/**
 * Tests for Fluq SDK (standalone) — validates init parameter validation,
 * lifecycle management (init/destroy), and core client configuration.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Fluq, FluqError } from "./index.js";

describe("Fluq", () => {
  let client: Fluq;

  beforeEach(() => {
    client = new Fluq();
  });

  afterEach(async () => {
    try {
      await client.destroy();
    } catch {
      // ignore if not initialized
    }
  });

  describe("init", () => {
    it("throws if apiKey is missing", () => {
      expect(() =>
        client.init({ apiKey: "", agentId: "a", capabilities: ["x"] }),
      ).toThrow("apiKey is required");
    });

    it("throws if agentId is missing", () => {
      expect(() =>
        client.init({ apiKey: "k", agentId: "", capabilities: ["x"] }),
      ).toThrow("agentId is required");
    });

    it("throws if capabilities is empty", () => {
      expect(() =>
        client.init({ apiKey: "k", agentId: "a", capabilities: [] }),
      ).toThrow("capabilities must be a non-empty array");
    });

    it("initializes successfully with valid config", () => {
      expect(() =>
        client.init({ apiKey: "k", agentId: "a", capabilities: ["code"] }),
      ).not.toThrow();
    });
  });

  describe("pre-init guards", () => {
    it("trace throws before init", async () => {
      await expect(client.trace({ name: "t" })).rejects.toThrow(
        "Fluq not initialized",
      );
    });

    it("event throws before init", () => {
      expect(() =>
        client.event({ traceId: "t", eventType: "action" }),
      ).toThrow("Fluq not initialized");
    });

    it("pullTask throws before init", async () => {
      await expect(client.pullTask()).rejects.toThrow("Fluq not initialized");
    });

    it("completeTask throws before init", async () => {
      await expect(client.completeTask("t")).rejects.toThrow(
        "Fluq not initialized",
      );
    });
  });

  describe("event batching", () => {
    it("buffers events and flushes on destroy", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      });
      vi.stubGlobal("fetch", fetchSpy);

      client.init({
        apiKey: "k",
        agentId: "a1",
        capabilities: ["code"],
        flushIntervalMs: 60_000, // long interval so only destroy triggers flush
      });

      client.event({ traceId: "t1", eventType: "action" });
      client.event({ traceId: "t1", eventType: "error" });

      await client.destroy();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, opts] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.fluq.dev/api/v1/events");
      const body = JSON.parse(opts.body);
      expect(body.events).toHaveLength(2);
      expect(body.events[0].agentId).toBe("a1");

      vi.unstubAllGlobals();
    });
  });

  describe("FluqError", () => {
    it("has correct name and properties", () => {
      const err = new FluqError("bad request", 400, { detail: "invalid" });
      expect(err.name).toBe("FluqError");
      expect(err.message).toBe("bad request");
      expect(err.status).toBe(400);
      expect(err.body).toEqual({ detail: "invalid" });
      expect(err).toBeInstanceOf(Error);
    });
  });
});
