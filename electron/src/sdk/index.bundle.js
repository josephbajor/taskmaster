var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/sdk/api/index.ts
var api_exports = {};
__export(api_exports, {
  TaskStatus: () => TaskStatus,
  system: () => system_exports,
  tasks: () => tasks_exports,
  transcription: () => transcription_exports
});

// src/sdk/api/resources/system/index.ts
var system_exports = {};

// src/sdk/api/resources/tasks/index.ts
var tasks_exports = {};
__export(tasks_exports, {
  TaskStatus: () => TaskStatus
});

// src/sdk/api/resources/tasks/types/TaskStatus.ts
var TaskStatus = {
  Todo: "TODO",
  InProgress: "IN_PROGRESS",
  Completed: "COMPLETED",
  Cancelled: "CANCELLED"
};

// src/sdk/api/resources/transcription/index.ts
var transcription_exports = {};

// src/sdk/core/json.ts
var toJson = (value, replacer, space) => {
  return JSON.stringify(value, replacer, space);
};
function fromJson(text, reviver) {
  return JSON.parse(text, reviver);
}

// src/sdk/errors/TaskmasterTaskmasterError.ts
var TaskmasterTaskmasterError = class _TaskmasterTaskmasterError extends Error {
  statusCode;
  body;
  rawResponse;
  constructor({
    message,
    statusCode,
    body,
    rawResponse
  }) {
    super(buildMessage({ message, statusCode, body }));
    Object.setPrototypeOf(this, _TaskmasterTaskmasterError.prototype);
    this.statusCode = statusCode;
    this.body = body;
    this.rawResponse = rawResponse;
  }
};
function buildMessage({
  message,
  statusCode,
  body
}) {
  let lines = [];
  if (message != null) {
    lines.push(message);
  }
  if (statusCode != null) {
    lines.push(`Status code: ${statusCode.toString()}`);
  }
  if (body != null) {
    lines.push(`Body: ${toJson(body, void 0, 2)}`);
  }
  return lines.join("\n");
}

// src/sdk/errors/TaskmasterTaskmasterTimeoutError.ts
var TaskmasterTaskmasterTimeoutError = class _TaskmasterTaskmasterTimeoutError extends Error {
  constructor(message) {
    super(message);
    Object.setPrototypeOf(this, _TaskmasterTaskmasterTimeoutError.prototype);
  }
};

// src/sdk/core/url/qs.ts
var defaultQsOptions = {
  arrayFormat: "indices",
  encode: true
};
function encodeValue(value, shouldEncode) {
  if (value === void 0) {
    return "";
  }
  if (value === null) {
    return "";
  }
  const stringValue = String(value);
  return shouldEncode ? encodeURIComponent(stringValue) : stringValue;
}
function stringifyObject(obj, prefix = "", options) {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === void 0) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (item === void 0) {
          continue;
        }
        if (typeof item === "object" && !Array.isArray(item) && item !== null) {
          const arrayKey = options.arrayFormat === "indices" ? `${fullKey}[${i}]` : fullKey;
          parts.push(...stringifyObject(item, arrayKey, options));
        } else {
          const arrayKey = options.arrayFormat === "indices" ? `${fullKey}[${i}]` : fullKey;
          const encodedKey = options.encode ? encodeURIComponent(arrayKey) : arrayKey;
          parts.push(`${encodedKey}=${encodeValue(item, options.encode)}`);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      if (Object.keys(value).length === 0) {
        continue;
      }
      parts.push(...stringifyObject(value, fullKey, options));
    } else {
      const encodedKey = options.encode ? encodeURIComponent(fullKey) : fullKey;
      parts.push(`${encodedKey}=${encodeValue(value, options.encode)}`);
    }
  }
  return parts;
}
function toQueryString(obj, options) {
  if (obj == null || typeof obj !== "object") {
    return "";
  }
  const parts = stringifyObject(obj, "", {
    ...defaultQsOptions,
    ...options
  });
  return parts.join("&");
}

