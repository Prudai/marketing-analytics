import type { InitAnalyticsConfig } from "./config";
import { runConsent } from "./consent/run";
import { applyConsent, initGtag } from "./ga4/init";
import { legHerkomstVast } from "./herkomst";
import { initSentry } from "./sentry/init";

export function initAnalytics(config: InitAnalyticsConfig): void {
  if (typeof window === "undefined") return;

  // Vóór alles: waar kwam dit bezoek vandaan (landingspagina, verwijzer, utm,
  // gclid)? Zonder toestemming te vragen, want het is onze eigen URL.
  legHerkomstVast();

  if (config.sentry?.dsn) {
    initSentry({
      dsn: config.sentry.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.sentry.tracesSampleRate,
    });
  }

  const measurementId = config.ga4?.measurementId;
  const adsConversionId = config.googleAds?.conversionId;
  if (measurementId || adsConversionId) {
    // Consent Mode basic: initGtag onthoudt alleen de id's. gtag.js laadt pas
    // in applyConsent, na akkoord in de banner (of direct bij een opgeslagen
    // akkoord van een terugkerende bezoeker).
    initGtag({
      measurementId,
      adsConversionId,
      debug: config.ga4?.debug,
    });

    void runConsent({
      policyHref: config.consent?.policyHref,
      onConsentChange: applyConsent,
    });
  }
}
