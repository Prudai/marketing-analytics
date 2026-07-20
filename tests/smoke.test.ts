import { describe, expect, test } from "bun:test";

import { initAnalytics } from "../src";

describe("initAnalytics", () => {
  test("no-ops outside the browser", () => {
    expect(() => initAnalytics({ siteId: "test" })).not.toThrow();
  });

  test("no-ops outside the browser with googleAds configured", () => {
    expect(() =>
      initAnalytics({
        siteId: "test",
        ga4: { measurementId: "G-TEST" },
        googleAds: { conversionId: "AW-TEST" },
      })
    ).not.toThrow();
  });
});
