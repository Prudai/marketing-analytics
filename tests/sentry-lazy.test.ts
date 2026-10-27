import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// @sentry/react nagebootst: hier gaat het om wanneer en hoe het pakket Sentry start, niet om
// Sentry zelf. Het echte gedrag in een browser (eigen chunk, banner eerst) is met Lighthouse
// op een build van product-page-zia gemeten (zie de PR).
const sentryAanroepen: { fn: string; args: unknown[] }[] = [];
let initGooit = false;
// Let op: bun houdt deze module-mock de rest van het testproces actief; de andere testbestanden
// gebruiken @sentry/react niet anders dan via de (ongebruikte) `Sentry`-export.
mock.module("@sentry/react", () => ({
  init: (...args: unknown[]) => {
    sentryAanroepen.push({ fn: "init", args });
    if (initGooit) throw new Error("init faalt");
  },
  captureException: (...args: unknown[]) => void sentryAanroepen.push({ fn: "captureException", args }),
  browserTracingIntegration: () => ({ name: "BrowserTracing" }),
  addEventProcessor: () => undefined,
}));

// Een minimale browser: listeners, readyState en een requestIdleCallback die we zelf afspelen.
type Listener = (e: unknown) => void;
const listeners = new Map<string, Set<Listener>>();
const rustTaken: (() => void)[] = [];
let rustOpties: unknown[] = [];
const fakeWindow = {
  addEventListener: (type: string, fn: Listener) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: Listener) => void listeners.get(type)?.delete(fn),
  requestIdleCallback: (fn: () => void, opts?: unknown) => {
    rustTaken.push(fn);
    rustOpties.push(opts);
    return rustTaken.length;
  },
};
function stuur(type: string, e: unknown) {
  for (const fn of [...(listeners.get(type) ?? [])]) fn(e);
}

const g = globalThis as unknown as Record<string, unknown>;
const hadWindow = "window" in g;
const vorigeWindow = g.window;
const hadDocument = "document" in g;
const vorigeDocument = g.document;
g.window = fakeWindow;
g.document = { readyState: "complete", referrer: "" };

const { scheduleSentry, resetSentryScheduleForTests, MAX_VROEGE_FOUTEN, IDLE_TIMEOUT_MS, NA_LOAD_MS } = await import(
  "../src/sentry/lazy"
);
const { resetSentryForTests } = await import("../src/sentry/init");
const { initAnalytics } = await import("../src/init");

