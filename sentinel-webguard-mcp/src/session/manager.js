/**
 * Session Manager — manages browser session lifecycle with
 * concurrency limits, timeouts, and clean shutdown.
 */
export class SessionManager {
  #sessions = new Map();
  #currentSessionId = null;
  #config;
  #auditLogger;
  #timers = new Map();

  constructor(config, auditLogger) {
    this.#config = config;
    this.#auditLogger = auditLogger;
  }

  get currentSessionId() {
    return this.#currentSessionId;
  }

  get sessionCount() {
    return this.#sessions.size;
  }

  /**
   * Register a new session. Enforces concurrency limits.
   * @param {string} browser
   * @param {object} driver - Selenium WebDriver instance
   * @param {object} bidiState - BiDi diagnostic state (or null)
   * @returns {string} sessionId
   */
  create(browser, driver, bidiState) {
    const maxSessions = this.#config.session.maxConcurrentSessions;
    if (this.#sessions.size >= maxSessions) {
      throw new Error(
        `Maximum concurrent sessions (${maxSessions}) reached. Close an existing session first.`
      );
    }

    const sessionId = `${browser}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    this.#sessions.set(sessionId, {
      id: sessionId,
      browser,
      driver,
      bidi: bidiState,
      createdAt: Date.now(),
      screenshotCount: 0,
    });

    this.#currentSessionId = sessionId;
    this.#startTimeout(sessionId);

    this.#auditLogger?.logSession({
      event: 'created',
      sessionId,
      browser,
    });

    return sessionId;
  }

  /**
   * Get the active session's driver.
   * @throws {Error} if no active session
   */
  getDriver() {
    const session = this.#sessions.get(this.#currentSessionId);
    if (!session) {
      throw new Error('No active browser session');
    }
    return session.driver;
  }

  /**
   * Get the active session object.
   */
  getSession() {
    return this.#sessions.get(this.#currentSessionId) || null;
  }

  /**
   * Get BiDi state for the current session.
   */
  getBidi() {
    const session = this.#sessions.get(this.#currentSessionId);
    return session?.bidi || null;
  }

  /**
   * Increment screenshot counter and check limit.
   * @returns {{ allowed: boolean, count: number, max: number }}
   */
  trackScreenshot() {
    const session = this.#sessions.get(this.#currentSessionId);
    if (!session) {
      return { allowed: false, count: 0, max: 0 };
    }

    const max = this.#config.screenshot.maxPerSession;
    // max=0 means unlimited
    if (max > 0 && session.screenshotCount >= max) {
      return { allowed: false, count: session.screenshotCount, max };
    }

    session.screenshotCount++;
    return { allowed: true, count: session.screenshotCount, max };
  }

  /**
   * Close the current session and clean up.
   */
  async closeCurrent() {
    const sessionId = this.#currentSessionId;
    if (!sessionId) {
      throw new Error('No active session to close');
    }

    await this.#destroySession(sessionId);
    this.#currentSessionId = null;
  }

  /**
   * Clean up all sessions (for shutdown).
   */
  async closeAll() {
    const sessionIds = [...this.#sessions.keys()];
    for (const id of sessionIds) {
      await this.#destroySession(id);
    }
    this.#currentSessionId = null;
  }

  /**
   * List all session IDs.
   */
  listSessions() {
    return [...this.#sessions.entries()].map(([id, s]) => ({
      id,
      browser: s.browser,
      createdAt: s.createdAt,
      isCurrent: id === this.#currentSessionId,
    }));
  }

  async #destroySession(sessionId) {
    this.#clearTimeout(sessionId);

    const session = this.#sessions.get(sessionId);
    if (!session) return;

    try {
      await session.driver.quit();
    } catch {
      // Best-effort cleanup
    }

    this.#sessions.delete(sessionId);

    this.#auditLogger?.logSession({
      event: 'closed',
      sessionId,
      browser: session.browser,
      details: {
        durationMs: Date.now() - session.createdAt,
        screenshotsTaken: session.screenshotCount,
      },
    });
  }

  #startTimeout(sessionId) {
    const timeoutMs = this.#config.session.sessionTimeoutMs;
    if (timeoutMs <= 0) return;

    const timer = setTimeout(async () => {
      this.#auditLogger?.logSecurity({
        event: 'session_timeout',
        tool: null,
        details: { sessionId, timeoutMs },
        severity: 'info',
      });

      await this.#destroySession(sessionId);

      if (this.#currentSessionId === sessionId) {
        this.#currentSessionId = null;
      }
    }, timeoutMs);

    // Unref so the timer doesn't prevent Node.js from exiting
    timer.unref();
    this.#timers.set(sessionId, timer);
  }

  #clearTimeout(sessionId) {
    const timer = this.#timers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.#timers.delete(sessionId);
    }
  }
}
