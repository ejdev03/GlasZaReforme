import en from "./translations/en.json" with { type: "json" };
import hu from "./translations/hu.json" with { type: "json" };
import sq from "./translations/sq.json" with { type: "json" };
import ru from "./translations/ru.json" with { type: "json" };
import uk from "./translations/uk.json" with { type: "json" };
import zhHans from "./translations/zh-Hans.json" with { type: "json" };
import bs from "./translations/bs.json" with { type: "json" };
import rom from "./translations/rom.json" with { type: "json" };
import sk from "./translations/sk.json" with { type: "json" };
import ro from "./translations/ro.json" with { type: "json" };
import hr from "./translations/hr.json" with { type: "json" };
import mk from "./translations/mk.json" with { type: "json" };
import bg from "./translations/bg.json" with { type: "json" };

export const UI_TRANSLATIONS = { en, hu, sq, ru, uk, "zh-Hans": zhHans, bs, rom, sk, ro, hr, mk, bg };

export function translateUi(value, locale) {
  if (locale === "sr-Latn" || locale === "sr-Cyrl") return value;
  const match = value.match(/^(\s*)(.*?)(\s*)$/s);
  const core = match?.[2] ?? value;
  const dictionary = UI_TRANSLATIONS[locale] ?? UI_TRANSLATIONS.en;
  let translated = dictionary[core] ?? UI_TRANSLATIONS.en[core];
  if (!translated && locale === "zh-Hans") {
    const queue = core.match(/^Pozicija u redu: (\d+)$/);
    const success = core.match(/^Predlog je sačuvan i čeka Llama analizu(?: na mestu (\d+))?\. Možeš bezbedno zatvoriti stranicu\.$/);
    if (queue) translated = `队列位置：${queue[1]}`;
    else if (success) translated = `建议已保存并正在等待 Llama 分析${success[1] ? `，当前队列位置为 ${success[1]}` : ""}。您可以安全关闭此页面。`;
    else if (core.startsWith("Prikaži original ·")) translated = core.replace("Prikaži original", "查看原文");
  }
  return `${match?.[1] ?? ""}${translated ?? core}${match?.[3] ?? ""}`;
}
