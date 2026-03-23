import { mkdirSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * Audit Logger — structured JSON audit trail for all tool invocations.
 * Each entry records: timestamp, tool, input, output, policy decision, duration.
 */
export class AuditLogger {
  #enabled;
  #logPath;
  #includeTimestamps;
  #includeToolInputs;
  #redactSensitiveInputs;
  #redactor;

  constructor(auditPolicy, redactor) {
    this.#enabled = auditPolicy.enabled;
    this.#includeTimestamps = auditPolicy.includeTimestamps;
    this.#includeToolInputs = auditPolicy.includeToolInputs;
    this.#redactSensitiveInputs = auditPolicy.redactSensitiveInputs;
    this.#redactor = redactor;

    if (this.#enabled) {
      const logDir = resolve(auditPolicy.logDir);
      mkdirSync(logDir, { recursive: true });
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      this.#logPath = resolve(logDir, `audit-${dateStr}.jsonl`);
    }
  }

  /**
   * Log a tool invocation event.
   */
  logToolCall({ tool, params, policyResult, result, durationMs, sessionId }) {
    if (!this.#enabled) return;

    const entry = {
      event: 'tool_call',
      tool,
      sessionId: sessionId || null,
      policy: {
        allowed: policyResult.allowed,
        reason: policyResult.reason,
        warnings: policyResult.warnings?.length ? policyResult.warnings : undefined,
      },
    };

    if (this.#includeTimestamps) {
      entry.timestamp = new Date().toISOString();
    }

    if (this.#includeToolInputs) {
      entry.params = this.#redactSensitiveInputs && this.#redactor
        ? this.#redactor.redactObject(params).data
        : params;
    }

    if (result !== undefined) {
      entry.result = {
        isError: result.isError || false,
        summary: this.#summarizeResult(result),
      };
    }

    if (durationMs !== undefined) {
      entry.durationMs = durationMs;
    }

    this.#write(entry);
  }

  /**
   * Log a session lifecycle event.
   */
  logSession({ event, sessionId, browser, details }) {
    if (!this.#enabled) return;

    const entry = {
      event: `session_${event}`,
      sessionId,
      browser,
    };

    if (this.#includeTimestamps) {
      entry.timestamp = new Date().toISOString();
    }

    if (details) {
      entry.details = details;
    }

    this.#write(entry);
  }

  /**
   * Log a security event (policy violation, PII detected, etc.).
   */
  logSecurity({ event, tool, details, severity }) {
    if (!this.#enabled) return;

    const entry = {
      event: `security_${event}`,
      tool,
      severity: severity || 'warning',
    };

    if (this.#includeTimestamps) {
      entry.timestamp = new Date().toISOString();
    }

    if (details) {
      entry.details = details;
    }

    this.#write(entry);
  }

  #summarizeResult(result) {
    if (!result?.content?.[0]) return 'no content';
    const first = result.content[0];
    if (first.type === 'text') {
      const text = first.text;
      return text.length > 200 ? text.slice(0, 200) + '...' : text;
    }
    if (first.type === 'image') return '[image data]';
    return '[content]';
  }

  #write(entry) {
    try {
      appendFileSync(this.#logPath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // Audit logging failure should not crash the server
    }
  }
}
