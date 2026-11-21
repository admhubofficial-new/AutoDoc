import { validSession } from "../../lib/server/session.ts";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.ts";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const session = await validSession(request);
      if (!session) return json({ authenticated: false });

      return json({
        authenticated: true,
        expiresAt: new Date(session.exp * 1000).toISOString(),
      });
    } catch (error) {
      return publicError(error);
    }
  },
};
