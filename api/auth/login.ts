import { adminClient } from "../../lib/server/supabase.js";
import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.js";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.js";
import { createSessionCookie } from "../../lib/server/session.js";
import {
  checkThrottle,
  clearFailedAttempts,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
  tokenMatches,
} from "../../lib/server/security.js";

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
      if (!token) {
        return json({ message: "Masukkan PIN/token yang valid." }, 400);
      }

      const client = adminClient();
      const { data: settings, error: settingsError } = await client
        .from("settings")
        .select("token_hash, setup_completed_at, session_version")
        .eq("id", 1)
        .maybeSingle();

      if (settingsError) throw settingsError;
      if (!settings?.setup_completed_at || !settings.token_hash) {
        return json({ code: "SETUP_REQUIRED", message: "Setup Awal harus diselesaikan terlebih dahulu." }, 409);
      }

      const keyHash = loginThrottleKey(sessionSecret());
      const throttle = await checkThrottle(client, keyHash);
      if (throttle.locked) {
        return json(
          { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
          429,
          { "Retry-After": String(throttle.retryAfterSeconds) },
        );
      }

      const valid = await tokenMatches(token, settings.token_hash);
      if (!valid) {
        const state = await recordFailedAttempt(client, keyHash);
        if (state.locked) {
          return json(
            { message: "Lima kali percobaan gagal. Akses dikunci selama 15 menit." },
            429,
            { "Retry-After": String(state.retryAfterSeconds) },
          );
        }
        return json({ message: "PIN/token tidak sesuai." }, 401);
      }

      await clearFailedAttempts(client, keyHash);
      const { error: auditError } = await client.from("audit_log").insert({
        aksi: "login_berhasil",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: null,
        nilai_baru: { login: true },
        detail: { metode: "PIN/token", hasil: "berhasil" },
      });
      if (auditError) throw auditError;

      return json(
        { success: true, message: "Berhasil masuk." },
        200,
        { "Set-Cookie": createSessionCookie(request, Number(settings.session_version)) },
      );
    } catch (error) {
      return publicError(error);
    }
  },
};
