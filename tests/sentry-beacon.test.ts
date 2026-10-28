import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BEACON_VERSIE, MAX_KORT, MAX_URL, MAX_WAARDE, bouwEnvelope, envelopeEindpunt, schoneUrl, stuurFoutenMetBeacon } from "../src/sentry/beacon";

const g = globalThis as unknown as Record<string, unknown>;
const hadLocation = "location" in g;
const vorigeLocation = g.location;
g.location = { href: "https://trust.prudai.com/controls?bestand=geheim.xlsx#kolom=Tarief" };
const vorigeNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const echteFetch = globalThis.fetch;

const fetches: { url: string; init: RequestInit }[] = [];
const beacons: { url: string; body: Blob }[] = [];
const zetNavigator = (waarde: unknown) =>
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: waarde });

afterAll(() => {
  if (hadLocation) g.location = vorigeLocation;
  else delete g.location;
  if (vorigeNavigator) Object.defineProperty(globalThis, "navigator", vorigeNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
  globalThis.fetch = echteFetch;
});
beforeEach(() => {
  fetches.length = 0;
  beacons.length = 0;
  zetNavigator({ userAgent: "TestBrowser/1.0", sendBeacon: (url: string, body: Blob) => (beacons.push({ url, body }), true) });
  globalThis.fetch = ((url: string, init: RequestInit) => (fetches.push({ url, init }), Promise.resolve(new Response("{}")))) as typeof fetch;
});

const DSN = "https://abc123@errors.prudai.com/14";
const f = (n: number) => ({ fout: new Error(`e${n}`), soort: "onerror" as const });

describe("versie", () => {
  test("BEACON_VERSIE volgt package.json", () => {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dir, "../package.json"), "utf8")) as { version: string };
    expect(BEACON_VERSIE).toBe(pkg.version);
  });
});

describe("envelopeEindpunt", () => {
  test("gewone DSN", () => {
    expect(envelopeEindpunt(DSN)).toBe(
      "https://errors.prudai.com/api/14/envelope/?sentry_key=abc123&sentry_version=7&sentry_client=prudai.marketing-analytics.beacon%2F0.4.8"
    );
  });
  test("DSN met poort en pad-voorvoegsel", () => {
    expect(envelopeEindpunt("https://k@host.test:8443/sentry/7")).toContain("https://host.test:8443/sentry/api/7/envelope/?sentry_key=k");
  });
  test.each(["", "geen-url", "ftp://k@h/1", "https://host.test/1", "https://k@host.test/abc", "https://k@host.test/"])(
    "onbruikbaar: %p",
    (dsn) => expect(envelopeEindpunt(dsn)).toBeUndefined()
  );
});

describe("schoneUrl", () => {
  test("geen userinfo, geen query, geen hash", () => {
    expect(schoneUrl("https://u:p@host.test/a/12345?x=1#y")).toBe("https://host.test/a/12345");
  });
  test("de grenzen zijn 500 tekens (README)", () => {
    expect(MAX_URL).toBe(500);
    expect(MAX_WAARDE).toBe(500);
    expect(MAX_KORT).toBe(100);
  });
  test("zonder query en hash, afgekapt", () => {
    expect(schoneUrl("https://x.test/a/b?bestand=geheim.xlsx#kolom=1")).toBe("https://x.test/a/b");
    expect(schoneUrl(`https://x.test/${"p".repeat(2000)}`)).toHaveLength(MAX_URL);
    expect(schoneUrl("geen url")).toBeUndefined();
  });
});

