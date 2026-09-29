import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

// vanilla-cookieconsent wordt nagebootst: het echte venster vraagt een DOM, en
// hier gaat het om de koppeling footerlink → showPreferences() en om de vorm van
// de cookielijsten die we aan run() geven. Het echte venster is in een browser
// gemeten op de previews; het echte wissen op het bovenliggende domein in
// Chromium met de echte bibliotheek op een nagebootst leo.prudai.com (29-09-2026).
const aanroepen: string[] = [];
type WisCookie = { name: RegExp; domain?: string };
let laatsteConfig: {
  revision?: number;
  categories: Record<string, { services?: Record<string, { cookies?: WisCookie[] }> }>;
} | null = null;
let showPreferencesGooit = false;
mock.module("vanilla-cookieconsent", () => ({
  run: async (config: unknown) => {
    aanroepen.push("run");
    laatsteConfig = config as typeof laatsteConfig;
  },
  showPreferences: () => {
    aanroepen.push("showPreferences");
    // Zo reageert de echte bibliotheek als run() vroeg stopte (bot): er is geen
    // venster, ze valt over een ontbrekend element, en omdat ze haar "open"-vlag
    // al gezet had doet elke volgende aanroep stil niets (gemeten in jsdom).
    if (showPreferencesGooit) {
      showPreferencesGooit = false;
      throw new TypeError("Cannot read properties of undefined");
    }
  },
  acceptedCategory: () => false,
}));

const g = globalThis as unknown as Record<string, unknown>;
const hadWindow = "window" in g;
const vorigeWindow = g.window;

const { openCookieVoorkeuren, runConsent, resetConsentForTests, wisDomeinen } = await import(
  "../src/consent/run"
);
const pakketroot = await import("../src");

afterAll(() => {
  if (hadWindow) g.window = vorigeWindow;
  else delete g.window;
  mock.restore();
});

beforeEach(() => {
  resetConsentForTests();
  aanroepen.length = 0;
  showPreferencesGooit = false;
  g.window = globalThis;
});

describe("openCookieVoorkeuren", () => {
  test("is via de pakketroot te importeren", () => {
    expect(pakketroot.openCookieVoorkeuren).toBe(openCookieVoorkeuren);
  });

  test("doet niets zolang de banner niet gestart is", () => {
    expect(openCookieVoorkeuren()).toBe(false);
    expect(aanroepen).toEqual([]);
  });

  test("opent het voorkeurenvenster zodra de banner draait", async () => {
    await runConsent({ onConsentChange: () => {} });
    expect(openCookieVoorkeuren()).toBe(true);
    expect(aanroepen).toEqual(["run", "showPreferences"]);
  });

  test("kan vaker open (tweede klik op de footerlink)", async () => {
    await runConsent({ onConsentChange: () => {} });
    openCookieVoorkeuren();
    openCookieVoorkeuren();
    expect(aanroepen.filter((a) => a === "showPreferences")).toHaveLength(2);
  });

  test("gooit niet als de bibliotheek geen venster heeft (bot), en blijft daarna false", async () => {
    await runConsent({ onConsentChange: () => {} });
    showPreferencesGooit = true;
    let eerste: boolean | undefined;
    expect(() => {
      eerste = openCookieVoorkeuren();
    }).not.toThrow();
    expect(eerste).toBe(false);
    // De bibliotheek gooit maar één keer; daarna zou ze stil niets doen.
    expect(openCookieVoorkeuren()).toBe(false);
    expect(aanroepen.filter((a) => a === "showPreferences")).toHaveLength(1);
  });

  test("doet niets buiten de browser", async () => {
    await runConsent({ onConsentChange: () => {} });
    delete g.window;
    expect(openCookieVoorkeuren()).toBe(false);
    expect(aanroepen).toEqual(["run"]);
  });
});

describe("cookies wissen bij intrekken", () => {
  const vorigeLocation = g.location;
  afterAll(() => {
    if (vorigeLocation === undefined) delete g.location;
    else g.location = vorigeLocation;
  });

  test("wisDomeinen: host plus elk bovenliggend domein", () => {
    expect(wisDomeinen("leo.prudai.com")).toEqual(["leo.prudai.com", "prudai.com"]);
    expect(wisDomeinen("prudai.com")).toEqual(["prudai.com"]);
    expect(wisDomeinen("product-page-x.vercel.app")).toEqual(["product-page-x.vercel.app", "vercel.app"]);
    expect(wisDomeinen("localhost")).toEqual([]);
    expect(wisDomeinen("127.0.0.1")).toEqual([]);
    expect(wisDomeinen("")).toEqual([]);
  });

  test("op een subdomein wist de banner _ga en _gcl ook op het hoofddomein", async () => {
    // gtag zet de cookies op .prudai.com; zonder domain wiste de bibliotheek
    // alleen op leo.prudai.com (productie, 29-09-2026).
    g.location = { hostname: "leo.prudai.com" };
    laatsteConfig = null;
    await runConsent({ marketing: true, onConsentChange: () => {} });
    const cats = laatsteConfig!.categories;
    const ga = cats.analytics.services!.ga4.cookies!;
    const gcl = cats.marketing.services!.googleAds.cookies!;
    for (const [lijst, naam] of [[ga, "/^_ga/"], [gcl, "/^_gcl/"]] as const) {
      expect(lijst.every((c) => String(c.name) === naam)).toBe(true);
      expect(lijst.map((c) => c.domain)).toEqual([undefined, "leo.prudai.com", "prudai.com"]);
    }
  });
});

describe("toestemmingsrevisie (v0.4.4)", () => {
  test("gelijk op sites met en zonder marketing (gedeelde cc_cookie op prudai.com)", async () => {
    await runConsent({ marketing: true, onConsentChange: () => {} });
    const met = laatsteConfig!.revision;
    resetConsentForTests();
    await runConsent({ onConsentChange: () => {} });
    const zonder = laatsteConfig!.revision;
    expect(met).toBe(2);
    expect(zonder).toBe(2);
  });
});
