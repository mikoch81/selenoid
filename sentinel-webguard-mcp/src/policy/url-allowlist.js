/**
 * URL Allowlist — validates navigation targets against configured policy.
 * Supports glob-like domain patterns and exact path matching.
 */

export class UrlAllowlist {
  #mode;
  #patterns;
  #compiled;

  constructor(urlPolicy) {
    this.#mode = urlPolicy.mode;
    this.#patterns = urlPolicy.patterns;
    this.#compiled = this.#patterns.map(p => this.#compilePattern(p));
  }

  /**
   * Check if a URL is allowed by the current policy.
   * @param {string} urlString
   * @returns {{ allowed: boolean, reason: string }}
   */
  check(urlString) {
    // Always allow about:blank and data: URIs needed for session init
    if (urlString === 'about:blank' || urlString.startsWith('data:')) {
      return { allowed: true, reason: 'Built-in URI' };
    }

    // Allow file:// URIs for local test fixtures
    if (urlString.startsWith('file://')) {
      return { allowed: true, reason: 'Local file URI' };
    }

    if (this.#mode === 'unrestricted') {
      return { allowed: true, reason: 'Unrestricted mode' };
    }

    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return { allowed: false, reason: `Invalid URL: ${urlString}` };
    }

    // Only allow http/https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, reason: `Protocol not allowed: ${parsed.protocol}` };
    }

    const matches = this.#compiled.some(re => re.test(parsed.hostname));

    if (this.#mode === 'allowlist') {
      return matches
        ? { allowed: true, reason: `Hostname ${parsed.hostname} matches allowlist` }
        : { allowed: false, reason: `Hostname ${parsed.hostname} not in allowlist. Allowed: [${this.#patterns.join(', ')}]` };
    }

    if (this.#mode === 'blocklist') {
      return matches
        ? { allowed: false, reason: `Hostname ${parsed.hostname} is blocklisted` }
        : { allowed: true, reason: `Hostname ${parsed.hostname} not in blocklist` };
    }

    return { allowed: false, reason: `Unknown URL policy mode: ${this.#mode}` };
  }

  #compilePattern(pattern) {
    // Convert glob-like pattern to regex: *.example.com → .*\.example\.com
    const PLACEHOLDER = '\x00GLOB\x00';
    const withPlaceholders = pattern.replace(/\*/g, PLACEHOLDER);
    const escaped = withPlaceholders.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexStr = escaped.replaceAll(PLACEHOLDER, '.*');
    return new RegExp(`^${regexStr}$`, 'i');
  }
}
