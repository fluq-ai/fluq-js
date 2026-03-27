type EventType = "status_change" | "action" | "error" | "cost" | "heartbeat" | "tool_use" | "decision" | "spawn" | "api_call" | "file_write" | "file_read" | "conflict";
type TraceStatus = "active" | "completed" | "failed" | "cancelled" | "timeout";
type TaskPriority = "critical" | "high" | "medium" | "low";
type TaskStatus = "pending" | "assigned" | "running" | "completed" | "failed" | "expired" | "dead";
interface FluqConfig {
    apiKey: string;
    agentId: string;
    capabilities: string[];
    baseUrl?: string;
    flushIntervalMs?: number;
    flushBatchSize?: number;
    maxRetries?: number;
    retryBaseDelayMs?: number;
}
interface TraceInput {
    name: string;
    input?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    parentTraceId?: string;
    environment?: string;
}
interface TraceResult {
    id: string;
    name: string;
    agentId: string;
    status: TraceStatus;
    createdAt: string;
}
interface EventInput {
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
interface Task {
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
interface CompleteTaskInput {
    output?: Record<string, unknown>;
}
declare class FluqError extends Error {
    status: number;
    body?: unknown | undefined;
    constructor(message: string, status: number, body?: unknown | undefined);
}
declare class Fluq {
    private apiKey;
    private agentId;
    private capabilities;
    private baseUrl;
    private flushIntervalMs;
    private flushBatchSize;
    private maxRetries;
    private retryBaseDelayMs;
    private eventBuffer;
    private flushTimer;
    private initialized;
    init(config: FluqConfig): void;
    private assertInitialized;
    private request;
    trace(input: TraceInput): Promise<TraceResult>;
    event(input: EventInput): void;
    flush(): Promise<void>;
    pullTask(): Promise<Task | null>;
    completeTask(taskId: string, input?: CompleteTaskInput): Promise<void>;
    destroy(): Promise<void>;
}

export { type CompleteTaskInput, type EventInput, type EventType, Fluq, type FluqConfig, FluqError, type Task, type TaskPriority, type TaskStatus, type TraceInput, type TraceResult, type TraceStatus };
