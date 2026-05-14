import { runFeed, type FeedOptions } from '@modex/core';
import { z } from 'zod';

import { captureStream, guard, textResult, type ToolResult } from './shared.js';

// Input schema as a Zod raw shape — the MCP SDK validates the host's tool call
// against this before the handler runs.
export const feedInputSchema = {
  agent_id: z
    .string()
    .describe('UUIDv7 of the target agent (from agents_create or agents_list).'),
  patterns: z
    .array(z.string())
    .min(1)
    .describe(
      'Explicit file paths, globs, or http(s) URLs to ingest as a corpus. ' +
        'These are filesystem and URL sources ONLY — this tool does not and ' +
        'cannot read conversation history or any inline text. To feed text, ' +
        'write it to a file first and pass the path.',
    ),
  model: z
    .string()
    .optional()
    .describe('Anthropic model id for extraction (default: Claude Haiku 4.5).'),
};

export interface FeedArgs {
  agent_id: string;
  patterns: string[];
  model?: string;
}

// Test seam: the same injectable points core's runFeed already exposes.
export type FeedHandlerOpts = Pick<
  FeedOptions,
  'baseDir' | 'client' | 'apiKey' | 'loadSource'
>;

export function handleFeed(args: FeedArgs, opts: FeedHandlerOpts = {}): Promise<ToolResult> {
  return guard(async () => {
    const out = captureStream();
    const err = captureStream();
    await runFeed(args.agent_id, args.patterns, {
      model: args.model,
      ...opts,
      stdout: out.stream,
      stderr: err.stream,
    });
    const parts = [out.text().trimEnd()];
    const warnings = err.text().trim();
    if (warnings.length > 0) parts.push(warnings);
    return textResult(parts.filter((p) => p.length > 0).join('\n'));
  });
}
