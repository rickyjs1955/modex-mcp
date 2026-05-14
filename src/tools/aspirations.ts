import { loadCredentials, runAspirationsAdd } from '@mojax/core';
import { z } from 'zod';

import { captureStream, errorResult, guard, textResult, type ToolResult } from './shared.js';
import type { RegistryHandlerOpts } from './bind.js';

export const aspirationsAddInputSchema = {
  agent_id: z.string().describe('UUIDv7 of the already-bound agent.'),
  md_file: z
    .string()
    .describe(
      'Path to a markdown file describing the aspiration. A file path ONLY — ' +
        'this tool does not accept inline text or conversation content.',
    ),
};

export interface AspirationsAddArgs {
  agent_id: string;
  md_file: string;
}

const NO_CREDENTIALS =
  'No Modex credentials found. Run `modex login` in a terminal first — the ' +
  'MCP server cannot perform the interactive device-code login itself.';

export function handleAspirationsAdd(
  args: AspirationsAddArgs,
  opts: RegistryHandlerOpts = {},
): Promise<ToolResult> {
  return guard(async () => {
    const credentials = await loadCredentials(opts.configDir);
    if (credentials === null) {
      return errorResult(NO_CREDENTIALS);
    }
    const out = captureStream();
    await runAspirationsAdd(args.agent_id, args.md_file, {
      baseDir: opts.baseDir,
      configDir: opts.configDir,
      fetch: opts.fetch,
      stdout: out.stream,
    });
    return textResult(out.text().trimEnd());
  });
}
