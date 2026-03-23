import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ConfigSchema } from './schema.js';

const PROFILE_DEFAULTS = {
  banking: {
    profile: 'banking',
    url: { mode: 'allowlist', patterns: [] },
    session: {
      maxConcurrentSessions: 1,
      sessionTimeoutMs: 120_000,
      allowedBrowsers: ['chrome'],
      forceHeadless: true,
      defaultArguments: [
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-background-networking',
        '--disable-translate',
        '--disable-component-update',
        '--no-default-browser-check',
      ],
    },
    script: { allowExecuteScript: false, allowedScriptPatterns: [] },
    redaction: {
      enabled: true,
      patterns: [
        { name: 'credit-card', regex: '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b', replacement: '[CC-REDACTED]' },
        { name: 'ssn', regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replacement: '[SSN-REDACTED]' },
        { name: 'pesel', regex: '\\b\\d{11}\\b', replacement: '[PESEL-REDACTED]' },
        { name: 'email', regex: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', replacement: '[EMAIL-REDACTED]' },
        { name: 'iban', regex: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{4,30}\\b', replacement: '[IBAN-REDACTED]' },
        { name: 'polish-phone', regex: '\\b(?:\\+48)?[- ]?\\d{3}[- ]?\\d{3}[- ]?\\d{3}\\b', replacement: '[PHONE-REDACTED]' },
      ],
    },
    audit: {
      enabled: true,
      logDir: './audit-logs',
      includeTimestamps: true,
      includeToolInputs: true,
      redactSensitiveInputs: true,
    },
    screenshot: { allowed: true, maxPerSession: 10, autoRedactPii: false },
    cookie: { allowRead: true, allowWrite: false, allowDelete: false, redactValuesInLogs: true },
    tools: {
      execute_script: { enabled: false, requiresApproval: false },
      upload_file: { enabled: false, requiresApproval: false },
    },
  },

  restricted: {
    profile: 'restricted',
    url: { mode: 'allowlist', patterns: [] },
    session: {
      maxConcurrentSessions: 2,
      sessionTimeoutMs: 300_000,
      allowedBrowsers: ['chrome', 'firefox'],
      forceHeadless: true,
      defaultArguments: [
        '--no-first-run',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-sync',
      ],
    },
    script: { allowExecuteScript: false, allowedScriptPatterns: [] },
    redaction: {
      enabled: true,
      patterns: [
        { name: 'credit-card', regex: '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b', replacement: '[CC-REDACTED]' },
        { name: 'email', regex: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', replacement: '[EMAIL-REDACTED]' },
      ],
    },
    audit: { enabled: true, logDir: './audit-logs', includeTimestamps: true, includeToolInputs: true, redactSensitiveInputs: true },
    screenshot: { allowed: true, maxPerSession: 30, autoRedactPii: false },
    cookie: { allowRead: true, allowWrite: true, allowDelete: false, redactValuesInLogs: true },
    tools: {
      execute_script: { enabled: false, requiresApproval: false },
    },
  },

  standard: {
    profile: 'standard',
    url: { mode: 'unrestricted', patterns: [] },
    session: {
      maxConcurrentSessions: 3,
      sessionTimeoutMs: 600_000,
      allowedBrowsers: ['chrome', 'firefox', 'edge'],
      forceHeadless: false,
      defaultArguments: ['--no-first-run'],
    },
    script: { allowExecuteScript: true, allowedScriptPatterns: [] },
    redaction: { enabled: false, patterns: [] },
    audit: { enabled: true, logDir: './audit-logs', includeTimestamps: true, includeToolInputs: true, redactSensitiveInputs: false },
    screenshot: { allowed: true, maxPerSession: 50, autoRedactPii: false },
    cookie: { allowRead: true, allowWrite: true, allowDelete: true, redactValuesInLogs: false },
    tools: {},
  },

  permissive: {
    profile: 'permissive',
    url: { mode: 'unrestricted', patterns: [] },
    session: {
      maxConcurrentSessions: 5,
      sessionTimeoutMs: 0,
      allowedBrowsers: ['chrome', 'firefox', 'edge'],
      forceHeadless: false,
      defaultArguments: [],
    },
    script: { allowExecuteScript: true, allowedScriptPatterns: [] },
    redaction: { enabled: false, patterns: [] },
    audit: { enabled: false, logDir: './audit-logs', includeTimestamps: true, includeToolInputs: false, redactSensitiveInputs: false },
    screenshot: { allowed: true, maxPerSession: 0, autoRedactPii: false },
    cookie: { allowRead: true, allowWrite: true, allowDelete: true, redactValuesInLogs: false },
    tools: {},
  },
};

export function loadConfig(overridePath) {
  let rawConfig = {};

  // 1. Start with profile defaults
  const profileName = process.env.SENTINEL_PROFILE || 'banking';
  const profileDefaults = PROFILE_DEFAULTS[profileName];
  if (!profileDefaults) {
    throw new Error(`Unknown security profile: "${profileName}". Valid: ${Object.keys(PROFILE_DEFAULTS).join(', ')}`);
  }
  rawConfig = { ...profileDefaults };

  // 2. Overlay config file if provided
  const configPath = overridePath || process.env.SENTINEL_CONFIG;
  if (configPath) {
    const absPath = resolve(configPath);
    if (!existsSync(absPath)) {
      throw new Error(`Config file not found: ${absPath}`);
    }
    const fileContent = JSON.parse(readFileSync(absPath, 'utf-8'));
    rawConfig = deepMerge(rawConfig, fileContent);
  }

  // 3. Apply environment variable overrides
  if (process.env.SENTINEL_URL_PATTERNS) {
    rawConfig.url = rawConfig.url || {};
    rawConfig.url.patterns = process.env.SENTINEL_URL_PATTERNS.split(',').map(s => s.trim());
  }
  if (process.env.SENTINEL_ALLOWED_BROWSERS) {
    rawConfig.session = rawConfig.session || {};
    rawConfig.session.allowedBrowsers = process.env.SENTINEL_ALLOWED_BROWSERS.split(',').map(s => s.trim());
  }
  if (process.env.SENTINEL_HEADLESS !== undefined) {
    rawConfig.session = rawConfig.session || {};
    rawConfig.session.forceHeadless = process.env.SENTINEL_HEADLESS !== 'false';
  }
  if (process.env.SENTINEL_AUDIT_DIR) {
    rawConfig.audit = rawConfig.audit || {};
    rawConfig.audit.logDir = process.env.SENTINEL_AUDIT_DIR;
  }

  // 4. Validate with Zod
  const result = ConfigSchema.safeParse(rawConfig);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }

  return Object.freeze(result.data);
}

function deepMerge(target, source) {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else {
      output[key] = source[key];
    }
  }
  return output;
}
