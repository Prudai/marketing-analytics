/**
 * Het eigenlijke Sentry/GlitchTip-begin. Sinds v0.4.7 laadt `initAnalytics` deze module met een
 * dynamische `import()` (zie `./lazy`), zodat @sentry/react (~40 KB gz) in de bundel van een site
 * een eigen chunk wordt en de cookiebanner er niet meer op wacht. Importeer deze module dus niet
 * statisch vanuit code die op de kritieke route zit.
 */
export interface SentryInitOptions {
    dsn: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    /** Zie `InitAnalyticsConfig.sentry.noodroute`; `false` zet de noodroute (./beacon) uit. */
    noodroute?: boolean;
}
/** Een fout die vóór het laden van Sentry op de pagina viel (zie `./lazy`). */
export interface VroegeFout {
    fout: unknown;
    soort: "onerror" | "onunhandledrejection";
    /** Tijdstip van de fout (ms sinds epoch); alleen de noodroute (./beacon) gebruikt het. */
    tijd?: number;
}
export declare function initSentry({ dsn, environment, release, tracesSampleRate }: SentryInitOptions, vroegeFouten?: readonly VroegeFout[]): void;
/** @internal Alleen voor tests. Niet via de pakketroot. */
export declare function resetSentryForTests(): void;
//# sourceMappingURL=init.d.ts.map