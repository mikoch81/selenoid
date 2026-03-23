import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { UrlAllowlist } from '../../src/policy/url-allowlist.js';

describe('UrlAllowlist', () => {
  describe('allowlist mode', () => {
    const policy = new UrlAllowlist({ mode: 'allowlist', patterns: ['*.example.com', 'localhost'] });

    it('allows matching domain', () => {
      const result = policy.check('https://app.example.com/login');
      assert.equal(result.allowed, true);
    });

    it('allows exact domain', () => {
      const result = policy.check('http://localhost:3000/test');
      assert.equal(result.allowed, true);
    });

    it('blocks non-matching domain', () => {
      const result = policy.check('https://evil.com/phish');
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('not in allowlist'));
    });

    it('allows about:blank', () => {
      const result = policy.check('about:blank');
      assert.equal(result.allowed, true);
    });

    it('allows file:// URIs', () => {
      const result = policy.check('file:///C:/test/fixture.html');
      assert.equal(result.allowed, true);
    });

    it('blocks javascript: protocol', () => {
      const result = policy.check('javascript:alert(1)');
      assert.equal(result.allowed, false);
    });

    it('rejects invalid URL', () => {
      const result = policy.check('not a url at all');
      assert.equal(result.allowed, false);
      assert.ok(result.reason.includes('Invalid URL'));
    });
  });

  describe('blocklist mode', () => {
    const policy = new UrlAllowlist({ mode: 'blocklist', patterns: ['*.evil.com', 'malware.org'] });

    it('allows non-blocked domain', () => {
      const result = policy.check('https://good-site.com');
      assert.equal(result.allowed, true);
    });

    it('blocks matching domain', () => {
      const result = policy.check('https://sub.evil.com/payload');
      assert.equal(result.allowed, false);
    });
  });

  describe('unrestricted mode', () => {
    const policy = new UrlAllowlist({ mode: 'unrestricted', patterns: [] });

    it('allows any URL', () => {
      const result = policy.check('https://anything.anywhere.com');
      assert.equal(result.allowed, true);
    });
  });

  describe('empty allowlist', () => {
    const policy = new UrlAllowlist({ mode: 'allowlist', patterns: [] });

    it('blocks all HTTP URLs when allowlist is empty', () => {
      const result = policy.check('https://example.com');
      assert.equal(result.allowed, false);
    });

    it('still allows about:blank', () => {
      const result = policy.check('about:blank');
      assert.equal(result.allowed, true);
    });
  });
});
