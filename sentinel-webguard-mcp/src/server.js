import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { loadConfig } from './config/loader.js';
import { PolicyEngine } from './policy/engine.js';
import { PiiRedactor } from './security/pii-redactor.js';
import { AuditLogger } from './security/audit-logger.js';
import { SessionManager } from './session/manager.js';
import { loadBidiModules } from './utils/bidi.js';
import { registerAllTools } from './tools/registry.js';
import { registerAllResources } from './resources/registry.js';

/**
 * Create and configure the Sentinel WebGuard MCP server.
 * @param {string} [configPath] - Optional path to config JSON file
 * @returns {{ server: McpServer, sessionManager: SessionManager, config: object }}
 */
export async function createServer(configPath) {
  // 1. Load configuration with profile defaults + overrides
  const config = loadConfig(configPath);

  // 2. Initialize security components
  const redactor = new PiiRedactor(config.redaction);
  const auditLogger = new AuditLogger(config.audit, redactor);
  const policyEngine = new PolicyEngine(config);
  const sessionManager = new SessionManager(config, auditLogger);

  // 3. Load BiDi modules (non-blocking)
  await loadBidiModules();

  // 4. Create MCP server
  const server = new McpServer(
    { name: config.server.name, version: config.server.version },
    {
      instructions: [
        'Sentinel WebGuard MCP — banking-grade browser automation.',
        `Security profile: ${config.profile}.`,
        config.url.mode === 'allowlist'
          ? `URL navigation restricted to allowlist: [${config.url.patterns.join(', ')}].`
          : config.url.mode === 'blocklist'
            ? 'URL navigation uses blocklist mode.'
            : 'URL navigation is unrestricted.',
        !config.script.allowExecuteScript
          ? 'execute_script is DISABLED by policy.'
          : 'execute_script is enabled (use responsibly).',
        'Use accessibility://current resource to understand page content before interacting.',
      ].join(' '),
    }
  );

  // 5. Shared context passed to all tool/resource registrations
  const ctx = {
    config,
    policyEngine,
    sessionManager,
    auditLogger,
    redactor,
  };

  // 6. Register tools and resources
  registerAllTools(server, ctx);
  registerAllResources(server, ctx);

  // 7. Log server startup
  auditLogger.logSession({
    event: 'server_started',
    sessionId: null,
    browser: null,
    details: {
      profile: config.profile,
      urlMode: config.url.mode,
      allowedBrowsers: config.session.allowedBrowsers,
      executeScriptEnabled: config.script.allowExecuteScript,
    },
  });

  return { mcpServer: server, sessionManager, config, policyEngine, redactor, auditLogger };
}
