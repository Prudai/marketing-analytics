import { runConsent } from "./consent/run";
import { applyConsent, initGtag } from "./ga4/init";
import { legHerkomstVast } from "./herkomst";
import { scheduleSentry } from "./sentry/lazy";
export function initAnalytics(config) {
    if (typeof window === "undefined")
        return;
    // Sentry lui (v0.4.7): @sentry/react is een eigen chunk die pas laadt als de pagina geladen is en
    // de browser rust heeft, zodat de cookiebanner er niet op wacht. Fouten van vóór dat moment
    // worden gebufferd en daarna alsnog gemeld (v0.4.8: bij vertrek via een beacon). Hier als eerste gepland,
    // vóór herkomst en het GA4/consent-blok: plannen kost niets (een paar listeners en een timer), en een
    // fout daarin mag Sentry niet meer overslaan. Zie ./sentry/lazy.
    if (config.sentry?.dsn) {
        scheduleSentry({
            dsn: config.sentry.dsn,
            environment: config.environment,
            release: config.release,
            tracesSampleRate: config.sentry.tracesSampleRate,
            noodroute: config.sentry.noodroute,
        });
    }
    // Vóór de analytics-tags: waar kwam dit bezoek vandaan (landingspagina, verwijzer, utm,
    // gclid)? Zonder toestemming te vragen, want het is onze eigen URL.
    legHerkomstVast();
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
            bereik: config.consent?.bereik,
            onConsentChange: applyConsent,
        });
    }
}
//# sourceMappingURL=init.js.map