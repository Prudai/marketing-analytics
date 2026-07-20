import { afterAll, describe, expect, test } from "bun:test";

// Minimal DOM so initGtag runs its real logic outside a browser. Set up
// before the dynamic import — a static import would hoist above this.
(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { document: unknown }).document = {
  title: "test",
  head: { appendChild: () => {} },
  createElement: () => ({}),
};

type DataLayerEntry = unknown[];

function dataLayer(): DataLayerEntry[] {
  const dl = (globalThis as unknown as { dataLayer: IArguments[] }).dataLayer ?? [];
  return dl.map((e) => Array.from(e));
}

describe("initGtag + applyConsent", () => {
  test("configs both ids with denied Consent Mode defaults", async () => {
    const { initGtag } = await import("../src/ga4/init");
    initGtag({ measurementId: "G-TEST", adsConversionId: "AW-TEST" });

    const dl = dataLayer();
    const consentDefault = dl.find((e) => e[0] === "consent" && e[1] === "default")?.[2] as
      | Record<string, string>
      | undefined;
    expect(consentDefault).toBeDefined();
    expect(consentDefault!.ad_storage).toBe("denied");
    expect(consentDefault!.ad_user_data).toBe("denied");
    expect(consentDefault!.ad_personalization).toBe("denied");
    expect(consentDefault!.analytics_storage).toBe("denied");
    expect(dl.some((e) => e[0] === "config" && e[1] === "G-TEST")).toBe(true);
    expect(dl.some((e) => e[0] === "config" && e[1] === "AW-TEST")).toBe(true);
  });

  test("applyConsent maps marketing to ad_* and analytics to analytics_storage", async () => {
    const { applyConsent } = await import("../src/ga4/init");
    applyConsent({ analytics: false, marketing: true });

    const update = dataLayer()
      .filter((e) => e[0] === "consent" && e[1] === "update")
      .at(-1)?.[2] as Record<string, string> | undefined;
    expect(update).toBeDefined();
    expect(update!.ad_storage).toBe("granted");
    expect(update!.ad_user_data).toBe("granted");
    expect(update!.ad_personalization).toBe("granted");
    expect(update!.analytics_storage).toBe("denied");
  });
});

afterAll(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
  delete (globalThis as unknown as { dataLayer?: unknown }).dataLayer;
  delete (globalThis as unknown as { gtag?: unknown }).gtag;
});
