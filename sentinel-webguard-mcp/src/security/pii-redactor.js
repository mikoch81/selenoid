/**
 * PII Redactor — scans text for sensitive data patterns and replaces them.
 * Used on all tool outputs and audit log entries.
 */
export class PiiRedactor {
  #enabled;
  #rules;

  constructor(redactionPolicy) {
    this.#enabled = redactionPolicy.enabled;
    this.#rules = redactionPolicy.patterns.map(p => ({
      name: p.name,
      regex: new RegExp(p.regex, 'g'),
      replacement: p.replacement,
    }));
  }

  /**
   * Redact sensitive patterns from text.
   * @param {string} text
   * @returns {{ text: string, redactions: string[] }}
   */
  redact(text) {
    if (!this.#enabled || typeof text !== 'string') {
      return { text, redactions: [] };
    }

    const redactions = [];
    let result = text;

    for (const rule of this.#rules) {
      // Reset lastIndex for global regex
      rule.regex.lastIndex = 0;
      if (rule.regex.test(result)) {
        redactions.push(rule.name);
        rule.regex.lastIndex = 0;
        result = result.replace(rule.regex, rule.replacement);
      }
    }

    return { text: result, redactions };
  }

  /**
   * Redact PII from a structured object (deep).
   * Returns a new object with string values redacted.
   */
  redactObject(obj) {
    if (!this.#enabled) return { data: obj, redactions: [] };
    const allRedactions = [];
    const redacted = this.#deepRedact(obj, allRedactions);
    return { data: redacted, redactions: [...new Set(allRedactions)] };
  }

  #deepRedact(value, redactions) {
    if (typeof value === 'string') {
      const result = this.redact(value);
      redactions.push(...result.redactions);
      return result.text;
    }
    if (Array.isArray(value)) {
      return value.map(item => this.#deepRedact(item, redactions));
    }
    if (value !== null && typeof value === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(value)) {
        out[k] = this.#deepRedact(v, redactions);
      }
      return out;
    }
    return value;
  }
}
