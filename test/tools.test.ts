import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { createAgent, readChain, saveCredentials, verifyChain } from '@modexagents/core';

import { handleFeed, feedInputSchema } from '../src/tools/feed.js';
import { handleAgentsCreate, handleAgentsList } from '../src/tools/agents.js';
import { handleBind } from '../src/tools/bind.js';
import { handleAspirationsAdd } from '../src/tools/aspirations.js';

const FIXED_ID = '01928c8e-1234-7abc-8def-0123456789ab';
const REGISTRY = 'https://registry.example';

function fakeAnthropic(
  skillsByCall: Array<Array<{ slug: string; name: string; description: string; tags: string[] }>>,
) {
  let call = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        const skills = skillsByCall[call] ?? skillsByCall[skillsByCall.length - 1] ?? [];
        call++;
        return {
          id: 'msg_test',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
          content: [{ type: 'tool_use', id: 't1', name: 'emit_skills', input: { skills } }],
        };
      }),
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  const nullBody = status === 204 || status === 205 || status === 304;
  return new Response(nullBody || body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function routedFetch(routes: Record<string, Response[]>) {
  const cursors: Record<string, number> = {};
  return vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    const key = Object.keys(routes).find((k) => u.includes(k));
    if (!key) throw new Error(`no route for ${u}`);
    const idx = cursors[key] ?? 0;
    cursors[key] = idx + 1;
    const queue = routes[key]!;
    return queue[idx] ?? queue[queue.length - 1]!;
  }) as unknown as typeof globalThis.fetch;
}

async function tempDirs() {
  return {
    baseDir: await mkdtemp(join(tmpdir(), 'modex-mcp-base-')),
    configDir: await mkdtemp(join(tmpdir(), 'modex-mcp-cfg-')),
  };
}

describe('feed tool', () => {
  it('schema has no inline-content field — sources are paths/globs/URLs only', () => {
    expect(Object.keys(feedInputSchema).sort()).toEqual(['agent_id', 'model', 'patterns']);
  });

  it('feeds an agent from a file path and reports the summary', async () => {
    const { baseDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z', name: 'demo' });
    const corpus = join(baseDir, 'book.md');
    await writeFile(corpus, 'Some corpus describing techniques.', 'utf8');

    const result = await handleFeed(
      { agent_id: FIXED_ID, patterns: [corpus] },
      {
        baseDir,
        apiKey: 'test',
        client: fakeAnthropic([
          [{ slug: 'five-whys', name: 'Five Whys', description: 'Ask why.', tags: ['debugging'] }],
        ]),
      },
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain('+1 added');

    const chain = await readChain(join(baseDir, '.modex', FIXED_ID, 'provenance.jsonl'));
    expect(chain).toHaveLength(2);
    verifyChain(chain);
  });

  it('returns isError for a nonexistent source path', async () => {
    const { baseDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z' });
    const result = await handleFeed(
      { agent_id: FIXED_ID, patterns: [join(baseDir, 'missing.md')] },
      { baseDir, apiKey: 'test', client: fakeAnthropic([[]]) },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/error:/);
  });
});

describe('agents tools', () => {
  it('creates an agent and lists it', async () => {
    const { baseDir } = await tempDirs();
    const created = await handleAgentsCreate({ name: 'handbook' }, { baseDir });
    expect(created.isError).toBeUndefined();
    expect(created.content[0]!.text).toMatch(/Created agent [0-9a-f-]{36}/);

    const listed = await handleAgentsList({ baseDir });
    expect(listed.content[0]!.text).toContain('handbook');
  });

  it('agents_list reports an empty directory gracefully', async () => {
    const { baseDir } = await tempDirs();
    const listed = await handleAgentsList({ baseDir });
    expect(listed.content[0]!.text).toContain('no agents');
  });
});

describe('bind tool', () => {
  it('returns an actionable isError when there are no credentials', async () => {
    const { baseDir, configDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z' });
    const result = await handleBind({ agent_id: FIXED_ID }, { baseDir, configDir });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/modex login.*terminal/i);
  });

  it('binds when credentials are present', async () => {
    const { baseDir, configDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z' });
    await saveCredentials(
      { schema_version: 1, access_token: 'tok_live', registry_url: REGISTRY },
      configDir,
    );
    const result = await handleBind(
      { agent_id: FIXED_ID },
      {
        baseDir,
        configDir,
        fetch: routedFetch({
          '/bind': [
            jsonResponse(200, {
              skills_md_sha256: 'f'.repeat(64),
              bound_at: '2026-05-15T01:00:00.000Z',
            }),
          ],
        }),
      },
    );
    expect(result.isError).toBeUndefined();
    expect(result.content[0]!.text).toContain('Bound');

    const chain = await readChain(join(baseDir, '.modex', FIXED_ID, 'provenance.jsonl'));
    expect(chain[1]!.kind).toBe('bound');
    verifyChain(chain);
  });
});

describe('aspirations_add tool', () => {
  it('returns isError without credentials', async () => {
    const { baseDir, configDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z' });
    const aspFile = join(baseDir, 'goal.md');
    await writeFile(aspFile, '# A goal\n', 'utf8');
    const result = await handleAspirationsAdd(
      { agent_id: FIXED_ID, md_file: aspFile },
      { baseDir, configDir },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/modex login/i);
  });

  it('returns isError when the agent is not bound', async () => {
    const { baseDir, configDir } = await tempDirs();
    await createAgent({ baseDir, id: FIXED_ID, ts: '2026-05-15T00:00:00.000Z' });
    await saveCredentials(
      { schema_version: 1, access_token: 'tok_live', registry_url: REGISTRY },
      configDir,
    );
    const aspFile = join(baseDir, 'goal.md');
    await writeFile(aspFile, '# A goal\n', 'utf8');
    const result = await handleAspirationsAdd(
      { agent_id: FIXED_ID, md_file: aspFile },
      { baseDir, configDir, fetch: routedFetch({}) },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toMatch(/not bound/i);
  });
});
