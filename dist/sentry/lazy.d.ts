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
 *
 * v0.4.8: (1) verlaat de bezoeker de pagina (`pagehide`, of het tabblad wordt verborgen) vóór de
 * start, dan gaat de buffer als noodroute met `sendBeacon` weg (./beacon); (2) een mislukte
 * `import()` wordt één keer opnieuw geprobeerd (met een extra queryparameter op dezelfde chunk, omdat
 * elke engine een mislukte import voor dezelfde URL onthoudt; zonder URL in de foutmelding, Safari,
 * geen tweede poging), en lukt het dan nog niet, dan gaat de buffer ook via die noodroute; (3) `initAnalytics` plant dit vóór het GA4/consent-blok, zodat een
 * fout daar Sentry niet meer overslaat.
 */
export declare const NA_LOAD_MS = 1000;
export declare const IDLE_TIMEOUT_MS = 3000;
export declare const MAX_VROEGE_FOUTEN = 10;
/** Pauze voor de ene nieuwe poging om de chunk te laden. */
export declare const OPNIEUW_NA_MS = 2000;
/**
 * Een mislukte `import()` blijft voor die URL mislukt zolang de pagina leeft: Chromium, Firefox en
 * WebKit onthouden de fout in hun module map, een tweede `import("./init")` doet geen verzoek meer
 * (gemeten 28-10-2026: Chromium 145/147, Firefox 142, WebKit 26.4). Dus de tweede poging gaat naar
 * dezelfde chunk met een extra queryparameter. De URL staat in de foutmelding van Chromium en
 * Firefox; WebKit noemt hem niet ("Importing a module script failed."). Zonder URL is er dus geen
 * werkende tweede poging (Safari): dan meteen door naar de noodroute. Alleen een URL op de eigen
 * origin krijgt de parameter.
 */
export declare function chunkUrlUitFout(fout: unknown, origin?: string | undefined): string | undefined;
export declare function scheduleSentry(options: SentryInitOptions): void;
/** @internal Alleen voor tests. Niet via de pakketroot. */
export declare function resetSentryScheduleForTests(wachtNaLoadMs?: number, opnieuwMs?: number): void;
/** @internal Alleen voor tests: vervangt het laden van ./init (nabootsen van een mislukte import). */
export declare function zetInitLaderVoorTests(lader: () => Promise<typeof import("./init")>, perUrl?: (url: string) => Promise<typeof import("./init")>): void;
//# sourceMappingURL=lazy.d.ts.map