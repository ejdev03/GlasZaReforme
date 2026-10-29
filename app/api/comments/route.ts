import { env } from "cloudflare:workers";
import { createComment, listComments, type RuntimeEnv } from "../../../db/persistence";
import { moderateSubmission } from "../../../lib/idea-analysis.mjs";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";

const runtimeEnv = env as unknown as RuntimeEnv;

export async function GET(request: Request) {
  const ideaId = Number(new URL(request.url).searchParams.get("ideaId"));
  if (!Number.isSafeInteger(ideaId) || ideaId <= 0) return Response.json({ error: "invalid_idea" }, { status: 400 });
  return Response.json({ comments: await listComments(runtimeEnv, ideaId) }, {
    headers: { "cache-control": "public, max-age=15, stale-while-revalidate=60" },
  });
}

export async function POST(request: Request) {
  const body = await request.json() as { ideaId?: number; body?: string; languageCode?: string };
  const ideaId = Number(body.ideaId);
  const commentBody = body.body?.trim() ?? "";
  if (!Number.isSafeInteger(ideaId) || ideaId <= 0 || commentBody.length < 3 || commentBody.length > 1500) {
    return Response.json({ error: "invalid_comment", explanation: "Komentar mora imati između 3 i 1.500 znakova." }, { status: 400 });
  }
  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const safety = moderateSubmission(commentBody);
  if (safety.status === "blocked") {
    return Response.json({ error: "prohibited_content", explanation: safety.explanation }, { status: 422 });
  }
  const moderationStatus = safety.status === "legal_review" ? "pending" : "approved";
  const result = await createComment(runtimeEnv, {
    ideaId,
    body: commentBody,
    languageCode: body.languageCode ?? request.headers.get("content-language") ?? "sr-Latn",
    authorKeyHash: await hashValue(ownerKey!),
    moderationStatus,
    moderationReason: safety.reason,
  });
  if (result.status === "rate_limited") return Response.json({ error: "rate_limited" }, { status: 429, headers: { "retry-after": "600" } });
  if (result.status === "not_found") return Response.json({ error: "idea_not_found" }, { status: 404 });
  return Response.json({ id: result.id, status: result.status }, { status: 201 });
}
