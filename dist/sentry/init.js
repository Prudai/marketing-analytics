import * as Sentry from "@sentry/react";
let initialized = false;
export function initSentry({ dsn, environment, release, tracesSampleRate = 0, }) {
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
}
export { Sentry };
//# sourceMappingURL=init.js.map