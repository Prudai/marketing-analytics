import type { SentryInitOptions } from "./init";
/**
 * Sentry/GlitchTip lui laden (v0.4.7). Tot v0.4.6 importeerde `initAnalytics` @sentry/react
 * statisch en startte het vóór de cookiebanner: de banner zat daardoor in dezelfde kritieke
 * bundel als ~40 KB gz Sentry, en op mobiel was de bannertekst (`#cm__desc`) het LCP-element.
 *
 * Nu: `import("./init")` (een eigen chunk in de bundel van de site) pas `NA_LOAD_MS` na het
 * `load`-event én als de browser even niets te doen heeft (`requestIdleCallback`, uiterlijk na
 * `IDLE_TIMEOUT_MS`; zonder `requestIdleCallback` een `setTimeout`). De wachttijd na `load` is er
 * omdat de banner pas ~100 ms na `CookieConsent.run()` met een CSS-overgang inschuift: direct na
 * `load` viel het ophalen van de chunk nog vóór de LCP (gemeten met Lighthouse op
 * product-page-zia, 27-10-2026: chunk op 216 ms, LCP op 274 ms), en dan rekent Lighthouse hem in
 * de LCP mee. Fouten die in de tussentijd vallen, vangt een kleine buffer op; die worden na
 * `Sentry.init` alsnog gemeld (maximaal `MAX_VROEGE_FOUTEN`).
 */
export declare const NA_LOAD_MS = 1000;
export declare const IDLE_TIMEOUT_MS = 3000;
export declare const MAX_VROEGE_FOUTEN = 10;
export declare function scheduleSentry(options: SentryInitOptions): void;
/** @internal Alleen voor tests. Niet via de pakketroot. */
export declare function resetSentryScheduleForTests(wachtNaLoadMs?: number): void;
//# sourceMappingURL=lazy.d.ts.map