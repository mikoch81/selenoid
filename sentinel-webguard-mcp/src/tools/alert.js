import { z } from 'zod';
import pkg from 'selenium-webdriver';
const { until } = pkg;

/**
 * Register alert/dialog handling tools.
 */
export function registerAlertTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger } = ctx;

  server.registerTool(
    'alert',
    {
      description: 'Handles browser alert, confirm, or prompt dialogs',
      inputSchema: {
        action: z.enum(['accept', 'dismiss', 'get_text', 'send_text']).describe('Alert action'),
        text: z.string().optional().describe('Text for send_text'),
        timeout: z.number().optional().describe('Max wait in ms'),
      },
    },
    async ({ action, text, timeout = 5000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('alert', { action });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        await driver.wait(until.alertIsPresent(), timeout);
        const alertObj = await driver.switchTo().alert();

        let result;
        switch (action) {
          case 'accept':
            await alertObj.accept();
            result = { content: [{ type: 'text', text: 'Alert accepted' }] };
            break;
          case 'dismiss':
            await alertObj.dismiss();
            result = { content: [{ type: 'text', text: 'Alert dismissed' }] };
            break;
          case 'get_text': {
            const alertText = await alertObj.getText();
            result = { content: [{ type: 'text', text: alertText }] };
            break;
          }
          case 'send_text': {
            if (text === undefined) throw new Error('text is required for send_text');
            await alertObj.sendKeys(text);
            await alertObj.accept();
            result = { content: [{ type: 'text', text: `Text sent and prompt accepted` }] };
            break;
          }
        }

        auditLogger.logToolCall({ tool: 'alert', params: { action }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error in alert ${action}: ${e.message}` }], isError: true };
      }
    }
  );
}
