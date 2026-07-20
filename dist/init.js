import { runConsent } from "./consent/run";
import { applyConsent, initGtag } from "./ga4/init";
import { initSentry } from "./sentry/init";
export function initAnalytics(config) {
    if (typeof window === "undefined")
        return;
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
        initGtag({
            measurementId,
            adsConversionId,
            debug: config.ga4?.debug,
        });
        void runConsent({
            policyHref: config.consent?.policyHref,
            marketing: Boolean(adsConversionId),
            onConsentChange: applyConsent,
        });
    }
}
//# sourceMappingURL=init.js.map