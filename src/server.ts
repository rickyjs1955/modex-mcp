import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import {
  agentsCreateInputSchema,
  agentsListInputSchema,
  handleAgentsCreate,
  handleAgentsList,
} from './tools/agents.js';
import { aspirationsAddInputSchema, handleAspirationsAdd } from './tools/aspirations.js';
import { bindInputSchema, handleBind } from './tools/bind.js';
import { feedInputSchema, handleFeed } from './tools/feed.js';

export const SERVER_NAME = 'modex-mcp';
export const SERVER_VERSION = '0.1.0';

// Build the MCP server with all five modex tools registered. Every tool
// delegates straight to a @mojax/core operation — this package holds the tool
// schemas and the stdio plumbing, nothing else.
export function buildServer(): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    'feed',
    {
      title: 'Feed sources into an agent',
      description:
        "Extract skills from explicit file paths, globs, or URLs and merge them " +
        "into an agent's SKILLS.md, appending a provenance entry per source. " +
        'Operates on the filesystem and the web only — it never reads the ' +
        'conversation.',
      inputSchema: feedInputSchema,
    },
    (args) => handleFeed(args),
  );

  server.registerTool(
    'agents_create',
    {
      title: 'Create an agent',
      description: 'Create a new local agent under .modex/<uuid7>/.',
      inputSchema: agentsCreateInputSchema,
    },
    (args) => handleAgentsCreate(args),
  );

  server.registerTool(
    'agents_list',
    {
      title: 'List agents',
      description: 'List the local agents in the current directory.',
      inputSchema: agentsListInputSchema,
    },
    () => handleAgentsList(),
  );

  server.registerTool(
    'bind',
    {
      title: 'Bind an agent to the registry',
      description:
        'Upload an agent\'s SKILLS.md and provenance head to the Modex ' +
        'registry. Requires credentials from a prior `modex login` run in a ' +
        'terminal.',
      inputSchema: bindInputSchema,
    },
    (args) => handleBind(args),
  );

  server.registerTool(
    'aspirations_add',
    {
      title: 'Add an aspiration',
      description:
        'Append an aspiration (from a markdown file path) to a bound agent. ' +
        'Append-only — aspirations cannot be edited or removed.',
      inputSchema: aspirationsAddInputSchema,
    },
    (args) => handleAspirationsAdd(args),
  );

  return server;
}
