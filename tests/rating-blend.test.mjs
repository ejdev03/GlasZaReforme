import assert from "node:assert/strict";
import test from "node:test";
import { aiWeightPercent, blendRating } from "../lib/rating-blend.mjs";

test("starts with the AI rating before any community votes", () => {
  assert.equal(blendRating(8, undefined, 0), 8);
  assert.equal(aiWeightPercent(0), 100);
});

test("reduces the AI contribution linearly until the hundredth rating", () => {
  assert.equal(blendRating(8, 4, 25), 7);
  assert.equal(blendRating(8, 4, 50), 6);
  assert.equal(blendRating(8, 4, 99), 4.04);
  assert.equal(aiWeightPercent(75), 25);
  assert.equal(blendRating(8, 3, 37), 6.15);
});

test("uses only community ratings from one hundred ratings onward", () => {
  assert.equal(blendRating(8, 4, 100), 4);
  assert.equal(blendRating(8, 4, 250), 4);
  assert.equal(aiWeightPercent(250), 0);
});
