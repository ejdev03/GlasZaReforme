import { readFile, writeFile } from "node:fs/promises";
import { toSerbianCyrillic } from "../lib/serbian-script.mjs";

const directory = new URL("../lib/translations/", import.meta.url);
const master = JSON.parse(await readFile(new URL("zh-Hans.json", directory), "utf8"));
const keys = Object.keys(master);
const delimiter = "\n@@@\n";
const targets = { en: "en", hu: "hu", sq: "sq", ru: "ru", uk: "uk", ro: "ro", sk: "sk", rom: "rom", mk: "mk", bg: "bg" };

function batches(entries, limit = 430) {
  const result = [];
  let current = [];
  let size = 0;
  for (const entry of entries) {
    if (current.length && size + delimiter.length + entry.length > limit) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(entry);
    size += entry.length + (current.length > 1 ? delimiter.length : 0);
  }
  if (current.length) result.push(current);
  return result;
}

async function translateBatch(batch, target) {
  const url = new URL("https://clients5.google.com/translate_a/t");
  url.searchParams.set("q", batch.join(delimiter));
  url.searchParams.set("client", "dict-chrome-ex");
  url.searchParams.set("sl", "sr");
  url.searchParams.set("tl", target);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
  const payload = await response.json();
  const values = String(payload[0]).split(delimiter);
  if (values.length !== batch.length) throw new Error(`Translation delimiter mismatch for ${target}`);
  return values;
}

async function translateCatalog(locale, target) {
  const url = new URL(`${locale}.json`, directory);
  const catalog = JSON.parse(await readFile(url, "utf8"));
  const missing = keys.filter((key) => !catalog[key]?.trim());
  for (const batch of batches(missing)) {
    const values = await translateBatch(batch, target);
    batch.forEach((key, index) => { catalog[key] = values[index].trim(); });
  }
  const ordered = Object.fromEntries(keys.map((key) => [key, catalog[key]]));
  await writeFile(url, `${JSON.stringify(ordered, null, 2)}\n`);
}

for (const [locale, target] of Object.entries(targets)) await translateCatalog(locale, target);

const serbianLatin = Object.fromEntries(keys.map((key) => [key, key]));
const serbianCyrillic = Object.fromEntries(keys.map((key) => [key, toSerbianCyrillic(key)]));
await writeFile(new URL("sr-Latn.json", directory), `${JSON.stringify(serbianLatin, null, 2)}\n`);
await writeFile(new URL("sr-Cyrl.json", directory), `${JSON.stringify(serbianCyrillic, null, 2)}\n`);
await writeFile(new URL("bs.json", directory), `${JSON.stringify(serbianLatin, null, 2)}\n`);
await writeFile(new URL("hr.json", directory), `${JSON.stringify(serbianLatin, null, 2)}\n`);

console.log(`Synchronized ${keys.length} fields across 15 locale catalogs.`);
