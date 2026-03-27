"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Fluq: () => Fluq,
  FluqError: () => FluqError
});
module.exports = __toCommonJS(index_exports);
var FluqError = class extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "FluqError";
  }
};
var Fluq = class {
  apiKey = "";
  agentId = "";
  capabilities = [];
  baseUrl = "";
  flushIntervalMs = 1e3;
  flushBatchSize = 50;
  maxRetries = 3;
  retryBaseDelayMs = 500;
  eventBuffer = [];
  flushTimer = null;
  initialized = false;
  init(config) {
    if (!config.apiKey) throw new Error("apiKey is required");
    if (!config.agentId) throw new Error("agentId is required");
    if (!config.capabilities?.length)
      throw new Error("capabilities must be a non-empty array");
    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
    this.capabilities = config.capabilities;
    this.baseUrl = (config.baseUrl ?? "https://api.fluq.dev").replace(
      /\/$/,
      ""
    );
    this.flushIntervalMs = config.flushIntervalMs ?? 1e3;
    this.flushBatchSize = config.flushBatchSize ?? 50;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 500;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.initialized = true;
  }
  assertInitialized() {
    if (!this.initialized) throw new Error("Fluq not initialized. Call init() first.");
  }
  async request(method, path, body) {
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryBaseDelayMs * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }
      let res;
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`
          },
          body: body != null ? JSON.stringify(body) : void 0
        });
      } catch (err) {
        lastError = err;
        continue;
      }
      if (res.status >= 500) {
        lastError = new FluqError(
          `Server error: ${res.status}`,
          res.status,
          await res.text().catch(() => null)
        );
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => null);
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = text;
        }
        throw new FluqError(`Request failed: ${res.status}`, res.status, parsed);
      }
      return await res.json();
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }
  async trace(input) {
    this.assertInitialized();
    return this.request("POST", "/api/v1/traces", {
      agentId: this.agentId,
      ...input
    });
  }
  event(input) {
    this.assertInitialized();
    this.eventBuffer.push(input);
    if (this.eventBuffer.length >= this.flushBatchSize) {
      void this.flush();
    }
  }
  async flush() {
    if (this.eventBuffer.length === 0) return;
    const batch = this.eventBuffer.splice(0);
    const events = batch.map((e) => ({ agentId: this.agentId, ...e }));
    await this.request("POST", "/api/v1/events", { events });
  }
  async pullTask() {
    this.assertInitialized();
    try {
      return await this.request("POST", "/api/v1/tasks/pull", {
        agentId: this.agentId,
        capabilities: this.capabilities
      });
    } catch (err) {
      if (err instanceof FluqError && err.status === 404) return null;
      throw err;
    }
  }
  async completeTask(taskId, input) {
    this.assertInitialized();
    await this.request("POST", `/api/v1/tasks/${taskId}/complete`, {
      agentId: this.agentId,
      ...input
    });
  }
  async destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.initialized = false;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Fluq,
  FluqError
});
