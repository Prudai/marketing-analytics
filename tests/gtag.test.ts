import { afterAll, beforeEach, describe, expect, test } from "bun:test";

// Minimal DOM so the real gtag logic runs outside a browser. Set up before the
// dynamic imports — a static import would hoist above this.
type FakeScript = { tagName: string; async?: boolean; src?: string };
const head: FakeScript[] = [];
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.document = {
  title: "test",
  head: { appendChild: (el: FakeScript) => head.push(el) },
  createElement: (tagName: string) => ({ tagName }),
};
g.location = { href: "https://example.test/contact" };

const { initGtag, applyConsent, resetGtagForTests } = await import("../src/ga4/init");
const { trackEvent } = await import("../src/ga4/events");

type Entry = unknown[];

function dataLayer(): Entry[] {
  const dl = (g.dataLayer as IArguments[] | undefined) ?? [];
  return dl.map((e) => Array.from(e));
}

function googleScripts(): FakeScript[] {
  return head.filter((el) => el.tagName === "script" && /googletagmanager\.com/.test(el.src ?? ""));
}

function configs(id: string): Entry[] {
  return dataLayer().filter((e) => e[0] === "config" && e[1] === id);
}

function lastUpdate(): Record<string, string> | undefined {
  return dataLayer()
    .filter((e) => e[0] === "consent" && e[1] === "update")
    .at(-1)?.[2] as Record<string, string> | undefined;
}

function events(name: string): Entry[] {
  return dataLayer().filter((e) => e[0] === "event" && e[1] === name);
}

/** Een verse paginalading: geen tag, geen dataLayer, geen uitschakelvlaggen. */
function freshPage(): void {
  resetGtagForTests();
  head.length = 0;
  for (const key of Object.keys(g)) {
    if (key.startsWith("ga-disable-")) delete g[key];
  }
  delete g.dataLayer;
  delete g.gtag;
  g.location = { href: "https://example.test/contact" };
}

/** Een gtag die niet van dit pakket is (site-snippet of test-spion). */
function foreignGtag(): unknown[][] {
  const calls: unknown[][] = [];
  g.gtag = (...args: unknown[]) => void calls.push(args);
  return calls;
}

const IDS = { measurementId: "G-TEST", adsConversionId: "AW-TEST" };

beforeEach(freshPage);

describe("Consent Mode basic — vóór akkoord", () => {
  test("initGtag laadt geen gtag.js en queuet niets", () => {
    initGtag(IDS);
    expect(googleScripts()).toHaveLength(0);
    expect(g.gtag).toBeUndefined();
    expect(dataLayer()).toHaveLength(0);
    expect(configs("G-TEST")).toHaveLength(0);
  });

  test("alleen noodzakelijk: nog steeds geen tag, geen config", () => {
    initGtag(IDS);
    applyConsent({ analytics: false, marketing: false });
    expect(googleScripts()).toHaveLength(0);
    expect(g.gtag).toBeUndefined();
    expect(dataLayer()).toHaveLength(0);
  });

  test("events zonder akkoord gaan nergens heen", () => {
    initGtag(IDS);
    trackEvent("ads_conversion_Aanmelding_1");
    expect(g.gtag).toBeUndefined();
    expect(dataLayer()).toHaveLength(0);
  });

  test("zonder akkoord ook niet via een gtag die al op de pagina stond", () => {
    initGtag(IDS);
    const calls = foreignGtag();
    trackEvent("ads_conversion_Aanmelding_1");
    trackEvent("cta_click", { send_to: "G-TEST" });
    expect(calls).toHaveLength(0);
  });
});

describe("pakket beheert de tag niet (geen initAnalytics met tag-id)", () => {
  test("event gaat ongewijzigd naar de gtag van de site, zoals vóór v0.4.0", () => {
    const calls = foreignGtag();
    trackEvent("cta_click", { label: "probeer-gratis", location: "hero" });
    expect(calls).toEqual([["event", "cta_click", { label: "probeer-gratis", location: "hero" }]]);
  });
});

