import * as CookieConsent from "vanilla-cookieconsent";
/**
 * Toestemmingsrevisie, gelijk op alle sites. Een opgeslagen keuze met een andere
 * revisie telt niet meer en de banner vraagt opnieuw. 3 sinds v0.4.4: de keuze
 * geldt sindsdien voor alle Prudai-websites samen (zie `GEDEELD_DOMEIN`), een
 * ruimere reikwijdte dan "deze site", dus iedereen wordt één keer opnieuw gevraagd.
 */
export const CONSENT_REVISIE = 3;
/**
 * Eén toestemming voor alle Prudai-websites (besluit Beau 29-09-2026). De keuze
 * staat in `cc_cookie` op `.prudai.com`, zodat akkoord of intrekken op één site
 * direct op alle `*.prudai.com`-sites geldt. Daarvóór schreef elke host zijn eigen
 * cookie, maar die van prudai.com (`Domain=prudai.com`) was ook op de subdomeinen
 * zichtbaar en won daar: intrekken op leo.prudai.com hield na herladen geen stand
 * (gemeten op productie 29-09-2026).
 */
export const GEDEELD_DOMEIN = "prudai.com";
/** Domein voor `cc_cookie`: `prudai.com` op de Prudai-sites, anders de standaard. */
export function toestemmingsDomein(host) {
    const h = host.toLowerCase().replace(/\.$/, "");
    return h === GEDEELD_DOMEIN || h.endsWith(`.${GEDEELD_DOMEIN}`) ? GEDEELD_DOMEIN : undefined;
}
/**
 * Oude toestemming per subdomein opruimen. Tot v0.4.4 schreef bijvoorbeeld
 * leo.prudai.com een eigen `cc_cookie` (host-only of `Domain=leo.prudai.com`). Die
 * zou naast de gedeelde cookie blijven staan, en de bibliotheek leest de eerste
 * `cc_cookie` die ze vindt; de oudste kan dus winnen. Op prudai.com zelf is de
 * bestaande cookie al de gedeelde, die blijft staan.
 */
function ruimOudeToestemmingOp(host) {
    if (typeof document === "undefined")
        return;
    if (toestemmingsDomein(host) !== GEDEELD_DOMEIN || host === GEDEELD_DOMEIN)
        return;
    const weg = "cc_cookie=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
    document.cookie = weg;
    document.cookie = `${weg}; domain=${host}`;
}
/**
 * Is de banner op deze pagina gestart? Pas na `CookieConsent.run()` kan het
 * voorkeurenvenster open; daarvóór gooit `showPreferences()` een TypeError.
 */
let bannerGestart = false;
/**
 * Gooide `showPreferences()` al eens? Dan heeft de bibliotheek geen venster (bij
 * een bot stopt `run()` vroeg) en doet elke volgende aanroep stil niets.
 */
let vensterOnbruikbaar = false;
/**
 * Domeinen waarop een cookie gewist moet worden: de host en elk bovenliggend
 * domein (leo.prudai.com → leo.prudai.com, prudai.com). gtag zet `_ga`/`_gcl_*`
 * op het registreerbare domein (`.prudai.com`), ook als de bezoeker op een
 * subdomein zit, maar vanilla-cookieconsent wist zonder `domain` alleen op
 * `location.hostname`. Daardoor bleven de cookies na intrekken staan op
 * leo.prudai.com (gemeten op productie 29-09-2026). De host zelf staat er voor
 * de volledigheid in; de entry zonder `domain` dekt host-only en `.host` al. Een publiek suffix
 * (vercel.app) weigert de browser gewoon; een IP-adres of `localhost` heeft
 * geen bovenliggend domein.
 */
