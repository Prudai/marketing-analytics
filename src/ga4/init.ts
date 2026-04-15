declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

import { CONSENT_EVENT, type ConsentState, readConsent } from "../consent/storage";

export interface Ga4InitOptions {
  measurementId: string;
  debug?: boolean;
}

let loaded = false;

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
  }
}

function applyConsentMode(state: ConsentState): void {
  if (!window.gtag) return;
  const analytics = state === "granted" ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: analytics,
  });
  if (state === "granted") {
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_title: document.title,
    });
  }
}

export function initGa4({ measurementId, debug }: Ga4InitOptions): void {
  if (typeof window === "undefined" || !measurementId || loaded) return;
  loaded = true;

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
  window.gtag!("config", measurementId, {
    anonymize_ip: true,
    debug_mode: debug === true ? true : undefined,
  });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  applyConsentMode(readConsent());
  window.addEventListener(CONSENT_EVENT, (event) => {
    const detail = (event as CustomEvent<ConsentState>).detail;
    applyConsentMode(detail);
  });
}
