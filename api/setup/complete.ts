import { sameOriginAllowed } from "../../lib/server/env.ts";
import { json, methodNotAllowed, publicError, readJson } from "../../lib/server/http.ts";
import { currentSessionVersion, createSessionCookie } from "../../lib/server/session.ts";
import { rpc } from "../../lib/server/supabase.ts";
import { normalizeToken } from "../../lib/server/security.ts";

interface SetupBody extends Record<string, unknown> {
  token?: unknown;
  confirmToken?: unknown;
  startNumberSj?: unknown;
  startNumberBast?: unknown;
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      const body = await readJson<SetupBody>(request);
      const token = normalizeToken(body.token);
      const confirmToken = normalizeToken(body.confirmToken);
      const startNumberSj = Number(body.startNumberSj);
      const startNumberBast = Number(body.startNumberBast);

      if (!token || !confirmToken) {
        return json({ message: "PIN/token minimal 6 dan maksimal 128 karakter." }, 400);
      }
      if (token !== confirmToken) {
        return json({ message: "Konfirmasi PIN/token tidak sama." }, 400);
      }
      if (
        !Number.isSafeInteger(startNumberSj) ||
        startNumberSj < 1 ||
        !Number.isSafeInteger(startNumberBast) ||
        startNumberBast < 1
      ) {
        return json({ message: "Nomor awal SJ dan BAST harus bilangan bulat minimal 1." }, 400);
      }

      await rpc("selesaikan_setup_awal_dengan_pin", {
        p_token: token,
        p_start_sj: startNumberSj,
        p_start_bast: startNumberBast,
      });

      const version = await currentSessionVersion();
      return json(
        { success: true, message: "Setup Awal berhasil. Selamat datang di AutoDoc." },
        200,
        { "Set-Cookie": createSessionCookie(request, version) },
      );
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === "55000") {
        return json({ message: "Setup Awal sudah pernah diselesaikan atau tidak lagi tersedia." }, 409);
      }
      if (code === "22023") {
        return json({ message: "Data Setup Awal tidak valid." }, 400);
      }
      return publicError(error);
    }
  },
};
