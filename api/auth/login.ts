import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.ts";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.ts";
import { createSessionCookie } from "../../lib/server/session.ts";
import { insertRow, selectOne, rpc } from "../../lib/server/supabase.ts";
import {
  checkThrottle,
  clearFailedAttempts,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
} from "../../lib/server/security.ts";

interface LoginBody extends Record<string, unknown> {
  token?: unknown;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      const body = await readJson<LoginBody>(request);
      const token = normalizeToken(body.token);
      if (!token) return json({ message: "Masukkan PIN/token yang valid." }, 400);

      const settings = await selectOne<{
        setup_completed_at: string | null;
      }>("settings", "setup_completed_at", { id: "eq.1" });

      if (!settings?.setup_completed_at) {
        return json({ code: "SETUP_REQUIRED", message: "Setup Awal harus diselesaikan terlebih dahulu." }, 409);
      }

      const keyHash = loginThrottleKey(sessionSecret());
      const throttle = await checkThrottle(keyHash);
      if (throttle.locked) {
        return json(
          { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
          429,
          { "Retry-After": String(throttle.retryAfterSeconds) },
        );
      }

      // Verifies bcrypt and returns the exact session version from the same
      // database statement, protected from a concurrent token rotation.
      const sessionVersion = await rpc<number | null>("authenticate_access_token", {
        p_token: token,
      });

      if (sessionVersion === null) {
        const state = await recordFailedAttempt(keyHash);
        if (state.locked) {
          return json(
            { message: "Lima kali percobaan gagal. Akses dikunci selama 15 menit." },
            429,
            { "Retry-After": String(state.retryAfterSeconds) },
          );
        }
        return json({ message: "PIN/token tidak sesuai." }, 401);
      }

      await clearFailedAttempts(keyHash);
      await insertRow("audit_log", {
        aksi: "login_berhasil",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: null,
        nilai_baru: { login: true },
        detail: { metode: "PIN/token", hasil: "berhasil" },
      });

      return json(
        { success: true, message: "Berhasil masuk." },
        200,
        { "Set-Cookie": createSessionCookie(request, Number(sessionVersion)) },
      );
    } catch (error) {
      return publicError(error);
    }
  },
};
