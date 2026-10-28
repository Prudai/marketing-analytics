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
const docListeners = new Map<string, Set<Listener>>();
const fakeDocument = {
  readyState: "complete",
  referrer: "",
  visibilityState: "visible",
  addEventListener: (type: string, fn: Listener) => {
    if (!docListeners.has(type)) docListeners.set(type, new Set());
    docListeners.get(type)!.add(fn);
  },
  removeEventListener: (type: string, fn: Listener) => void docListeners.get(type)?.delete(fn),
};
function stuurDoc(type: string) {
  for (const fn of [...(docListeners.get(type) ?? [])]) fn({});
}
// Beacons die het pakket als noodroute verstuurt: `fetch` met keepalive en zonder cookies.
const beacons: { url: string; body: string; init: RequestInit }[] = [];
const echteFetch = globalThis.fetch;
globalThis.fetch = ((url: string | URL, init?: RequestInit) => (
  beacons.push({ url: String(url), body: String(init?.body), init: init ?? {} }), Promise.resolve(new Response("{}"))
)) as typeof fetch;
g.window = fakeWindow;
g.document = fakeDocument;

const {
  scheduleSentry,
  resetSentryScheduleForTests,
  zetInitLaderVoorTests,
  chunkUrlUitFout,
  MAX_VROEGE_FOUTEN,
  IDLE_TIMEOUT_MS,
  NA_LOAD_MS,
  OPNIEUW_NA_MS,
} = await import("../src/sentry/lazy");
const { resetSentryForTests } = await import("../src/sentry/init");
const { initAnalytics } = await import("../src/init");
const { resetGtagForTests } = await import("../src/ga4/init");

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

beforeEach(async () => {
  // Timers van de vorige test laten aflopen vóór we de stand wissen: ze zouden anders de lader
  // van deze test aanroepen en het aantal pogingen vertekenen.
  await slaap(WACHT_MS + 15);
  resetSentryScheduleForTests(WACHT_MS);
  resetSentryForTests();
  sentryAanroepen.length = 0;
  rustTaken.length = 0;
  rustOpties = [];
  initGooit = false;
  listeners.clear();
  docListeners.clear();
  beacons.length = 0;
  fakeDocument.readyState = "complete";
  fakeDocument.visibilityState = "visible";
});

