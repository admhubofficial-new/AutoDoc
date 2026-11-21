import { sameOriginAllowed } from "../../lib/server/env.ts";
import { clearAuthCookies } from "../../lib/server/session.ts";
import { insertRow } from "../../lib/server/supabase.ts";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      await insertRow("audit_log", {
        aksi: "logout",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: { session: "aktif" },
        nilai_baru: { session: "berakhir" },
        detail: { metode: "logout" },
      });

      return json({ success: true }, 200, {
        "Set-Cookie": clearAuthCookies(request),
      });
    } catch (error) {
      return publicError(error);
    }
  },
};
