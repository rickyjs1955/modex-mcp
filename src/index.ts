import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { buildServer } from './server.js';

// Entry point: wire the modex MCP server to a stdio transport. MCP hosts
// (Claude Code, Cursor, …) launch this as a subprocess and speak JSON-RPC
// over stdin/stdout, so nothing else may be written to stdout.
async function main(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `modex-mcp failed to start: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
