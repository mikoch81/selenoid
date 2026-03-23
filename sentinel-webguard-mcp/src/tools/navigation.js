import { z } from 'zod';
import { InputSanitizer } from '../security/sanitizer.js';

/**
 * Register navigation tools: navigate.
 */
export function registerNavigationTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger, redactor } = ctx;

  server.registerTool(
    'navigate',
    {
      description: 'Navigates to a URL (subject to URL allowlist policy)',
      inputSchema: {
        url: z.string().describe('URL to navigate to'),
      },
    },
    async ({ url }) => {
      const start = Date.now();
      const sanitizedUrl = InputSanitizer.sanitizeUrl(url);
      const policyResult = policyEngine.evaluate('navigate', { url: sanitizedUrl });

      if (!policyResult.allowed) {
        auditLogger.logSecurity({ event: 'url_blocked', tool: 'navigate', details: { url: redactor.redact(sanitizedUrl).text }, severity: 'warning' });
        auditLogger.logToolCall({ tool: 'navigate', params: { url: sanitizedUrl }, policyResult, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        await driver.get(sanitizedUrl);

        const result = { content: [{ type: 'text', text: `Navigated to ${redactor.redact(sanitizedUrl).text}` }] };
        auditLogger.logToolCall({ tool: 'navigate', params: { url: sanitizedUrl }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error navigating: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'navigate', params: { url: sanitizedUrl }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );
}
