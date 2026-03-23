import { UrlAllowlist } from './url-allowlist.js';

/**
 * Policy Engine — central gatekeeper for all tool invocations.
 * Every tool call passes through the engine before execution.
 */
export class PolicyEngine {
  #config;
  #urlAllowlist;

  constructor(config) {
    this.#config = config;
    this.#urlAllowlist = new UrlAllowlist(config.url);
  }

  /**
   * Evaluate whether a tool invocation is permitted.
   * @param {string} toolName
   * @param {object} params - The tool's input parameters
   * @returns {{ allowed: boolean, reason: string, warnings: string[] }}
   */
  evaluate(toolName, params) {
    const warnings = [];

    // 1. Check if tool is explicitly disabled
    const toolPolicy = this.#config.tools[toolName];
    if (toolPolicy && !toolPolicy.enabled) {
      return {
        allowed: false,
        reason: `Tool "${toolName}" is disabled by security profile "${this.#config.profile}"`,
        warnings,
      };
    }

    // 2. Tool-specific policy checks
    switch (toolName) {
      case 'navigate':
        return this.#evaluateNavigate(params, warnings);

      case 'start_browser':
        return this.#evaluateStartBrowser(params, warnings);

      case 'execute_script':
        return this.#evaluateExecuteScript(params, warnings);

      case 'take_screenshot':
        return this.#evaluateScreenshot(params, warnings);

      case 'add_cookie':
        return this.#evaluateCookieWrite(warnings);

      case 'delete_cookie':
        return this.#evaluateCookieDelete(warnings);

      case 'upload_file':
        return this.#evaluateUpload(params, warnings);

      default:
        return { allowed: true, reason: 'No specific restrictions', warnings };
    }
  }

  /**
   * Validate a URL against the URL policy (used by navigate and other tools).
   */
  checkUrl(urlString) {
    return this.#urlAllowlist.check(urlString);
  }

  #evaluateNavigate(params, warnings) {
    if (!params.url) {
      return { allowed: false, reason: 'URL is required', warnings };
    }

    const urlCheck = this.#urlAllowlist.check(params.url);
    if (!urlCheck.allowed) {
      return { allowed: false, reason: urlCheck.reason, warnings };
    }

    return { allowed: true, reason: urlCheck.reason, warnings };
  }

  #evaluateStartBrowser(params, warnings) {
    const browser = params.browser;
    if (!this.#config.session.allowedBrowsers.includes(browser)) {
      return {
        allowed: false,
        reason: `Browser "${browser}" not allowed. Allowed: [${this.#config.session.allowedBrowsers.join(', ')}]`,
        warnings,
      };
    }

    if (params.options?.headless === false && this.#config.session.forceHeadless) {
      warnings.push('Headless mode is enforced by policy — ignoring headless=false');
    }

    return { allowed: true, reason: 'Browser permitted', warnings };
  }

  #evaluateExecuteScript(params, warnings) {
    if (!this.#config.script.allowExecuteScript) {
      return {
        allowed: false,
        reason: `execute_script is disabled by security profile "${this.#config.profile}"`,
        warnings,
      };
    }

    const allowedPatterns = this.#config.script.allowedScriptPatterns;
    if (allowedPatterns.length > 0 && params.script) {
      const scriptAllowed = allowedPatterns.some(pattern => {
        try {
          return new RegExp(pattern).test(params.script);
        } catch {
          return false;
        }
      });
      if (!scriptAllowed) {
        return {
          allowed: false,
          reason: 'Script content does not match any allowed pattern',
          warnings,
        };
      }
    }

    return { allowed: true, reason: 'Script execution permitted', warnings };
  }

  #evaluateScreenshot(params, warnings) {
    if (!this.#config.screenshot.allowed) {
      return {
        allowed: false,
        reason: `Screenshots disabled by security profile "${this.#config.profile}"`,
        warnings,
      };
    }

    return { allowed: true, reason: 'Screenshot permitted', warnings };
  }

  #evaluateCookieWrite(warnings) {
    if (!this.#config.cookie.allowWrite) {
      return {
        allowed: false,
        reason: `Cookie writing disabled by security profile "${this.#config.profile}"`,
        warnings,
      };
    }
    return { allowed: true, reason: 'Cookie write permitted', warnings };
  }

  #evaluateCookieDelete(warnings) {
    if (!this.#config.cookie.allowDelete) {
      return {
        allowed: false,
        reason: `Cookie deletion disabled by security profile "${this.#config.profile}"`,
        warnings,
      };
    }
    return { allowed: true, reason: 'Cookie delete permitted', warnings };
  }

  #evaluateUpload(params, warnings) {
    if (params.filePath) {
      // Prevent path traversal
      const normalized = params.filePath.replace(/\\/g, '/');
      if (normalized.includes('..')) {
        return {
          allowed: false,
          reason: 'Path traversal detected in filePath',
          warnings,
        };
      }
    }
    return { allowed: true, reason: 'Upload permitted', warnings };
  }
}
