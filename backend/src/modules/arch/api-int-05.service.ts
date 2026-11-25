/**
 * Architecture Service 95: MCP Server Interface
 * Subsystem: Model Context Protocol for IDE Agents
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export class McpServerInterfaceService {
  private tools = new Map<string, McpTool>();

  public registerTool(tool: McpTool): void {
    this.tools.set(tool.name, tool);
  }

  public listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  public async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error('Tool ' + name + ' not found');
    return await tool.handler(args);
  }
}
