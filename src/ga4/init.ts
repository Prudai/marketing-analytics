declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export interface GtagInitOptions {
  measurementId?: string;
  adsConversionId?: string;
  debug?: boolean;
}

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

let loaded = false;
let measurementIdCache: string | null = null;

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    // Must push `arguments` (not a plain Array) — gtag.js's hydration
    // relies on the Arguments object identity when processing the queue.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

export function initGtag({ measurementId, adsConversionId, debug }: GtagInitOptions): void {
  if (typeof window === "undefined" || loaded) return;
  const loaderId = measurementId ?? adsConversionId;
  if (!loaderId) return;
  loaded = true;
  measurementIdCache = measurementId ?? null;

  ensureDataLayer();

  window.gtag!("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500,
  });

  window.gtag!("js", new Date());
  if (measurementId) {
    window.gtag!("config", measurementId, {
      anonymize_ip: true,
      debug_mode: debug === true ? true : undefined,
    });
  }
  if (adsConversionId) {
    window.gtag!("config", adsConversionId);
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`;
  document.head.appendChild(script);
}

export function applyConsent({ analytics, marketing }: ConsentState): void {
  if (!window.gtag) return;
  window.gtag("consent", "update", {
    ad_storage: marketing ? "granted" : "denied",
    ad_user_data: marketing ? "granted" : "denied",
    ad_personalization: marketing ? "granted" : "denied",
    analytics_storage: analytics ? "granted" : "denied",
  });
  if (analytics && measurementIdCache) {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_title: document.title,
      send_to: measurementIdCache,
    });
  }
}
