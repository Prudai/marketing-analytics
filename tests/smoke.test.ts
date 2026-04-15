import { describe, expect, test } from "bun:test";

import { initAnalytics } from "../src";

describe("initAnalytics", () => {
  test("no-ops outside the browser", () => {
    expect(() => initAnalytics({ siteId: "test" })).not.toThrow();
  });
});
