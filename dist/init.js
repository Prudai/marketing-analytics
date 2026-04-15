import { CONSENT_EVENT } from "./consent/storage";
import { trackConsentChoice } from "./ga4/events";
import { initGa4 } from "./ga4/init";
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
    if (config.ga4?.measurementId) {
        initGa4({
            measurementId: config.ga4.measurementId,
            debug: config.ga4.debug,
        });
    }
    window.addEventListener(CONSENT_EVENT, (event) => {
        const detail = event.detail;
        if (detail === "granted" || detail === "denied") {
            trackConsentChoice(detail);
        }
    });
}
//# sourceMappingURL=init.js.map