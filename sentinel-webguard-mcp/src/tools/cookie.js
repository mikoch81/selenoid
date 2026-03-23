import { z } from 'zod';
import { InputSanitizer } from '../security/sanitizer.js';

/**
 * Register cookie management tools with policy controls.
 */
export function registerCookieTools(server, ctx) {
  const { config, policyEngine, sessionManager, auditLogger, redactor } = ctx;

  server.registerTool(
    'add_cookie',
    {
      description: 'Adds a cookie to the current browser session (subject to cookie write policy)',
      inputSchema: {
        name: z.string().describe('Cookie name'),
        value: z.string().describe('Cookie value'),
        domain: z.string().optional().describe('Cookie domain'),
        path: z.string().optional().describe('Cookie path'),
        secure: z.boolean().optional().describe('Secure flag'),
        httpOnly: z.boolean().optional().describe('HttpOnly flag'),
        expiry: z.number().optional().describe('Unix timestamp expiry'),
      },
    },
    async ({ name, value, domain, path, secure, httpOnly, expiry }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('add_cookie', { name });

      if (!policyResult.allowed) {
        auditLogger.logSecurity({ event: 'cookie_write_blocked', tool: 'add_cookie', details: { name }, severity: 'warning' });
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        const cookie = {
          name: InputSanitizer.sanitizeCookieValue(name),
          value: InputSanitizer.sanitizeCookieValue(value),
        };
        if (domain !== undefined) cookie.domain = domain;
        if (path !== undefined) cookie.path = path;
        if (secure !== undefined) cookie.secure = secure;
        if (httpOnly !== undefined) cookie.httpOnly = httpOnly;
        if (expiry !== undefined) cookie.expiry = expiry;

        await driver.manage().addCookie(cookie);

        const result = { content: [{ type: 'text', text: `Cookie "${name}" added` }] };
        auditLogger.logToolCall({ tool: 'add_cookie', params: { name, value: '[redacted]' }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error adding cookie: ${e.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'get_cookies',
    {
      description: 'Retrieves cookies (values are redacted in banking profile)',
      inputSchema: {
        name: z.string().optional().describe('Specific cookie name, or omit for all'),
      },
    },
    async ({ name }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('get_cookies', { name });
      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        let cookies;

        if (name) {
          const { error: seleniumError } = pkg;
          try {
            cookies = await driver.manage().getCookie(name);
            if (!cookies) {
              return { content: [{ type: 'text', text: `Cookie "${name}" not found` }], isError: true };
            }
          } catch (cookieError) {
            if (cookieError?.constructor?.name === 'NoSuchCookieError') {
              return { content: [{ type: 'text', text: `Cookie "${name}" not found` }], isError: true };
            }
            throw cookieError;
          }
        } else {
          cookies = await driver.manage().getCookies();
        }

        // Redact cookie values if policy requires it
        let output;
        if (config.cookie.redactValuesInLogs) {
          const redacted = Array.isArray(cookies)
            ? cookies.map(c => ({ ...c, value: '[redacted]' }))
            : { ...cookies, value: '[redacted]' };
          output = JSON.stringify(redacted, null, 2);
        } else {
          output = JSON.stringify(cookies, null, 2);
        }

        const result = { content: [{ type: 'text', text: output }] };
        auditLogger.logToolCall({ tool: 'get_cookies', params: { name }, policyResult, result, durationMs: Date.now() - start, sessionId: sessionManager.currentSessionId });
        return result;
      } catch (e) {
        return { content: [{ type: 'text', text: `Error getting cookies: ${e.message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    'delete_cookie',
    {
      description: 'Deletes cookies (subject to cookie delete policy)',
      inputSchema: {
        name: z.string().optional().describe('Cookie name to delete, or omit for all'),
      },
    },
    async ({ name }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('delete_cookie', { name });

      if (!policyResult.allowed) {
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        const driver = sessionManager.getDriver();
        if (name) {
          await driver.manage().deleteCookie(name);
          return { content: [{ type: 'text', text: `Cookie "${name}" deleted` }] };
        } else {
          await driver.manage().deleteAllCookies();
          return { content: [{ type: 'text', text: 'All cookies deleted' }] };
        }
      } catch (e) {
        return { content: [{ type: 'text', text: `Error deleting cookies: ${e.message}` }], isError: true };
      }
    }
  );
}

// Import selenium error types
import pkg from 'selenium-webdriver';
