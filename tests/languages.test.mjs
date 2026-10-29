import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { normalizeLocale, SUPPORTED_LOCALES, translationTargets } from "../lib/languages.mjs";
import { translateUi } from "../lib/ui-translations.mjs";

test("normalizes regional browser locales to supported languages", () => {
  assert.equal(normalizeLocale("sr-Cyrl-RS"), "sr-Cyrl");
  assert.equal(normalizeLocale("hu-HU"), "hu");
  assert.equal(normalizeLocale("zh-CN"), "zh-Hans");
  assert.equal(normalizeLocale("fr-FR"), "sr-Latn");
});

test("queues every language except the preserved original", () => {
  const targets = translationTargets("sq");
  assert.equal(targets.includes("sq"), false);
  assert.equal(targets.length, SUPPORTED_LOCALES.length - 1);
  assert.ok(targets.includes("hu"));
  assert.ok(targets.includes("rom"));
  assert.ok(targets.includes("en"));
});

test("translates core interface controls in requested languages", () => {
  assert.equal(translateUi("Predloži reformu", "en"), "Propose a reform");
  assert.equal(translateUi("Predloži reformu", "hu"), "Reform javaslata");
  assert.equal(translateUi("Komentari", "sq"), "Komentet");
  assert.equal(translateUi("Objavi komentar", "ru"), "Опубликовать");
  assert.equal(translateUi("Moje ideje", "uk"), "Мої ідеї");
  assert.equal(translateUi("Tvoja ideja", "zh-Hans"), "您的建议");
});

test("translates complete Chinese content rather than leaving Serbian fallbacks", () => {
  const samples = [
    "Predloži promenu, podrži dobre ideje i pomozi da najvažnije reforme stignu do onih koji odlučuju.",
    "Najbolje ocenjeni predlozi građana, razvrstani po oblastima i analizirani prema jasnim kriterijumima.",
    "Llama predlaže ministarstva, sektore i oznake, a moderatori potvrđuju klasifikaciju.",
    "Ne unosi državne tajne, lične podatke trećih lica ili materijal čije posedovanje nije dozvoljeno. Ova platforma nije državni kanal za klasifikovane informacije.",
    "Gostujući pristup čuva nacrte i tvoje ideje u ovom pregledaču. Kada OAuth bude povezan, nalog će omogućiti pristup sa više uređaja.",
    "Komentari se otvaraju kada ideja završi obradu i bude objavljena.",
    "Ovaj privremeni pregled je vezan za trenutni pregledač. Kada OAuth prijava bude uključena, ideje će biti povezane sa nalogom i dostupne na svim uređajima.",
  ];
  for (const source of samples) {
    const translated = translateUi(source, "zh-Hans");
    assert.notEqual(translated, source);
    assert.match(translated, /[\u3400-\u9fff]/u);
  }
  assert.equal(translateUi("Pozicija u redu: 12", "zh-Hans"), "队列位置：12");
  assert.match(translateUi("Predlog je sačuvan i čeka Llama analizu na mestu 4. Možeš bezbedno zatvoriti stranicu.", "zh-Hans"), /队列位置为 4/);
  assert.equal(translateUi("Personalizovano obrazovanje uz AI mentore", "zh-Hans"), "由 AI 导师支持的个性化教育");
  assert.equal(translateUi("Zabrana ugovornih klauzula koje prisvajaju nepovezanu intelektualnu svojinu", "en"), "Ban contract clauses that claim unrelated intellectual property");
});

test("every supported locale catalog has the complete non-empty field set", async () => {
  const directory = new URL("../lib/translations/", import.meta.url);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
  assert.equal(files.includes("rue.json"), false);
  assert.deepEqual(files.map((file) => file.replace(".json", "")).sort(), [...SUPPORTED_LOCALES].sort());
  const master = JSON.parse(await readFile(new URL("zh-Hans.json", directory), "utf8"));
  const requiredKeys = Object.keys(master).sort();
  assert.ok(requiredKeys.length >= 190);
  for (const file of files) {
    const catalog = JSON.parse(await readFile(new URL(file, directory), "utf8"));
    assert.deepEqual(Object.keys(catalog).sort(), requiredKeys, `${file} has a different field set`);
    assert.equal(Object.values(catalog).every((value) => typeof value === "string" && value.trim().length > 0), true, `${file} has an empty translation`);
  }
});
