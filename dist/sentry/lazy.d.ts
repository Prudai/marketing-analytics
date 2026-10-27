import type { SentryInitOptions } from "./init";
/**
 * Sentry/GlitchTip lui laden (v0.4.7). Tot v0.4.6 importeerde `initAnalytics` @sentry/react
 * statisch en startte het vóór de cookiebanner: de banner zat daardoor in dezelfde kritieke
 * bundel als ~40 KB gz Sentry, en op mobiel was de bannertekst (`#cm__desc`) het LCP-element.
 *
 * Nu: `import("./init")` (een eigen chunk in de bundel van de site) pas als de pagina geladen is
 * én de browser even niets te doen heeft (`requestIdleCallback`, uiterlijk na `IDLE_TIMEOUT_MS`;
 * zonder `requestIdleCallback` een `setTimeout`). Fouten die in de tussentijd vallen, vangt een
 * kleine buffer op; die worden na `Sentry.init` alsnog gemeld (maximaal `MAX_VROEGE_FOUTEN`).
 */
export declare const IDLE_TIMEOUT_MS = 3000;
export declare const MAX_VROEGE_FOUTEN = 10;
export declare function scheduleSentry(options: SentryInitOptions): void;
/** @internal Alleen voor tests. Niet via de pakketroot. */
export declare function resetSentryScheduleForTests(): void;
//# sourceMappingURL=lazy.d.ts.map