// src/sdk/core/fetcher/createRequestUrl.ts
function createRequestUrl(baseUrl, queryParameters) {
  const queryString = toQueryString(queryParameters, { arrayFormat: "repeat" });
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// src/sdk/core/fetcher/BinaryResponse.ts
function getBinaryResponse(response) {
  const binaryResponse = {
    get bodyUsed() {
      return response.bodyUsed;
    },
    stream: () => response.body,
    arrayBuffer: response.arrayBuffer.bind(response),
    blob: response.blob.bind(response)
  };
  if ("bytes" in response && typeof response.bytes === "function") {
    binaryResponse.bytes = response.bytes.bind(response);
  }
  return binaryResponse;
}

// src/sdk/core/fetcher/ResponseWithBody.ts
function isResponseWithBody(response) {
  return response.body != null;
}

// src/sdk/core/fetcher/getResponseBody.ts
async function getResponseBody(response, responseType) {
  if (!isResponseWithBody(response)) {
    return void 0;
  }
  switch (responseType) {
    case "binary-response":
      return getBinaryResponse(response);
    case "blob":
      return await response.blob();
    case "arrayBuffer":
      return await response.arrayBuffer();
    case "sse":
      return response.body;
    case "streaming":
      return response.body;
    case "text":
      return await response.text();
  }
  const text = await response.text();
  if (text.length > 0) {
    try {
      let responseBody = fromJson(text);
      return responseBody;
    } catch (err) {
      return {
        ok: false,
        error: {
          reason: "non-json",
          statusCode: response.status,
          rawBody: text
        }
      };
    }
  }
  return void 0;
}

// src/sdk/core/fetcher/getErrorResponseBody.ts
async function getErrorResponseBody(response) {
  let contentType = response.headers.get("Content-Type")?.toLowerCase();
  if (contentType == null || contentType.length === 0) {
    return getResponseBody(response);
  }
  if (contentType.indexOf(";") !== -1) {
    contentType = contentType.split(";")[0]?.trim() ?? "";
  }
  switch (contentType) {
    case "application/hal+json":
    case "application/json":
    case "application/ld+json":
    case "application/problem+json":
    case "application/vnd.api+json":
    case "text/json":
      const text = await response.text();
      return text.length > 0 ? fromJson(text) : void 0;
    default:
      if (contentType.startsWith("application/vnd.") && contentType.endsWith("+json")) {
        const text2 = await response.text();
        return text2.length > 0 ? fromJson(text2) : void 0;
      }
      return await response.text();
  }
}

// src/sdk/core/fetcher/getFetchFn.ts
async function getFetchFn() {
  return fetch;
}

// src/sdk/core/fetcher/getRequestBody.ts
async function getRequestBody({ body, type }) {
  if (type.includes("json")) {
    return toJson(body);
  } else {
    return body;
  }
}

// src/sdk/core/fetcher/signals.ts
var TIMEOUT = "timeout";
function getTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const abortId = setTimeout(() => controller.abort(TIMEOUT), timeoutMs);
  return { signal: controller.signal, abortId };
}
function anySignal(...args) {
  const signals = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal?.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal?.reason), {
      signal: controller.signal
    });
  }
  return controller.signal;
}

// src/sdk/core/fetcher/makeRequest.ts
var makeRequest = async (fetchFn, url, method, headers, requestBody, timeoutMs, abortSignal, withCredentials, duplex) => {
  const signals = [];
  let timeoutAbortId = void 0;
  if (timeoutMs != null) {
    const { signal, abortId } = getTimeoutSignal(timeoutMs);
    timeoutAbortId = abortId;
    signals.push(signal);
  }
  if (abortSignal != null) {
    signals.push(abortSignal);
  }
  let newSignals = anySignal(signals);
  const response = await fetchFn(url, {
    method,
    headers,
    body: requestBody,
    signal: newSignals,
    credentials: withCredentials ? "include" : void 0,
    // @ts-ignore
    duplex
  });
  if (timeoutAbortId != null) {
    clearTimeout(timeoutAbortId);
  }
  return response;
};

