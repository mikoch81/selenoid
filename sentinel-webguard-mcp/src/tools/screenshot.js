import { z } from 'zod';

/**
 * Register screenshot tool with policy-controlled limits.
 */
export function registerScreenshotTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger } = ctx;

  server.registerTool(
    'take_screenshot',
    {
      description: 'Captures a screenshot of the current page (subject to rate limits)',
      inputSchema: {},
    },
    async () => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('take_screenshot', {});

      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      // Check screenshot limit
      const track = sessionManager.trackScreenshot();
      if (!track.allowed) {
        auditLogger.logSecurity({ event: 'screenshot_limit', tool: 'take_screenshot', details: { count: track.count, max: track.max }, severity: 'warning' });
        return { content: [{ type: 'text', text: `Screenshot limit reached (${track.count}/${track.max} per session)` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const screenshot = await driver.takeScreenshot();

        const result = {
          content: [{ type: 'image', data: screenshot, mimeType: 'image/png' }],
        };
        auditLogger.logToolCall({ tool: 'take_screenshot', params: {}, policyResult, result: { content: [{ type: 'text', text: `[screenshot ${track.count}/${track.max || '∞'}]` }] }, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error taking screenshot: ${e.message}` }], isError: true };
      }
    }
  );
}