describe("Consent Mode basic — na akkoord", () => {
  test("alles accepteren: defaults denied, dan update granted, dan config en één script", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: true });

    const dl = dataLayer();
    const iDefault = dl.findIndex((e) => e[0] === "consent" && e[1] === "default");
    const iUpdate = dl.findIndex((e) => e[0] === "consent" && e[1] === "update");
    const iConfig = dl.findIndex((e) => e[0] === "config");
    expect(iDefault).toBe(0);
    expect(iUpdate).toBeGreaterThan(iDefault);
    expect(iConfig).toBeGreaterThan(iUpdate);

    const defaults = dl[iDefault][2] as Record<string, string>;
    expect(defaults.ad_storage).toBe("denied");
    expect(defaults.ad_user_data).toBe("denied");
    expect(defaults.ad_personalization).toBe("denied");
    expect(defaults.analytics_storage).toBe("denied");

    const update = lastUpdate()!;
    expect(update.analytics_storage).toBe("granted");
    expect(update.ad_storage).toBe("granted");
    expect(update.ad_user_data).toBe("granted");
    expect(update.ad_personalization).toBe("granted");

    expect(configs("G-TEST")).toHaveLength(1);
    expect("send_page_view" in (configs("G-TEST")[0][2] as object)).toBe(false);
    expect(configs("AW-TEST")).toHaveLength(1);
    expect(googleScripts()).toHaveLength(1);
    expect(googleScripts()[0].src).toContain("id=G-TEST");
    expect(googleScripts()[0].async).toBe(true);
    // config stuurt zelf de page_view; geen dubbele handmatige.
    expect(events("page_view")).toHaveLength(0);
  });

  test("akkoord halverwege de sessie: tag start pas dan", () => {
    initGtag(IDS);
    applyConsent({ analytics: false, marketing: false });
    trackEvent("cta_click");
    expect(googleScripts()).toHaveLength(0);

    applyConsent({ analytics: true, marketing: false });
    expect(googleScripts()).toHaveLength(1);
    expect(configs("G-TEST")).toHaveLength(1);
    // Het event van vóór het akkoord is niet bewaard en ook niet nagestuurd.
    expect(events("cta_click")).toHaveLength(0);
  });

  test("alleen analytics: geen Ads-config en conversie-event niet naar Ads", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: false });

    expect(configs("AW-TEST")).toHaveLength(0);
    const update = lastUpdate()!;
    expect(update.analytics_storage).toBe("granted");
    expect(update.ad_storage).toBe("denied");

    trackEvent("ads_conversion_Aanmelding_1");
    const sent = events("ads_conversion_Aanmelding_1");
    expect(sent).toHaveLength(1);
    expect((sent[0][2] as Record<string, unknown>).send_to).toEqual(["G-TEST"]);
  });

  test("alleen marketing: Ads-tag laadt, GA4 niet", () => {
    initGtag(IDS);
    applyConsent({ analytics: false, marketing: true });

    expect(configs("AW-TEST")).toHaveLength(1);
    expect(configs("G-TEST")).toHaveLength(0);
    expect(googleScripts()).toHaveLength(1);
    expect(googleScripts()[0].src).toContain("id=AW-TEST");
  });

  test("voorkeuren wijzigen terwijl analytics aan blijft: geen extra page_view", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: false });
    applyConsent({ analytics: true, marketing: true });
    applyConsent({ analytics: true, marketing: false });
    applyConsent({ analytics: true, marketing: true });
    expect(events("page_view")).toHaveLength(0);
    expect(configs("G-TEST")).toHaveLength(1);
  });

  test("expliciete send_to naar een toegestane tag gaat ongewijzigd door", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: true });
    trackEvent("conversion", { send_to: "AW-TEST/abcLabel", value: 1 });
    expect(events("conversion")).toEqual([
      ["event", "conversion", { send_to: "AW-TEST/abcLabel", value: 1 }],
    ]);
  });

  test("marketing later erbij: Ads-config één keer, geen tweede script", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: false });
    applyConsent({ analytics: true, marketing: true });

    expect(configs("AW-TEST")).toHaveLength(1);
    expect(configs("G-TEST")).toHaveLength(1);
    expect(googleScripts()).toHaveLength(1);
    expect(dataLayer().filter((e) => e[0] === "consent" && e[1] === "default")).toHaveLength(1);

    trackEvent("ads_conversion_Aanmelding_1");
    const sent = events("ads_conversion_Aanmelding_1");
    expect((sent[0][2] as Record<string, unknown>).send_to).toEqual(["G-TEST", "AW-TEST"]);
  });

  test("terugkerende bezoeker (opgeslagen akkoord bij het starten): tag direct", () => {
    initGtag(IDS);
    // vanilla-cookieconsent roept onConsent bij elke paginalading met een
    // geldig opgeslagen akkoord, dus meteen bij het starten.
    applyConsent({ analytics: true, marketing: true });
    expect(googleScripts()).toHaveLength(1);
    expect(configs("G-TEST")).toHaveLength(1);
  });

  test("site zonder Google Ads: marketing-akkoord laadt niets extra", () => {
    initGtag({ measurementId: "G-TEST" });
    applyConsent({ analytics: false, marketing: true });
    expect(googleScripts()).toHaveLength(0);
    expect(g.gtag).toBeUndefined();
  });
});

