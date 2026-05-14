import { runAgentsCreate, runAgentsList } from '@modex/core';
import { z } from 'zod';

import { captureStream, guard, textResult, type ToolResult } from './shared.js';

export const agentsCreateInputSchema = {
  name: z
    .string()
    .optional()
    .describe('Optional human-readable label for the new agent.'),
};

export const agentsListInputSchema = {};

export interface AgentsCreateArgs {
  name?: string;
}

export interface AgentsHandlerOpts {
  baseDir?: string;
}

export function handleAgentsCreate(
  args: AgentsCreateArgs,
  opts: AgentsHandlerOpts = {},
): Promise<ToolResult> {
  return guard(async () => {
    const out = captureStream();
    const id = await runAgentsCreate({ name: args.name, baseDir: opts.baseDir, stdout: out.stream });
    return textResult(`Created agent ${id}`);
  });
}

export function handleAgentsList(opts: AgentsHandlerOpts = {}): Promise<ToolResult> {
  return guard(async () => {
    const out = captureStream();
    await runAgentsList({ baseDir: opts.baseDir, stdout: out.stream });
    return textResult(out.text().trimEnd());
  });
}
