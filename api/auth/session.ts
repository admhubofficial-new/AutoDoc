import { validSession } from "../../lib/server/session.js";
import { json, methodNotAllowed, publicError } from "../../lib/server/http.js";

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "GET") return methodNotAllowed("GET");

    try {
      const session = await validSession(request);
      if (!session) {
        return json({ authenticated: false });
      }
      return json({
        authenticated: true,
        expiresAt: new Date(session.exp * 1000).toISOString(),
      });
    } catch (error) {
      return publicError(error);
    }
  },
};
