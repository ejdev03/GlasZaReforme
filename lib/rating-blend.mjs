export const AI_PRIOR_VOTE_LIMIT = 100;

export function blendRating(aiRating, communityRating, ratingCount) {
  const ai = Number(aiRating);
  const community = Number(communityRating);
  const count = Math.min(Math.max(Number(ratingCount) || 0, 0), AI_PRIOR_VOTE_LIMIT);
  if (!Number.isFinite(ai)) return Number.isFinite(community) ? Math.round(community * 100) / 100 : 0;
  if (count === 0 || !Number.isFinite(community)) return Math.round(ai * 100) / 100;
  const communityWeight = count / AI_PRIOR_VOTE_LIMIT;
  return Math.round((ai * (1 - communityWeight) + community * communityWeight) * 100) / 100;
}

export function aiWeightPercent(ratingCount) {
  const count = Math.min(Math.max(Number(ratingCount) || 0, 0), AI_PRIOR_VOTE_LIMIT);
  return AI_PRIOR_VOTE_LIMIT - count;
}
