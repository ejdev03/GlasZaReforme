"use client";

import { useEffect, useMemo, useState } from "react";
import { toSerbianCyrillic, toSerbianLatin } from "../lib/serbian-script.mjs";
import { normalizeLocale, SUPPORTED_LANGUAGES } from "../lib/languages.mjs";
import { translateUi } from "../lib/ui-translations.mjs";

type LanguageMode = "auto" | string;
const STORAGE_KEY = "glas-za-reforme-language";
const textOriginals = new WeakMap<Text, string>();
const textApplied = new WeakMap<Text, string>();
const attributeOriginals = new WeakMap<Element, Map<string, string>>();
const attributeApplied = new WeakMap<Element, Map<string, string>>();
const attributes = ["placeholder", "aria-label", "title"];

function isExcluded(node: Node) {
  return node.parentElement?.closest("[data-no-transliterate]") !== null;
}

function convert(value: string, locale: string) {
  if (locale === "sr-Cyrl") return toSerbianCyrillic(value);
  if (locale === "sr-Latn") return toSerbianLatin(value);
  return translateUi(toSerbianLatin(value), locale);
}

function applyText(node: Text, locale: string) {
  if (isExcluded(node) || !node.nodeValue?.trim()) return;
  const previousApplied = textApplied.get(node);
  if (!textOriginals.has(node) || (previousApplied !== undefined && node.nodeValue !== previousApplied)) textOriginals.set(node, node.nodeValue);
  const next = convert(textOriginals.get(node) ?? node.nodeValue, locale);
  textApplied.set(node, next);
  if (node.nodeValue !== next) node.nodeValue = next;
}

function applyElement(element: Element, locale: string) {
  if (element.closest("[data-no-transliterate]")) return;
  const originals = attributeOriginals.get(element) ?? new Map<string, string>();
  const applied = attributeApplied.get(element) ?? new Map<string, string>();
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    if (!originals.has(attribute) || (applied.has(attribute) && current !== applied.get(attribute))) originals.set(attribute, current);
    const next = convert(originals.get(attribute) ?? current, locale);
    applied.set(attribute, next);
    if (current !== next) element.setAttribute(attribute, next);
  }
  attributeOriginals.set(element, originals);
  attributeApplied.set(element, applied);
}

function applyTree(root: Node, locale: string) {
  if (root instanceof Text) applyText(root, locale);
  if (root instanceof Element) applyElement(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text) applyText(node, locale);
    else if (node instanceof Element) applyElement(node, locale);
    node = walker.nextNode();
  }
}

export default function ScriptSwitcher() {
  const [mode, setMode] = useState<LanguageMode>("auto");
  const resolved = useMemo(() => {
    if (mode !== "auto") return normalizeLocale(mode);
    return typeof navigator === "undefined" ? "sr-Latn" : normalizeLocale(navigator.language);
  }, [mode]);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const legacy = window.localStorage.getItem("glas-za-reforme-script");
    const migrated = legacy === "cyrillic" ? "sr-Cyrl" : legacy === "latin" ? "sr-Latn" : null;
    if (stored === "auto" || SUPPORTED_LANGUAGES.some(({ code }: { code: string }) => code === stored)) queueMicrotask(() => setMode(stored!));
    else if (migrated) queueMicrotask(() => setMode(migrated));
  }, []);

  useEffect(() => {
    document.documentElement.lang = resolved;
    applyTree(document.body, resolved);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") applyText(mutation.target as Text, resolved);
        else if (mutation.type === "attributes") applyElement(mutation.target as Element, resolved);
        else for (const node of mutation.addedNodes) applyTree(node, resolved);
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes });
    return () => observer.disconnect();
  }, [resolved]);

  function choose(next: LanguageMode) {
    window.localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
    window.location.reload();
  }

  return <div className="scriptSwitcher languageSwitcher">
    <label htmlFor="site-language">Jezik</label>
    <select id="site-language" data-no-transliterate aria-label="Izbor jezika" value={mode} onChange={(event) => choose(event.target.value)}>
      <option value="auto">Auto · {SUPPORTED_LANGUAGES.find(({ code }: { code: string }) => code === resolved)?.label}</option>
      {SUPPORTED_LANGUAGES.map(({ code, label }: { code: string; label: string }) => <option key={code} value={code}>{label}</option>)}
    </select>
  </div>;
}
