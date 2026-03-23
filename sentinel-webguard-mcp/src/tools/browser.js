import { z } from 'zod';
import pkg from 'selenium-webdriver';
const { Builder } = pkg;
import { Options as ChromeOptions } from 'selenium-webdriver/chrome.js';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox.js';
import { Options as EdgeOptions } from 'selenium-webdriver/edge.js';
import { isBidiAvailable, setupBidi } from '../utils/bidi.js';

/**
 * Register browser management tools: start_browser, close_session.
 */
export function registerBrowserTools(server, ctx) {
  const { config, policyEngine, sessionManager, auditLogger } = ctx;

  server.registerTool(
    'start_browser',
    {
      description: 'Launches a browser session with the configured security profile',
      inputSchema: {
        browser: z.enum(['chrome', 'firefox', 'edge']).describe('Browser to launch'),
        options: z.object({
          headless: z.boolean().optional().describe('Run in headless mode'),
          arguments: z.array(z.string()).optional().describe('Additional browser arguments'),
        }).optional(),
      },
    },
    async ({ browser, options = {} }) => {
      const start = Date.now();
      const policyResult = policyEngine.evaluate('start_browser', { browser, options });

      if (!policyResult.allowed) {
        auditLogger.logToolCall({ tool: 'start_browser', params: { browser }, policyResult, durationMs: Date.now() - start });
        return { content: [{ type: 'text', text: `Policy denied: ${policyResult.reason}` }], isError: true };
      }

      try {
        let builder = new Builder();
        const warnings = [...(policyResult.warnings || [])];

        // Force headless if policy requires it
        const headless = config.session.forceHeadless || options.headless !== false;

        // Merge default arguments with user-provided
        const args = [...config.session.defaultArguments, ...(options.arguments || [])];

        // Enable BiDi if available
        if (isBidiAvailable()) {
          builder = builder.withCapabilities({
            webSocketUrl: true,
            unhandledPromptBehavior: 'ignore',
          });
        }

        let driver;
        switch (browser) {
          case 'chrome': {
            const opts = new ChromeOptions();
            if (headless) opts.addArguments('--headless=new');
            args.forEach(arg => opts.addArguments(arg));
            driver = await builder.forBrowser('chrome').setChromeOptions(opts).build();
            break;
          }
          case 'firefox': {
            const opts = new FirefoxOptions();
            if (headless) opts.addArguments('--headless');
            args.forEach(arg => opts.addArguments(arg));
            driver = await builder.forBrowser('firefox').setFirefoxOptions(opts).build();
            break;
          }
          case 'edge': {
            const opts = new EdgeOptions();
            if (headless) opts.addArguments('--headless=new');
            args.forEach(arg => opts.addArguments(arg));
            driver = await builder.forBrowser('edge').setEdgeOptions(opts).build();
            break;
          }
        }

        // Setup BiDi diagnostics
        let bidiState = null;
        if (isBidiAvailable()) {
          try {
            bidiState = await setupBidi(driver);
          } catch {
            // BiDi not supported by this browser — continue without it
          }
        }

        const sessionId = sessionManager.create(browser, driver, bidiState);

        let message = `Browser started: ${sessionId}`;
        if (bidiState?.available) {
          message += ' (BiDi: console logs, JS errors, network activity captured)';
        }
        if (warnings.length) {
          message += `\nWarnings: ${warnings.join('; ')}`;
        }

        const result = { content: [{ type: 'text', text: message }] };
        auditLogger.logToolCall({ tool: 'start_browser', params: { browser }, policyResult, result, durationMs: Date.now() - start, sessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error starting browser: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'start_browser', params: { browser }, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );

  server.registerTool(
    'close_session',
    {
      description: 'Closes the current browser session and cleans up resources',
      inputSchema: {},
    },
    async () => {
      const start = Date.now();
      const policyResult = { allowed: true, reason: 'Always allowed', warnings: [] };

      try {
        const sessionId = sessionManager.currentSessionId;
        await sessionManager.closeCurrent();

        const result = { content: [{ type: 'text', text: `Session ${sessionId} closed` }] };
        auditLogger.logToolCall({ tool: 'close_session', params: {}, policyResult, result, durationMs: Date.now() - start, sessionId });
        return result;
      } catch (e) {
        const result = { content: [{ type: 'text', text: `Error closing session: ${e.message}` }], isError: true };
        auditLogger.logToolCall({ tool: 'close_session', params: {}, policyResult, result, durationMs: Date.now() - start });
        return result;
      }
    }
  );
}
