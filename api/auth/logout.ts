import { sameOriginAllowed } from "../../lib/server/env.js";
import { adminClient } from "../../lib/server/supabase.js";
import { clearAuthCookies } from "../../lib/server/session.js";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return methodNotAllowed("POST");
    if (!sameOriginAllowed(request)) {
      return json({ message: "Asal permintaan tidak diizinkan." }, 403);
    }

    try {
      const client = adminClient();
      const { error } = await client.from("audit_log").insert({
        aksi: "logout",
        tabel: "settings",
        record_key: "1",
        actor: "token",
        nilai_lama: { session: "aktif" },
        nilai_baru: { session: "berakhir" },
        detail: { metode: "logout" },
      });
      if (error) throw error;

      return json(
        { success: true },
        200,
        { "Set-Cookie": clearAuthCookies(request) },
      );
    } catch (error) {
      return publicError(error);
    }
  },
};
