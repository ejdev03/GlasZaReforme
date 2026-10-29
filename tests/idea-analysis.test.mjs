import assert from "node:assert/strict";
import test from "node:test";
import { classifyLocally, estimateUrgency, moderateSubmission } from "../lib/idea-analysis.mjs";

test("rejects calls for violence against a protected group with a clear explanation", () => {
  const result = moderateSubmission("kill all the muslims");
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "group_violence");
  assert.match(result.explanation, /nasilje|progon/iu);
  assert.match(result.explanation, /vere|porekla/iu);
});

test("rejects a threat against an individual while explicitly allowing political criticism", () => {
  const result = moderateSubmission("kill Vucic");
  assert.equal(result.status, "blocked");
  assert.equal(result.code, "targeted_violence");
  assert.match(result.explanation, /konkretnoj osobi/iu);
  assert.match(result.explanation, /politička kritika/iu);
});

test("does not reject an unrealistic moon proposal but assigns zero Serbian feasibility", () => {
  const text = "Serbia should colonize the moon and establish a permanent moon colony using the national budget.";
  assert.equal(moderateSubmission(text).status, "clear");
  const analysis = classifyLocally(text, "reform");
  assert.equal(analysis.feasibility.score, 0);
  assert.match(analysis.feasibility.basis, /izvan budžeta/iu);
  assert.equal(analysis.urgency.score, 2);
});

test("keeps potential separate from urgency", () => {
  const longTerm = classifyLocally("Create a high-potential long-term research fund for future technology.", "reform");
  const immediate = estimateUrgency("Transparent hospital waiting lists for patients whose treatment is delayed.");
  assert.ok(longTerm.potential >= 7);
  assert.ok(longTerm.urgency.score < immediate.score);
  assert.match(immediate.basis, /zdravlje|bezbednost/iu);
});

test("accepts personalized AI education and routes it to education", () => {
  const text = "Use AI for personalized education criteria for each student so professors become tutors instead of lecturers.";
  assert.equal(moderateSubmission(text).status, "clear");
  const analysis = classifyLocally(text, "reform");
  assert.equal(analysis.ministry, "Prosveta");
  assert.ok(analysis.feasibility.score > 0);
  assert.ok(analysis.potential >= 8);
});

test("accepts a smart tax-paying currency and routes it to finance", () => {
  const text = "Create a smart currency which automatically pays taxes and allocates money into multiple accounts so large retail chains pay suppliers on time.";
  assert.equal(moderateSubmission(text).status, "clear");
  const analysis = classifyLocally(text, "reform");
  assert.equal(analysis.ministry, "Finansije");
  assert.ok(analysis.feasibility.score > 0);
});

test("accepts an AI-sifted investment fund for small businesses", () => {
  const text = "Build a better investment fund for small businesses with initial AI sifting and easier investment for private citizens to grow the economy.";
  assert.equal(moderateSubmission(text).status, "clear");
  const analysis = classifyLocally(text, "reform");
  assert.equal(analysis.ministry, "Finansije");
  assert.ok(analysis.potential >= 8);
});

test("routes platform improvement proposals outside government ministries", () => {
  const analysis = classifyLocally("Add clearer moderation explanations and a better queue view for users.", "platform");
  assert.equal(analysis.ministry, "Razvoj platforme");
  assert.deepEqual(analysis.sectors, ["Platforma"]);
  assert.ok(analysis.tags.includes("Poboljšanje platforme"));
});
