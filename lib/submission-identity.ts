export async function hashValue(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validOwnerKey(value: string | null) {
  return Boolean(value && /^[a-zA-Z0-9-]{32,100}$/.test(value));
}
