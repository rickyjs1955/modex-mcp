import { loadCredentials, runBind } from '@modexagents/core';
import { z } from 'zod';

import { captureStream, errorResult, guard, textResult, type ToolResult } from './shared.js';

export const bindInputSchema = {
  agent_id: z.string().describe('UUIDv7 of the agent to bind to the registry.'),
};

export interface BindArgs {
  agent_id: string;
}

export interface RegistryHandlerOpts {
  baseDir?: string;
  configDir?: string;
  fetch?: typeof globalThis.fetch;
}

const NO_CREDENTIALS =
  'No Modex credentials found. Run `modex login` in a terminal first — the ' +
  'MCP server cannot perform the interactive device-code login itself.';

export function handleBind(args: BindArgs, opts: RegistryHandlerOpts = {}): Promise<ToolResult> {
  return guard(async () => {
    // Pre-flight: the MCP server is non-interactive, so surface a clear
    // "log in via the CLI" message rather than letting runBind throw a
    // terser CredentialsError.
    const credentials = await loadCredentials(opts.configDir);
    if (credentials === null) {
      return errorResult(NO_CREDENTIALS);
    }
    const out = captureStream();
    await runBind(args.agent_id, {
      baseDir: opts.baseDir,
      configDir: opts.configDir,
      fetch: opts.fetch,
      stdout: out.stream,
    });
    return textResult(out.text().trimEnd());
  });
}
