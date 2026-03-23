/**
 * Input Sanitizer — validates and sanitizes tool inputs at system boundary.
 * Protects against injection and malformed data.
 */
export class InputSanitizer {
  /**
   * Sanitize a URL string.
   * @param {string} url
   * @returns {string}
   */
  static sanitizeUrl(url) {
    if (typeof url !== 'string') {
      throw new Error('URL must be a string');
    }
    // Strip control characters
    return url.replace(/[\x00-\x1F\x7F]/g, '');
  }

  /**
   * Sanitize a locator value to prevent injection.
   * @param {string} value
   * @returns {string}
   */
  static sanitizeLocatorValue(value) {
    if (typeof value !== 'string') {
      throw new Error('Locator value must be a string');
    }
    // For XPath: no injection possible through selenium-webdriver's By.xpath
    // For CSS: strip null bytes
    return value.replace(/\x00/g, '');
  }

  /**
   * Sanitize script content — only called when execute_script is policy-allowed.
   * Rejects scripts containing known dangerous patterns.
   * @param {string} script
   * @returns {{ safe: boolean, reason?: string }}
   */
  static validateScript(script) {
    if (typeof script !== 'string') {
      return { safe: false, reason: 'Script must be a string' };
    }

    const dangerous = [
      { pattern: /\bfetch\s*\(/, reason: 'Network fetch() calls are not allowed' },
      { pattern: /\bXMLHttpRequest\b/, reason: 'XMLHttpRequest is not allowed' },
      { pattern: /\bWebSocket\b/, reason: 'WebSocket is not allowed' },
      { pattern: /\bimportScripts\b/, reason: 'importScripts is not allowed' },
      { pattern: /\beval\s*\(/, reason: 'eval() is not allowed' },
      { pattern: /\bFunction\s*\(/, reason: 'Function constructor is not allowed' },
    ];

    for (const { pattern, reason } of dangerous) {
      if (pattern.test(script)) {
        return { safe: false, reason };
      }
    }

    return { safe: true };
  }

  /**
   * Sanitize cookie values - strip control characters.
   */
  static sanitizeCookieValue(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\x00-\x1F\x7F]/g, '');
  }
}
