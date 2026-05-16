#!/usr/bin/env bun
/**
 * GBrain MCP Client for Trae Solo
 * Connects to remote HTTP MCP server and bridges to stdio
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

// Configuration
const args = Bun.argv.slice(2);
let remoteUrl = 'http://localhost:8787/mcp';
let token = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url' && args[i + 1]) {
    remoteUrl = args[i + 1];
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    token = args[i + 1];
    i++;
  }
}

if (!token) {
  console.error('Error: --token is required');
  process.exit(1);
}

console.error(`Connecting to GBrain at ${remoteUrl}...`);

// Cache tools list
let cachedTools: any[] | null = null;

async function callRemoteMCPServer(request: any) {
  const response = await fetch(remoteUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Remote server error: ${response.status}`);
  }

  return response.json();
}

const server = new Server(
  { name: 'gbrain-remote', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (!cachedTools) {
    const response = await callRemoteMCPServer({
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 1,
    });
    cachedTools = response.result?.tools || [];
  }
  return { tools: cachedTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const response = await callRemoteMCPServer({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: request.params,
    id: Date.now(),
  });
  
  return response.result || response;
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('GBrain Remote MCP Client connected');
