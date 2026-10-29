const protectedPattern = /(https?:\/\/[^\s]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:ChatGPT|Google|Apple|TikTok|Instagram|OAuth|Llama|AI|API|EU|NATO|JMBG|X)\b|\b[A-Z]{2,}\b)/g;

function protect(text) {
  const values = [];
  return {
    text: text.replace(protectedPattern, (value) => `\uE000${values.push(value) - 1}\uE001`),
    restore: (converted) => converted.replace(/\uE000(\d+)\uE001/g, (_, index) => values[Number(index)] ?? ""),
  };
}

const latinPairs = [
  ["DŽ", "Џ"], ["Dž", "Џ"], ["dž", "џ"], ["LJ", "Љ"], ["Lj", "Љ"], ["lj", "љ"], ["NJ", "Њ"], ["Nj", "Њ"], ["nj", "њ"],
];
const latinSingles = {
  A: "А", B: "Б", C: "Ц", Č: "Ч", Ć: "Ћ", D: "Д", Đ: "Ђ", E: "Е", F: "Ф", G: "Г", H: "Х", I: "И", J: "Ј", K: "К", L: "Л", M: "М", N: "Н", O: "О", P: "П", R: "Р", S: "С", Š: "Ш", T: "Т", U: "У", V: "В", Z: "З", Ž: "Ж",
  a: "а", b: "б", c: "ц", č: "ч", ć: "ћ", d: "д", đ: "ђ", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", š: "ш", t: "т", u: "у", v: "в", z: "з", ž: "ж",
};
const cyrillicSingles = Object.fromEntries(Object.entries(latinSingles).map(([latin, cyrillic]) => [cyrillic, latin]));
Object.assign(cyrillicSingles, { Љ: "Lj", љ: "lj", Њ: "Nj", њ: "nj", Џ: "Dž", џ: "dž" });

export function toSerbianCyrillic(input) {
  const guarded = protect(String(input));
  let output = guarded.text;
  for (const [latin, cyrillic] of latinPairs) output = output.replaceAll(latin, cyrillic);
  output = Array.from(output, (character) => latinSingles[character] ?? character).join("");
  return guarded.restore(output);
}

export function toSerbianLatin(input) {
  const guarded = protect(String(input));
  const output = Array.from(guarded.text, (character) => cyrillicSingles[character] ?? character).join("");
  return guarded.restore(output);
}