export function wisDomeinen(host) {
    if (!host || /^[\d.]+$/.test(host) || host.includes(":"))
        return [];
    const delen = host.split(".").filter(Boolean);
    const uit = [];
    for (let i = 0; i + 2 <= delen.length; i++)
        uit.push(delen.slice(i).join("."));
    return uit;
}
function wisbareCookies(naam) {
    const host = typeof location === "undefined" ? "" : location.hostname;
    return [{ name: naam }, ...wisDomeinen(host).map((domain) => ({ name: naam, domain }))];
}
export async function runConsent(options) {
    const includeMarketing = true;
    const host = typeof location === "undefined" ? "" : location.hostname;
    ruimOudeToestemmingOp(host);
    const domein = toestemmingsDomein(host);
    const applyCurrent = () => {
        options.onConsentChange({
            analytics: CookieConsent.acceptedCategory("analytics"),
            marketing: includeMarketing && CookieConsent.acceptedCategory("marketing"),
        });
    };
    const categories = {
        necessary: { readOnly: true, enabled: true },
        analytics: {
            services: {
                ga4: {
                    label: "Google Analytics 4",
                    cookies: wisbareCookies(/^_ga/),
                },
            },
        },
    };
    if (includeMarketing) {
        categories.marketing = {
            services: {
                googleAds: {
                    label: "Google Ads",
                    cookies: wisbareCookies(/^_gcl/),
                },
            },
        };
    }
    const nlSections = [
        {
            title: "Noodzakelijk",
            description: "Deze cookies zijn nodig om de site te laten werken en kunnen niet uitgezet worden.",
            linkedCategory: "necessary",
        },
        {
            title: "Analytics",
            description: "Helpen ons te begrijpen hoe bezoekers de site gebruiken (geaggregeerd, niet persoonlijk identificeerbaar).",
            linkedCategory: "analytics",
        },
        ...(includeMarketing
            ? [
                {
                    title: "Marketing",
                    description: "Meten of onze advertenties (Google Ads) tot een aanvraag of aanmelding leiden. We bouwen geen persoonlijke advertentieprofielen op.",
                    linkedCategory: "marketing",
                },
            ]
            : []),
    ];
    const enSections = [
        {
            title: "Necessary",
            description: "Required to operate the site; cannot be disabled.",
            linkedCategory: "necessary",
        },
        {
            title: "Analytics",
            description: "Help us understand how visitors use the site (aggregated, not personally identifiable).",
            linkedCategory: "analytics",
        },
        ...(includeMarketing
            ? [
                {
                    title: "Marketing",
                    description: "Measure whether our ads (Google Ads) lead to a request or sign-up. We do not build personal advertising profiles.",
                    linkedCategory: "marketing",
                },
            ]
            : []),
    ];
    await CookieConsent.run({
        // Stored consent is only re-requested on a revision mismatch. Bump
        // CONSENT_REVISIE whenever a consent-relevant category or the scope changes.
        // Every site has the same categories and revision, because the choice is
        // shared across all Prudai sites (GEDEELD_DOMEIN).
        revision: CONSENT_REVISIE,
        ...(domein ? { cookie: { domain: domein } } : {}),
        guiOptions: {
            consentModal: { layout: "box inline", position: "bottom right" },
            preferencesModal: { layout: "box", position: "right" },
        },
        categories,
        onConsent: applyCurrent,
        onChange: applyCurrent,
        language: {
            default: "nl",
            autoDetect: "browser",
            translations: {
                nl: {
                    consentModal: {
                        title: "Cookies op de websites van Prudai",
                        description: "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze websites gebruiken, zodat we ze kunnen verbeteren. Je keuze geldt voor alle websites van Prudai (prudai.com en de sites daaronder, zoals leo.prudai.com) en je kunt hem altijd wijzigen via 'Cookievoorkeuren' onderaan de pagina. Essentiële functies werken altijd zonder cookies.",
                        acceptAllBtn: "Alles accepteren",
                        acceptNecessaryBtn: "Alleen noodzakelijk",
                        showPreferencesBtn: "Voorkeuren",
                        footer: options.policyHref
                            ? `<a href="${options.policyHref}" target="_blank" rel="noreferrer">Privacybeleid</a>`
                            : undefined,
                    },
                    preferencesModal: {
                        title: "Cookievoorkeuren",
                        acceptAllBtn: "Alles accepteren",
                        acceptNecessaryBtn: "Alleen noodzakelijk",
                        savePreferencesBtn: "Voorkeuren opslaan",
                        closeIconLabel: "Sluiten",
                        sections: nlSections,
                    },
                },
                en: {
                    consentModal: {
                        title: "Cookies on Prudai websites",
                        description: "We use analytics cookies to understand how visitors use our websites so we can improve them. Your choice applies to all Prudai websites (prudai.com and the sites under it, such as leo.prudai.com) and you can change it at any time via 'Cookie preferences' at the bottom of the page. Essential features always work without cookies.",
                        acceptAllBtn: "Accept all",
                        acceptNecessaryBtn: "Only necessary",
                        showPreferencesBtn: "Preferences",
                        footer: options.policyHref
                            ? `<a href="${options.policyHref}" target="_blank" rel="noreferrer">Privacy policy</a>`
                            : undefined,
                    },
                    preferencesModal: {
                        title: "Cookie preferences",
                        acceptAllBtn: "Accept all",
                        acceptNecessaryBtn: "Only necessary",
                        savePreferencesBtn: "Save preferences",
                        closeIconLabel: "Close",
                        sections: enSections,
                    },
                },
            },
        },
    });
    bannerGestart = true;
}
/**
 * Opent het voorkeurenvenster van de cookiebanner. Bedoeld voor een link als
 * "Cookievoorkeuren" in de footer: intrekken moet even makkelijk zijn als
 * toestemming geven (AVG art. 7 lid 3). Wie daar "Alleen noodzakelijk" kiest
 * of alles uitzet, krijgt dezelfde intrekking als via de banner (`onChange`
 * → `consent update` denied + `ga-disable-<id>`).
 *
 * Waarom een functie en niet het attribuut `data-cc="show-preferencesModal"`:
 * vanilla-cookieconsent koppelt dat attribuut één keer, tijdens `run()`, aan
 * de elementen die er dán al staan. Een React-footer die later rendert, of bij
 * een routewissel opnieuw mount, krijgt die koppeling niet.
 *
 * @returns `true` als het venster openging; `false` als de banner op deze
 * pagina niet draait (buiten de browser, geen tag-id's in `initAnalytics`, of
 * een geautomatiseerde browser, die vanilla-cookieconsent overslaat).
 */
export function openCookieVoorkeuren() {
    if (typeof window === "undefined" || !bannerGestart || vensterOnbruikbaar)
        return false;
    try {
        CookieConsent.showPreferences();
        return true;
    }
    catch {
        // De bibliotheek zet haar "venster open"-vlag vóór ze valt; daarna doet
        // showPreferences() niets meer maar gooit ook niet. Zonder deze vlag zou
        // een tweede aanroep dus `true` geven zonder venster.
        vensterOnbruikbaar = true;
        return false;
    }
}
/** @internal Alleen voor tests: terug naar een pagina zonder banner. Niet via de pakketroot. */
export function resetConsentForTests() {
    bannerGestart = false;
    vensterOnbruikbaar = false;
}
export { CookieConsent };
//# sourceMappingURL=run.js.map