// src/sdk/core/fetcher/Headers.ts
var Headers;
if (typeof globalThis.Headers !== "undefined") {
  Headers = globalThis.Headers;
} else {
  Headers = class Headers2 {
    headers;
    constructor(init) {
      this.headers = /* @__PURE__ */ new Map();
      if (init) {
        if (init instanceof Headers2) {
          init.forEach((value, key) => this.append(key, value));
        } else if (Array.isArray(init)) {
          for (const [key, value] of init) {
            if (typeof key === "string" && typeof value === "string") {
              this.append(key, value);
            } else {
              throw new TypeError("Each header entry must be a [string, string] tuple");
            }
          }
        } else {
          for (const [key, value] of Object.entries(init)) {
            if (typeof value === "string") {
              this.append(key, value);
            } else {
              throw new TypeError("Header values must be strings");
            }
          }
        }
      }
    }
    append(name, value) {
      const key = name.toLowerCase();
      const existing = this.headers.get(key) || [];
      this.headers.set(key, [...existing, value]);
    }
    delete(name) {
      const key = name.toLowerCase();
      this.headers.delete(key);
    }
    get(name) {
      const key = name.toLowerCase();
      const values = this.headers.get(key);
      return values ? values.join(", ") : null;
    }
    has(name) {
      const key = name.toLowerCase();
      return this.headers.has(key);
    }
    set(name, value) {
      const key = name.toLowerCase();
      this.headers.set(key, [value]);
    }
    forEach(callbackfn, thisArg) {
      const boundCallback = thisArg ? callbackfn.bind(thisArg) : callbackfn;
      this.headers.forEach((values, key) => boundCallback(values.join(", "), key, this));
    }
    getSetCookie() {
      return this.headers.get("set-cookie") || [];
    }
    *entries() {
      for (const [key, values] of this.headers.entries()) {
        yield [key, values.join(", ")];
      }
    }
    *keys() {
      yield* this.headers.keys();
    }
    *values() {
      for (const values of this.headers.values()) {
        yield values.join(", ");
      }
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

// src/sdk/core/fetcher/RawResponse.ts
var abortRawResponse = {
  headers: new Headers(),
  redirected: false,
  status: 499,
  statusText: "Client Closed Request",
  type: "error",
  url: ""
};
var unknownRawResponse = {
  headers: new Headers(),
  redirected: false,
  status: 0,
  statusText: "Unknown Error",
  type: "error",
  url: ""
};
function toRawResponse(response) {
  return {
    headers: response.headers,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    type: response.type,
    url: response.url
  };
}

// src/sdk/core/fetcher/requestWithRetries.ts
var INITIAL_RETRY_DELAY = 1e3;
var MAX_RETRY_DELAY = 6e4;
var DEFAULT_MAX_RETRIES = 2;
var JITTER_FACTOR = 0.2;
function addJitter(delay) {
  const jitterMultiplier = 1 + (Math.random() * 2 - 1) * JITTER_FACTOR;
  return delay * jitterMultiplier;
}
async function requestWithRetries(requestFn, maxRetries = DEFAULT_MAX_RETRIES) {
  let response = await requestFn();
  for (let i = 0; i < maxRetries; ++i) {
    if ([408, 429].includes(response.status) || response.status >= 500) {
      const baseDelay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, i), MAX_RETRY_DELAY);
      const delayWithJitter = addJitter(baseDelay);
      await new Promise((resolve) => setTimeout(resolve, delayWithJitter));
      response = await requestFn();
    } else {
      break;
    }
  }
  return response;
}

// src/sdk/core/fetcher/Supplier.ts
var Supplier = {
  get: async (supplier) => {
    if (typeof supplier === "function") {
      return supplier();
    } else {
      return supplier;
    }
  }
};

// src/sdk/core/fetcher/Fetcher.ts
async function getHeaders(args) {
  const newHeaders = {};
  if (args.body !== void 0 && args.contentType != null) {
    newHeaders["Content-Type"] = args.contentType;
  }
  if (args.headers == null) {
    return newHeaders;
  }
  for (const [key, value] of Object.entries(args.headers)) {
    const result = await Supplier.get(value);
    if (typeof result === "string") {
      newHeaders[key] = result;
      continue;
    }
    if (result == null) {
      continue;
    }
    newHeaders[key] = `${result}`;
  }
  return newHeaders;
}
async function fetcherImpl(args) {
  const url = createRequestUrl(args.url, args.queryParameters);
  const requestBody = await getRequestBody({
    body: args.body,
    type: args.requestType === "json" ? "json" : "other"
  });
  const fetchFn = await getFetchFn();
  try {
    const response = await requestWithRetries(
      async () => makeRequest(
        fetchFn,
        url,
        args.method,
        await getHeaders(args),
        requestBody,
        args.timeoutMs,
        args.abortSignal,
        args.withCredentials,
        args.duplex
      ),
      args.maxRetries
    );
    if (response.status >= 200 && response.status < 400) {
      return {
        ok: true,
        body: await getResponseBody(response, args.responseType),
        headers: response.headers,
        rawResponse: toRawResponse(response)
      };
    } else {
      return {
        ok: false,
        error: {
          reason: "status-code",
          statusCode: response.status,
          body: await getErrorResponseBody(response)
        },
        rawResponse: toRawResponse(response)
      };
    }
  } catch (error) {
    if (args.abortSignal != null && args.abortSignal.aborted) {
      return {
        ok: false,
        error: {
          reason: "unknown",
          errorMessage: "The user aborted a request"
        },
        rawResponse: abortRawResponse
      };
    } else if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        error: {
          reason: "timeout"
        },
        rawResponse: abortRawResponse
      };
    } else if (error instanceof Error) {
      return {
        ok: false,
        error: {
          reason: "unknown",
          errorMessage: error.message
        },
        rawResponse: unknownRawResponse
      };
    }
    return {
      ok: false,
      error: {
        reason: "unknown",
        errorMessage: toJson(error)
      },
      rawResponse: unknownRawResponse
    };
  }
}
var fetcher = fetcherImpl;

