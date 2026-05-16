#!/usr/bin/env bun
/**
 * GBrain HTTP MCP Wrapper
 * 
 * Wraps `gbrain serve` (stdio transport) in an HTTP server for remote access.
 * Supports:
 * - POST /mcp - MCP JSON-RPC over HTTP
 * - GET /health - Health check endpoint
 * - Bearer token authentication
 * 
 * Usage:
 *   bun run http-mcp-wrapper.ts --port 8787 --token YOUR_TOKEN
 *   Or with DATABASE_URL:
 *   DATABASE_URL=... bun run http-mcp-wrapper.ts --port 8787 --token YOUR_TOKEN
 */

import { spawn, ChildProcess } from 'child_process';
import { createHash } from 'crypto';

// Parse command line arguments
const args = Bun.argv.slice(2);
let port = 8787;
let token = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) {
    port = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--token' && args[i + 1]) {
    token = args[i + 1];
    i++;
  }
}

if (!token) {
  console.error('Error: --token is required for security.');
  console.error('Create a token with: bun run src/commands/auth.ts create "trae-solo"');
  process.exit(1);
}

console.log(`Starting GBrain HTTP MCP wrapper on port ${port}...`);

// Spawn gbrain serve
let gbrainProcess: ChildProcess | null = null;
let responseBuffer = '';
let pendingRequests = new Map<number, { resolve: (value: any) => void; reject: (reason: any) => void }>();
let requestId = 1;

function startGBrain() {
  gbrainProcess = spawn('gbrain', ['serve'], {
    cwd: process.cwd(),
    env: process.env,
  });

  gbrainProcess.stdout?.on('data', (data) => {
    const chunk = data.toString();
    responseBuffer += chunk;
    
    // Try to parse complete JSON-RPC responses
    processResponseBuffer();
  });

  gbrainProcess.stderr?.on('data', (data) => {
    console.error('[gbrain]', data.toString());
  });

  gbrainProcess.on('close', (code) => {
    console.error(`gbrain process exited with code ${code}`);
    // Restart after 2 seconds
    setTimeout(() => {
      console.log('Restarting gbrain...');
      startGBrain();
    }, 2000);
  });

  gbrainProcess.on('error', (err) => {
    console.error('Failed to start gbrain:', err);
  });
}

function processResponseBuffer() {
  // Split by newline to find complete JSON objects
  // MCP over stdio uses line-delimited JSON
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || ''; // Keep incomplete line in buffer
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const response = JSON.parse(line);
      
      // Match response to pending request
      if (response.id && pendingRequests.has(response.id)) {
        const { resolve } = pendingRequests.get(response.id)!;
        pendingRequests.delete(response.id);
        resolve(response);
      }
    } catch (e) {
      // Not valid JSON, skip
    }
  }
}

function sendRequestToGBrain(request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!gbrainProcess || !gbrainProcess.stdin) {
      reject(new Error('gbrain process not ready'));
      return;
    }

    const id = requestId++;
    const requestWithId = { ...request, id };
    
    pendingRequests.set(id, { resolve, reject });

    // Send as line-delimited JSON
    gbrainProcess.stdin.write(JSON.stringify(requestWithId) + '\n', (err) => {
      if (err) {
        pendingRequests.delete(id);
        reject(err);
      }
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }
    }, 60000);
  });
}

// Start gbrain
startGBrain();

// HTTP server
const server = Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, status: 'running' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // MCP endpoint
    if (url.pathname === '/mcp') {
      // Verify Authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ 
          jsonrpc: '2.0',
          error: { code: -32000, message: 'missing_auth' },
          id: null 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const providedToken = authHeader.slice(7);
      if (providedToken !== token) {
        return new Response(JSON.stringify({ 
          jsonrpc: '2.0',
          error: { code: -32000, message: 'invalid_token' },
          id: null 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        const request = await req.json();
        const response = await sendRequestToGBrain(request);
        return new Response(JSON.stringify(response), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ 
          jsonrpc: '2.0',
          error: { code: -32000, message: e.message || 'internal_error' },
          id: null 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('Not found', { status: 404 });
  },
});

console.log(`GBrain HTTP MCP wrapper running on http://0.0.0.0:${port}`);
console.log(`Health check: http://localhost:${port}/health`);
console.log(`MCP endpoint: http://localhost:${port}/mcp`);
console.log(`Use --token to authenticate requests`);
