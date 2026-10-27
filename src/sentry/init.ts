import * as Sentry from "@sentry/react";

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
}

/** Een fout die vóór het laden van Sentry op de pagina viel (zie `./lazy`). */
export interface VroegeFout {
  fout: unknown;
  soort: "onerror" | "onunhandledrejection";
}

let initialized = false;

export function initSentry(
  { dsn, environment, release, tracesSampleRate = 0 }: SentryInitOptions,
  vroegeFouten: readonly VroegeFout[] = []
): void {
  if (!dsn || initialized) return;
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
export function resetSentryForTests(): void {
  initialized = false;
}
