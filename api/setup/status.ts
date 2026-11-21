import { selectOne } from "../../lib/server/supabase.ts";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const data = await selectOne<{
        setup_completed_at: string | null;
        token_hash: string | null;
      }>("settings", "setup_completed_at,token_hash", { id: "eq.1" });

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
