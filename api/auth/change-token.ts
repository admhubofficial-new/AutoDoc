import { sameOriginAllowed, sessionSecret } from "../../lib/server/env.ts";
import { validSession, clearAuthCookies } from "../../lib/server/session.ts";
import { rpc } from "../../lib/server/supabase.ts";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.ts";
import {
  checkThrottle,
  clearFailedAttempts,
  loginThrottleKey,
  normalizeToken,
  recordFailedAttempt,
} from "../../lib/server/security.ts";

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

      const keyHash = loginThrottleKey(sessionSecret());
      const throttle = await checkThrottle(keyHash);
      if (throttle.locked) {
        return json(
          { message: "Terlalu banyak percobaan. Akses dikunci selama 15 menit." },
          429,
          { "Retry-After": String(throttle.retryAfterSeconds) },
        );
      }

      try {
        await rpc("change_access_token", {
          p_current_token: currentToken,
          p_new_token: newToken,
        });
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code === "28000") {
          const state = await recordFailedAttempt(keyHash);
          if (state.locked) {
            return json(
              { message: "Lima kali percobaan gagal. Akses dikunci selama 15 menit." },
              429,
              { "Retry-After": String(state.retryAfterSeconds) },
            );
          }
          return json({ message: "PIN lama tidak sesuai." }, 401);
        }
        if (code === "22023") {
          return json({ message: "PIN baru tidak valid atau sama dengan PIN lama." }, 400);
        }
        throw error;
      }

      await clearFailedAttempts(keyHash);
      return json(
        {
          success: true,
          message: "PIN berhasil diubah. Semua sesi lama telah berakhir; silakan masuk dengan PIN baru.",
        },
        200,
        { "Set-Cookie": clearAuthCookies(request) },
      );
    } catch (error) {
      return publicError(error);
    }
  },
};
