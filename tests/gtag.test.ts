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
