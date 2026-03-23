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
 * Register element utility tools: get_element_text, get_element_attribute, execute_script, upload_file.
 */
export function registerElementTools(server, ctx) {
  const { policyEngine, sessionManager, auditLogger, redactor } = ctx;

  server.registerTool(
    'get_element_text',
    {
      description: 'Gets the text content of an element',
      inputSchema: { ...locatorSchema },
    },
    async ({ by, value, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('get_element_text', { by, value });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const locator = resolveLocator(by, InputSanitizer.sanitizeLocatorValue(value));
        const element = await driver.wait(until.elementLocated(locator), timeout);
        const text = await element.getText();
        const redacted = redactor.redact(text);

        const result = { content: [{ type: 'text', text: redacted.text }] };
        if (redacted.redactions.length) {
          auditLogger.logSecurity({ event: 'pii_redacted', tool: 'get_element_text', details: { patterns: redacted.redactions }, severity: 'info' });
        }
        auditLogger.logToolCall({ tool: 'get_element_text', params: { by, value }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error getting text: ${e.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'get_element_attribute',
    {
      description: 'Gets the value of an attribute on an element',
      inputSchema: {
        ...locatorSchema,
        attribute: z.string().describe("Attribute name (e.g., 'href', 'value', 'class')"),
      },
    },
    async ({ by, value, attribute, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('get_element_attribute', { by, value, attribute });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const locator = resolveLocator(by, InputSanitizer.sanitizeLocatorValue(value));
        const element = await driver.wait(until.elementLocated(locator), timeout);
        const attrValue = await element.getAttribute(attribute);
        const redacted = redactor.redact(attrValue ?? '');

        const result = { content: [{ type: 'text', text: redacted.text }] };
        auditLogger.logToolCall({ tool: 'get_element_attribute', params: { by, value, attribute }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error getting attribute: ${e.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'execute_script',
    {
      description: 'Executes JavaScript in the browser (restricted by policy). Use for advanced interactions not covered by other tools.',
      inputSchema: {
        script: z.string().describe('JavaScript code to execute'),
        args: z.array(z.any()).optional().describe('Arguments (accessible via arguments[0], etc.)'),
      },
    },
    async ({ script, args = [] }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('execute_script', { script });

      if (!policyResult.allowed) {
        auditLogger.logSecurity({ event: 'script_blocked', tool: 'execute_script', details: { reason: policyResult.reason }, severity: 'warning' });
        auditLogger.logToolCall({ tool: 'execute_script', params: { script: '[blocked]' }, policyResult, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      // Additional sanitization check
      const validation = InputSanitizer.validateScript(script);
      if (!validation.safe) {
        auditLogger.logSecurity({ event: 'script_unsafe', tool: 'execute_script', details: { reason: validation.reason }, severity: 'warning' });
        return { content: [{ type: 'text', text: `Script blocked: ${validation.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const rawResult = await driver.executeScript(script, ...args);
        const text = rawResult === undefined || rawResult === null
          ? 'Script executed (no return value)'
          : typeof rawResult === 'object' ? JSON.stringify(rawResult, null, 2) : String(rawResult);

        const redacted = redactor.redact(text);
        const result = { content: [{ type: 'text', text: redacted.text }] };
        auditLogger.logToolCall({ tool: 'execute_script', params: { script: script.slice(0, 200) }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error executing script: ${e.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'upload_file',
    {
      description: 'Uploads a file using a file input element',
      inputSchema: {
        ...locatorSchema,
        filePath: z.string().describe('Absolute path to file'),
      },
    },
    async ({ by, value, filePath, timeout = 10000 }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('upload_file', { by, value, filePath });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const locator = resolveLocator(by, InputSanitizer.sanitizeLocatorValue(value));
        const element = await driver.wait(until.elementLocated(locator), timeout);
        await element.sendKeys(filePath);

        const result = { content: [{ type: 'text', text: 'File upload initiated' }] };
        auditLogger.logToolCall({ tool: 'upload_file', params: { by, value, filePath }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error uploading file: ${e.message}` }], isError: true };
      }
    }
  );
}
