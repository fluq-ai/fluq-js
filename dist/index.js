// src/index.ts
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
export {
  Fluq,
  FluqError
};
