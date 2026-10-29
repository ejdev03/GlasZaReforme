import { env } from "cloudflare:workers";
import { castVote, persistenceBackend, type RuntimeEnv } from "../../../db/persistence";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";

const runtimeEnv = env as unknown as RuntimeEnv;

export async function POST(request: Request) {
  const { ideaId, ratings } = await request.json() as { ideaId?: number; ratings?: { feasibility?: number; potential?: number; urgency?: number; support?: number } };
  if (typeof ideaId !== "number" || !Number.isInteger(ideaId)) return Response.json({ error: "invalid_idea" }, { status: 400 });
  const values = [ratings?.feasibility, ratings?.potential, ratings?.urgency, ratings?.support];
  if (!values.every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 10)) {
    return Response.json({ error: "invalid_ratings", explanation: "Sve četiri ocene moraju biti celi brojevi od 0 do 10." }, { status: 400 });
  }
  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const result = await castVote(runtimeEnv, ideaId, await hashValue(ownerKey!), {
    feasibility: Number(ratings!.feasibility), potential: Number(ratings!.potential),
    urgency: Number(ratings!.urgency), support: Number(ratings!.support),
  });
  if (result.status === "not_found") return Response.json({ error: "idea_not_found" }, { status: 404 });
  return Response.json({ ...result, backend: persistenceBackend(runtimeEnv) });
}