// src/sdk/core/fetcher/HttpResponsePromise.ts
var HttpResponsePromise = class _HttpResponsePromise extends Promise {
  innerPromise;
  unwrappedPromise;
  constructor(promise) {
    super((resolve) => {
      resolve(void 0);
    });
    this.innerPromise = promise;
  }
  /**
   * Creates an `HttpResponsePromise` from a function that returns a promise.
   *
   * @param fn - A function that returns a promise resolving to a `WithRawResponse` object.
   * @param args - Arguments to pass to the function.
   * @returns An `HttpResponsePromise` instance.
   */
  static fromFunction(fn, ...args) {
    return new _HttpResponsePromise(fn(...args));
  }
  /**
   * Creates a function that returns an `HttpResponsePromise` from a function that returns a promise.
   *
   * @param fn - A function that returns a promise resolving to a `WithRawResponse` object.
   * @returns A function that returns an `HttpResponsePromise` instance.
   */
  static interceptFunction(fn) {
    return (...args) => {
      return _HttpResponsePromise.fromPromise(fn(...args));
    };
  }
  /**
   * Creates an `HttpResponsePromise` from an existing promise.
   *
   * @param promise - A promise resolving to a `WithRawResponse` object.
   * @returns An `HttpResponsePromise` instance.
   */
  static fromPromise(promise) {
    return new _HttpResponsePromise(promise);
  }
  /**
   * Creates an `HttpResponsePromise` from an executor function.
   *
   * @param executor - A function that takes resolve and reject callbacks to create a promise.
   * @returns An `HttpResponsePromise` instance.
   */
  static fromExecutor(executor) {
    const promise = new Promise(executor);
    return new _HttpResponsePromise(promise);
  }
  /**
   * Creates an `HttpResponsePromise` from a resolved result.
   *
   * @param result - A `WithRawResponse` object to resolve immediately.
   * @returns An `HttpResponsePromise` instance.
   */
  static fromResult(result) {
    const promise = Promise.resolve(result);
    return new _HttpResponsePromise(promise);
  }
  unwrap() {
    if (!this.unwrappedPromise) {
      this.unwrappedPromise = this.innerPromise.then(({ data }) => data);
    }
    return this.unwrappedPromise;
  }
  /** @inheritdoc */
  then(onfulfilled, onrejected) {
    return this.unwrap().then(onfulfilled, onrejected);
  }
  /** @inheritdoc */
  catch(onrejected) {
    return this.unwrap().catch(onrejected);
  }
  /** @inheritdoc */
  finally(onfinally) {
    return this.unwrap().finally(onfinally);
  }
  /**
   * Retrieves the data and raw response.
   *
   * @returns A promise resolving to a `WithRawResponse` object.
   */
  async withRawResponse() {
    return await this.innerPromise;
  }
};

