import { stuurFoutenMetBeacon } from "./beacon";
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
export const NA_LOAD_MS = 1000;
export const IDLE_TIMEOUT_MS = 3000;
export const MAX_VROEGE_FOUTEN = 10;
/** Pauze voor de ene nieuwe poging om de chunk te laden. */
export const OPNIEUW_NA_MS = 2000;
let gepland = false;
let naLoadMs = NA_LOAD_MS;
let opnieuwNaMs = OPNIEUW_NA_MS;
/** Hoe de chunk geladen wordt; een eigen variabele zodat tests een mislukte `import()` kunnen nabootsen. */
let laadInit = () => import("./init");
/** Importeert een volledige URL; een eigen variabele zodat tests dit kunnen nabootsen. */
let importUrl = (url) => import(/* @vite-ignore */ url);
/**
 * Een mislukte `import()` blijft voor die URL mislukt zolang de pagina leeft: Chromium, Firefox en
 * WebKit onthouden de fout in hun module map, een tweede `import("./init")` doet geen verzoek meer
 * (gemeten 28-10-2026: Chromium 145/147, Firefox 142, WebKit 26.4). Dus de tweede poging gaat naar
 * dezelfde chunk met een extra queryparameter. De URL staat in de foutmelding van Chromium en
 * Firefox; WebKit noemt hem niet ("Importing a module script failed."). Zonder URL is er dus geen
 * werkende tweede poging (Safari): dan meteen door naar de noodroute. Alleen een URL op de eigen
 * origin krijgt de parameter.
 */
export function chunkUrlUitFout(fout, origin = typeof location === "undefined" ? undefined : location.origin) {
    const bericht = (fout instanceof Error ? fout.message : typeof fout === "string" ? fout : "").slice(0, 2000);
    const m = bericht.match(/https?:\/\/[^\s"')]+?\.m?js(?=$|[\s"')?])(?:\?[^\s"')]*)?/);
    if (!m || !origin)
        return undefined;
    try {
        return new URL(m[0]).origin === origin ? m[0] : undefined;
    }
    catch {
        return undefined;
    }
}
/** Eén `import()`, bij een fout met een chunk-URL na `opnieuwNaMs` één poging met `?r=`; anders de fout door. */
function laadInitMetEenKeerOpnieuw() {
    return laadInit().catch((fout) => {
        const url = chunkUrlUitFout(fout);
        if (!url)
            throw fout;
        return new Promise((klaar) => setTimeout(klaar, opnieuwNaMs)).then(() => importUrl(`${url}${url.includes("?") ? "&" : "?"}r=${Date.now()}`));
    });
}
/** Roep `fn` aan `naLoadMs` na het `load`-event, op een rustig moment. */
function naLadenEnRust(win, fn) {
    const opRust = () => {
        if (typeof win.requestIdleCallback === "function")
            win.requestIdleCallback(fn, { timeout: IDLE_TIMEOUT_MS });
        else
            setTimeout(fn, 1);
    };
    const naLoad = () => setTimeout(opRust, naLoadMs);
    const doc = typeof document === "undefined" ? undefined : document;
    if (doc?.readyState === "complete" || typeof win.addEventListener !== "function")
        naLoad();
    else
        win.addEventListener("load", naLoad, { once: true });
}
export function scheduleSentry(options) {
    if (typeof window === "undefined" || !options.dsn || gepland)
        return;
    gepland = true;
    const win = window;
    const doc = typeof document === "undefined" ? undefined : document;
    const vroeg = [];
    const opFout = (e) => {
        // Zonder error-object (cross-origin "Script error.") valt er niets te melden.
        if (e.error != null && vroeg.length < MAX_VROEGE_FOUTEN)
            vroeg.push({ fout: e.error, soort: "onerror", tijd: Date.now() });
    };
    const opAfwijzing = (e) => {
        if (vroeg.length < MAX_VROEGE_FOUTEN)
            vroeg.push({ fout: e.reason, soort: "onunhandledrejection", tijd: Date.now() });
    };
    // Noodroute: wat nu in de buffer staat gaat per beacon weg en wordt níét meer na init gemeld
    // (anders kwam het dubbel binnen als de pagina uit de bfcache terugkomt).
    const spoelNaarBeacon = (fouten = vroeg.splice(0)) => {
        // `noodroute: false`: de site heeft event processors die schonen en die draaien niet op deze route.
        if (options.noodroute === false || fouten.length === 0)
            return;
        stuurFoutenMetBeacon(options, fouten);
    };
    const opPagehide = () => spoelNaarBeacon();
    const opVerborgen = () => {
        if (doc?.visibilityState === "hidden")
            spoelNaarBeacon();
    };
    const luistert = typeof win.addEventListener === "function";
    const luistertDoc = typeof doc?.addEventListener === "function";
    if (luistert) {
        win.addEventListener("error", opFout);
        win.addEventListener("unhandledrejection", opAfwijzing);
        win.addEventListener("pagehide", opPagehide);
    }
    if (luistertDoc)
        doc.addEventListener("visibilitychange", opVerborgen);
    const stopBuffer = () => {
        if (luistert) {
            win.removeEventListener("error", opFout);
            win.removeEventListener("unhandledrejection", opAfwijzing);
            win.removeEventListener("pagehide", opPagehide);
        }
        if (luistertDoc)
            doc.removeEventListener("visibilitychange", opVerborgen);
    };
    naLadenEnRust(win, () => {
        laadInitMetEenKeerOpnieuw()
            .then(({ initSentry }) => {
            // In één taak: Sentry's eigen handlers staan na init, dus er valt geen fout tussen.
            const fouten = vroeg.splice(0);
            try {
                initSentry(options, fouten);
            }
            catch {
                // Init zelf faalde: dan zijn de gebufferde fouten nog niet gemeld, ga naar de noodroute.
                spoelNaarBeacon(fouten);
            }
            stopBuffer();
        })
            // Chunk ook na een nieuwe poging niet te laden (offline, adblocker, verlopen hash): de site
            // werkt gewoon door, de gebufferde fouten gaan als noodroute weg, daarna stopt de buffer.
            .catch(() => {
            spoelNaarBeacon();
            stopBuffer();
        });
    });
}
/** @internal Alleen voor tests. Niet via de pakketroot. */
export function resetSentryScheduleForTests(wachtNaLoadMs = NA_LOAD_MS, opnieuwMs = OPNIEUW_NA_MS) {
    gepland = false;
    naLoadMs = wachtNaLoadMs;
    opnieuwNaMs = opnieuwMs;
    laadInit = () => import("./init");
    importUrl = (url) => import(/* @vite-ignore */ url);
}
/** @internal Alleen voor tests: vervangt het laden van ./init (nabootsen van een mislukte import). */
export function zetInitLaderVoorTests(lader, perUrl) {
    laadInit = lader;
    if (perUrl)
        importUrl = perUrl;
}
//# sourceMappingURL=lazy.js.map