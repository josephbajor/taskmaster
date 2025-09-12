// Auto-generated minimal MCP Server for Taskmaster (stdio)
// Reads tool specs from tools.json and proxies requests to the Taskmaster HTTP API
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:8000';
const AUTH_HEADER = process.env.TASKMASTER_API_KEY ? { 'Authorization': `Bearer ${process.env.TASKMASTER_API_KEY}` } : {};

const toolsSpec = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf-8')).tools;

function buildUrlWithQuery(basePath, args) {
  const url = new URL(basePath, BASE_URL);
  if (args && typeof args === 'object') {
    for (const [k, v] of Object.entries(args)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          url.searchParams.append(k, String(item));
        }
      } else if (typeof v === 'object') {
        // naive serialization for objects
        url.searchParams.set(k, JSON.stringify(v));
      } else {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url;
}

async function fetchWithRetry(url, init, { attempts = 2, timeoutMs = 15000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(to);
      return res;
    } catch (err) {
      clearTimeout(to);
      lastErr = err;
      if (i < attempts - 1) continue;
    }
  }
  throw lastErr;
}

async function callToolHttp(t, args) {
  const method = t.method;
  const headers = { 'Content-Type': 'application/json', ...AUTH_HEADER };
  let url;
  const init = { method, headers };
  if (method === 'GET') {
    url = buildUrlWithQuery(t.path, args).toString();
  } else {
    url = new URL(t.path, BASE_URL).toString();
    if (args && Object.keys(args).length) {
      init.body = JSON.stringify(args);
    }
  }
  const res = await fetchWithRetry(url, init);
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (!res.ok) {
    const text = ct.includes('application/json') ? JSON.stringify(await res.json()) : await res.text();
    return { isError: true, content: [{ type: 'text', text: 'HTTP ' + res.status + ': ' + text }] };
  }
  if (ct.includes('application/json')) {
    const body = await res.json();
    return { content: [{ type: 'json', json: body }] };
  }
  const text = await res.text();
  return { content: [{ type: 'text', text: text || 'ok' }] };
}

const server = new Server({
  name: 'taskmaster-mcp',
  version: '0.1.0'
}, {
  capabilities: { tools: {} }
});

if (typeof server.tool === 'function') {
  for (const t of toolsSpec) {
    server.tool({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
      handler: async (input) => {
        return await callToolHttp(t, input || {});
      }
    });
  }
} else if (typeof server.setRequestHandler === 'function') {
  // Register handlers using typed schemas
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolsSpec.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        outputSchema: t.outputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params || {};
    const t = toolsSpec.find((x) => x.name === name);
    if (!t) {
      return { isError: true, content: [{ type: 'text', text: 'Tool not found: ' + name }] };
    }
    return await callToolHttp(t, args || {});
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
