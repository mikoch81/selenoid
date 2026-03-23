import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PiiRedactor } from '../../src/security/pii-redactor.js';

describe('PiiRedactor', () => {
  const redactor = new PiiRedactor({
    enabled: true,
    patterns: [
      { name: 'credit-card', regex: '\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b', replacement: '[CC-REDACTED]' },
      { name: 'email', regex: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', replacement: '[EMAIL-REDACTED]' },
      { name: 'ssn', regex: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replacement: '[SSN-REDACTED]' },
      { name: 'iban', regex: '\\b[A-Z]{2}\\d{2}[A-Z0-9]{4,30}\\b', replacement: '[IBAN-REDACTED]' },
    ],
  });

  it('redacts credit card numbers', () => {
    const result = redactor.redact('Card: 4111-1111-1111-1111');
    assert.equal(result.text, 'Card: [CC-REDACTED]');
    assert.ok(result.redactions.includes('credit-card'));
  });

  it('redacts email addresses', () => {
    const result = redactor.redact('Contact: user@bank.com');
    assert.equal(result.text, 'Contact: [EMAIL-REDACTED]');
    assert.ok(result.redactions.includes('email'));
  });

  it('redacts SSN', () => {
    const result = redactor.redact('SSN: 123-45-6789');
    assert.equal(result.text, 'SSN: [SSN-REDACTED]');
  });

  it('redacts IBAN', () => {
    const result = redactor.redact('Account: PL61109010140000071219812874');
    assert.equal(result.text, 'Account: [IBAN-REDACTED]');
  });

  it('handles multiple redactions in one text', () => {
    const text = 'User: test@example.com, Card: 4111111111111111';
    const result = redactor.redact(text);
    assert.ok(result.redactions.includes('email'));
    assert.ok(result.redactions.includes('credit-card'));
    assert.ok(!result.text.includes('test@example.com'));
    assert.ok(!result.text.includes('4111111111111111'));
  });

  it('returns unchanged text when no patterns match', () => {
    const result = redactor.redact('Hello, world!');
    assert.equal(result.text, 'Hello, world!');
    assert.equal(result.redactions.length, 0);
  });

  it('handles non-string input', () => {
    const result = redactor.redact(42);
    assert.equal(result.text, 42);
    assert.equal(result.redactions.length, 0);
  });

  describe('disabled redactor', () => {
    const disabled = new PiiRedactor({ enabled: false, patterns: [] });

    it('returns text unchanged', () => {
      const result = disabled.redact('Card: 4111111111111111');
      assert.equal(result.text, 'Card: 4111111111111111');
    });
  });

  describe('redactObject', () => {
    it('deep-redacts nested objects', () => {
      const data = {
        user: { email: 'admin@bank.com', name: 'John' },
        card: '4111-1111-1111-1111',
        items: ['text', 'user2@test.com'],
      };
      const result = redactor.redactObject(data);
      assert.equal(result.data.user.email, '[EMAIL-REDACTED]');
      assert.equal(result.data.card, '[CC-REDACTED]');
      assert.equal(result.data.items[1], '[EMAIL-REDACTED]');
      assert.equal(result.data.user.name, 'John');
    });
  });
});
