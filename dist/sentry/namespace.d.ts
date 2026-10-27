import * as Sentry from "@sentry/react";
/**
 * De `Sentry`-export van de pakketroot (ongewijzigd sinds v0.1), los van de init-module zodat die
 * lui kan laden. Een site die `Sentry` importeert (bv. `Sentry.addEventProcessor` direct na
 * `initAnalytics`) houdt @sentry/react daarmee in haar eigen hoofdbundel; een site die hem niet
 * gebruikt, krijgt hem door tree-shaking alleen nog in de luie chunk. Wat vóór het luie begin via
 * deze export wordt geregistreerd (event processors, tags, user) zit op de globale scopes en geldt
 * na `Sentry.init` gewoon; `captureException` vóór dat moment gaat verloren, zoals vóór een init.
 */
export { Sentry };
//# sourceMappingURL=namespace.d.ts.map