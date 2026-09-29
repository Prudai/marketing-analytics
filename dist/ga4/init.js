/**
 * Google-tag (GA4 + Google Ads) in Consent Mode v2 **basic**.
 *
 * Tot de bezoeker toestemming geeft bestaat er niets: geen `gtag.js`, geen
 * `dataLayer`, geen `window.gtag`, dus ook geen cookieloze pings. Pas wanneer de
 * cookiebanner (vanilla-cookieconsent) analytics en/of marketing toestaat, laadt
 * `applyConsent` de tag, met eerst de denied-defaults en direct daarna de
 * `update` naar wat de bezoeker koos.
 *
 * Waarom basic en niet advanced: in advanced stuurde de tag vóór akkoord al
 * cookieloze pings. Die kwamen voor het grootste deel van Microsoft 365-
 * linkscanners die de links in onze mails openen en nooit op de banner klikken
 * (29-09-2026: 775 van de 1.283 GA4-sessies in 28 dagen, alle "Unassigned").
 * De modellering waarvoor advanced bestaat vraagt een volume dat wij niet halen.
 */
/** Tag-id's uit `initAnalytics`; `null` = geen Google-tag op deze site. */
let options = null;
/** Heeft de tag deze pagina al opgestart (defaults, `js`, script)? */
let started = false;
/** Id's waarvoor `config` al is aangeroepen. */
const configured = new Set();
/** Wat de bezoeker nu toestaat, beperkt tot de id's die er zijn. */
let current = { analytics: false, marketing: false };
function ensureDataLayer() {
    window.dataLayer = window.dataLayer ?? [];
    if (!window.gtag) {
        // Must push `arguments` (not a plain Array) — gtag.js's hydration
        // relies on the Arguments object identity when processing the queue.
        window.gtag = function gtag() {
            // eslint-disable-next-line prefer-rest-params
            window.dataLayer.push(arguments);
        };
    }
}
function loadScript(id) {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
}
/**
 * Onthoudt welke tags de site heeft. Laadt en queuet bewust niets: dat doet
 * `applyConsent` zodra er toestemming is (Consent Mode basic).
 */
export function initGtag({ measurementId, adsConversionId, debug }) {
    if (typeof window === "undefined" || options)
        return;
    if (!measurementId && !adsConversionId)
        return;
    options = { measurementId, adsConversionId, debug };
}
/**
 * Past de keuze uit de cookiebanner toe. Wordt aangeroepen bij het eerste
 * akkoord, bij elke paginalading met een opgeslagen akkoord, en bij elke
 * wijziging van de voorkeuren.
 */
export function applyConsent({ analytics, marketing }) {
    if (typeof window === "undefined" || !options)
        return;
    const { measurementId, adsConversionId, debug } = options;
    const previous = current;
    current = {
        analytics: analytics && Boolean(measurementId),
        marketing: marketing && Boolean(adsConversionId),
    };
    if (!started) {
        // Basic: zonder toestemming blijft de tag helemaal weg.
        if (!current.analytics && !current.marketing)
            return;
        ensureDataLayer();
        window.gtag("consent", "default", {
            ad_storage: "denied",
            ad_user_data: "denied",
            ad_personalization: "denied",
            analytics_storage: "denied",
            functionality_storage: "granted",
            security_storage: "granted",
        });
    }
    window.gtag("consent", "update", {
        ad_storage: current.marketing ? "granted" : "denied",
        ad_user_data: current.marketing ? "granted" : "denied",
        ad_personalization: current.marketing ? "granted" : "denied",
        analytics_storage: current.analytics ? "granted" : "denied",
    });
    // Ingetrokken toestemming: de geladen tag stuurt daarna ook geen
    // cookieloze hits meer (Googles officiële uitschakelvlag per tag-id).
    const flags = window;
    if (measurementId)
        flags[`ga-disable-${measurementId}`] = !current.analytics;
    if (adsConversionId)
        flags[`ga-disable-${adsConversionId}`] = !current.marketing;
    if (!started) {
        window.gtag("js", new Date());
    }
    if (measurementId && current.analytics) {
        if (!configured.has(measurementId)) {
            // `config` stuurt zelf de page_view van de pagina waarop het akkoord
            // valt; routewissels daarna meet GA4 via de history-events.
            configured.add(measurementId);
            window.gtag("config", measurementId, {
                anonymize_ip: true,
                debug_mode: debug === true ? true : undefined,
            });
        }
        else if (!previous.analytics) {
            // Opnieuw toegestaan nadat het eerder op deze pagina was ingetrokken.
            window.gtag("event", "page_view", {
                page_location: window.location.href,
                page_title: document.title,
                send_to: measurementId,
            });
        }
    }
    if (adsConversionId && current.marketing && !configured.has(adsConversionId)) {
        configured.add(adsConversionId);
        window.gtag("config", adsConversionId);
    }
    if (!started) {
        started = true;
        loadScript(current.analytics ? measurementId : adsConversionId);
    }
}
/** Tag-id's waar een event nu heen mag, volgens de toestemming van de bezoeker. */
export function consentedTargets() {
    if (!options)
        return [];
    const targets = [];
    if (current.analytics && options.measurementId)
        targets.push(options.measurementId);
    if (current.marketing && options.adsConversionId)
        targets.push(options.adsConversionId);
    return targets;
}
/** Alleen voor tests: terug naar een verse paginalading. */
export function resetGtagForTests() {
    options = null;
    started = false;
    configured.clear();
    current = { analytics: false, marketing: false };
}
//# sourceMappingURL=init.js.map