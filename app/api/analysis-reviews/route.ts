import { env } from "cloudflare:workers";
import { createAnalysisReviewRequest, type RuntimeEnv } from "../../../db/persistence";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";

const runtimeEnv = env as unknown as RuntimeEnv;

export async function POST(request: Request) {
  const body = await request.json() as { ideaId?: number; acknowledged?: boolean };
  const ideaId = Number(body.ideaId);
  if (!Number.isSafeInteger(ideaId) || ideaId <= 0 || body.acknowledged !== true) {
    return Response.json({ error: "invalid_review_request" }, { status: 400 });
  }
  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const result = await createAnalysisReviewRequest(runtimeEnv, { ideaId, requesterKeyHash: await hashValue(ownerKey!) });
  if (result.status === "not_found") return Response.json({ error: "idea_not_found" }, { status: 404 });
  if (result.status === "not_eligible") return Response.json({ error: "review_not_eligible" }, { status: 422 });
  if (result.status === "duplicate") return Response.json({ error: "duplicate_review" }, { status: 409 });
  if (result.status === "rate_limited") {
    return Response.json({ error: "review_rate_limited" }, { status: 429, headers: { "retry-after": "2592000" } });
  }
  return Response.json({ id: result.id, status: "pending" }, { status: 201 });
}
