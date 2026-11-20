import { Test, TestingModule } from '@nestjs/testing';
import { WhiteboardService, VectorShape } from './whiteboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('WhiteboardService & Architecture Canvas', () => {
  let service: WhiteboardService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      battleWhiteboard: {
        upsert: jest.fn().mockImplementation(({ create, update }) => {
          return Promise.resolve({ id: 'wb-123', ...(create || update) });
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhiteboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WhiteboardService>(WhiteboardService);
  });

  it('creates and retrieves a new whiteboard session', () => {
    const board = service.getOrCreateWhiteboard('battle_arc_1');
    expect(board.battleId).toBe('battle_arc_1');
    expect(board.version).toBe(1);
    expect(board.shapes).toEqual({});
  });

  it('applies shape updates with lock-free state reconciliation', () => {
    const battleId = 'battle_arc_2';
    const shape1: VectorShape = {
      id: 'srv_1',
      type: 'microservice',
      x: 100,
      y: 150,
      width: 140,
      height: 60,
      label: 'Auth Service',
      color: '#38bdf8',
      authorId: 'user_dev_a',
      version: 1,
      updatedAt: Date.now(),
    };

    const res = service.applyShapeUpdate(battleId, shape1);
    expect(res.shape.label).toBe('Auth Service');
    expect(res.snapshotVersion).toBe(2);

    // Newer version overrides previous version
    const updatedShape: VectorShape = {
      ...shape1,
      label: 'Auth & Session Service',
      version: 2,
    };
    const res2 = service.applyShapeUpdate(battleId, updatedShape);
    expect(res2.shape.label).toBe('Auth & Session Service');

    // Stale version is rejected / ignored
    const staleShape: VectorShape = {
      ...shape1,
      label: 'Stale Overwrite',
      version: 1,
    };
    const res3 = service.applyShapeUpdate(battleId, staleShape);
    expect(res3.shape.label).toBe('Auth & Session Service');
  });

  it('filters shapes by spatial indexing (bounding box)', () => {
    const battleId = 'battle_arc_spatial';
    service.applyShapeUpdate(battleId, {
      id: 'shape_near',
      type: 'box',
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      color: '#ffffff',
      authorId: 'u1',
      version: 1,
      updatedAt: Date.now(),
    });

    service.applyShapeUpdate(battleId, {
      id: 'shape_far',
      type: 'database',
      x: 2000,
      y: 2000,
      width: 120,
      height: 80,
      color: '#ffffff',
      authorId: 'u2',
      version: 1,
      updatedAt: Date.now(),
    });

    const inView = service.getShapesInViewport(battleId, {
      minX: 0,
      minY: 0,
      maxX: 500,
      maxY: 500,
    });

    expect(inView.length).toBe(1);
    expect(inView[0].id).toBe('shape_near');
  });

  it('compresses and decompresses binary shape delta updates', () => {
    const shapes: VectorShape[] = [
      {
        id: 'db_1',
        type: 'database',
        x: 300,
        y: 400,
        width: 100,
        height: 80,
        label: 'PostgreSQL Cluster',
        color: '#10b981',
        authorId: 'architect_1',
        version: 1,
        updatedAt: Date.now(),
      },
    ];

    const compressed = service.compressDelta(shapes);
    expect(Buffer.isBuffer(compressed)).toBe(true);

    const decompressed = service.decompressDelta(compressed);
    expect(decompressed.length).toBe(1);
    expect(decompressed[0].label).toBe('PostgreSQL Cluster');
  });

  it('exports whiteboard layout to SVG and Mermaid.js diagrams', async () => {
    const battleId = 'battle_export_test';
    service.applyShapeUpdate(battleId, {
      id: 'svc_api',
      type: 'microservice',
      x: 100,
      y: 100,
      width: 120,
      height: 60,
      label: 'Gateway API',
      color: '#38bdf8',
      authorId: 'u1',
      version: 1,
      updatedAt: Date.now(),
    });

    service.applyShapeUpdate(battleId, {
      id: 'db_main',
      type: 'database',
      x: 300,
      y: 100,
      width: 100,
      height: 80,
      label: 'Main DB',
      color: '#10b981',
      authorId: 'u1',
      version: 1,
      updatedAt: Date.now(),
    });

    service.applyShapeUpdate(battleId, {
      id: 'arrow_1',
      type: 'arrow',
      x: 220,
      y: 130,
      width: 80,
      height: 0,
      color: '#38bdf8',
      fromNodeId: 'svc_api',
      toNodeId: 'db_main',
      label: 'reads/writes',
      authorId: 'u1',
      version: 1,
      updatedAt: Date.now(),
    });

    const svg = service.exportToSvg(battleId);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Gateway API');
    expect(svg).toContain('Main DB');

    const mermaid = service.exportToMermaid(battleId);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('svc_api["⚙️ Gateway API"]');
    expect(mermaid).toContain('db_main[("Main DB")]');
    expect(mermaid).toContain('svc_api -->|reads/writes| db_main');

    // Snapshot save in DB
    const saved = await service.saveSnapshotToDb(battleId);
    expect(mockPrisma.battleWhiteboard.upsert).toHaveBeenCalled();
    expect(saved.battleId).toBe(battleId);
  });
});
