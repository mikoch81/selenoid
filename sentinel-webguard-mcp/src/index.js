#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

async function main() {
  const configPath = process.argv[2] || undefined;

  const { mcpServer, sessionManager, config } = await createServer(configPath);

  // Graceful shutdown
  async function cleanup() {
    try {
      await sessionManager.closeAll();
    } catch {
      // Best-effort cleanup
    }
    process.exit(0);
  }

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  console.error(`Sentinel WebGuard MCP failed to start: ${err.message}`);
  process.exit(1);
});
