import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../../src/policy/engine.js';
import { loadConfig } from '../../src/config/loader.js';

describe('PolicyEngine', () => {
  describe('banking profile', () => {
    // Use banking profile defaults
    const config = loadConfig.__test_parse
      ? loadConfig.__test_parse({})
      : (() => {
          // Manually set profile env and load
          const savedProfile = process.env.SENTINEL_PROFILE;
          process.env.SENTINEL_PROFILE = 'banking';
          const cfg = loadConfig();
          if (savedProfile !== undefined) {
            process.env.SENTINEL_PROFILE = savedProfile;
          } else {
            delete process.env.SENTINEL_PROFILE;
          }
          return cfg;
        })();
    const engine = new PolicyEngine(config);

    it('blocks execute_script', () => {
      const result = engine.evaluate('execute_script', { script: 'return 1;' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('disabled'));
    });

    it('blocks upload_file (disabled in banking)', () => {
      const result = engine.evaluate('upload_file', { by: 'id', value: 'file', filePath: '/tmp/test.txt' });
      assert.equal(result.allowed, false);
    });

    it('blocks navigation to non-allowlisted URL', () => {
      const result = engine.evaluate('navigate', { url: 'https://evil.com' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('not in allowlist'));
    });

    it('allows navigation to about:blank', () => {
      const result = engine.evaluate('navigate', { url: 'about:blank' });
      assert.equal(result.allowed, true);
    });

    it('blocks non-chrome browsers', () => {
      const result = engine.evaluate('start_browser', { browser: 'firefox' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('not allowed'));
    });

    it('allows chrome browser', () => {
      const result = engine.evaluate('start_browser', { browser: 'chrome' });
      assert.equal(result.allowed, true);
    });

    it('blocks cookie writing', () => {
      const result = engine.evaluate('add_cookie', { name: 'test' });
      assert.equal(result.allowed, false);
    });

    it('blocks cookie deletion', () => {
      const result = engine.evaluate('delete_cookie', { name: 'test' });
      assert.equal(result.allowed, false);
    });

    it('allows reading cookies', () => {
      const result = engine.evaluate('get_cookies', { name: 'test' });
      assert.equal(result.allowed, true);
    });

    it('allows interact tool', () => {
      const result = engine.evaluate('interact', { action: 'click', by: 'id', value: 'btn' });
      assert.equal(result.allowed, true);
    });
  });

  describe('standard profile', () => {
    const config = (() => {
      const saved = process.env.SENTINEL_PROFILE;
      process.env.SENTINEL_PROFILE = 'standard';
      const cfg = loadConfig();
      if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
      else delete process.env.SENTINEL_PROFILE;
      return cfg;
    })();
    const engine = new PolicyEngine(config);

    it('allows execute_script', () => {
      const result = engine.evaluate('execute_script', { script: 'return 1;' });
      assert.equal(result.allowed, true);
    });

    it('allows any URL navigation', () => {
      const result = engine.evaluate('navigate', { url: 'https://anything.com' });
      assert.equal(result.allowed, true);
    });

    it('allows cookie operations', () => {
      assert.equal(engine.evaluate('add_cookie', { name: 'x' }).allowed, true);
      assert.equal(engine.evaluate('delete_cookie', { name: 'x' }).allowed, true);
    });
  });

  describe('path traversal protection', () => {
    const config = (() => {
      const saved = process.env.SENTINEL_PROFILE;
      process.env.SENTINEL_PROFILE = 'standard';
      const cfg = loadConfig();
      if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
      else delete process.env.SENTINEL_PROFILE;
      return cfg;
    })();
    const engine = new PolicyEngine(config);

    it('blocks path traversal in upload', () => {
      const result = engine.evaluate('upload_file', { by: 'id', value: 'f', filePath: '../../etc/passwd' });
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('Path traversal'));
    });
  });
});
