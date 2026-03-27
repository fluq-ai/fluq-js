# fluq-sdk

TypeScript/JavaScript SDK for [Fluq](https://fluq.ai) — AI agent fleet observability and control.

Fluq tells you what your agents **did**, not just what they said. Observe every action, enforce policies, and orchestrate tasks across your entire agent fleet.

## Install

```bash
npm install fluq-sdk
# or
pnpm add fluq-sdk
# or
yarn add fluq-sdk
```

## Quick Start

```typescript
import { Fluq } from "fluq-sdk";

const fluq = new Fluq();

fluq.init({
  apiKey: "fo_your_api_key",
  agentId: "my-agent",
  capabilities: ["code", "search"],
  baseUrl: "https://fluq.ai",
});

// Create a trace for a unit of work
const trace = await fluq.trace({ name: "process-request" });

// Log events as your agent works
fluq.event({
  traceId: trace.id,
  eventType: "llm_call",
  input: { prompt: "Analyze this data" },
  output: { response: "Here's the analysis..." },
  tokensIn: 150,
  tokensOut: 420,
  estimatedCostUsd: 0.003,
});

fluq.event({
  traceId: trace.id,
  eventType: "tool_use",
  resource: "database",
  metadata: { query: "SELECT * FROM users" },
  durationMs: 45.2,
});

// Flush and clean up
await fluq.destroy();
```

## Features

- **Auto-batched events** — events are buffered and sent in batches for performance
- **Retry with backoff** — transient failures are retried automatically
- **ESM + CJS** — works with both module systems
- **Zero dependencies** — uses native `fetch`
- **TypeScript-first** — full type definitions included

## Event Types

| Type | Description |
|------|-------------|
| `llm_call` | LLM API calls with token counts and cost |
| `tool_use` | Tool/function invocations |
| `action` | General agent actions |
| `decision` | Decision points |
| `spawn` | Child agent/process spawns |
| `api_call` | External API calls |
| `file_read` / `file_write` | File system operations |
| `error` | Errors and exceptions |
| `cost` | Cost tracking events |
| `heartbeat` | Agent health signals |
| `conflict` | Resource conflict detection |

## Task Queue

```typescript
// Pull and complete tasks
const task = await fluq.pullTask();
if (task) {
  console.log(`Working on: ${task.name}`);
  // ... do the work ...
  await fluq.completeTask(task.id, {
    output: { result: "done" },
  });
}
```

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `apiKey` | required | Your Fluq API key (`fo_...`) |
| `agentId` | required | Unique identifier for this agent |
| `capabilities` | required | Array of agent capabilities |
| `baseUrl` | `https://api.fluq.dev` | Fluq API base URL |
| `flushIntervalMs` | `1000` | Auto-flush interval in ms |
| `flushBatchSize` | `50` | Max events per batch |
| `maxRetries` | `3` | Retry attempts for failed requests |

## Requirements

- Node.js 18+ (uses native `fetch`)

## Links

- [Dashboard](https://fluq.ai/dashboard)
- [Documentation](https://fluq.ai/docs)
- [Python SDK](https://github.com/fluq-ai/fluq-python)

## License

MIT
