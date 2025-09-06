#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OPENAPI_PATH = path.join(repoRoot, "shared", "openapi.json");
const OUTPUT_DIR = path.join(repoRoot, "mcp", "taskmaster-server");

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function readOpenApi() {
    if (!fs.existsSync(OPENAPI_PATH)) {
        throw new Error(`OpenAPI spec not found at ${OPENAPI_PATH}. Run build first.`);
    }
    const raw = fs.readFileSync(OPENAPI_PATH, "utf-8");
    return JSON.parse(raw);
}

function sanitizeOperationId(opId, fallback) {
    if (typeof opId === "string" && opId.trim().length > 0) return opId.trim();
    return fallback;
}

function extractTasksTools(openapi) {
    const tools = [];
    const paths = openapi.paths || {};
    for (const [p, methods] of Object.entries(paths)) {
        for (const [method, op] of Object.entries(methods)) {
            if (!op || typeof op !== "object") continue;
            const tags = Array.isArray(op.tags) ? op.tags : [];
            if (!tags.includes("tasks")) continue;
            const nameBase = sanitizeOperationId(op.operationId, `${method}_${p.replace(/[^a-zA-Z0-9]+/g, "_")}`);
            const toolName = `tasks.${nameBase}`;
            const summary = op.summary || op.description || `${method.toUpperCase()} ${p}`;
            // Build a very loose JSON Schema for inputs (prefer requestBody schema if present)
            let inputSchema = { type: "object", properties: {}, additionalProperties: true };
            const reqBody = op.requestBody;
            if (reqBody && reqBody.content && reqBody.content["application/json"] && reqBody.content["application/json"].schema) {
                inputSchema = reqBody.content["application/json"].schema;
            }
            // Output schema: try first 2xx response application/json schema
            let outputSchema = { type: "object", additionalProperties: true };
            const responses = op.responses || {};
            for (const [code, resp] of Object.entries(responses)) {
                if (!/^2\d\d$/.test(code)) continue;
                const content = resp && resp.content && resp.content["application/json"];
                if (content && content.schema) {
                    outputSchema = content.schema;
                    break;
                }
            }
            tools.push({
                name: toolName,
                method: method.toUpperCase(),
                path: p,
                description: summary,
                inputSchema,
                outputSchema,
            });
        }
    }
    // Sort tools for stability
    tools.sort((a, b) => a.name.localeCompare(b.name));
    return tools;
}

function writeProject(tools) {
    ensureDir(OUTPUT_DIR);
    const pkgJson = {
        name: "taskmaster-mcp-server",
        version: "0.1.0",
        private: true,
        type: "module",
        description: "Auto-generated MCP server for Taskmaster APIs",
        scripts: {
            start: "node server.mjs",
        },
        overrides: {
            "@modelcontextprotocol/sdk": "1.3.0"
        },
        dependencies: {
            "@modelcontextprotocol/sdk": "^1.3.0",
            "node-fetch": "^3.3.2"
        }
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, "package.json"), JSON.stringify(pkgJson, null, 2));

    const toolsJsonPath = path.join(OUTPUT_DIR, "tools.json");
    fs.writeFileSync(toolsJsonPath, JSON.stringify({ tools }, null, 2));

    const serverMjs = `// Auto-generated minimal MCP Server for Taskmaster (stdio)
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
const AUTH_HEADER = process.env.TASKMASTER_API_KEY ? { 'Authorization': \`Bearer \${process.env.TASKMASTER_API_KEY}\` } : {};

const toolsSpec = JSON.parse(fs.readFileSync(path.join(__dirname, 'tools.json'), 'utf-8')).tools;

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
        const url = new URL(t.path, BASE_URL).toString();
        const init = { method: t.method, headers: { 'Content-Type': 'application/json', ...AUTH_HEADER } };
        if (t.method !== 'GET' && input && Object.keys(input).length) {
          init.body = JSON.stringify(input);
        }
        const res = await fetch(url, init);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(\`HTTP \${res.status}: \${text}\`);
        }
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          return await res.json();
        }
        return { ok: true };
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
      throw new Error(\`Tool not found: \${name}\`);
    }
    const url = new URL(t.path, BASE_URL).toString();
    const init = { method: t.method, headers: { 'Content-Type': 'application/json', ...AUTH_HEADER } };
    if (t.method !== 'GET' && args && Object.keys(args).length) {
      init.body = JSON.stringify(args);
    }
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(\`HTTP \${res.status}: \${text}\`);
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return await res.json();
    }
    return { ok: true };
  });
}

const transport = new StdioServerTransport();
await server.connect(transport);
`;

    fs.writeFileSync(path.join(OUTPUT_DIR, "server.mjs"), serverMjs);

    const readme = `# Taskmaster MCP Server (generated)

This MCP server exposes Taskmaster API endpoints as MCP tools. It is generated from the exported OpenAPI spec.

Env vars:
- TASKMASTER_BASE_URL: Base URL to your Taskmaster HTTP API (default: http://127.0.0.1:8000)
- TASKMASTER_API_KEY: Optional bearer token header

Usage:
1) npm install
2) npm start
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, "README.md"), readme);
}

try {
    const spec = readOpenApi();
    const tools = extractTasksTools(spec);
    writeProject(tools);
    console.log(`[mcp] Wrote MCP server project to ${OUTPUT_DIR} with ${tools.length} tools`);
} catch (err) {
    console.error(`[mcp] Failed to generate MCP server:`, err.message || err);
    process.exitCode = 1;
}