describe("bouwEnvelope", () => {
  test("Error: drie regels JSON met type, bericht, mechanism, tag, schone URL en user-agent; geen stack", () => {
    const fout = new RangeError("buiten bereik");
    const [kop, item, event] = bouwEnvelope({ dsn: DSN, environment: "production", release: "abc" }, { fout, soort: "onerror", tijd: 1_700_000_000_000 }, 1_700_000_005_000)
      .split("\n")
      .map((r) => JSON.parse(r));
    expect(kop.event_id).toBe(event.event_id);
    expect(kop.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(kop.sent_at).toBe(new Date(1_700_000_005_000).toISOString());
    expect(item).toEqual({ type: "event" });
    expect(event).toMatchObject({
      platform: "javascript",
      level: "error",
      environment: "production",
      release: "abc",
      timestamp: 1_700_000_000,
      tags: { via: "noodroute" },
      request: { url: "https://trust.prudai.com/controls", headers: { "User-Agent": "TestBrowser/1.0" } },
      exception: { values: [{ type: "RangeError", value: "buiten bereik", mechanism: { type: "onerror", handled: false } }] },
    });
    expect(JSON.stringify(event)).not.toContain("geheim");
    expect(JSON.stringify(event)).not.toContain("Tarief");
    expect(event.extra).toBeUndefined(); // geen ruwe stack: die herhaalt het bericht
  });

  test("elke envelope heeft een eigen event_id", () => {
    const id = () => JSON.parse(bouwEnvelope({ dsn: DSN }, f(1)).split("\n")[0]!).event_id;
    expect(id()).not.toBe(id());
  });

  test("foutnaam, omgeving en release zijn afgekapt", () => {
    const fout = new Error("x");
    fout.name = "N".repeat(500);
    const [kop, , event] = bouwEnvelope({ dsn: DSN, environment: "e".repeat(500), release: "r".repeat(500) }, { fout, soort: "onerror" }).split("\n").map((r) => JSON.parse(r));
    expect(kop.sdk.name).toBe("prudai.marketing-analytics.beacon");
    expect(event.exception.values[0].type).toHaveLength(MAX_KORT);
    expect(event.environment).toHaveLength(MAX_KORT);
    expect(event.release).toHaveLength(MAX_KORT);
  });

  test("zonder tijd: de verzendtijd", () => {
    const [, , event] = bouwEnvelope({ dsn: DSN }, { fout: new Error("x"), soort: "onerror" }, 1_700_000_005_000).split("\n").map((r) => JSON.parse(r));
    expect(event.timestamp).toBe(1_700_000_005);
  });

  test("geen Error: afwijzing met een string of een object, afgekapt", () => {
    const e1 = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: "weg", soort: "onunhandledrejection" }).split("\n")[2]!);
    expect(e1.exception.values[0]).toEqual({
      type: "UnhandledRejection",
      value: "Non-Error promise rejection captured with value: weg",
      mechanism: { type: "onunhandledrejection", handled: false },
    });
    const e2 = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: { code: 7 }, soort: "onerror" }).split("\n")[2]!);
    expect(e2.exception.values[0].value).toBe('Non-Error exception captured with value: {"code":7}');
    const lang = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: new Error("x".repeat(5000)), soort: "onerror" }).split("\n")[2]!);
    expect(lang.exception.values[0].value).toHaveLength(MAX_WAARDE);
  });

  test("circulaire waarde breekt het bouwen niet", () => {
    const a: Record<string, unknown> = {};
    a.zelf = a;
    expect(() => bouwEnvelope({ dsn: DSN }, { fout: a, soort: "onerror" })).not.toThrow();
  });

  test("tien fouten van maximale grootte blijven onder de 64 KB keepalive-grens", () => {
    const grootste = bouwEnvelope(
      { dsn: DSN, environment: "e".repeat(50), release: "r".repeat(50) },
      { fout: new Error("x".repeat(10_000)), soort: "onerror" }
    );
    expect(grootste.length * 10).toBeLessThan(64 * 1024);
  });
});

describe("stuurFoutenMetBeacon", () => {
  test("fetch eerst: één verzoek per fout, keepalive, zonder cookies, text/plain", async () => {
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1), f(2)])).toBe(2);
    expect(fetches).toHaveLength(2);
    expect(beacons).toHaveLength(0); // sendBeacon stuurt cookies van .prudai.com mee naar het GlitchTip-subdomein
    expect(fetches[0]!.url).toContain("/api/14/envelope/");
    expect(fetches[0]!.init).toMatchObject({ method: "POST", keepalive: true, credentials: "omit", headers: { "content-type": "text/plain;charset=UTF-8" } });
    expect(String(fetches[1]!.init.body)).toContain('"value":"e2"');
  });
  test("niets bij lege lijst of onbruikbare DSN", () => {
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [])).toBe(0);
    expect(stuurFoutenMetBeacon({ dsn: "x" }, [f(1)])).toBe(0);
    expect(fetches).toHaveLength(0);
  });
  test("fetch gooit of wordt afgewezen: geen fout naar buiten", async () => {
    globalThis.fetch = (() => {
      throw new Error("boem");
    }) as unknown as typeof fetch;
    expect(() => stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).not.toThrow();
    globalThis.fetch = (() => Promise.reject(new Error("netwerk"))) as unknown as typeof fetch;
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).toBe(1);
    await new Promise((r) => setTimeout(r, 5)); // geen unhandled rejection
  });
  test("zonder fetch: niets, ook geen sendBeacon (dat stuurt de cookies van .prudai.com mee)", () => {
    (globalThis as { fetch?: unknown }).fetch = undefined;
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).toBe(0);
    expect(beacons).toHaveLength(0);
  });
});
