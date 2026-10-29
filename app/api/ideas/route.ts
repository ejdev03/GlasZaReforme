import { env } from "cloudflare:workers";
import {
  checkSubmissionAllowance, createAnonymousModeratorReport, createIdea, listIdeas, persistenceBackend, type RuntimeEnv,
} from "../../../db/persistence";
import { classifyLocally, classifySubmission, moderateSubmission } from "../../../lib/idea-analysis.mjs";
import { hashValue, validOwnerKey } from "../../../lib/submission-identity";
import { normalizeLocale } from "../../../lib/languages.mjs";

type Submission = {
  title?: string;
  problem?: string;
  solution?: string;
  sourceLanguage?: string;
  stage?: "preview" | "confirm";
  confirmed?: boolean;
  visibilityChoice?: "public" | "private";
};

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
  const sourceLanguage = normalizeLocale(body.sourceLanguage ?? request.headers.get("content-language") ?? request.headers.get("accept-language"));
  if (title.length < 8 || title.length > 120 || problem.length < 30 || problem.length > 1500 || solution.length < 30 || solution.length > 2500) {
    return Response.json({ error: "invalid_submission", explanation: "Naslov, opis problema ili rešenje nisu u dozvoljenom opsegu dužine." }, { status: 400 });
  }

  const fullText = `${title} ${problem} ${solution}`;
  const safety = moderateSubmission(fullText);
  if (safety.status === "blocked") {
    return Response.json({ error: "prohibited_content", moderationCode: safety.code, explanation: safety.explanation }, { status: 422 });
  }
  const safetyStatus: "clear" | "legal_review" = safety.status === "legal_review" ? "legal_review" : "clear";
  const classification = classifySubmission(fullText, safetyStatus) as {
    kind: "reform" | "platform" | "corruption" | "sensitive";
    label: string;
    recommendedVisibility: "public" | "private";
    forcePrivate: boolean;
  };

  if (body.stage !== "confirm" || body.confirmed !== true) {
    return Response.json({
      status: "confirmation_required",
      classification: classification.kind,
      classificationLabel: classification.label,
      recommendedVisibility: classification.recommendedVisibility,
      forcePrivate: classification.forcePrivate,
      explanation: classification.forcePrivate
        ? "Ovaj sadržaj može biti prijava korupcije ili sadržati osetljive podatke, pa može ići samo u anonimnu moderatorsku obradu."
        : classification.recommendedVisibility === "private"
          ? "Llama preporučuje privatnu obradu pre eventualne objave."
          : "Llama preporučuje javnu objavu nakon završene obrade i moderacije.",
    });
  }

  const contentHash = await hashValue(`${classification.kind}|${title.toLocaleLowerCase("sr-Latn")}|${problem.toLocaleLowerCase("sr-Latn")}|${solution.toLocaleLowerCase("sr-Latn")}`);
  if (classification.kind === "corruption" || classification.kind === "sensitive") {
    const report = await createAnonymousModeratorReport(runtimeEnv, {
      reportType: classification.kind,
      title, problem, solution, sourceLanguage, contentHash, safetyReason: safety.reason,
    });
    if (report.status === "duplicate") {
      return Response.json({ error: "duplicate_submission", anonymousReport: true }, { status: 409 });
    }
    return Response.json({
      id: report.id, status: "moderator_queue", visibility: "restricted", anonymousReport: true,
      classification: classification.kind, backend: persistenceBackend(runtimeEnv),
    }, { status: 201 });
  }

  const ownerKey = request.headers.get("x-idea-owner-key");
  if (!validOwnerKey(ownerKey)) return Response.json({ error: "missing_owner_key" }, { status: 400 });
  const clientAddress = request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
  const ownerKeyHash = await hashValue(ownerKey!);
  const submitterHash = await hashValue(`${clientAddress}|${request.headers.get("user-agent") ?? "unknown"}`);
  const allowance = await checkSubmissionAllowance(runtimeEnv, ownerKeyHash, submitterHash, contentHash);
  if (!allowance.allowed) {
    const error = allowance.reason === "duplicate" ? "duplicate_submission" : "rate_limited";
    return Response.json({ error, reason: allowance.reason, retryAfter: allowance.retryAfterSeconds }, {
      status: allowance.reason === "duplicate" ? 409 : 429,
      headers: allowance.retryAfterSeconds ? { "retry-after": String(allowance.retryAfterSeconds) } : undefined,
    });
  }

  const visibility = classification.forcePrivate || body.visibilityChoice === "private" ? "restricted" : "public";
  const ideaType = classification.kind === "platform" ? "platform" : "reform";
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
  return Response.json({
    id: queued.id, status: "queued", queuePosition: queued.queuePosition, visibility,
    classification: classification.kind, backend: persistenceBackend(runtimeEnv),
  }, { status: 201 });
}
