import { z } from 'zod';

/**
 * Register window/tab management tools.
 */
export function registerWindowTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger } = ctx;

  server.registerTool(
    'window',
    {
      description: 'Manages browser windows and tabs',
      inputSchema: {
        action: z.enum(['list', 'switch', 'switch_latest', 'close']).describe('Window action'),
        handle: z.string().optional().describe('Window handle (for switch)'),
      },
    },
    async ({ action, handle }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('window', { action });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();

        switch (action) {
          case 'list': {
            const handles = await driver.getAllWindowHandles();
            const current = await driver.getWindowHandle();
            return { content: [{ type: 'text', text: JSON.stringify({ current, all: handles }, null, 2) }] };
          }
          case 'switch': {
            if (!handle) throw new Error('handle is required for switch');
            await driver.switchTo().window(handle);
            return { content: [{ type: 'text', text: `Switched to window: ${handle}` }] };
          }
          case 'switch_latest': {
            const handles = await driver.getAllWindowHandles();
            if (!handles.length) throw new Error('No windows available');
            const latest = handles[handles.length - 1];
            await driver.switchTo().window(latest);
            return { content: [{ type: 'text', text: `Switched to latest window: ${latest}` }] };
          }
          case 'close': {
            await driver.close();
            let handles = [];
            try { handles = await driver.getAllWindowHandles(); } catch { /* session gone */ }
            if (handles.length > 0) {
              await driver.switchTo().window(handles[0]);
              return { content: [{ type: 'text', text: `Window closed. Switched to: ${handles[0]}` }] };
            }
            await sessionManager.closeCurrent();
            return { content: [{ type: 'text', text: 'Last window closed. Session ended.' }] };
          }
        }
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error in window ${action}: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'window', params: { action }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );
}
