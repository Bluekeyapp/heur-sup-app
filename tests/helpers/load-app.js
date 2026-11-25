// Loads the real index.html and src/app.js into a jsdom window so the screens
// can be driven the way a user would. Each call gets a fresh DOM, a fresh
// localStorage and a fresh copy of app.js (imported with a unique query), so
// tests do not share state.
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");
const GLOBALS = [
  "window", "document", "navigator", "localStorage", "requestAnimationFrame",
  "HTMLElement", "Event", "File", "Blob"
];

let loadCount = 0;

export async function loadApp({ storage = {}, now } = {}) {
  const dom = new JSDOM(html, { url: "http://localhost/", pretendToBeVisual: true });
  const { window } = dom;

  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

  // jsdom does not implement the inert property; reflect it to the attribute
  // like browsers do, since the app relies on [inert] selectors.
  if (!("inert" in window.HTMLElement.prototype)) {
    Object.defineProperty(window.HTMLElement.prototype, "inert", {
      configurable: true,
      get() { return this.hasAttribute("inert"); },
      set(value) { this.toggleAttribute("inert", Boolean(value)); }
    });
  }

  for (const [key, value] of Object.entries(storage)) {
    window.localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  const saved = new Map(GLOBALS.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const key of GLOBALS) {
    Object.defineProperty(globalThis, key, { value: window[key] ?? window, configurable: true, writable: true });
  }
  globalThis.window = window;

  const RealDate = globalThis.Date;
  if (now) {
    globalThis.Date = fakeDate(RealDate, now);
  }

  await import(new URL(`src/app.js?test=${++loadCount}`, root).href);

  const $ = (id) => window.document.getElementById(id);

  return {
    window,
    document: window.document,
    $,
    storage: window.localStorage,
    currentScreen: () => [...window.document.querySelectorAll(".screen")].find((screen) => !screen.inert)?.id,
    toast: () => $("toastText").textContent,
    entries: () => JSON.parse(window.localStorage.getItem("ot") || "[]"),
    tick: (ms = 0) => new Promise((resolve) => window.setTimeout(resolve, ms)),
    cleanup() {
      window.close();
      globalThis.Date = RealDate;
      for (const [key, descriptor] of saved) {
        if (descriptor) {
          Object.defineProperty(globalThis, key, descriptor);
        } else {
          delete globalThis[key];
        }
      }
    }
  };
}

// A Date whose "now" is fixed, so tests about today and future dates do not
// depend on when they run.
function fakeDate(RealDate, now) {
  const fixed = new RealDate(now).getTime();
  return class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixed]));
    }

    static now() {
      return fixed;
    }
  };
}
