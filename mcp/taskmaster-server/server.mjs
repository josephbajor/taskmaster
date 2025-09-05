// Auto-generated minimal MCP Server for Taskmaster (stdio)
// Reads tool specs from tools.json and proxies requests to the Taskmaster HTTP API
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.TASKMASTER_BASE_URL || 'http://127.0.0.1:8000';
const AUTH_HEADER = process.env.TASKMASTER_API_KEY ? { 'Authorization': `Bearer ${process.env.TASKMASTER_API_KEY}` } : {};

const toolsSpec = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf-8')).tools;

const server = new Server({
  name: 'taskmaster-mcp',
  version: '0.1.0'
}, {
  capabilities: { tools: {} }
});

for (const t of toolsSpec) {
  server.tool({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    outputSchema: t.outputSchema,
    handler: async (input) => {
      const url = new URL(t.path, BASE_URL).toString();
      const init = { method: t.method, headers: { 'Content-Type': 'application/json', ...AUTH_HEADER } };
      if (t.method !== 'GET' && input && Object.keys(input).length) {
        init.body = JSON.stringify(input);
      }
      const res = await fetch(url, init);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return await res.json();
      }
      return { ok: true };
    }
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
