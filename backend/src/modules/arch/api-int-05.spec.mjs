import { describe, it } from 'node:test';
import assert from 'node:assert';
import { McpServerInterfaceService } from './api-int-05.service.ts';

describe('McpServerInterfaceService (API-INT-05)', () => {
  it('exposes Model Context Protocol tool endpoints and executes tool calls', async () => {
    const mcp = new McpServerInterfaceService();
    mcp.registerTool({
      name: 'getChallengeDetails',
      description: 'Fetch challenge by id',
      inputSchema: { type: 'object' },
      handler: args => ({ id: args.id, title: 'Inverted Index' })
    });

    const tools = mcp.listTools();
    assert.strictEqual(tools.length, 1);
    assert.strictEqual(tools[0].name, 'getChallengeDetails');

    const res = await mcp.callTool('getChallengeDetails', { id: 101 });
    assert.deepStrictEqual(res, { id: 101, title: 'Inverted Index' });
  });
});
