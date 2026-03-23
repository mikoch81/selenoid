import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/config/loader.js';

describe('Config Loader', () => {
  it('loads banking profile by default', () => {
    const saved = process.env.SENTINEL_PROFILE;
    delete process.env.SENTINEL_PROFILE;
    delete process.env.SENTINEL_CONFIG;
    const config = loadConfig();
    assert.equal(config.profile, 'banking');
    assert.equal(config.script.allowExecuteScript, false);
    assert.equal(config.url.mode, 'allowlist');
    assert.equal(config.session.forceHeadless, true);
    assert.equal(config.cookie.allowWrite, false);
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
  });

  it('loads standard profile', () => {
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'standard';
    const config = loadConfig();
    assert.equal(config.profile, 'standard');
    assert.equal(config.script.allowExecuteScript, true);
    assert.equal(config.url.mode, 'unrestricted');
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });

  it('loads permissive profile', () => {
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'permissive';
    const config = loadConfig();
    assert.equal(config.profile, 'permissive');
    assert.equal(config.audit.enabled, false);
    assert.equal(config.session.maxConcurrentSessions, 5);
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });

  it('throws on unknown profile', () => {
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'nonexistent';
    assert.throws(() => loadConfig(), /Unknown security profile/);
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });

  it('applies URL_PATTERNS env override', () => {
    const savedProfile = process.env.SENTINEL_PROFILE;
    const savedPatterns = process.env.SENTINEL_URL_PATTERNS;
    process.env.SENTINEL_PROFILE = 'banking';
    process.env.SENTINEL_URL_PATTERNS = '*.mybank.com, internal.corp.com';
    const config = loadConfig();
    assert.deepEqual(config.url.patterns, ['*.mybank.com', 'internal.corp.com']);
    if (savedProfile !== undefined) process.env.SENTINEL_PROFILE = savedProfile;
    else delete process.env.SENTINEL_PROFILE;
    if (savedPatterns !== undefined) process.env.SENTINEL_URL_PATTERNS = savedPatterns;
    else delete process.env.SENTINEL_URL_PATTERNS;
  });

  it('config is frozen (immutable)', () => {
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'banking';
    const config = loadConfig();
    assert.throws(() => { config.profile = 'hacked'; }, TypeError);
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });
});
