import { z } from 'zod';

/**
 * Configuration schema for Sentinel WebGuard MCP.
 * Defines security profiles and policy rules that govern all tool behavior.
 */

export const SecurityProfileSchema = z.enum(['banking', 'restricted', 'standard', 'permissive']);

export const UrlPolicySchema = z.object({
  mode: z.enum(['allowlist', 'blocklist', 'unrestricted']).default('allowlist'),
  patterns: z.array(z.string()).default([]),
});

export const ToolPolicySchema = z.object({
  enabled: z.boolean().default(true),
  requiresApproval: z.boolean().default(false),
});

export const SessionPolicySchema = z.object({
  maxConcurrentSessions: z.number().int().min(1).max(10).default(1),
  sessionTimeoutMs: z.number().int().min(0).default(300_000),
  allowedBrowsers: z.array(z.enum(['chrome', 'firefox', 'edge'])).default(['chrome']),
  forceHeadless: z.boolean().default(true),
  defaultArguments: z.array(z.string()).default([
    '--no-first-run',
    '--disable-extensions',
    '--disable-default-apps',
    '--disable-sync',
    '--disable-background-networking',
  ]),
});

export const ScriptPolicySchema = z.object({
  allowExecuteScript: z.boolean().default(false),
  allowedScriptPatterns: z.array(z.string()).default([]),
});

export const RedactionPolicySchema = z.object({
  enabled: z.boolean().default(true),
  patterns: z.array(z.object({
    name: z.string(),
    regex: z.string(),
    replacement: z.string().default('[REDACTED]'),
  })).default([]),
});

export const AuditPolicySchema = z.object({
  enabled: z.boolean().default(true),
  logDir: z.string().default('./audit-logs'),
  includeTimestamps: z.boolean().default(true),
  includeToolInputs: z.boolean().default(true),
  redactSensitiveInputs: z.boolean().default(true),
});

export const ScreenshotPolicySchema = z.object({
  allowed: z.boolean().default(true),
  maxPerSession: z.number().int().min(0).default(50),
  autoRedactPii: z.boolean().default(false),
});

export const CookiePolicySchema = z.object({
  allowRead: z.boolean().default(true),
  allowWrite: z.boolean().default(false),
  allowDelete: z.boolean().default(false),
  redactValuesInLogs: z.boolean().default(true),
});

export const ConfigSchema = z.object({
  profile: SecurityProfileSchema.default('banking'),
  server: z.object({
    name: z.string().default('Sentinel WebGuard MCP'),
    version: z.string().default('0.1.0'),
  }).default({}),
  url: UrlPolicySchema.default({}),
  session: SessionPolicySchema.default({}),
  script: ScriptPolicySchema.default({}),
  redaction: RedactionPolicySchema.default({}),
  audit: AuditPolicySchema.default({}),
  screenshot: ScreenshotPolicySchema.default({}),
  cookie: CookiePolicySchema.default({}),
  tools: z.record(z.string(), ToolPolicySchema).default({}),
});
