/**
 * BiDi helpers — dynamic import and session state setup for WebDriver BiDi.
 * Fails gracefully if BiDi modules are not available.
 */

let LogInspector = null;
let Network = null;
let bidiLoaded = false;

/**
 * Attempt to load BiDi modules. Call once at startup.
 */
export async function loadBidiModules() {
  if (bidiLoaded) return;
  bidiLoaded = true;

  try {
    LogInspector = (await import('selenium-webdriver/bidi/logInspector.js')).default;
    const networkModule = await import('selenium-webdriver/bidi/network.js');
    Network = networkModule.Network;
  } catch {
    LogInspector = null;
    Network = null;
  }
}

/**
 * Check if BiDi modules are available.
 */
export function isBidiAvailable() {
  return LogInspector !== null && Network !== null;
}

/**
 * Create a fresh BiDi diagnostic state object.
 */
export function createBidiState() {
  return {
    available: false,
    consoleLogs: [],
    pageErrors: [],
    networkLogs: [],
  };
}

/**
 * Set up BiDi listeners on a driver session.
 * @param {WebDriver} driver
 * @returns {object|null} BiDi state object, or null if BiDi not available
 */
export async function setupBidi(driver) {
  if (!LogInspector || !Network) return null;

  const bidi = createBidiState();

  try {
    const logInspector = await LogInspector(driver);
    await logInspector.onConsoleEntry((entry) => {
      try {
        bidi.consoleLogs.push({
          level: entry.level,
          text: entry.text,
          timestamp: entry.timestamp,
          type: entry.type,
          method: entry.method,
        });
      } catch { /* ignore malformed entry */ }
    });
    await logInspector.onJavascriptLog((entry) => {
      try {
        bidi.pageErrors.push({
          level: entry.level,
          text: entry.text,
          timestamp: entry.timestamp,
          type: entry.type,
        });
      } catch { /* ignore malformed entry */ }
    });

    const network = await Network(driver);
    await network.responseCompleted((event) => {
      try {
        bidi.networkLogs.push({
          type: 'response',
          url: event.request?.url,
          status: event.response?.status,
          method: event.request?.method,
          timestamp: Date.now(),
        });
      } catch { /* ignore malformed event */ }
    });
    await network.fetchError((event) => {
      try {
        bidi.networkLogs.push({
          type: 'error',
          url: event.request?.url,
          method: event.request?.method,
          errorText: event.errorText,
          timestamp: Date.now(),
        });
      } catch { /* ignore malformed event */ }
    });

    bidi.available = true;
    return bidi;
  } catch {
    return null;
  }
}
