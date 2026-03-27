export type EventType =
  | "llm_call"
  | "status_change"
  | "action"
  | "error"
  | "cost"
  | "heartbeat"
  | "tool_use"
  | "decision"
  | "spawn"
  | "api_call"
  | "file_write"
  | "file_read"
  | "conflict";

export type TraceStatus =
  | "active"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export type TaskStatus =
  | "pending"
  | "assigned"
  | "running"
  | "completed"
  | "failed"
  | "expired"
  | "dead";

export interface FluqConfig {
  apiKey: string;
  agentId: string;
  capabilities: string[];
  baseUrl?: string;
  flushIntervalMs?: number;
  flushBatchSize?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

export interface TraceInput {
  name: string;
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  parentTraceId?: string;
  environment?: string;
}

export interface TraceResult {
  id: string;
  name: string;
  agentId: string;
  status: TraceStatus;
  createdAt: string;
}

export interface EventInput {
  traceId: string;
  eventType: EventType;
  payload?: Record<string, unknown>;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  resource?: string;
  durationMs?: number;
  errorMessage?: string;
  estimatedCostUsd?: number;
  tokensIn?: number;
  tokensOut?: number;
}

export interface Task {
  id: string;
  fleetId: string;
  name: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  requiredCapabilities: string[];
  input: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  deadline: string | null;
  retries: number;
  createdAt: string;
}

export interface CompleteTaskInput {
  output?: Record<string, unknown>;
}

export class FluqError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "FluqError";
  }
}

export class Fluq {
  private apiKey = "";
  private agentId = "";
  private capabilities: string[] = [];
  private baseUrl = "";
  private flushIntervalMs = 1000;
  private flushBatchSize = 50;
  private maxRetries = 3;
  private retryBaseDelayMs = 500;

  private eventBuffer: EventInput[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  init(config: FluqConfig): void {
    if (!config.apiKey) throw new Error("apiKey is required");
    if (!config.agentId) throw new Error("agentId is required");
    if (!config.capabilities?.length)
      throw new Error("capabilities must be a non-empty array");

    this.apiKey = config.apiKey;
    this.agentId = config.agentId;
    this.capabilities = config.capabilities;
    this.baseUrl = (config.baseUrl ?? "https://api.fluq.dev").replace(
      /\/$/,
      "",
    );
    this.flushIntervalMs = config.flushIntervalMs ?? 1000;
    this.flushBatchSize = config.flushBatchSize ?? 50;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 500;

    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    this.initialized = true;
  }

  private assertInitialized(): void {
    if (!this.initialized) throw new Error("Fluq not initialized. Call init() first.");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = this.retryBaseDelayMs * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, delay));
      }

      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: body != null ? JSON.stringify(body) : undefined,
        });
      } catch (err) {
        lastError = err;
        continue;
      }

      if (res.status >= 500) {
        lastError = new FluqError(
          `Server error: ${res.status}`,
          res.status,
          await res.text().catch(() => null),
        );
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => null);
        let parsed: unknown;
        try {
          parsed = JSON.parse(text!);
        } catch {
          parsed = text;
        }
        throw new FluqError(`Request failed: ${res.status}`, res.status, parsed);
      }

      return (await res.json()) as T;
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  async trace(input: TraceInput): Promise<TraceResult> {
    this.assertInitialized();
    return this.request<TraceResult>("POST", "/api/v1/traces", {
      agentId: this.agentId,
      ...input,
    });
  }

  event(input: EventInput): void {
    this.assertInitialized();
    this.eventBuffer.push(input);
    if (this.eventBuffer.length >= this.flushBatchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    const batch = this.eventBuffer.splice(0);
    const events = batch.map((e) => ({ agentId: this.agentId, ...e }));

    await this.request("POST", "/api/v1/events", { events });
  }

  async pullTask(): Promise<Task | null> {
    this.assertInitialized();
    try {
      return await this.request<Task>("POST", "/api/v1/tasks/pull", {
        agentId: this.agentId,
        capabilities: this.capabilities,
      });
    } catch (err) {
      if (err instanceof FluqError && err.status === 404) return null;
      throw err;
    }
  }

  async completeTask(
    taskId: string,
    input?: CompleteTaskInput,
  ): Promise<void> {
    this.assertInitialized();
    await this.request("POST", `/api/v1/tasks/${taskId}/complete`, {
      agentId: this.agentId,
      ...input,
    });
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.initialized = false;
  }
}
