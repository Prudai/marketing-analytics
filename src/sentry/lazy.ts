import type { SentryInitOptions, VroegeFout } from "./init";

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
export const IDLE_TIMEOUT_MS = 3000;
export const MAX_VROEGE_FOUTEN = 10;

let gepland = false;

type Win = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
};

/** Roep `fn` aan na het `load`-event, op een rustig moment. */
function naLadenEnRust(win: Win, fn: () => void): void {
  const opRust = () => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
    else setTimeout(fn, 1);
  };
  const doc = typeof document === "undefined" ? undefined : document;
  if (doc?.readyState === "complete" || typeof win.addEventListener !== "function") opRust();
  else win.addEventListener("load", opRust, { once: true });
}

export function scheduleSentry(options: SentryInitOptions): void {
  if (typeof window === "undefined" || !options.dsn || gepland) return;
  gepland = true;
  const win = window as Win;

  const vroeg: VroegeFout[] = [];
  const opFout = (e: ErrorEvent) => {
    // Zonder error-object (cross-origin "Script error.") valt er niets te melden.
    if (e.error != null && vroeg.length < MAX_VROEGE_FOUTEN) vroeg.push({ fout: e.error, soort: "onerror" });
  };
  const opAfwijzing = (e: PromiseRejectionEvent) => {
    if (vroeg.length < MAX_VROEGE_FOUTEN) vroeg.push({ fout: e.reason, soort: "onunhandledrejection" });
  };
  const luistert = typeof win.addEventListener === "function";
  if (luistert) {
    win.addEventListener("error", opFout);
    win.addEventListener("unhandledrejection", opAfwijzing);
  }
  const stopBuffer = () => {
    if (!luistert) return;
    win.removeEventListener("error", opFout);
    win.removeEventListener("unhandledrejection", opAfwijzing);
  };

  naLadenEnRust(win, () => {
    import("./init")
      .then(({ initSentry }) => {
        // In één taak: Sentry's eigen handlers staan na init, dus er valt geen fout tussen.
        initSentry(options, vroeg.splice(0));
        stopBuffer();
      })
      // Chunk niet te laden (offline, adblocker): geen foutmelding, de site werkt gewoon door.
      .catch(stopBuffer);
  });
}

/** @internal Alleen voor tests. Niet via de pakketroot. */
export function resetSentryScheduleForTests(): void {
  gepland = false;
}
