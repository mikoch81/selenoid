import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InputSanitizer } from '../../src/security/sanitizer.js';

describe('InputSanitizer', () => {
  describe('sanitizeUrl', () => {
    it('strips control characters', () => {
      const result = InputSanitizer.sanitizeUrl('https://example.com/\x00path');
      assert.equal(result, 'https://example.com/path');
    });

    it('preserves valid URLs', () => {
      const url = 'https://example.com/page?q=test&lang=en';
      assert.equal(InputSanitizer.sanitizeUrl(url), url);
    });

    it('throws for non-string', () => {
      assert.throws(() => InputSanitizer.sanitizeUrl(123), /string/);
    });
  });

  describe('validateScript', () => {
    it('blocks fetch()', () => {
      const result = InputSanitizer.validateScript('fetch("https://evil.com")');
      assert.equal(result.safe, false);
      assert.ok(result.reason.includes('fetch'));
    });

    it('blocks XMLHttpRequest', () => {
      const result = InputSanitizer.validateScript('new XMLHttpRequest()');
      assert.equal(result.safe, false);
    });

    it('blocks eval()', () => {
      const result = InputSanitizer.validateScript('eval("code")');
      assert.equal(result.safe, false);
    });

    it('blocks WebSocket', () => {
      const result = InputSanitizer.validateScript('new WebSocket("ws://evil.com")');
      assert.equal(result.safe, false);
    });

    it('allows safe scripts', () => {
      const result = InputSanitizer.validateScript('return document.title;');
      assert.equal(result.safe, true);
    });

    it('allows DOM manipulation', () => {
      const result = InputSanitizer.validateScript('document.getElementById("x").textContent');
      assert.equal(result.safe, true);
    });
  });

  describe('sanitizeCookieValue', () => {
    it('strips control characters from cookies', () => {
      assert.equal(InputSanitizer.sanitizeCookieValue('value\x00\x01test'), 'valuetest');
    });
  });
});