// src/sdk/core/runtime/runtime.ts
var RUNTIME = evaluateRuntime();
function evaluateRuntime() {
  const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
  if (isBrowser) {
    return {
      type: "browser",
      version: window.navigator.userAgent
    };
  }
  const isCloudflare = typeof globalThis !== "undefined" && globalThis?.navigator?.userAgent === "Cloudflare-Workers";
  if (isCloudflare) {
    return {
      type: "workerd"
    };
  }
  const isEdgeRuntime = typeof EdgeRuntime === "string";
  if (isEdgeRuntime) {
    return {
      type: "edge-runtime"
    };
  }
  const isWebWorker = typeof self === "object" && typeof self?.importScripts === "function" && (self.constructor?.name === "DedicatedWorkerGlobalScope" || self.constructor?.name === "ServiceWorkerGlobalScope" || self.constructor?.name === "SharedWorkerGlobalScope");
  if (isWebWorker) {
    return {
      type: "web-worker"
    };
  }
  const isDeno = typeof Deno !== "undefined" && typeof Deno.version !== "undefined" && typeof Deno.version.deno !== "undefined";
  if (isDeno) {
    return {
      type: "deno",
      version: Deno.version.deno
    };
  }
  const isBun = typeof Bun !== "undefined" && typeof Bun.version !== "undefined";
  if (isBun) {
    return {
      type: "bun",
      version: Bun.version
    };
  }
  const isNode = typeof process !== "undefined" && "version" in process && !!process.version && "versions" in process && !!process.versions?.node;
  if (isNode) {
    return {
      type: "node",
      version: process.versions.node,
      parsedVersion: Number(process.versions.node.split(".")[0])
    };
  }
  const isReactNative = typeof navigator !== "undefined" && navigator?.product === "ReactNative";
  if (isReactNative) {
    return {
      type: "react-native"
    };
  }
  return {
    type: "unknown"
  };
}

// src/sdk/core/url/index.ts
var url_exports = {};
__export(url_exports, {
  join: () => join,
  toQueryString: () => toQueryString
});

