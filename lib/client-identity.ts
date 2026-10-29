const OWNER_KEY_STORAGE = "glas-za-reforme-owner-key";

export function getIdeaOwnerKey() {
  let key = window.localStorage.getItem(OWNER_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem(OWNER_KEY_STORAGE, key);
  }
  return key;
}
