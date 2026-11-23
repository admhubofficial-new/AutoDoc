export type AiAdmissionResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  reason: "accepted" | "concurrency" | "session_quota" | "capacity";
  release: () => void;
};

type SessionWindow = { startedAt: number; count: number };

/**
 * Per-isolate admission control. This bounds bursts on each Edge Function worker;
 * it is intentionally not described as a project-wide or durable billing quota.
 */
export class AiRequestGate {
  private readonly sessions = new Map<string, SessionWindow>();
  private inFlight = 0;

  private readonly maxConcurrent: number;
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly maxTrackedSessions: number;

  constructor(
    maxConcurrent = 2,
    maxPerWindow = 6,
    windowMs = 10 * 60 * 1000,
    maxTrackedSessions = 2000,
  ) {
    if (![maxConcurrent, maxPerWindow, windowMs, maxTrackedSessions].every(Number.isSafeInteger) ||
        maxConcurrent < 1 || maxPerWindow < 1 || windowMs < 1 || maxTrackedSessions < 1) {
      throw new RangeError("Konfigurasi batas AI tidak valid.");
    }
    this.maxConcurrent = maxConcurrent;
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
    this.maxTrackedSessions = maxTrackedSessions;
  }

  acquire(sessionKey: string, nowMs = Date.now()): AiAdmissionResult {
    if (!sessionKey) throw new TypeError("Kunci sesi AI wajib tersedia.");

    for (const [key, window] of this.sessions) {
      if (nowMs - window.startedAt >= this.windowMs) this.sessions.delete(key);
    }

    if (this.inFlight >= this.maxConcurrent) {
      return this.denied("concurrency", 5);
    }

    let window = this.sessions.get(sessionKey);
    if (!window) {
      if (this.sessions.size >= this.maxTrackedSessions) {
        return this.denied("capacity", Math.max(1, Math.ceil(this.windowMs / 1000)));
      }
      window = { startedAt: nowMs, count: 0 };
      this.sessions.set(sessionKey, window);
    }

    if (window.count >= this.maxPerWindow) {
      const remaining = Math.max(1, Math.ceil((window.startedAt + this.windowMs - nowMs) / 1000));
      return this.denied("session_quota", remaining);
    }

    window.count += 1;
    this.inFlight += 1;
    let released = false;
    return {
      allowed: true,
      retryAfterSeconds: 0,
      reason: "accepted",
      release: () => {
        if (released) return;
        released = true;
        this.inFlight = Math.max(0, this.inFlight - 1);
      },
    };
  }

  get activeRequests(): number {
    return this.inFlight;
  }

  private denied(
    reason: Exclude<AiAdmissionResult["reason"], "accepted">,
    retryAfterSeconds: number,
  ): AiAdmissionResult {
    return { allowed: false, reason, retryAfterSeconds, release: () => undefined };
  }
}
