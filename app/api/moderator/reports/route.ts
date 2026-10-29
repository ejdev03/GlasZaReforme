import { env } from "cloudflare:workers";
import { listModeratorReports, type RuntimeEnv } from "../../../../db/persistence";
import { hashValue } from "../../../../lib/submission-identity";

const runtimeEnv = env as unknown as RuntimeEnv;

function moderatorKey() {
  return runtimeEnv.MODERATOR_API_KEY || (typeof process === "undefined" ? undefined : process.env.MODERATOR_API_KEY);
}

export async function GET(request: Request) {
  const expected = moderatorKey();
  if (!expected) return Response.json({ error: "moderator_access_not_configured" }, { status: 503 });
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied || await hashValue(supplied) !== await hashValue(expected)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const reports = await listModeratorReports(runtimeEnv);
  return Response.json({ reports }, { headers: { "cache-control": "no-store" } });
}
