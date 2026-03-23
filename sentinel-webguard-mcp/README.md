# Sentinel WebGuard MCP

Banking-grade, offline-first Selenium MCP server with layered security controls.

## Features

- **4 Security Profiles** — `banking` (strictest), `restricted`, `standard`, `permissive`
- **Policy Engine** — every tool invocation evaluated against configurable rules
- **URL Allowlist / Blocklist** — restrict navigation to approved domains
- **PII Redaction** — credit cards, SSNs, PESEL, IBAN, emails automatically scrubbed from output
- **Structured Audit Trail** — JSONL logs of all tool calls, session events, security decisions
- **Input Sanitization** — script injection protection, path traversal blocking, cookie sanitization
- **Session Management** — concurrency limits, auto-timeout, lifecycle tracking
- **Screenshot Rate Limiting** — prevents abuse of screenshot capture
- **BiDi Support** — optional WebDriver BiDi for console/network diagnostics

## Quick Start

```bash
npm install
```

### Run with default banking profile

```bash
node src/index.js
```

### Run with a specific profile

```bash
SENTINEL_PROFILE=standard node src/index.js
```

### Run with a config file

```bash
node src/index.js ./config/my-config.json
```

## Security Profiles

| Feature | Banking | Restricted | Standard | Permissive |
|---|---|---|---|---|
| URL policy | allowlist | blocklist | unrestricted | unrestricted |
| execute_script | ❌ | ❌ | ✅ | ✅ |
| upload_file | ❌ | ✅ | ✅ | ✅ |
| Cookie write | ❌ | ✅ | ✅ | ✅ |
| Cookie delete | ❌ | ❌ | ✅ | ✅ |
| Force headless | ✅ | ✅ | ❌ | ❌ |
| PII redaction | ✅ (6 patterns) | ✅ (4 patterns) | ✅ (2 patterns) | ❌ |
| Audit logging | ✅ | ✅ | ✅ | ❌ |
| Max sessions | 1 | 2 | 3 | 5 |
| Session timeout | 5 min | 10 min | 15 min | 30 min |
| Allowed browsers | Chrome only | Chrome, Firefox | Chrome, Firefox, Edge | All |

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `SENTINEL_PROFILE` | Security profile name | `banking`, `standard` |
| `SENTINEL_CONFIG` | Path to JSON config file | `./config/prod.json` |
| `SENTINEL_URL_PATTERNS` | Comma-separated URL patterns | `*.mybank.com, internal.corp.net` |
| `SENTINEL_ALLOWED_BROWSERS` | Comma-separated browser names | `chrome, firefox` |
| `SENTINEL_HEADLESS` | Force headless mode | `true` / `false` |
| `SENTINEL_AUDIT_DIR` | Audit log directory | `./logs` |

## MCP Tools

| Tool | Description |
|---|---|
| `start_browser` | Launch a browser session (browser type validated against policy) |
| `close_session` | Close the current browser session |
| `navigate` | Navigate to a URL (validated against URL policy) |
| `interact` | Click, double-click, right-click, or hover on elements |
| `send_keys` | Type text into form fields |
| `press_key` | Send keyboard keys (Enter, Tab, etc.) |
| `get_element_text` | Get text content (PII-redacted in output) |
| `get_element_attribute` | Get element attribute value |
| `execute_script` | Run JavaScript (policy-controlled, script-sanitized) |
| `upload_file` | Upload a file via file input (path traversal protected) |
| `take_screenshot` | Capture screenshot (rate-limited) |
| `window` | List, switch, or close browser windows/tabs |
| `frame` | Switch between frames/iframes |
| `alert` | Accept, dismiss, or interact with browser alerts |
| `add_cookie` | Add a cookie (write-policy controlled) |
| `get_cookies` | Read cookies (values redacted per policy) |
| `delete_cookie` | Delete cookies (delete-policy controlled) |
| `diagnostics` | BiDi console logs, errors, and network events |

## MCP Resources

| URI | Description |
|---|---|
| `browser://status` | Current session status, profile info, capabilities |
| `accessibility://current` | Accessibility tree snapshot of current page (PII-redacted) |

## Project Structure

```
sentinel-webguard-mcp/
├── src/
│   ├── index.js              # Entry point (stdio transport)
│   ├── server.js             # Server factory
│   ├── config/
│   │   ├── schema.js         # Zod validation schemas
│   │   └── loader.js         # Config loader (profile → file → env)
│   ├── policy/
│   │   ├── engine.js         # Central policy gatekeeper
│   │   └── url-allowlist.js  # URL domain validation
│   ├── security/
│   │   ├── pii-redactor.js   # PII pattern detection & redaction
│   │   ├── audit-logger.js   # JSONL structured audit trail
│   │   └── sanitizer.js      # Input sanitization
│   ├── session/
│   │   └── manager.js        # Session lifecycle management
│   ├── tools/                # 10 tool modules
│   │   ├── registry.js       # Wires all tools
│   │   ├── browser.js        # start_browser, close_session
│   │   ├── navigation.js     # navigate
│   │   ├── interaction.js    # interact, send_keys, press_key
│   │   ├── element.js        # get_element_text, get_element_attribute, execute_script, upload_file
│   │   ├── screenshot.js     # take_screenshot
│   │   ├── window.js         # window management
│   │   ├── frame.js          # frame management
│   │   ├── alert.js          # alert handling
│   │   ├── cookie.js         # cookie CRUD
│   │   └── diagnostics.js    # BiDi diagnostics
│   ├── resources/
│   │   └── registry.js       # browser-status, accessibility-snapshot
│   └── utils/
│       ├── locator.js        # Locator strategy resolver
│       └── bidi.js           # BiDi module loading
├── scripts/
│   └── accessibility-snapshot.js  # Browser-injected DOM walker
├── test/
│   ├── unit/                 # 51 unit tests
│   └── integration/          # 8 integration tests
├── package.json
└── .gitignore
```

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration
```

## MCP Client Configuration

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "sentinel-webguard": {
      "command": "node",
      "args": ["path/to/sentinel-webguard-mcp/src/index.js"],
      "env": {
        "SENTINEL_PROFILE": "banking",
        "SENTINEL_URL_PATTERNS": "*.mybank.com, app.internal.com"
      }
    }
  }
}
```

## License

ISC
