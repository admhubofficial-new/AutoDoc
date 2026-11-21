import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.ts";
import { validSession } from "../../lib/server/session.ts";
import { insertRow } from "../../lib/server/supabase.ts";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.ts";
import {
  checkThrottle,
  clearFailedAttempts,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
  tokenMatches,
} from "../../lib/server/security.ts";

interface VerifyBody extends Record<string, unknown> {
  token?: unknown;
  purpose?: unknown;
}

const allowedPurposes = new Set(["nomor_urut", "pembatalan", "ubah_token", "lainnya"]);

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      const session = await validSession(request);
      if (!session) return json({ message: "Sesi berakhir. Silakan masuk kembali." }, 401);

      const body = await readJson<VerifyBody>(request);
      const token = normalizeToken(body.token);
      if (!token) return json({ message: "Masukkan kembali PIN/token." }, 400);

      const keyHash = loginThrottleKey(sessionSecret());
      const throttle = await checkThrottle(keyHash);
      if (throttle.locked) {
        return json(
          { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
          429,
          { "Retry-After": String(throttle.retryAfterSeconds) },
        );
      }

      const valid = await tokenMatches(token);
      if (!valid) {
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
      const purpose =
        typeof body.purpose === "string" && allowedPurposes.has(body.purpose)
          ? body.purpose
          : "lainnya";
      await insertRow("audit_log", {
        aksi: "token_diverifikasi_ulang",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: null,
        nilai_baru: { verifikasi: "berhasil" },
        detail: { tujuan: purpose },
      });

      return json({ valid: true, message: "Verifikasi PIN berhasil." });
    } catch (error) {
      return publicError(error);
    }
  },
};