// src/sdk/core/url/join.ts
function join(base, ...segments) {
  if (!base) {
    return "";
  }
  if (segments.length === 0) {
    return base;
  }
  if (base.includes("://")) {
    let url;
    try {
      url = new URL(base);
    } catch {
      return joinPath(base, ...segments);
    }
    const lastSegment = segments[segments.length - 1];
    const shouldPreserveTrailingSlash = lastSegment && lastSegment.endsWith("/");
    for (const segment of segments) {
      const cleanSegment = trimSlashes(segment);
      if (cleanSegment) {
        url.pathname = joinPathSegments(url.pathname, cleanSegment);
      }
    }
    if (shouldPreserveTrailingSlash && !url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  }
  return joinPath(base, ...segments);
}
function joinPath(base, ...segments) {
  if (segments.length === 0) {
    return base;
  }
  let result = base;
  const lastSegment = segments[segments.length - 1];
  const shouldPreserveTrailingSlash = lastSegment && lastSegment.endsWith("/");
  for (const segment of segments) {
    const cleanSegment = trimSlashes(segment);
    if (cleanSegment) {
      result = joinPathSegments(result, cleanSegment);
    }
  }
  if (shouldPreserveTrailingSlash && !result.endsWith("/")) {
    result += "/";
  }
  return result;
}
function joinPathSegments(left, right) {
  if (left.endsWith("/")) {
    return left + right;
  }
  return left + "/" + right;
}
function trimSlashes(str) {
  if (!str) return str;
  let start = 0;
  let end = str.length;
  if (str.startsWith("/")) start = 1;
  if (str.endsWith("/")) end = str.length - 1;
  return start === 0 && end === str.length ? str : str.slice(start, end);
}

// src/sdk/core/form-data-utils/FormDataWrapper.ts
function isNamedValue(value) {
  return typeof value === "object" && value != null && "name" in value;
}
function isPathedValue(value) {
  return typeof value === "object" && value != null && "path" in value;
}
function isStreamLike(value) {
  return typeof value === "object" && value != null && ("read" in value || "pipe" in value);
}
function isReadableStream(value) {
  return typeof value === "object" && value != null && "getReader" in value;
}
function isBuffer(value) {
  return typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(value);
}
function isArrayBufferView(value) {
  return ArrayBuffer.isView(value);
}
function getLastPathSegment(pathStr) {
  const lastForwardSlash = pathStr.lastIndexOf("/");
  const lastBackSlash = pathStr.lastIndexOf("\\");
  const lastSlashIndex = Math.max(lastForwardSlash, lastBackSlash);
  return lastSlashIndex >= 0 ? pathStr.substring(lastSlashIndex + 1) : pathStr;
}
async function streamToBuffer(stream) {
  if (RUNTIME.type === "node") {
    const { Readable } = await import("stream");
    if (stream instanceof Readable) {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
  }
  if (isReadableStream(stream)) {
    const reader = stream.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(result);
  }
  throw new Error(
    "Unsupported stream type: " + typeof stream + ". Expected Node.js Readable stream or Web ReadableStream."
  );
}
async function newFormData() {
  return new FormDataWrapper();
}
var FormDataWrapper = class {
  fd = new FormData();
  async setup() {
  }
  append(key, value) {
    this.fd.append(key, String(value));
  }
  getFileName(value, filename) {
    if (filename != null) {
      return filename;
    }
    if (isNamedValue(value)) {
      return value.name;
    }
    if (isPathedValue(value) && value.path) {
      return getLastPathSegment(value.path.toString());
    }
    return void 0;
  }
  async convertToBlob(value) {
    if (isStreamLike(value) || isReadableStream(value)) {
      const buffer = await streamToBuffer(value);
      return new Blob([buffer]);
    }
    if (value instanceof Blob) {
      return value;
    }
    if (isBuffer(value)) {
      return new Blob([value]);
    }
    if (value instanceof ArrayBuffer) {
      return new Blob([value]);
    }
    if (isArrayBufferView(value)) {
      return new Blob([value]);
    }
    if (typeof value === "string") {
      return new Blob([value]);
    }
    if (typeof value === "object" && value !== null) {
      return new Blob([toJson(value)], { type: "application/json" });
    }
    return new Blob([String(value)]);
  }
  async appendFile(key, value, fileName) {
    fileName = this.getFileName(value, fileName);
    const blob = await this.convertToBlob(value);
    if (fileName) {
      this.fd.append(key, blob, fileName);
    } else {
      this.fd.append(key, blob);
    }
  }
  getRequest() {
    return {
      body: this.fd,
      headers: {},
      duplex: "half"
    };
  }
};

// src/sdk/core/headers.ts
function mergeHeaders(...headersArray) {
  const result = {};
  for (const [key, value] of headersArray.filter((headers) => headers != null).flatMap((headers) => Object.entries(headers))) {
    if (value != null) {
      result[key] = value;
    } else if (key in result) {
      delete result[key];
    }
  }
  return result;
}
function mergeOnlyDefinedHeaders(...headersArray) {
  const result = {};
  for (const [key, value] of headersArray.filter((headers) => headers != null).flatMap((headers) => Object.entries(headers))) {
    if (value != null) {
      result[key] = value;
    }
  }
  return result;
}

// src/sdk/environments.ts
var TaskmasterTaskmasterEnvironment = {
  Local: "http://127.0.0.1:8000"
};

// src/sdk/api/resources/system/client/Client.ts
var System = class {
  _options;
  constructor(_options = {}) {
    this._options = _options;
  }
  /**
   * @param {System.RequestOptions} requestOptions - Request-specific configuration.
   *
   * @example
   *     await client.system.getHealth()
   */
  getHealth(requestOptions) {
    return HttpResponsePromise.fromPromise(this.__getHealth(requestOptions));
  }
  async __getHealth(requestOptions) {
    let _headers = mergeHeaders(this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: url_exports.join(
        await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? TaskmasterTaskmasterEnvironment.Local,
        "/api/health"
      ),
      method: "GET",
      headers: _headers,
      queryParameters: requestOptions?.queryParams,
      timeoutMs: requestOptions?.timeoutInSeconds != null ? requestOptions.timeoutInSeconds * 1e3 : 6e4,
      maxRetries: requestOptions?.maxRetries,
      abortSignal: requestOptions?.abortSignal
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      throw new TaskmasterTaskmasterError({
        statusCode: _response.error.statusCode,
        body: _response.error.body,
        rawResponse: _response.rawResponse
      });
    }
    switch (_response.error.reason) {
      case "non-json":
        throw new TaskmasterTaskmasterError({
          statusCode: _response.error.statusCode,
          body: _response.error.rawBody,
          rawResponse: _response.rawResponse
        });
      case "timeout":
        throw new TaskmasterTaskmasterTimeoutError("Timeout exceeded when calling GET /api/health.");
      case "unknown":
        throw new TaskmasterTaskmasterError({
          message: _response.error.errorMessage,
          rawResponse: _response.rawResponse
        });
    }
  }
};

// src/sdk/api/resources/tasks/client/Client.ts
var Tasks = class {
  _options;
  constructor(_options = {}) {
    this._options = _options;
  }
  /**
   * @param {TaskmasterTaskmaster.CreateTaskRequest} request
   * @param {Tasks.RequestOptions} requestOptions - Request-specific configuration.
   *
   * @example
   *     await client.tasks.createTask({
   *         title: "title",
   *         description: "description",
   *         status: "TODO",
   *         priority: 1,
   *         duration_seconds: 1,
   *         deadline: undefined,
   *         prerequisite_tasks: undefined
   *     })
   */
  createTask(request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__createTask(request, requestOptions));
  }
  async __createTask(request, requestOptions) {
    let _headers = mergeHeaders(this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: url_exports.join(
        await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? TaskmasterTaskmasterEnvironment.Local,
        "/api/create-task"
      ),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryParameters: requestOptions?.queryParams,
      requestType: "json",
      body: request,
      timeoutMs: requestOptions?.timeoutInSeconds != null ? requestOptions.timeoutInSeconds * 1e3 : 6e4,
      maxRetries: requestOptions?.maxRetries,
      abortSignal: requestOptions?.abortSignal
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      throw new TaskmasterTaskmasterError({
        statusCode: _response.error.statusCode,
        body: _response.error.body,
        rawResponse: _response.rawResponse
      });
    }
    switch (_response.error.reason) {
      case "non-json":
        throw new TaskmasterTaskmasterError({
          statusCode: _response.error.statusCode,
          body: _response.error.rawBody,
          rawResponse: _response.rawResponse
        });
      case "timeout":
        throw new TaskmasterTaskmasterTimeoutError(
          "Timeout exceeded when calling POST /api/create-task."
        );
      case "unknown":
        throw new TaskmasterTaskmasterError({
          message: _response.error.errorMessage,
          rawResponse: _response.rawResponse
        });
    }
  }
  /**
   * @param {TaskmasterTaskmaster.UpdateTaskRequest} request
   * @param {Tasks.RequestOptions} requestOptions - Request-specific configuration.
   *
   * @example
   *     await client.tasks.updateTask({
   *         title: "title",
   *         description: undefined,
   *         status: undefined,
   *         priority: undefined,
   *         duration_seconds: undefined,
   *         deadline: undefined,
   *         prerequisite_tasks: undefined
   *     })
   */
  updateTask(request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__updateTask(request, requestOptions));
  }
  async __updateTask(request, requestOptions) {
    let _headers = mergeHeaders(this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: url_exports.join(
        await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? TaskmasterTaskmasterEnvironment.Local,
        "/api/update-task"
      ),
      method: "PUT",
      headers: _headers,
      contentType: "application/json",
      queryParameters: requestOptions?.queryParams,
      requestType: "json",
      body: request,
      timeoutMs: requestOptions?.timeoutInSeconds != null ? requestOptions.timeoutInSeconds * 1e3 : 6e4,
      maxRetries: requestOptions?.maxRetries,
      abortSignal: requestOptions?.abortSignal
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      throw new TaskmasterTaskmasterError({
        statusCode: _response.error.statusCode,
        body: _response.error.body,
        rawResponse: _response.rawResponse
      });
    }
    switch (_response.error.reason) {
      case "non-json":
        throw new TaskmasterTaskmasterError({
          statusCode: _response.error.statusCode,
          body: _response.error.rawBody,
          rawResponse: _response.rawResponse
        });
      case "timeout":
        throw new TaskmasterTaskmasterTimeoutError(
          "Timeout exceeded when calling PUT /api/update-task."
        );
      case "unknown":
        throw new TaskmasterTaskmasterError({
          message: _response.error.errorMessage,
          rawResponse: _response.rawResponse
        });
    }
  }
  /**
   * @param {Tasks.RequestOptions} requestOptions - Request-specific configuration.
   *
   * @example
   *     await client.tasks.deleteTask()
   */
  deleteTask(requestOptions) {
    return HttpResponsePromise.fromPromise(this.__deleteTask(requestOptions));
  }
  async __deleteTask(requestOptions) {
    let _headers = mergeHeaders(this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: url_exports.join(
        await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? TaskmasterTaskmasterEnvironment.Local,
        "/api/delete-task"
      ),
      method: "DELETE",
      headers: _headers,
      queryParameters: requestOptions?.queryParams,
      timeoutMs: requestOptions?.timeoutInSeconds != null ? requestOptions.timeoutInSeconds * 1e3 : 6e4,
      maxRetries: requestOptions?.maxRetries,
      abortSignal: requestOptions?.abortSignal
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      throw new TaskmasterTaskmasterError({
        statusCode: _response.error.statusCode,
        body: _response.error.body,
        rawResponse: _response.rawResponse
      });
    }
    switch (_response.error.reason) {
      case "non-json":
        throw new TaskmasterTaskmasterError({
          statusCode: _response.error.statusCode,
          body: _response.error.rawBody,
          rawResponse: _response.rawResponse
        });
      case "timeout":
        throw new TaskmasterTaskmasterTimeoutError(
          "Timeout exceeded when calling DELETE /api/delete-task."
        );
      case "unknown":
        throw new TaskmasterTaskmasterError({
          message: _response.error.errorMessage,
          rawResponse: _response.rawResponse
        });
    }
  }
};

