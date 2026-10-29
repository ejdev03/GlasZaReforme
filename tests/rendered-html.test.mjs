import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Glas za reforme experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="sr-Latn">/);
  assert.match(html, /<title>Glas za reforme/);
  assert.match(html, /Dobri predlozi/);
  assert.match(html, /Podrška u Srbiji/);
  assert.match(html, /nije moralna ocena/);
  assert.match(html, /Pozivi na nasilje i grupnu mržnju se blokiraju/);
  assert.match(html, /Predloži reformu/);
  assert.match(html, /Nalog/);
  assert.doesNotMatch(html, /Jedinstveni portal za sve lokalne administrativne takse/);
  assert.match(html, /Personalizovano obrazovanje uz AI mentore/);
  assert.match(html, /Pametna valuta sa automatskim porezima/);
  assert.match(html, /Investicioni fond dostupan malim firmama i građanima/);
  assert.doesNotMatch(html, /Srpska kolonija na Mesecu/);
  assert.match(html, /Zabrana ugovornih klauzula koje prisvajaju nepovezanu intelektualnu svojinu/);
  assert.match(html, /Programer igara mora ostati slobodan da nezavisno napravi bankarsku aplikaciju/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("keeps proposal routing automatic in the submission flow", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Jedan automatski tok/);
  assert.match(source, /Nastavi na potvrdu/);
  assert.match(source, /Preporuka Llama sistema/);
  assert.match(source, /Privatno moderatorima/);
  assert.doesNotMatch(source, /<legend>Način obrade<\/legend>/);
  assert.doesNotMatch(source, /idea-type-reform|idea-type-platform/);
});

test("stores corruption and sensitive reports anonymously in protected moderator groups", async () => {
  const [home, route, persistence, moderatorRoute, moderatorPage] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/ideas/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/moderator/reports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/moderacija/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /submissionPreview\.recommendedVisibility/);
  assert.match(home, /if \(!submissionPreview\.forcePrivate\).*x-idea-owner-key/);
  assert.match(route, /classification\.kind === "corruption" \|\| classification\.kind === "sensitive"/);
  assert.ok(route.indexOf("const report = await createAnonymousModeratorReport") < route.indexOf("const ownerKey = request.headers"));
  const reportTable = persistence.slice(persistence.indexOf("const createModeratorReportsD1"), persistence.indexOf("const postgresSchema"));
  assert.match(reportTable, /CREATE TABLE IF NOT EXISTS moderator_reports/);
  assert.doesNotMatch(reportTable, /owner_key|submitter|ip_address|account/);
  assert.match(moderatorRoute, /MODERATOR_API_KEY/);
  assert.match(moderatorRoute, /authorization/);
  assert.match(moderatorPage, /Prijave korupcije/);
  assert.match(moderatorPage, /Osetljive prijave/);
});

test("offers guest access without advertising an unconfigured sign-in", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /Nastavi bez prijave/);
  assert.match(source, /ChatGPT<\/b><small>nije povezano/);
  assert.doesNotMatch(source, /href="\/signin-with-chatgpt/);
  assert.doesNotMatch(source, /dostupno sada/);
});

test("keeps submitted ideas durable while analysis is queued", async () => {
  const [home, persistence, myIdeas] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/moje-ideje/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(home, /Sačuvaj nacrt/);
  assert.match(home, /x-idea-owner-key/);
  assert.match(persistence, /submission_attempts/);
  assert.match(persistence, /processing_status = 'queued'/);
  assert.match(myIdeas, /Pozicija u redu/);
  assert.match(myIdeas, /15_000/);
});

test("stores original ideas, per-language translations, and moderated comments", async () => {
  const [persistence, commentsRoute, discussion] = await Promise.all([
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/comments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/idea-discussion.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(persistence, /CREATE TABLE IF NOT EXISTS idea_translations/);
  assert.match(persistence, /original_title/);
  assert.match(persistence, /translation_available/);
  assert.match(persistence, /CREATE TABLE IF NOT EXISTS comments/);
  assert.match(commentsRoute, /moderateSubmission/);
  assert.match(discussion, /Prikaži original/);
  assert.match(discussion, /Objavi komentar/);
});

test("offers moderator review for exceptionally low feasibility or potential without treating low support as an error", async () => {
  const [home, myIdeas, discussion, persistence, reviewRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/moje-ideje/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/idea-discussion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/analysis-reviews/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(home, /idea\.feasibility <= 1 \|\| idea\.potential <= 2/);
  assert.match(home, /idea\.feasibility > 1 && idea\.potential > 2/);
  assert.doesNotMatch(home, /publicSupport <= 2/);
  assert.match(myIdeas, /Ova ideja nije javno prikazana/);
  assert.match(persistence, /i\.feasibility IS NULL OR i\.feasibility > 1/);
  assert.match(persistence, /i\.potential IS NULL OR i\.potential > 2/);
  assert.match(discussion, /Razumem upozorenje i ipak želim da pošaljem zahtev/);
  assert.match(discussion, /može dovesti do ograničenja ili zabrane naloga/);
  assert.match(persistence, /CREATE TABLE IF NOT EXISTS analysis_review_requests/);
  assert.match(persistence, /Number\(idea\.feasibility\) <= 1/);
  assert.match(persistence, /Number\(idea\.potential\) <= 2/);
  assert.match(reviewRoute, /body\.acknowledged !== true/);
});

test("keeps urgency distinct and collects four adjustable category ratings with each upvote", async () => {
  const [home, persistence, votesRoute, analysis] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/votes/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/idea-analysis.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(home, /Najhitnije/);
  assert.match(home, /type="range" min="0" max="10"/);
  assert.match(home, /Math\.round\(idea\.urgency\)/);
  assert.match(home, /Sačuvaj ocene i podrži/);
  assert.match(persistence, /feasibility_rating INTEGER, potential_rating INTEGER, urgency_rating INTEGER, support_rating INTEGER/);
  assert.match(votesRoute, /values\.every/);
  assert.match(analysis, /export function estimateUrgency/);
});

test("phases out stored AI ratings over the first one hundred community ratings", async () => {
  const [home, persistence, blend] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/persistence.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/rating-blend.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(blend, /AI_PRIOR_VOTE_LIMIT = 100/);
  assert.match(persistence, /ai_feasibility/);
  assert.match(persistence, /community_feasibility/);
  assert.match(persistence, /blendRating/);
  assert.match(home, /AI više ne utiče na rezultat/);
});

test("renders absolute social metadata for the deployed origin", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /property="og:title" content="Glas za reforme"/);
  assert.match(html, /property="og:image" content="https:\/\/glas-za-reforme\.copperfly3\.chatgpt\.site\/og\.png"/);
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
});
