import { registerBrowserTools } from './browser.js';
import { registerNavigationTools } from './navigation.js';
import { registerInteractionTools } from './interaction.js';
import { registerElementTools } from './element.js';
import { registerScreenshotTools } from './screenshot.js';
import { registerWindowTools } from './window.js';
import { registerFrameTools } from './frame.js';
import { registerAlertTools } from './alert.js';
import { registerCookieTools } from './cookie.js';
import { registerDiagnosticsTools } from './diagnostics.js';

/**
 * Register all tools on the MCP server.
 * @param {McpServer} server
 * @param {object} ctx - Shared context (config, policyEngine, sessionManager, auditLogger, redactor)
 */
export function registerAllTools(server, ctx) {
  registerBrowserTools(server, ctx);
  registerNavigationTools(server, ctx);
  registerInteractionTools(server, ctx);
  registerElementTools(server, ctx);
  registerScreenshotTools(server, ctx);
  registerWindowTools(server, ctx);
  registerFrameTools(server, ctx);
  registerAlertTools(server, ctx);
  registerCookieTools(server, ctx);
  registerDiagnosticsTools(server, ctx);
}
