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
  cookie?: { domain?: string };
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

const { openCookieVoorkeuren, runConsent, resetConsentForTests, wisDomeinen, toestemmingsDomein } = await import(
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

describe("één toestemming voor alle Prudai-sites (v0.4.4)", () => {
  const vorigeLocation = g.location;
  const vorigeDocument = g.document;
  const schrijf: string[] = [];
  function opHost(hostname: string) {
    g.location = { hostname };
    schrijf.length = 0;
    g.document = {
      get cookie() {
        return "";
      },
      set cookie(v: string) {
        schrijf.push(v);
        if (v.startsWith("cc_cookie=;")) aanroepen.push("cc-weg");
      },
    };
    laatsteConfig = null;
  }
  afterAll(() => {
    if (vorigeLocation === undefined) delete g.location;
    else g.location = vorigeLocation;
    if (vorigeDocument === undefined) delete g.document;
    else g.document = vorigeDocument;
  });

  test("toestemmingsDomein: prudai.com op alle Prudai-hosts, anders de standaard", () => {
    expect(toestemmingsDomein("prudai.com")).toBe("prudai.com");
    expect(toestemmingsDomein("leo.prudai.com")).toBe("prudai.com");
    expect(toestemmingsDomein("LEGAL.prudai.com")).toBe("prudai.com");
    // afsluitende punt: Chromium laat .prudai.com daar niet zien of schrijven
    expect(toestemmingsDomein("leo.prudai.com.")).toBeUndefined();
    expect(toestemmingsDomein("prudai-website-x.vercel.app")).toBeUndefined();
    expect(toestemmingsDomein("notprudai.com")).toBeUndefined();
    expect(toestemmingsDomein("localhost")).toBeUndefined();
  });

  test("leo.prudai.com: cc_cookie op .prudai.com, revisie 3, Marketing ook zonder Ads-tag", async () => {
    opHost("leo.prudai.com");
    await runConsent({ marketing: false, onConsentChange: () => {} });
    expect(laatsteConfig!.cookie?.domain).toBe("prudai.com");
    expect(laatsteConfig!.revision).toBe(3);
    expect(Object.keys(laatsteConfig!.categories).sort()).toEqual(["analytics", "marketing", "necessary"]);
  });

  test("subdomein ruimt zijn oude eigen cc_cookie op, vóór run()", async () => {
    opHost("legal.prudai.com");
    await runConsent({ onConsentChange: () => {} });
    const weg = schrijf.filter((c) => c.startsWith("cc_cookie=;") && /expires=Thu, 01 Jan 1970/.test(c));
    expect(weg.some((c) => !/domain=/.test(c))).toBe(true); // host-only
    expect(weg.some((c) => /domain=legal\.prudai\.com/.test(c))).toBe(true);
    expect(weg.some((c) => /domain=\.?prudai\.com(;|$)/.test(c))).toBe(false); // gedeelde blijft
    // opruimen vóór run(): anders leest de bibliotheek eerst de oude cookie
    expect(aanroepen.lastIndexOf("cc-weg")).toBeLessThan(aanroepen.indexOf("run"));
    expect(aanroepen.indexOf("cc-weg")).toBeGreaterThanOrEqual(0);
  });

  test("prudai.com zelf: gedeelde cookie blijft staan, niets opgeruimd", async () => {
    opHost("prudai.com");
    await runConsent({ onConsentChange: () => {} });
    expect(schrijf.filter((c) => c.startsWith("cc_cookie="))).toEqual([]);
    expect(laatsteConfig!.cookie?.domain).toBe("prudai.com");
  });

  test("preview op vercel.app: standaardcookie, niets opgeruimd", async () => {
    opHost("prudai-website-x.vercel.app");
    await runConsent({ onConsentChange: () => {} });
    expect(laatsteConfig!.cookie).toBeUndefined();
    expect(schrijf.filter((c) => c.startsWith("cc_cookie="))).toEqual([]);
    expect(laatsteConfig!.revision).toBe(3);
  });
});

describe("bannerbereik (v0.4.5)", () => {
  const tekst = () => JSON.stringify((laatsteConfig as unknown as { language: unknown }).language);
  test("standaard ongewijzigd: de gedeelde keuze voor alle Prudai-websites", async () => {
    await runConsent({ policyHref: "https://legal.prudai.com/privacy", onConsentChange: () => {} });
    expect(tekst()).toContain("Je keuze geldt voor alle websites van Prudai (prudai.com en de sites daaronder, zoals leo.prudai.com); je kunt hem altijd wijzigen");
    expect(tekst()).toContain("Cookies op de websites van Prudai");
    expect(tekst()).toContain("Your choice applies to all Prudai websites (prudai.com and the sites under it, such as leo.prudai.com); you can change it");
  });
  test("bereik site: alleen deze website, geen prudai.com-claim", async () => {
    resetConsentForTests();
    await runConsent({ bereik: "site", onConsentChange: () => {} });
    expect(tekst()).toContain("Je keuze geldt voor deze website; je kunt hem altijd wijzigen");
    expect(tekst()).toContain("Cookies op deze website");
    expect(tekst()).toContain("Your choice applies to this website; you can change it");
    expect(tekst()).not.toContain("prudai.com");
    expect(tekst()).not.toContain("alle websites");
  });
});
