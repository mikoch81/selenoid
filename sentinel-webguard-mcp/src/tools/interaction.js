import { z } from 'zod';
import pkg from 'selenium-webdriver';
const { until } = pkg;
import { resolveLocator } from '../utils/locator.js';
import { InputSanitizer } from '../security/sanitizer.js';

const locatorSchema = {
  by: z.enum(['id', 'css', 'xpath', 'name', 'tag', 'class']).describe('Locator strategy'),
  value: z.string().describe('Locator value'),
  timeout: z.number().optional().describe('Max wait in ms'),
};

/**
 * Register element interaction tools: interact, send_keys, press_key.
 */
export function registerInteractionTools(server, ctx) {
  const { sessionManager, auditLogger, policyEngine } = ctx;

  server.registerTool(
    'interact',
    {
      description: 'Performs a mouse action on an element',
      inputSchema: {
        action: z.enum(['click', 'doubleclick', 'rightclick', 'hover']).describe('Mouse action'),
        ...locatorSchema,
      },
    },
    async ({ action, by, value, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('interact', { action, by, value });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const locator = resolveLocator(by, InputSanitizer.sanitizeLocatorValue(value));
        const element = await driver.wait(until.elementLocated(locator), timeout);

        switch (action) {
          case 'click':
            await element.click();
            break;
          case 'doubleclick': {
            const actions = driver.actions({ bridge: true });
            await actions.doubleClick(element).perform();
            break;
          }
          case 'rightclick': {
            const actions = driver.actions({ bridge: true });
            await actions.contextClick(element).perform();
            break;
          }
          case 'hover': {
            const actions = driver.actions({ bridge: true });
            await actions.move({ origin: element }).perform();
            break;
          }
        }

        const result = { content: [{ type: 'text', text: `${action} performed` }] };
        auditLogger.logToolCall({ tool: 'interact', params: { action, by, value }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error performing ${action}: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'interact', params: { action, by, value }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );

  server.registerTool(
    'send_keys',
    {
      description: 'Types text into an element (clears first)',
      inputSchema: {
        ...locatorSchema,
        text: z.string().describe('Text to enter'),
      },
    },
    async ({ by, value, text, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('send_keys', { by, value });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const locator = resolveLocator(by, InputSanitizer.sanitizeLocatorValue(value));
        const element = await driver.wait(until.elementLocated(locator), timeout);
        await element.clear();
        await element.sendKeys(text);

        const result = { content: [{ type: 'text', text: `Text entered into element` }] };
        auditLogger.logToolCall({ tool: 'send_keys', params: { by, value, text: '[input]' }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error entering text: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'send_keys', params: { by, value }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );

  server.registerTool(
    'press_key',
    {
      description: 'Simulates pressing a keyboard key',
      inputSchema: {
        key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'a')"),
      },
    },
    async ({ key }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('press_key', { key });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const { Key } = pkg;
        const resolvedKey = key.length === 1
          ? key
          : Key[key.toUpperCase().replace(/ /g, '_')] ?? null;

        if (resolvedKey === null) {
          return {
            content: [{ type: 'text', text: `Unknown key: '${key}'. Use a single character or named key (Enter, Tab, Escape, etc.)` }],
            isError: true,
          };
        }

        const actions = driver.actions({ bridge: true });
        await actions.keyDown(resolvedKey).keyUp(resolvedKey).perform();

        const result = { content: [{ type: 'text', text: `Key '${key}' pressed` }] };
        auditLogger.logToolCall({ tool: 'press_key', params: { key }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error pressing key: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'press_key', params: { key }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );
}
