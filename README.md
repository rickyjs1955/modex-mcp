# modex-mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the
[`modex`](https://github.com/rickyjs1955/modex-cli) authoring flow as tools to
MCP hosts (Claude Code, Cursor, …).

It is a thin wrapper: every tool delegates straight to
[`@mojax/core`](https://www.npmjs.com/package/@mojax/core). The server holds the
tool schemas and the stdio plumbing — no business logic.

## Tools

| Tool | Inputs | Does |
|---|---|---|
| `feed` | `agent_id`, `patterns[]`, `model?` | Extract skills from explicit file paths / globs / URLs into the agent's `SKILLS.md`. |
| `agents_create` | `name?` | Create a new agent under `.modex/<uuid7>/`. |
| `agents_list` | — | List agents in the working directory. |
| `bind` | `agent_id` | Upload `SKILLS.md` + provenance head to the registry. |
| `aspirations_add` | `agent_id`, `md_file` | Append an aspiration from a markdown file (append-only). |

### Transcript is not a corpus

`feed` and `aspirations_add` take **file paths and URLs only**. There is no
inline-text or "read my conversation" input — by construction, the server
cannot ingest chat history. To feed text, write it to a file first.

## Authentication

`bind` and `aspirations_add` read credentials from
`~/.config/modex/credentials.json`, written by `modex login` in a terminal. The
MCP server does **not** perform interactive device-code login; if no credential
is present it returns an actionable error pointing you to the CLI.

## Usage

Add to your MCP host config (e.g. Claude Code):

```json
{
  "mcpServers": {
    "modex": { "command": "npx", "args": ["-y", "@mojax/mcp"] }
  }
}
```

## Local development

This package depends on the **published** `@mojax/core`. Before that package is
on npm, install it from a local tarball built in the `modex-cli` repo:

```sh
# in modex-cli: pnpm --filter @mojax/core pack  → modex-core-<version>.tgz
npm install            # installs everything except @mojax/core
npm install ../modex-core-0.3.1.tgz --no-save   # local @mojax/core
npm run build && npm test
```

Once `@mojax/core` is published, a plain `npm install` resolves it from the
registry.

## License

MIT — see [LICENSE](./LICENSE).
