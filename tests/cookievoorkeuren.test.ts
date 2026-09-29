import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test";

// vanilla-cookieconsent wordt nagebootst: het echte venster vraagt een DOM, en
// hier gaat het om de koppeling footerlink → showPreferences(). Het echte
// venster is in een browser gemeten op de previews (29-09-2026).
const aanroepen: string[] = [];
let showPreferencesGooit = false;
mock.module("vanilla-cookieconsent", () => ({
  run: async () => {
    aanroepen.push("run");
  },
  showPreferences: () => {
    aanroepen.push("showPreferences");
    // Zo reageert de echte bibliotheek als run() vroeg stopte (bot/webdriver):
    // er is geen venster, en hij valt over een ontbrekend element.
    if (showPreferencesGooit) throw new TypeError("Cannot read properties of undefined");
  },
  acceptedCategory: () => false,
}));

const g = globalThis as unknown as Record<string, unknown>;
const hadWindow = "window" in g;
const vorigeWindow = g.window;

const { openCookieVoorkeuren, runConsent, resetConsentForTests } = await import(
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

  test("gooit niet als de bibliotheek geen venster heeft (bot, webdriver)", async () => {
    await runConsent({ onConsentChange: () => {} });
    showPreferencesGooit = true;
    expect(() => openCookieVoorkeuren()).not.toThrow();
    expect(openCookieVoorkeuren()).toBe(false);
  });

  test("doet niets buiten de browser", async () => {
    await runConsent({ onConsentChange: () => {} });
    delete g.window;
    expect(openCookieVoorkeuren()).toBe(false);
    expect(aanroepen).toEqual(["run"]);
  });
});
