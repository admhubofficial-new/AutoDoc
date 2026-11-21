import { adminClient } from "../../lib/server/supabase.js";
import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.js";
import { validSession } from "../../lib/server/session.js";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.js";
import {
  checkThrottle,
  clearFailedAttempts,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
  tokenMatches,
} from "../../lib/server/security.js";

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

      const client = adminClient();
      const keyHash = loginThrottleKey(sessionSecret());
      const throttle = await checkThrottle(client, keyHash);
      if (throttle.locked) {
        return json(
          { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
          429,
          { "Retry-After": String(throttle.retryAfterSeconds) },
        );
      }

      const { data, error } = await client
        .from("settings")
        .select("token_hash, session_version")
        .eq("id", 1)
        .single();
      if (error) throw error;

      if (Number(data.session_version) !== session.sv) {
        return json({ message: "Sesi tidak lagi berlaku. Silakan masuk kembali." }, 401);
      }

      const valid = await tokenMatches(token, data.token_hash);
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
      const purpose =
        typeof body.purpose === "string" && allowedPurposes.has(body.purpose)
          ? body.purpose
          : "lainnya";
      const { error: auditError } = await client.from("audit_log").insert({
        aksi: "token_diverifikasi_ulang",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: null,
        nilai_baru: { verifikasi: "berhasil" },
        detail: { tujuan: purpose },
      });
      if (auditError) throw auditError;

      return json({ valid: true, message: "Verifikasi PIN berhasil." });
    } catch (error) {
      return publicError(error);
    }
  },
};
