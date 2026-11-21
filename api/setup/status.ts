import { adminClient } from "../../lib/server/supabase.js";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const { data, error } = await adminClient()
        .from("settings")
        .select("setup_completed_at, token_hash")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;

      const setupComplete = Boolean(data?.setup_completed_at && data?.token_hash);
      return json({
        setupRequired: !setupComplete,
        setupComplete,
      });
    } catch (error) {
      return publicError(error);
    }
  },
};
