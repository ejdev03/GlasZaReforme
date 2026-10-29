import { env } from "cloudflare:workers";
import { checkSubmissionAllowance, createIdea, listIdeas, persistenceBackend, type RuntimeEnv } from "../../../db/persistence";
import { classifyLocally, determineVisibility, moderateSubmission } from "../../../lib/idea-analysis.mjs";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";
import { normalizeLocale } from "../../../lib/languages.mjs";

type Submission = { title?: string; problem?: string; solution?: string; ideaType?: "reform" | "platform"; sourceLanguage?: string };
const runtimeEnv = env as unknown as RuntimeEnv;

export async function GET(request: Request) {
  const ideas = await listIdeas(runtimeEnv, new URL(request.url).searchParams.get("lang") ?? request.headers.get("accept-language") ?? undefined);
  return Response.json({ ideas, backend: persistenceBackend(runtimeEnv) });
}

export async function POST(request: Request) {
  const body = await request.json() as Submission;
  const title = body.title?.trim() ?? "";
  const problem = body.problem?.trim() ?? "";
  const solution = body.solution?.trim() ?? "";
  const ideaType = body.ideaType === "platform" ? "platform" : "reform";
  const sourceLanguage = normalizeLocale(body.sourceLanguage ?? request.headers.get("content-language") ?? request.headers.get("accept-language"));
  if (title.length < 8 || title.length > 120 || problem.length < 30 || problem.length > 1500 || solution.length < 30 || solution.length > 2500) {
    return Response.json({ error: "invalid_submission", explanation: "Naslov, opis problema ili rešenje nisu u dozvoljenom opsegu dužine." }, { status: 400 });
  }

  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const clientAddress = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const ownerKeyHash = await hashValue(ownerKey!);
  const submitterHash = await hashValue(`${clientAddress}|${request.headers.get("user-agent") ?? "unknown"}`);
  const contentHash = await hashValue(`${ideaType}|${title.toLocaleLowerCase("sr-Latn")}|${problem.toLocaleLowerCase("sr-Latn")}|${solution.toLocaleLowerCase("sr-Latn")}`);
  const allowance = await checkSubmissionAllowance(runtimeEnv, ownerKeyHash, submitterHash, contentHash);
  if (!allowance.allowed) {
    const error = allowance.reason === "duplicate" ? "duplicate_submission" : "rate_limited";
    return Response.json({ error, reason: allowance.reason, retryAfter: allowance.retryAfterSeconds }, {
      status: allowance.reason === "duplicate" ? 409 : 429,
      headers: allowance.retryAfterSeconds ? { "retry-after": String(allowance.retryAfterSeconds) } : undefined,
    });
  }

  const fullText = `${title} ${problem} ${solution}`;
  const safety = moderateSubmission(fullText);
  if (safety.status === "blocked") {
    return Response.json({ error: "prohibited_content", moderationCode: safety.code, explanation: safety.explanation }, { status: 422 });
  }
  const safetyStatus: "clear" | "legal_review" = safety.status === "legal_review" ? "legal_review" : "clear";
  const visibility = determineVisibility(fullText, safetyStatus) as "public" | "restricted";
  const analysis = classifyLocally(fullText, ideaType);
  const queued = await createIdea(runtimeEnv, {
    title, problem, solution, ideaType, visibility, safetyStatus, safetyReason: safety.reason,
    ministry: analysis.ministry, sectors: analysis.sectors, tags: analysis.tags,
    feasibility: analysis.feasibility.score, feasibilityConfidence: analysis.feasibility.confidence,
    feasibilityBasis: analysis.feasibility.basis, potential: analysis.potential,
    urgency: analysis.urgency.score, urgencyConfidence: analysis.urgency.confidence, urgencyBasis: analysis.urgency.basis,
    acceptability: analysis.publicSupport.score, acceptanceConfidence: analysis.publicSupport.confidence,
    acceptanceBasis: analysis.publicSupport.basis, ownerKeyHash, submitterHash, contentHash, sourceLanguage,
  });
  return Response.json({ id: queued.id, status: "queued", queuePosition: queued.queuePosition, visibility, backend: persistenceBackend(runtimeEnv) }, { status: 201 });
}
