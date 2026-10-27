import * as Sentry from "@sentry/react";
let initialized = false;
export function initSentry({ dsn, environment, release, tracesSampleRate = 0 }, vroegeFouten = []) {
    if (!dsn || initialized)
        return;
    initialized = true;
    Sentry.init({
        dsn,
        environment,
        release,
        sendDefaultPii: false,
        tracesSampleRate,
        integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
    });
    // Fouten van vóór het laden alsnog melden, als onafgehandeld (zoals Sentry's eigen
    // GlobalHandlers ze zou hebben gemeld). Event processors die een site eerder via de
    // `Sentry`-export registreerde, gelden ook hiervoor.
    for (const { fout, soort } of vroegeFouten) {
        Sentry.captureException(fout, { mechanism: { type: soort, handled: false } });
    }
}
/** @internal Alleen voor tests. Niet via de pakketroot. */
export function resetSentryForTests() {
    initialized = false;
}
//# sourceMappingURL=init.js.map