describe("akkoord na doorklikken binnen de SPA", () => {
  const LANDING =
    "https://example.test/?gclid=abc123&gbraid=gb1&utm_source=google&utm_medium=cpc&x=1";

  test("GA4 krijgt gclid/utm van de landingspagina terug in de eerste page_view", () => {
    g.location = { href: LANDING };
    initGtag(IDS);
    g.location = { href: "https://example.test/contact?y=2" };
    applyConsent({ analytics: true, marketing: true });

    const cfg = configs("G-TEST")[0][2] as Record<string, unknown>;
    expect(cfg.send_page_view).toBe(false);
    const pv = events("page_view");
    expect(pv).toHaveLength(1);
    const params = pv[0][2] as Record<string, string>;
    expect(params.send_to).toBe("G-TEST");
    const loc = new URL(params.page_location);
    expect(loc.pathname).toBe("/contact");
    expect(loc.searchParams.get("y")).toBe("2");
    expect(loc.searchParams.get("gclid")).toBe("abc123");
    expect(loc.searchParams.get("gbraid")).toBe("gb1");
    expect(loc.searchParams.get("utm_source")).toBe("google");
    expect(loc.searchParams.get("utm_medium")).toBe("cpc");
    expect(loc.searchParams.has("x")).toBe(false);
    // Ads-config blijft kaal: page_location zet de gclid-cookie niet.
    expect(configs("AW-TEST")[0][2]).toBeUndefined();
  });

  test("akkoord op de landingspagina zelf: gewone config, geen handmatige page_view", () => {
    g.location = { href: LANDING };
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: false });
    // Geen sleutel send_page_view, ook niet met undefined: gtag leest dat als "uit".
    expect("send_page_view" in (configs("G-TEST")[0][2] as object)).toBe(false);
    expect(events("page_view")).toHaveLength(0);
  });

  test("landing zonder campagne: niets toegevoegd", () => {
    g.location = { href: "https://example.test/?x=1" };
    initGtag(IDS);
    g.location = { href: "https://example.test/contact" };
    applyConsent({ analytics: true, marketing: false });
    // Geen sleutel send_page_view, ook niet met undefined: gtag leest dat als "uit".
    expect("send_page_view" in (configs("G-TEST")[0][2] as object)).toBe(false);
    expect(events("page_view")).toHaveLength(0);
  });
});

