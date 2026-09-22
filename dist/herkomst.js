/**
 * Herkomst van een bezoek: wat de bezoeker zélf meebracht toen hij deze tab
 * binnenkwam — landingspagina, verwijzer, utm_*-parameters en gclid. Geen
 * cookie, geen derde partij: het zijn de parameters van onze eigen URL en de
 * Referer-header die de browser toch al stuurt, bewaard in sessionStorage
 * (verdwijnt met de tab), zodat een formulier op een latere pagina nog weet
 * waar het bezoek begon. Onafhankelijk van cookie-toestemming; de
 * Google-tag zelf blijft onder Consent Mode.
 *
 * Eerste aanraking wint, behalve als de nieuwe URL zelf campagneparameters of
 * een gclid draagt: een verse advertentieklik in dezelfde tab is een nieuwe
 * herkomst.
 */
export const HERKOMST_SLEUTEL = "prudai_herkomst";
const UTM = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "utm_matchtype",
];
const MAX = 300;
const knip = (s) => s.slice(0, MAX);
function uitUrl(loc, verwijzer) {
    const params = new URLSearchParams(loc.search);
    const h = {
        landing: knip(loc.pathname + loc.search),
        verwijzer: knip(verwijzer),
        vastgelegd: new Date().toISOString(),
    };
    const gclid = params.get("gclid");
    if (gclid)
        h.gclid = knip(gclid);
    for (const k of UTM) {
        const v = params.get(k);
        if (v)
            h[k] = knip(v);
    }
    return h;
}
function heeftCampagne(loc) {
    const p = new URLSearchParams(loc.search);
    return p.has("gclid") || UTM.some((k) => p.has(k));
}
function lees() {
    try {
        const raw = window.sessionStorage.getItem(HERKOMST_SLEUTEL);
        if (!raw)
            return null;
        const h = JSON.parse(raw);
        return typeof h?.landing === "string" ? h : null;
    }
    catch {
        return null;
    }
}
/**
 * Legt de herkomst van deze tab vast als dat nog niet gebeurd is (of als de
 * huidige URL een nieuwe campagneklik draagt). Idempotent; veilig zonder
 * window (SSR/prerender) en zonder opslag (privémodus).
 */
export function legHerkomstVast() {
    if (typeof window === "undefined" || !window.location)
        return undefined;
    const loc = window.location;
    const bestaand = lees();
    if (bestaand && !heeftCampagne(loc))
        return bestaand;
    const vers = uitUrl(loc, typeof document !== "undefined" ? document.referrer ?? "" : "");
    try {
        window.sessionStorage.setItem(HERKOMST_SLEUTEL, JSON.stringify(vers));
    }
    catch {
        // Geen opslag: dan geldt de herkomst alleen voor deze pagina.
    }
    return vers;
}
/**
 * Herkomst voor een formulierinzending: de vastgelegde eerste aanraking plus
 * de pagina waar het formulier stond. `undefined` buiten de browser.
 */
export function leesHerkomst() {
    const h = legHerkomstVast();
    if (!h)
        return undefined;
    return { ...h, pagina: knip(window.location.pathname) };
}
//# sourceMappingURL=herkomst.js.map