import { z } from 'zod';
import pkg from 'selenium-webdriver';
const { until } = pkg;
import { resolveLocator } from '../utils/locator.js';

/**
 * Register frame management tools.
 */
export function registerFrameTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger } = ctx;

  server.registerTool(
    'frame',
    {
      description: 'Switches focus to a frame or back to main page',
      inputSchema: {
        action: z.enum(['switch', 'default']).describe('Frame action'),
        by: z.enum(['id', 'css', 'xpath', 'name', 'tag', 'class']).optional().describe('Locator strategy for frame'),
        value: z.string().optional().describe('Locator value'),
        index: z.number().optional().describe('Frame index (0-based)'),
        timeout: z.number().optional().describe('Max wait in ms'),
      },
    },
    async ({ action, by, value, index, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('frame', { action });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();

        if (action === 'default') {
          await driver.switchTo().defaultContent();
          return { content: [{ type: 'text', text: 'Switched to default content' }] };
        }

        if (index !== undefined) {
          await driver.switchTo().frame(index);
        } else if (by && value) {
          const locator = resolveLocator(by, value);
          const element = await driver.wait(until.elementLocated(locator), timeout);
          await driver.switchTo().frame(element);
        } else {
          throw new Error('Provide by/value or index');
        }

        const result = { content: [{ type: 'text', text: 'Switched to frame' }] };
        auditLogger.logToolCall({ tool: 'frame', params: { action, by, value, index }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error in frame ${action}: ${e.message}` }], isError: true };
      }
    }
  );
}