// src/sdk/api/resources/transcription/client/Client.ts
var Transcription = class {
  _options;
  constructor(_options = {}) {
    this._options = _options;
  }
  /**
   * Transcribe uploaded audio file
   *
   * @param {TaskmasterTaskmaster.CreateTranscriptionRequest} request
   * @param {Transcription.RequestOptions} requestOptions - Request-specific configuration.
   */
  createTranscription(request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__createTranscription(request, requestOptions));
  }
  async __createTranscription(request, requestOptions) {
    const _request = await newFormData();
    await _request.appendFile("file", request.file);
    const _maybeEncodedRequest = await _request.getRequest();
    let _headers = mergeHeaders(
      this._options?.headers,
      mergeOnlyDefinedHeaders({ ..._maybeEncodedRequest.headers }),
      requestOptions?.headers
    );
    const _response = await fetcher({
      url: url_exports.join(
        await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? TaskmasterTaskmasterEnvironment.Local,
        "/api/create-transcription"
      ),
      method: "POST",
      headers: _headers,
      queryParameters: requestOptions?.queryParams,
      requestType: "file",
      duplex: _maybeEncodedRequest.duplex,
      body: _maybeEncodedRequest.body,
      timeoutMs: requestOptions?.timeoutInSeconds != null ? requestOptions.timeoutInSeconds * 1e3 : 6e4,
      maxRetries: requestOptions?.maxRetries,
      abortSignal: requestOptions?.abortSignal
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      throw new TaskmasterTaskmasterError({
        statusCode: _response.error.statusCode,
        body: _response.error.body,
        rawResponse: _response.rawResponse
      });
    }
    switch (_response.error.reason) {
      case "non-json":
        throw new TaskmasterTaskmasterError({
          statusCode: _response.error.statusCode,
          body: _response.error.rawBody,
          rawResponse: _response.rawResponse
        });
      case "timeout":
        throw new TaskmasterTaskmasterTimeoutError(
          "Timeout exceeded when calling POST /api/create-transcription."
        );
      case "unknown":
        throw new TaskmasterTaskmasterError({
          message: _response.error.errorMessage,
          rawResponse: _response.rawResponse
        });
    }
  }
};

// src/sdk/Client.ts
var TaskmasterTaskmasterClient = class {
  _options;
  _system;
  _tasks;
  _transcription;
  constructor(_options = {}) {
    this._options = {
      ..._options,
      headers: mergeHeaders(
        {
          "X-Fern-Language": "JavaScript",
          "X-Fern-Runtime": RUNTIME.type,
          "X-Fern-Runtime-Version": RUNTIME.version
        },
        _options?.headers
      )
    };
  }
  get system() {
    return this._system ??= new System(this._options);
  }
  get tasks() {
    return this._tasks ??= new Tasks(this._options);
  }
  get transcription() {
    return this._transcription ??= new Transcription(this._options);
  }
};
export {
  api_exports as TaskmasterTaskmaster,
  TaskmasterTaskmasterClient,
  TaskmasterTaskmasterEnvironment,
  TaskmasterTaskmasterError,
  TaskmasterTaskmasterTimeoutError
};
