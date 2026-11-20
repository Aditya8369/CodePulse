import { WorkspaceStateService } from './workspace-state.service';
import { RocksDbService } from './rocksdb.service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('WorkspaceStateService (#457)', () => {
  let workspaceState: WorkspaceStateService;
  let rocksDb: RocksDbService;
  let tempDbDir: string;

  beforeEach(async () => {
    tempDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-state-test-'));
    rocksDb = new RocksDbService({ dbPath: tempDbDir });
    await rocksDb.onModuleInit();
    workspaceState = new WorkspaceStateService(rocksDb);
  });

  afterEach(async () => {
    await rocksDb.onModuleDestroy();
    try {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('Unsaved Editor Drafts', () => {
    it('saves and retrieves unsaved file drafts under ws:{userId}:{fileId}', async () => {
      const draft = {
        userId: 'dev-42',
        fileId: 'file-xyz',
        filePath: 'src/app.tsx',
        content: 'const App = () => <div>Hello</div>;',
        cursorLine: 5,
        cursorColumn: 12,
        lastModified: Date.now(),
      };

      await workspaceState.saveDraft(draft);
      const retrieved = await workspaceState.getDraft('dev-42', 'file-xyz');

      expect(retrieved).toMatchObject(draft);
    });

    it('lists all unsaved drafts across workspace for a given user', async () => {
      await workspaceState.saveDraft({
        userId: 'user-a',
        fileId: 'f1',
        filePath: 'a.ts',
        content: 'a',
        lastModified: Date.now(),
      });
      await workspaceState.saveDraft({
        userId: 'user-a',
        fileId: 'f2',
        filePath: 'b.ts',
        content: 'b',
        lastModified: Date.now(),
      });
      await workspaceState.saveDraft({
        userId: 'user-b',
        fileId: 'f3',
        filePath: 'c.ts',
        content: 'c',
        lastModified: Date.now(),
      });

      const userADrafts = await workspaceState.getUserDrafts('user-a');
      expect(userADrafts).toHaveLength(2);
      expect(userADrafts.map((d) => d.fileId).sort()).toEqual(['f1', 'f2']);
    });
  });

  describe('Monaco Breakpoints & Terminal Session History', () => {
    it('stores and retrieves Monaco breakpoint state', async () => {
      const bpState = {
        userId: 'user-dbg',
        fileId: 'main.ts',
        breakpoints: [
          { lineNumber: 15, enabled: true },
          { lineNumber: 32, condition: 'i > 10', enabled: true },
        ],
      };

      await workspaceState.saveBreakpoints(bpState);
      const retrieved = await workspaceState.getBreakpoints('user-dbg', 'main.ts');

      expect(retrieved).toMatchObject(bpState);
    });

    it('appends and reads terminal command histories', async () => {
      await workspaceState.appendTerminalHistory('user-term', 'sess-1', 'npm install', 0);
      await workspaceState.appendTerminalHistory('user-term', 'sess-1', 'npm test', 0);

      const history = await workspaceState.getTerminalHistory('user-term', 'sess-1');
      expect(history?.commands).toHaveLength(2);
      expect(history?.commands[0].command).toBe('npm install');
      expect(history?.commands[1].command).toBe('npm test');
    });
  });

  describe('Commit Flush', () => {
    it('flushes committed drafts from RocksDB when finalized to avoid disk bloat', async () => {
      await workspaceState.saveDraft({
        userId: 'dev-commit',
        fileId: 'file-1',
        filePath: 'index.ts',
        content: 'export const X = 1;',
        lastModified: Date.now(),
      });

      const flushResult = await workspaceState.flushCommittedDrafts(
        'dev-commit',
        ['file-1'],
        'commit-sha-abc',
      );

      expect(flushResult.flushedFilesCount).toBe(1);
      expect(flushResult.totalBytesWritten).toBeGreaterThan(0);

      // Draft deleted from RocksDB upon flush
      expect(await workspaceState.getDraft('dev-commit', 'file-1')).toBeNull();
    });
  });
});