afterAll(() => {
  if (hadWindow) g.window = vorigeWindow;
  else delete g.window;
  if (hadDocument) g.document = vorigeDocument;
  else delete g.document;
  globalThis.fetch = echteFetch;
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

  test("de wachttijd na load wordt echt toegepast: vóór het verstrijken is er nog geen rustmoment gepland", async () => {
    // Auditpunt 27-10: een hardgecodeerde wachttijd van 0 slaagde nog, omdat alleen de constante werd getoetst.
    resetSentryScheduleForTests(80);
    scheduleSentry(OPTS);
    await slaap(20);
    expect(rustTaken).toHaveLength(0);
    expect(sentryAanroepen).toHaveLength(0);
    await slaap(80);
    expect(rustTaken).toHaveLength(1);
  });

  test("zonder dsn: niets gepland, niets geladen", async () => {
    initAnalytics({ siteId: "test" });
    scheduleSentry({ dsn: "" });
    await slaap(WACHT_MS + 5);
    expect(rustTaken).toHaveLength(0);
    expect(listeners.get("error")?.size ?? 0).toBe(0);
  });

  test("wacht op het load-event als de pagina nog laadt", async () => {
    fakeDocument.readyState = "loading";
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

describe("hardening (v0.4.8)", () => {
  const leesBeacon = (i: number) => {
    const { url, body, init } = beacons[i]!;
    const [kop, itemkop, event] = body.split("\n");
    return { url, init, kop: JSON.parse(kop!), itemkop: JSON.parse(itemkop!), event: JSON.parse(event!) };
  };
  const CHUNK_FOUT = (url: string) => new TypeError(`Failed to fetch dynamically imported module: ${url}`);
  const metOrigin = async (fn: () => Promise<void>) => {
    g.location = { origin: "https://x.test", href: "https://x.test/pagina?bestand=geheim.xlsx#kolom=4" };
    try {
      await fn();
    } finally {
      delete g.location;
    }
  };

  test("Sentry wordt gepland vóór het GA4/consent-blok: een fout daarin slaat Sentry niet meer over", () => {
    // `window.location.href` gooit: initGtag valt dan om, zoals bij een kapotte omgeving.
    (fakeWindow as Record<string, unknown>).location = {
      pathname: "/",
      search: "",
      get href(): string {
        throw new Error("kapot");
      },
    };
    try {
      expect(() =>
        initAnalytics({ siteId: "t", ga4: { measurementId: "G-TEST" }, sentry: { dsn: OPTS.dsn } })
      ).toThrow("kapot");
      expect(listeners.get("error")?.size).toBe(1); // de buffer luistert al
    } finally {
      delete (fakeWindow as Record<string, unknown>).location;
      resetGtagForTests();
    }
  });

  test("pagehide vóór de start: de buffer gaat weg zonder cookies en komt na init niet nog eens", async () => {
    scheduleSentry(OPTS);
    stuur("error", { error: new TypeError("weg bij vertrek") });
    stuur("unhandledrejection", { reason: "afgewezen" });
    stuur("pagehide", {});
    expect(beacons).toHaveLength(2);
    const eerste = leesBeacon(0);
    expect(eerste.url).toBe("https://errors.example.test/api/1/envelope/?sentry_key=key&sentry_version=7&sentry_client=prudai.marketing-analytics.beacon%2F0.4.8");
    // Geen cookies (de DSN-host zit op hetzelfde registreerbare domein), overleeft het sluiten van de pagina, geen preflight.
    expect(eerste.init).toMatchObject({ method: "POST", keepalive: true, credentials: "omit", headers: { "content-type": "text/plain;charset=UTF-8" } });
    expect(eerste.itemkop).toEqual({ type: "event" });
    expect(eerste.event.exception.values[0]).toMatchObject({ type: "TypeError", value: "weg bij vertrek", mechanism: { type: "onerror", handled: false } });
    expect(eerste.event.tags).toEqual({ via: "pagehide-beacon" });
    expect(eerste.event.environment).toBe("test");
    expect(eerste.event.release).toBe("r1");
    expect(leesBeacon(1).event.exception.values[0].mechanism.type).toBe("onunhandledrejection");
    // Pagina overleeft (bfcache): Sentry start later en meldt de al verstuurde fouten niet nog eens.
    await rust();
    expect(sentryAanroepen.filter((a) => a.fn === "captureException")).toHaveLength(0);
    expect(beacons).toHaveLength(2);
  });

  test("een beacon draagt het tijdstip van de fout (ook bij een afwijzing), niet van het vertrek", async () => {
    scheduleSentry(OPTS);
    const voor = Date.now();
    stuur("error", { error: new Error("eerder") });
    stuur("unhandledrejection", { reason: new Error("ook eerder") });
    await slaap(60);
    stuur("pagehide", {});
    for (const i of [0, 1]) {
      const { event } = leesBeacon(i);
      expect(event.timestamp * 1000).toBeGreaterThanOrEqual(voor - 1);
      expect(event.timestamp * 1000).toBeLessThan(Date.now() - 40);
    }
  });

  test("de URL in een beacon heeft geen query en geen hash", async () => {
    await metOrigin(async () => {
      scheduleSentry(OPTS);
      stuur("error", { error: new Error("x") });
      stuur("pagehide", {});
    });
    expect(leesBeacon(0).event.request.url).toBe("https://x.test/pagina");
  });

  test("tabblad verborgen vóór de start: zelfde noodroute; zichtbaar of lege buffer: niets", async () => {
    scheduleSentry(OPTS);
    stuurDoc("visibilitychange"); // nog zichtbaar
    stuur("pagehide", {}); // lege buffer
    expect(beacons).toHaveLength(0);
    stuur("error", { error: new Error("achtergrond") });
    stuurDoc("visibilitychange");
    expect(beacons).toHaveLength(0);
    fakeDocument.visibilityState = "hidden";
    stuurDoc("visibilitychange");
    expect(beacons).toHaveLength(1);
    stuurDoc("visibilitychange"); // tweede keer: buffer is leeg
    expect(beacons).toHaveLength(1);
  });

  test("na de start gaat er geen beacon meer weg: Sentry's eigen handlers nemen het over", async () => {
    scheduleSentry(OPTS);
    await rust();
    expect(listeners.get("pagehide")?.size ?? 0).toBe(0);
    expect(docListeners.get("visibilitychange")?.size ?? 0).toBe(0);
    stuur("error", { error: new Error("laat") });
    stuur("pagehide", {});
    fakeDocument.visibilityState = "hidden";
    stuurDoc("visibilitychange");
    expect(beacons).toHaveLength(0);
  });

  test("noodroute: false (site met event processors): nooit een beacon, ook niet na een mislukte chunk", async () => {
    resetSentryScheduleForTests(WACHT_MS, 10);
    zetInitLaderVoorTests(() => Promise.reject(new Error("geen URL")));
    scheduleSentry({ ...OPTS, noodroute: false });
    stuur("error", { error: new Error("a") });
    stuur("pagehide", {});
    fakeDocument.visibilityState = "hidden";
    stuurDoc("visibilitychange");
    await rust();
    await slaap(40);
    expect(beacons).toHaveLength(0);
  });

  test("initAnalytics geeft sentry.noodroute door aan de planner", async () => {
    initAnalytics({ siteId: "t", sentry: { dsn: OPTS.dsn, noodroute: false } });
    stuur("error", { error: new Error("a") });
    stuur("pagehide", {});
    expect(beacons).toHaveLength(0);
  });

  test("onbruikbare dsn: geen beacon en geen fout", () => {
    scheduleSentry({ dsn: "geen-dsn" });
    stuur("error", { error: new Error("x") });
    expect(() => stuur("pagehide", {})).not.toThrow();
    expect(beacons).toHaveLength(0);
  });

  test("init zelf faalt: de gebufferde fouten gaan alsnog als beacon weg", async () => {
    initGooit = true;
    scheduleSentry(OPTS);
    stuur("error", { error: new Error("niet kwijt") });
    await rust();
    await slaap(30);
    expect(beacons).toHaveLength(1);
    expect(leesBeacon(0).event.exception.values[0].value).toBe("niet kwijt");
    expect(listeners.get("error")?.size ?? 0).toBe(0);
  });

  test("foutmelding met chunk-URL: de tweede poging gaat naar dezelfde chunk met ?r=, niet naar de gecachete import", async () => {
    resetSentryScheduleForTests(WACHT_MS, 60);
    const geladen: string[] = [];
    let gewoon = 0;
    await metOrigin(async () => {
      zetInitLaderVoorTests(
        () => (gewoon++, Promise.reject(CHUNK_FOUT("https://x.test/assets/init-abc.js"))),
        (url) => (geladen.push(url), import("../src/sentry/init"))
      );
      scheduleSentry(OPTS);
      stuur("error", { error: new Error("tijdens het wachten") });
      await slaap(WACHT_MS + 5);
      while (rustTaken.length) rustTaken.shift()!(); // het rustmoment: eerste poging faalt
      await slaap(20);
      expect(geladen).toHaveLength(0); // de pauze voor de nieuwe poging is nog niet om
      await slaap(120);
    });
    expect(gewoon).toBe(1);
    expect(geladen).toHaveLength(1);
    expect(geladen[0]).toMatch(/^https:\/\/x\.test\/assets\/init-abc\.js\?r=\d+$/);
    expect(sentryAanroepen.map((a) => a.fn)).toEqual(["init", "captureException"]);
    expect(beacons).toHaveLength(0);
  });

  test("chunk-URL die al een query heeft krijgt &r=", async () => {
    resetSentryScheduleForTests(WACHT_MS, 10);
    const geladen: string[] = [];
    await metOrigin(async () => {
      zetInitLaderVoorTests(
        () => Promise.reject(CHUNK_FOUT("https://x.test/assets/init-abc.js?v=2")),
        (url) => (geladen.push(url), import("../src/sentry/init"))
      );
      scheduleSentry(OPTS);
      await rust();
      await slaap(40);
    });
    expect(geladen[0]).toMatch(/^https:\/\/x\.test\/assets\/init-abc\.js\?v=2&r=\d+$/);
  });

  test("zonder chunk-URL in de foutmelding (Safari) of van een andere origin: geen tweede poging, meteen de noodroute", async () => {
    for (const fout of [new TypeError("Importing a module script failed."), CHUNK_FOUT("https://cdn.elders.test/init-abc.js")]) {
      beacons.length = 0;
      await slaap(WACHT_MS + 15);
      resetSentryScheduleForTests(WACHT_MS, 10);
      let gewoon = 0;
      const geladen: string[] = [];
      await metOrigin(async () => {
        zetInitLaderVoorTests(
          () => (gewoon++, Promise.reject(fout)),
          (url) => (geladen.push(url), import("../src/sentry/init"))
        );
        scheduleSentry(OPTS);
        stuur("error", { error: new Error("verloren zonder noodroute") });
        await rust();
        await slaap(40);
      });
      expect(gewoon).toBe(1);
      expect(geladen).toHaveLength(0);
      expect(sentryAanroepen).toHaveLength(0);
      expect(beacons).toHaveLength(1);
      expect(listeners.get("error")?.size ?? 0).toBe(0);
    }
  });

  test("mislukt ook de poging met ?r=: precies twee verzoeken, daarna de beacon en stopt de buffer", async () => {
    resetSentryScheduleForTests(WACHT_MS, 10);
    let gewoon = 0;
    const geladen: string[] = [];
    await metOrigin(async () => {
      zetInitLaderVoorTests(
        () => (gewoon++, Promise.reject(CHUNK_FOUT("https://x.test/assets/init-abc.js"))),
        (url) => (geladen.push(url), Promise.reject(CHUNK_FOUT(url)))
      );
      scheduleSentry(OPTS);
      stuur("error", { error: new Error("verloren zonder noodroute") });
      await rust();
      await slaap(60);
    });
    expect(gewoon + geladen.length).toBe(2);
    expect(sentryAanroepen).toHaveLength(0);
    expect(beacons).toHaveLength(1);
    expect(leesBeacon(0).event.exception.values[0].value).toBe("verloren zonder noodroute");
    expect(listeners.get("error")?.size ?? 0).toBe(0);
    expect(listeners.get("pagehide")?.size ?? 0).toBe(0);
  });

  test("chunkUrlUitFout: Chromium, Firefox, Safari, query, andere origin, grens na .js", () => {
    const o = "https://x.test";
    expect(chunkUrlUitFout(new TypeError("Failed to fetch dynamically imported module: https://x.test/assets/init-a.js"), o)).toBe("https://x.test/assets/init-a.js");
    expect(chunkUrlUitFout(new Error("error loading dynamically imported module: https://x.test/a/init-b.js?v=2"), o)).toBe("https://x.test/a/init-b.js?v=2");
    expect(chunkUrlUitFout(new TypeError("Importing a module script failed."), o)).toBeUndefined();
    expect(chunkUrlUitFout(new Error("Failed to fetch dynamically imported module: https://elders.test/init.js"), o)).toBeUndefined();
    expect(chunkUrlUitFout(new Error("kapot: https://x.test/pagina"), o)).toBeUndefined();
    expect(chunkUrlUitFout(new Error("kapot: https://x.test/data.json"), o)).toBeUndefined();
    expect(chunkUrlUitFout(new Error("kapot: https://x.test/chart.js-vendor-abc.css"), o)).toBeUndefined();
    expect(chunkUrlUitFout("https://x.test/init.js", undefined)).toBeUndefined();
    expect(chunkUrlUitFout(undefined, o)).toBeUndefined();
    // een enorm bericht blijft snel
    const t = Date.now();
    chunkUrlUitFout(new Error("https://x.test/a".repeat(20_000)), o); // veel begin-posities, geen .js: kwadratisch zonder lengtegrens
    expect(Date.now() - t).toBeLessThan(200);
  });

  test("lukt de import meteen, dan geen tweede poging", async () => {
    resetSentryScheduleForTests(WACHT_MS, 10);
    let pogingen = 0;
    zetInitLaderVoorTests(() => (pogingen++, import("../src/sentry/init")));
    scheduleSentry(OPTS);
    await rust();
    await slaap(30);
    expect(pogingen).toBe(1);
  });

  test("de pauze voor de nieuwe poging is standaard 2 s", () => {
    expect(OPNIEUW_NA_MS).toBe(2000);
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
    // ./init (met @sentry/react) mag nooit statisch; ./beacon is de noodroute zonder SDK en wel statisch.
    // (`import type` uit ./init verdwijnt bij het compileren.)
    expect(statischeImports(join(src, "sentry/lazy.ts"))).toEqual(["./beacon"]);
    expect(statischeImports(join(src, "sentry/beacon.ts"))).toEqual([]);
  });
});
