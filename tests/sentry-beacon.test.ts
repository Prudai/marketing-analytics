import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import { bouwEnvelope, envelopeEindpunt, stuurFoutenMetBeacon } from "../src/sentry/beacon";

const g = globalThis as unknown as Record<string, unknown>;
const hadLocation = "location" in g;
const vorigeLocation = g.location;
g.location = { href: "https://trust.prudai.com/controls?x=1" };
const vorigeNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const verstuurd: { url: string; body: Blob }[] = [];
let beaconAccepteert = true;
const zetNavigator = (waarde: unknown) =>
  Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: waarde });
afterAll(() => {
  if (hadLocation) g.location = vorigeLocation;
  else delete g.location;
  if (vorigeNavigator) Object.defineProperty(globalThis, "navigator", vorigeNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
});
beforeEach(() => {
  verstuurd.length = 0;
  beaconAccepteert = true;
  zetNavigator({ sendBeacon: (url: string, body: Blob) => (verstuurd.push({ url, body }), beaconAccepteert) });
});

const DSN = "https://abc123@errors.prudai.com/14";

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

describe("bouwEnvelope", () => {
  test("Error: drie regels JSON met type, bericht, mechanism, tag, URL en ruwe stack", () => {
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
      tags: { via: "pagehide-beacon" },
      request: { url: "https://trust.prudai.com/controls?x=1" },
      exception: { values: [{ type: "RangeError", value: "buiten bereik", mechanism: { type: "onerror", handled: false } }] },
    });
    expect(typeof event.extra.raw_stack).toBe("string");
  });

  test("geen Error: afwijzing met een string of een object, afgekapt", () => {
    const e1 = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: "weg", soort: "onunhandledrejection" }).split("\n")[2]!);
    expect(e1.exception.values[0]).toEqual({
      type: "UnhandledRejection",
      value: 'Non-Error promise rejection captured with value: weg',
      mechanism: { type: "onunhandledrejection", handled: false },
    });
    const e2 = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: { code: 7 }, soort: "onerror" }).split("\n")[2]!);
    expect(e2.exception.values[0].value).toBe('Non-Error exception captured with value: {"code":7}');
    const lang = JSON.parse(bouwEnvelope({ dsn: DSN }, { fout: new Error("x".repeat(5000)), soort: "onerror" }).split("\n")[2]!);
    expect(lang.exception.values[0].value).toHaveLength(1000);
  });

  test("circulaire waarde breekt het bouwen niet", () => {
    const a: Record<string, unknown> = {};
    a.zelf = a;
    expect(() => bouwEnvelope({ dsn: DSN }, { fout: a, soort: "onerror" })).not.toThrow();
  });
});

describe("stuurFoutenMetBeacon", () => {
  const f = (n: number) => ({ fout: new Error(`e${n}`), soort: "onerror" as const });
  test("één beacon per fout, text/plain", async () => {
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1), f(2)])).toBe(2);
    expect(verstuurd).toHaveLength(2);
    expect(verstuurd[0]!.url).toContain("/api/14/envelope/");
    expect(verstuurd[0]!.body.type).toBe("text/plain;charset=utf-8");
    expect(await verstuurd[1]!.body.text()).toContain('"value":"e2"');
  });
  test("niets bij lege lijst of onbruikbare DSN", () => {
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [])).toBe(0);
    expect(stuurFoutenMetBeacon({ dsn: "x" }, [f(1)])).toBe(0);
    expect(verstuurd).toHaveLength(0);
  });
  test("sendBeacon weigert (wachtrij vol): niet meegeteld, geen fout", () => {
    beaconAccepteert = false;
    expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).toBe(0);
  });
  test("sendBeacon gooit: geen fout naar buiten", () => {
    zetNavigator({ sendBeacon: () => { throw new Error("boem"); } });
    expect(() => stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).not.toThrow();
  });
  test("zonder sendBeacon: fetch met keepalive", async () => {
    zetNavigator({});
    const echt = globalThis.fetch;
    const aanroepen: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = ((url: string, init: RequestInit) => (aanroepen.push({ url, init }), Promise.resolve(new Response("{}")))) as typeof fetch;
    try {
      expect(stuurFoutenMetBeacon({ dsn: DSN }, [f(1)])).toBe(1);
    } finally {
      globalThis.fetch = echt;
    }
    expect(aanroepen).toHaveLength(1);
    expect(aanroepen[0]!.init).toMatchObject({ method: "POST", keepalive: true, credentials: "omit" });
  });
});
