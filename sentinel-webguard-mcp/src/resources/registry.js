import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'fs';

/**
 * Register all MCP resources.
 */
export function registerAllResources(server, ctx) {
  const { sessionManager, redactor } = ctx;

  // Load browser-side accessibility script once at startup
  const accessibilityScript = readFileSync(
    new URL('../../scripts/accessibility-snapshot.js', import.meta.url),
    'utf-8'
  );

  server.registerResource(
    'browser-status',
    'browser-status://current',
    {
      description: 'Current browser session status and security profile',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const sessionId = sessionManager.currentSessionId;
      const sessions = sessionManager.listSessions();

      const text = sessionId
        ? `Active: ${sessionId}\nTotal sessions: ${sessions.length}\nProfile: ${ctx.config.profile}`
        : `No active browser session\nProfile: ${ctx.config.profile}`;

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/plain',
          text,
        }],
      };
    }
  );

  server.registerResource(
    'accessibility-snapshot',
    'accessibility://current',
    {
      description: 'Accessibility tree snapshot — structured representation of page elements for finding locators',
      mimeType: 'application/json',
    },
    async (uri) => {
      const session = sessionManager.getSession();
      if (!session) {
        throw new McpError(-32002, 'No active browser session. Start a browser first.');
      }

      try {
        const tree = await session.driver.executeScript(accessibilityScript) || {};
        let json = JSON.stringify(tree, null, 2);

        // Redact PII in accessibility tree output
        const redacted = redactor.redact(json);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: redacted.text,
          }],
        };
      } catch (e) {
        if (e instanceof McpError) throw e;
        throw new McpError(ErrorCode.InternalError, `Failed to capture accessibility snapshot: ${e.message}`);
      }
    }
  );
}
