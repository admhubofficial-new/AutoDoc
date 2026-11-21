import { adminClient } from "../../lib/server/supabase.js";
import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.js";
import { validSession } from "../../lib/server/session.js";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.js";
import {
  checkThrottle,
  clearFailedAttempts,
  hashToken,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
  tokenHashFingerprint,
  tokenMatches,
} from "../../lib/server/security.js";

interface ChangeTokenBody extends Record<string, unknown> {
  currentToken?: unknown;
  newToken?: unknown;
  confirmNewToken?: unknown;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      const session = await validSession(request);
      if (!session) return json({ message: "Sesi berakhir. Silakan masuk kembali." }, 401);

      const body = await readJson<ChangeTokenBody>(request);
      const currentToken = normalizeToken(body.currentToken);
      const newToken = normalizeToken(body.newToken);
      const confirmNewToken = normalizeToken(body.confirmNewToken);

      if (!currentToken || !newToken || !confirmNewToken) {
        return json({ message: "Semua kolom PIN wajib diisi. PIN baru minimal 6 karakter." }, 400);
      }
      if (newToken !== confirmNewToken) {
        return json({ message: "Konfirmasi PIN baru tidak sama." }, 400);
      }
      if (currentToken === newToken) {
        return json({ message: "PIN baru harus berbeda dari PIN lama." }, 400);
      }

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

      const { data: settings, error: settingsError } = await client
        .from("settings")
        .select("token_hash, session_version")
        .eq("id", 1)
        .single();
      if (settingsError) throw settingsError;

      if (Number(settings.session_version) !== session.sv) {
        return json({ message: "Sesi tidak lagi berlaku. Silakan masuk kembali." }, 401);
      }

      const currentValid = await tokenMatches(currentToken, settings.token_hash);
      if (!currentValid) {
        const state = await recordFailedAttempt(client, keyHash);
        if (state.locked) {
          return json(
            { message: "Lima kali percobaan gagal. Akses dikunci selama 15 menit." },
            429,
            { "Retry-After": String(state.retryAfterSeconds) },
          );
        }
        return json({ message: "PIN lama tidak sesuai." }, 401);
      }

      const nextHash = await hashToken(newToken);
      const nextVersion = Number(settings.session_version) + 1;
      const { error: updateError } = await client
        .from("settings")
        .update({ token_hash: nextHash, session_version: nextVersion })
        .eq("id", 1);
      if (updateError) throw updateError;

      await clearFailedAttempts(client, keyHash);
      const { error: auditError } = await client.from("audit_log").insert({
        aksi: "token_diubah",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: { token_hash_sha256: tokenHashFingerprint(settings.token_hash) },
        nilai_baru: { token_hash_sha256: tokenHashFingerprint(nextHash) },
        detail: { session_version: { lama: settings.session_version, baru: nextVersion } },
      });
      if (auditError) throw auditError;

      return json(
        {
          success: true,
          message: "PIN berhasil diubah. Semua sesi lama telah berakhir; silakan masuk dengan PIN baru.",
        },
        200,
        {
          "Set-Cookie": [
            "autodoc_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
              (new URL(request.url).protocol === "https:" ? "; Secure" : ""),
            "autodoc_stepup=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" +
              (new URL(request.url).protocol === "https:" ? "; Secure" : ""),
          ],
        },
      );
    } catch (error) {
      return publicError(error);
    }
  },
};
