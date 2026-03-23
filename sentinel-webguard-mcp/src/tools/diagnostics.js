import { z } from 'zod';

const DIAGNOSTIC_TYPES = {
  console: { logKey: 'consoleLogs', emptyMessage: 'No console logs captured' },
  errors: { logKey: 'pageErrors', emptyMessage: 'No page errors captured' },
  network: { logKey: 'networkLogs', emptyMessage: 'No network activity captured' },
};

/**
 * Register BiDi diagnostic tools.
 */
export function registerDiagnosticsTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger, redactor } = ctx;

  server.registerTool(
    'diagnostics',
    {
      description: 'Retrieves browser diagnostics (console, JS errors, network) via WebDriver BiDi',
      inputSchema: {
        type: z.enum(['console', 'errors', 'network']).describe('Diagnostic type'),
        clear: z.boolean().optional().describe('Clear after returning (default: false)'),
      },
    },
    async ({ type, clear = false }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('diagnostics', { type });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        sessionManager.getDriver(); // Ensure active session
        const bidi = sessionManager.getBidi();

        if (!bidi?.available) {
          return { content: [{ type: 'text', text: 'Diagnostics not available (BiDi not supported)' }] };
        }

        const { logKey, emptyMessage } = DIAGNOSTIC_TYPES[type];
        const logs = bidi[logKey];
        let text = logs.length === 0 ? emptyMessage : JSON.stringify(logs, null, 2);

        // Redact PII from diagnostic output
        const redacted = redactor.redact(text);
        if (redacted.redactions.length) {
          auditLogger.logSecurity({ event: 'pii_redacted', tool: 'diagnostics', details: { patterns: redacted.redactions }, severity: 'info' });
        }

        if (clear) bidi[logKey] = [];

        const result = { content: [{ type: 'text', text: redacted.text }] };
        auditLogger.logToolCall({ tool: 'diagnostics', params: { type, clear }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error getting diagnostics: ${e.message}` }], isError: true };
      }
    }
  );
}
