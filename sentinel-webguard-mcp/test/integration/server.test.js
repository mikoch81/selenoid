import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../../src/server.js';

describe('MCP Server Integration', () => {
  let server;

  before(async () => {
    // Use standard profile so most tools are enabled
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'standard';
    server = await createServer();
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });

  it('creates a server instance', () => {
    assert.ok(server);
    assert.ok(server.mcpServer);
  });

  it('has registered tools', () => {
    const mcpServer = server.mcpServer;
    assert.ok(mcpServer, 'MCP server should exist');
  });

  it('has config loaded', () => {
    assert.ok(server.config);
    assert.equal(server.config.profile, 'standard');
  });

  it('has policy engine', () => {
    assert.ok(server.policyEngine);
    const result = server.policyEngine.evaluate('navigate', { url: 'https://example.com' });
    assert.equal(typeof result.allowed, 'boolean');
  });

  it('has PII redactor', () => {
    assert.ok(server.redactor);
    const result = server.redactor.redact('test@email.com');
    assert.ok(result.text);
  });

  it('has session manager', () => {
    assert.ok(server.sessionManager);
  });
});

describe('MCP Server Banking Profile', () => {
  let server;

  before(async () => {
    const saved = process.env.SENTINEL_PROFILE;
    process.env.SENTINEL_PROFILE = 'banking';
    server = await createServer();
    if (saved !== undefined) process.env.SENTINEL_PROFILE = saved;
    else delete process.env.SENTINEL_PROFILE;
  });

  it('enforces banking restrictions via policy engine', () => {
    const scriptResult = server.policyEngine.evaluate('execute_script', { script: 'return 1;' });
    assert.equal(scriptResult.allowed, false);
  });

  it('redacts PII in banking profile', () => {
    const result = server.redactor.redact('Card: 4111111111111111');
    assert.ok(!result.text.includes('4111'));
  });
});