/** De wachttijd na `load` in deze tests (in productie `NA_LOAD_MS`). */
const WACHT_MS = 5;
const slaap = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Laat de wachttijd verstrijken, speel de rustmomenten af en wacht op import en init. */
async function rust() {
  await slaap(WACHT_MS + 5);
  while (rustTaken.length) rustTaken.shift()!();
  for (let i = 0; i < 20 && !sentryAanroepen.some((a) => a.fn === "init"); i++) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

const OPTS = { dsn: "https://key@errors.example.test/1", environment: "test", release: "r1" };

beforeEach(() => {
  resetSentryScheduleForTests(WACHT_MS);
  resetSentryForTests();
  sentryAanroepen.length = 0;
  rustTaken.length = 0;
  rustOpties = [];
  initGooit = false;
  listeners.clear();
  (g.document as { readyState: string }).readyState = "complete";
});

afterAll(() => {
  if (hadWindow) g.window = vorigeWindow;
  else delete g.window;
  if (hadDocument) g.document = vorigeDocument;
  else delete g.document;
});

describe("Sentry lui laden (v0.4.7)", () => {
  test("initAnalytics start Sentry niet synchroon, maar op een rustmoment", async () => {
    initAnalytics({ siteId: "test", sentry: { dsn: OPTS.dsn, tracesSampleRate: 0 }, environment: "test", release: "r1" });
    expect(sentryAanroepen).toHaveLength(0);
    // Eerst de wachttijd na load (de banner schuift nog in), dan pas een rustmoment.
    expect(rustTaken).toHaveLength(0);
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(1);
    expect(rustOpties[0]).toEqual({ timeout: IDLE_TIMEOUT_MS });
    await rust();
    const init = sentryAanroepen.filter((a) => a.fn === "init");
    expect(init).toHaveLength(1);
    expect(init[0]!.args[0]).toEqual({
      dsn: OPTS.dsn,
      environment: "test",
      release: "r1",
      sendDefaultPii: false,
      tracesSampleRate: 0,
      integrations: [],
    });
  });

  test("standaard wacht het pakket 1 s na load", () => {
    expect(NA_LOAD_MS).toBe(1000);
  });

  test("zonder dsn: niets gepland, niets geladen", async () => {
    initAnalytics({ siteId: "test" });
    scheduleSentry({ dsn: "" });
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(0);
    expect(listeners.get("error")?.size ?? 0).toBe(0);
  });

  test("wacht op het load-event als de pagina nog laadt", async () => {
    (g.document as { readyState: string }).readyState = "loading";
    scheduleSentry(OPTS);
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(0);
    stuur("load", {});
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(1);
    await rust();
    expect(sentryAanroepen.filter((a) => a.fn === "init")).toHaveLength(1);
  });

  test("twee keer plannen start Sentry één keer", async () => {
    scheduleSentry(OPTS);
    scheduleSentry(OPTS);
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(1);
    await rust();
    expect(sentryAanroepen.filter((a) => a.fn === "init")).toHaveLength(1);
  });

  test("fouten van vóór het laden worden na init alsnog gemeld, en daarna niet meer gebufferd", async () => {
    scheduleSentry(OPTS);
    const fout = new Error("vroeg");
    stuur("error", { error: fout });
    stuur("error", { error: null, message: "Script error." }); // cross-origin: niets te melden
    stuur("unhandledrejection", { reason: "weg" });
    expect(sentryAanroepen).toHaveLength(0);
    await rust();
    expect(sentryAanroepen.map((a) => a.fn)).toEqual(["init", "captureException", "captureException"]);
    expect(sentryAanroepen[1]!.args).toEqual([fout, { mechanism: { type: "onerror", handled: false } }]);
    expect(sentryAanroepen[2]!.args).toEqual(["weg", { mechanism: { type: "onunhandledrejection", handled: false } }]);
    // Na init vangt Sentry's eigen handler alles; onze buffer luistert niet meer.
    expect(listeners.get("error")?.size ?? 0).toBe(0);
    expect(listeners.get("unhandledrejection")?.size ?? 0).toBe(0);
  });

  test("mislukt het starten (chunk of init), dan luistert de buffer ook niet meer", async () => {
    initGooit = true;
    scheduleSentry(OPTS);
    expect(listeners.get("error")?.size ?? 0).toBe(1);
    await rust();
    for (let i = 0; i < 20 && (listeners.get("error")?.size ?? 0) > 0; i++) await slaap(5);
    expect(listeners.get("error")?.size ?? 0).toBe(0);
    expect(listeners.get("unhandledrejection")?.size ?? 0).toBe(0);
  });

  test(`buffer is begrensd op ${MAX_VROEGE_FOUTEN} fouten`, async () => {
    scheduleSentry(OPTS);
    for (let i = 0; i < MAX_VROEGE_FOUTEN + 5; i++) stuur("error", { error: new Error(String(i)) });
    await rust();
    expect(sentryAanroepen.filter((a) => a.fn === "captureException")).toHaveLength(MAX_VROEGE_FOUTEN);
  });

  test("zonder requestIdleCallback (Safari): setTimeout", async () => {
    const ric = fakeWindow.requestIdleCallback;
    delete (fakeWindow as { requestIdleCallback?: unknown }).requestIdleCallback;
    try {
      scheduleSentry(OPTS);
      expect(sentryAanroepen).toHaveLength(0);
      await rust();
      expect(sentryAanroepen.filter((a) => a.fn === "init")).toHaveLength(1);
    } finally {
      fakeWindow.requestIdleCallback = ric;
    }
  });
});

// De winst bestaat alleen zolang @sentry/react niet statisch bereikbaar is vanaf initAnalytics:
// één statische import terug en de bundelaar zet Sentry weer in de kritieke chunk.
describe("kritieke route importeert @sentry/react niet statisch", () => {
  const src = resolve(import.meta.dir, "../src");
  function statischeImports(bestand: string): string[] {
    const code = readFileSync(bestand, "utf8");
    const uit: string[] = [];
    // `import … from "x"` en `export … from "x"`, niet `import("x")` en niet `import type`.
    for (const m of code.matchAll(/^\s*(import|export)\s+(?!type\b)[^;]*?\sfrom\s+["']([^"']+)["']/gms)) {
      uit.push(m[2]!);
    }
    for (const m of code.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) uit.push(m[1]!);
    return uit;
  }
  function bestandVoor(van: string, spec: string): string | undefined {
    if (!spec.startsWith(".")) return undefined;
    const basis = join(dirname(van), spec);
    for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
      try {
        readFileSync(basis + ext);
        return basis + ext;
      } catch {
        // volgende extensie
      }
    }
    return undefined;
  }
  function bereikbaar(start: string): Set<string> {
    const gezien = new Set<string>();
    const pakketten = new Set<string>();
    const stapel = [start];
    while (stapel.length) {
      const f = stapel.pop()!;
      if (gezien.has(f)) continue;
      gezien.add(f);
      for (const spec of statischeImports(f)) {
        const doel = bestandVoor(f, spec);
        if (doel) stapel.push(doel);
        else if (!spec.startsWith(".")) pakketten.add(spec);
      }
    }
    return pakketten;
  }

  test("src/init.ts", () => {
    const pakketten = bereikbaar(join(src, "init.ts"));
    expect(pakketten.has("vanilla-cookieconsent")).toBe(true); // de walker werkt
    expect([...pakketten].filter((p) => p.startsWith("@sentry/"))).toEqual([]);
  });

  test("lazy.ts laadt ./init dynamisch", () => {
    const code = readFileSync(join(src, "sentry/lazy.ts"), "utf8");
    expect(code).toContain('import("./init")');
    // Alleen `import type` uit ./init: verdwijnt bij het compileren.
    expect(statischeImports(join(src, "sentry/lazy.ts"))).toEqual([]);
  });
});
