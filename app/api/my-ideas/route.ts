import { env } from "cloudflare:workers";
import { listMyIdeas, persistenceBackend, type RuntimeEnv } from "../../../db/persistence";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";

const runtimeEnv = env as unknown as RuntimeEnv;

export async function GET(request: Request) {
  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const ideas = await listMyIdeas(runtimeEnv, await hashValue(ownerKey!));
  return Response.json({ ideas, backend: persistenceBackend(runtimeEnv) }, {
    headers: { "cache-control": "private, no-store" },
  });
}