describe("Consent Mode basic — intrekken", () => {
  test("intrekken: update denied, uitschakelvlaggen aan, geen events meer", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: true });
    const before = dataLayer().length;

    applyConsent({ analytics: false, marketing: false });
    const update = lastUpdate()!;
    expect(update.analytics_storage).toBe("denied");
    expect(update.ad_storage).toBe("denied");
    expect(update.ad_user_data).toBe("denied");
    expect(update.ad_personalization).toBe("denied");
    expect(g["ga-disable-G-TEST"]).toBe(true);
    expect(g["ga-disable-AW-TEST"]).toBe(true);

    trackEvent("ads_conversion_Aanmelding_1");
    trackEvent("cta_click", { send_to: "G-TEST" });
    // Alleen de consent-update kwam erbij.
    expect(dataLayer().length).toBe(before + 1);
    expect(googleScripts()).toHaveLength(1);
  });

  test("alleen marketing intrekken: Ads uit, GA4 blijft", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: true });
    applyConsent({ analytics: true, marketing: false });

    expect(g["ga-disable-G-TEST"]).toBe(false);
    expect(g["ga-disable-AW-TEST"]).toBe(true);
    trackEvent("ads_conversion_Aanmelding_1");
    const sent = events("ads_conversion_Aanmelding_1");
    expect((sent[0][2] as Record<string, unknown>).send_to).toEqual(["G-TEST"]);
    trackEvent("x", { send_to: "AW-TEST/label" });
    expect(events("x")).toHaveLength(0);
  });

  test("opnieuw toestaan op dezelfde pagina: vlag uit en één page_view, geen tweede config", () => {
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: false });
    applyConsent({ analytics: false, marketing: false });
    applyConsent({ analytics: true, marketing: false });

    expect(g["ga-disable-G-TEST"]).toBe(false);
    expect(configs("G-TEST")).toHaveLength(1);
    expect(events("page_view")).toHaveLength(1);
  });
});

afterAll(() => {
  freshPage();
  delete g.window;
  delete g.document;
  delete g.location;
});

describe("intrekken ruimt de advertentieklik in localStorage op (v0.4.4)", () => {
  // Stub met de Storage-API die het pakket gebruikt (length/key/removeItem).
  function fakeStorage(init: Record<string, string>) {
    const data = new Map(Object.entries(init));
    return {
      get length() {
        return data.size;
      },
      key: (i: number) => [...data.keys()][i] ?? null,
      removeItem: (k: string) => void data.delete(k),
      keys: () => [...data.keys()].sort(),
    };
  }
  const vorige = g.localStorage;
  afterAll(() => {
    if (vorige === undefined) delete g.localStorage;
    else g.localStorage = vorige;
  });

  test("site mét Ads: marketing ingetrokken → _gcl-sleutels weg, rest blijft", () => {
    const ls = fakeStorage({ _gcl_ls: "klik", _gcl_dc: "x", cc_cookie: "keuze", ander: "blijft" });
    g.localStorage = ls;
    initGtag(IDS);
    applyConsent({ analytics: true, marketing: true });
    expect(ls.keys()).toContain("_gcl_ls");
    applyConsent({ analytics: true, marketing: false });
    expect(ls.keys()).toEqual(["ander", "cc_cookie"]);
  });

  test("site zonder Ads-tag (zoals /vera op prudai.com): laat de klik van de hoofdsite staan", () => {
    const ls = fakeStorage({ _gcl_ls: "klik van prudai.com" });
    g.localStorage = ls;
    initGtag({ measurementId: "G-TEST" });
    applyConsent({ analytics: true, marketing: false });
    expect(ls.keys()).toEqual(["_gcl_ls"]);
  });

  test("marketing toegestaan: klik blijft staan", () => {
    const ls = fakeStorage({ _gcl_ls: "klik" });
    g.localStorage = ls;
    initGtag(IDS);
    applyConsent({ analytics: false, marketing: true });
    expect(ls.keys()).toEqual(["_gcl_ls"]);
  });

  test("geblokkeerde localStorage: geen fout", () => {
    Object.defineProperty(g, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    initGtag(IDS);
    expect(() => applyConsent({ analytics: false, marketing: false })).not.toThrow();
    Object.defineProperty(g, "localStorage", { configurable: true, writable: true, value: undefined });
  });
});
