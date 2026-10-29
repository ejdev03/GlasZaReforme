import assert from "node:assert/strict";
import test from "node:test";
import { toSerbianCyrillic, toSerbianLatin } from "../lib/serbian-script.mjs";

test("converts Serbian Latin digraphs and diacritics to Cyrillic", () => {
  assert.equal(toSerbianCyrillic("Bolja država, građani i predlozi"), "Боља држава, грађани и предлози");
  assert.equal(toSerbianCyrillic("Njihov džak i Ljiljana"), "Њихов џак и Љиљана");
});

test("converts Serbian Cyrillic back to Latin", () => {
  assert.equal(toSerbianLatin("Боља држава, грађани и предлози"), "Bolja država, građani i predlozi");
  assert.equal(toSerbianLatin("Њихов џак и Љиљана"), "Njihov džak i Ljiljana");
});

test("preserves product names, acronyms, URLs, and email addresses", () => {
  const source = "ChatGPT, Google, Apple, TikTok, Llama, AI, OAuth i API — https://example.com test@example.com";
  const converted = toSerbianCyrillic(source);
  for (const protectedValue of ["ChatGPT", "Google", "Apple", "TikTok", "Llama", "AI", "OAuth", "API", "https://example.com", "test@example.com"]) {
    assert.match(converted, new RegExp(protectedValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(converted, / и /);
});
