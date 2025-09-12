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

function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function resolveRef(ref, components) {
    if (typeof ref !== "string" || !ref.startsWith("#/components/schemas/")) return null;
    const key = ref.replace("#/components/schemas/", "");
    if (!components || !components.schemas || !components.schemas[key]) return null;
    return components.schemas[key];
}

function dereferenceSchema(schema, components, seen = new Set()) {
    if (!schema || typeof schema !== "object") return schema;
    if (schema.$ref && typeof schema.$ref === "string") {
        const refKey = schema.$ref;
        if (seen.has(refKey)) return {}; // prevent cycles
        const resolved = resolveRef(refKey, components);
        if (!resolved) return deepClone(schema);
        seen.add(refKey);
        const derefResolved = dereferenceSchema(resolved, components, seen);
        // Merge to allow local overrides alongside $ref (OpenAPI 3.1 behavior)
        const { $ref, ...rest } = schema;
        return dereferenceSchema({ ...deepClone(derefResolved), ...deepClone(rest) }, components, seen);
    }
    // Recurse into known composite keywords
    const out = Array.isArray(schema) ? [] : {};
    for (const [k, v] of Object.entries(schema)) {
        if (v && typeof v === "object") {
            if (k === "items") {
                out[k] = dereferenceSchema(v, components, new Set(seen));
            } else if (k === "properties") {
                const props = {};
                for (const [pk, pv] of Object.entries(v)) {
                    props[pk] = dereferenceSchema(pv, components, new Set(seen));
                }
                out[k] = props;
            } else if (["allOf", "anyOf", "oneOf"].includes(k) && Array.isArray(v)) {
                out[k] = v.map((entry) => dereferenceSchema(entry, components, new Set(seen)));
            } else {
                out[k] = dereferenceSchema(v, components, new Set(seen));
            }
        } else {
            out[k] = v;
        }
    }
    return out;
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
            // Dereference schemas so tools.json is self-contained
            const components = openapi.components || {};
            const inputSchemaDeref = dereferenceSchema(inputSchema, components);
            const outputSchemaDeref = dereferenceSchema(outputSchema, components);
            tools.push({
                name: toolName,
                method: method.toUpperCase(),
                path: p,
                description: summary,
                inputSchema: inputSchemaDeref,
                outputSchema: outputSchemaDeref,
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


