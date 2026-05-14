import { Writable } from 'node:stream';

import { isUserFacingError } from '@mojax/core';

// The shape an MCP tool handler must return.
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
  [key: string]: unknown;
}

export function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text: text.length > 0 ? text : '(no output)' }] };
}

export function errorResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

// A Writable that accumulates everything written, so a core operation's
// stdout/stderr can be captured and returned as the tool's text result.
export function captureStream(): { stream: NodeJS.WritableStream; text: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk.toString('utf8'));
      cb();
    },
  });
  return { stream: stream as unknown as NodeJS.WritableStream, text: () => chunks.join('') };
}

// Run a tool body, mapping every failure to an isError result so a bad tool
// call never tears down the stdio server. User-facing errors (bad input, auth
// needed, registry rejection) surface their message verbatim; anything else is
// labelled as unexpected.
export async function guard(fn: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await fn();
  } catch (err) {
    if (isUserFacingError(err)) {
      return errorResult(`error: ${err.message}`);
    }
    return errorResult(
      `unexpected error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
