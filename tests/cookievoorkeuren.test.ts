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

// De v0.4.4-tekst letterlijk: de standaard moet hier byte voor byte aan gelijk blijven, zodat de
// sites op .prudai.com niets merken van de optie `bereik` (v0.4.5).
const V044 = {
  nl: {
    title: "Cookies op de websites van Prudai",
    description:
      "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze websites gebruiken en, als je dat toestaat, cookies om te meten of onze advertenties (Google Ads) tot een aanvraag leiden. Je keuze geldt voor alle websites van Prudai (prudai.com en de sites daaronder, zoals leo.prudai.com); je kunt hem altijd wijzigen via 'Cookievoorkeuren' onderaan de pagina. Essentiële functies werken altijd zonder cookies.",
  },
  en: {
    title: "Cookies on Prudai websites",
    description:
      "We use analytics cookies to understand how visitors use our websites and, if you allow it, cookies to measure whether our ads (Google Ads) lead to a request. Your choice applies to all Prudai websites (prudai.com and the sites under it, such as leo.prudai.com); you can change it at any time via 'Cookie preferences' at the bottom of the page. Essential features always work without cookies.",
  },
};
const SITE = {
  nl: {
    title: "Cookies op deze website",
    description:
      "We gebruiken analytische cookies om te begrijpen hoe bezoekers deze website gebruiken en, als je dat toestaat, cookies om te meten of onze advertenties (Google Ads) tot een aanvraag leiden. Je keuze geldt voor deze website; je kunt hem altijd wijzigen via 'Cookievoorkeuren' onderaan de pagina. Essentiële functies werken altijd zonder cookies.",
  },
  en: {
    title: "Cookies on this website",
    description:
      "We use analytics cookies to understand how visitors use this website and, if you allow it, cookies to measure whether our ads (Google Ads) lead to a request. Your choice applies to this website; you can change it at any time via 'Cookie preferences' at the bottom of the page. Essential features always work without cookies.",
  },
};
type Vertalingen = Record<"nl" | "en", { consentModal: { title: string; description: string } }>;
const modals = () => {
  const t = (laatsteConfig as unknown as { language: { translations: Vertalingen } }).language.translations;
  return {
    nl: { title: t.nl.consentModal.title, description: t.nl.consentModal.description },
    en: { title: t.en.consentModal.title, description: t.en.consentModal.description },
  };
};

describe("bannerbereik (v0.4.5)", () => {
  test("standaard en 'prudai': titel en tekst in NL én EN exact die van v0.4.4", async () => {
    await runConsent({ policyHref: "https://legal.prudai.com/privacy", onConsentChange: () => {} });
    expect(modals()).toEqual(V044);
    resetConsentForTests();
    await runConsent({ bereik: "prudai", onConsentChange: () => {} });
    expect(modals()).toEqual(V044);
  });
  test("'site': eigen tekst in NL en EN, geen prudai.com en geen meervoud", async () => {
    await runConsent({ bereik: "site", onConsentChange: () => {} });
    expect(modals()).toEqual(SITE);
    expect(JSON.stringify(modals())).not.toMatch(/prudai\.com|onze websites|our websites|alle websites/);
  });
  test("initAnalytics geeft consent.bereik door aan de banner (de route die sites gebruiken)", async () => {
    // initGtag leest window.location; in Bun is er geen, dus een nagebootste host buiten prudai.com.
    const hadLocation = "location" in g;
    const vorigeLocation = g.location;
    g.location = { href: "https://ai-geletterdheid-training.nl/", hostname: "ai-geletterdheid-training.nl", pathname: "/", search: "" };
    try {
    laatsteConfig = null;
    pakketroot.initAnalytics({ siteId: "test", googleAds: { conversionId: "AW-0000000000" }, consent: { bereik: "site" } });
    for (let i = 0; i < 20 && !laatsteConfig; i++) await new Promise((r) => setTimeout(r, 5));
    expect(modals()).toEqual(SITE);
    resetConsentForTests();
    laatsteConfig = null;
    pakketroot.initAnalytics({ siteId: "test", googleAds: { conversionId: "AW-0000000000" } });
    for (let i = 0; i < 20 && !laatsteConfig; i++) await new Promise((r) => setTimeout(r, 5));
    expect(modals()).toEqual(V044);
    } finally {
      if (hadLocation) g.location = vorigeLocation;
      else delete g.location;
    }
  });
});
