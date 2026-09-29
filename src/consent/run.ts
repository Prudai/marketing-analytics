import * as CookieConsent from "vanilla-cookieconsent";

import type { ConsentState } from "../ga4/init";

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
export function wisDomeinen(host: string): string[] {
  if (!host || /^[\d.]+$/.test(host) || host.includes(":")) return [];
  const delen = host.split(".").filter(Boolean);
  const uit: string[] = [];
  for (let i = 0; i + 2 <= delen.length; i++) uit.push(delen.slice(i).join("."));
  return uit;
}

function wisbareCookies(naam: RegExp): { name: RegExp; domain?: string }[] {
  const host = typeof location === "undefined" ? "" : location.hostname;
  return [{ name: naam }, ...wisDomeinen(host).map((domain) => ({ name: naam, domain }))];
}

export interface RunConsentOptions {
  policyHref?: string;
  /** Show a Marketing category (Google Ads conversion measurement). */
  marketing?: boolean;
  onConsentChange: (state: ConsentState) => void;
}

export async function runConsent(options: RunConsentOptions): Promise<void> {
  const includeMarketing = options.marketing === true;

  const applyCurrent = () => {
    options.onConsentChange({
      analytics: CookieConsent.acceptedCategory("analytics"),
      marketing: includeMarketing && CookieConsent.acceptedCategory("marketing"),
    });
  };

  const categories: NonNullable<Parameters<typeof CookieConsent.run>[0]["categories"]> = {
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
      description:
        "Deze cookies zijn nodig om de site te laten werken en kunnen niet uitgezet worden.",
      linkedCategory: "necessary",
    },
    {
      title: "Analytics",
      description:
        "Helpen ons te begrijpen hoe bezoekers de site gebruiken (geaggregeerd, niet persoonlijk identificeerbaar).",
      linkedCategory: "analytics",
    },
    ...(includeMarketing
      ? [
          {
            title: "Marketing",
            description:
              "Meten of onze advertenties (Google Ads) tot een aanvraag of aanmelding leiden. We bouwen geen persoonlijke advertentieprofielen op.",
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
      description:
        "Help us understand how visitors use the site (aggregated, not personally identifiable).",
      linkedCategory: "analytics",
    },
    ...(includeMarketing
      ? [
          {
            title: "Marketing",
            description:
              "Measure whether our ads (Google Ads) lead to a request or sign-up. We do not build personal advertising profiles.",
            linkedCategory: "marketing",
          },
        ]
      : []),
  ];

  await CookieConsent.run({
    // Stored consent is only re-requested on a revision mismatch. Sites that
    // enable the marketing category must re-ask returning visitors (their
    // cc_cookie predates the category and would deny ads consent for up to
    // 182 days). Bump this number whenever a consent-relevant category is
    // added or changed.
    revision: includeMarketing ? 2 : 0,
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
            title: "Cookies op deze site",
            description:
              "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze site gebruiken, zodat we 'm kunnen verbeteren. Essentiële functies werken altijd zonder cookies.",
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
            title: "Cookies on this site",
            description:
              "We use analytics cookies to understand how visitors use our site so we can improve it. Essential features always work without cookies.",
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
export function openCookieVoorkeuren(): boolean {
  if (typeof window === "undefined" || !bannerGestart || vensterOnbruikbaar) return false;
  try {
    CookieConsent.showPreferences();
    return true;
  } catch {
    // De bibliotheek zet haar "venster open"-vlag vóór ze valt; daarna doet
    // showPreferences() niets meer maar gooit ook niet. Zonder deze vlag zou
    // een tweede aanroep dus `true` geven zonder venster.
    vensterOnbruikbaar = true;
    return false;
  }
}

/** @internal Alleen voor tests: terug naar een pagina zonder banner. Niet via de pakketroot. */
export function resetConsentForTests(): void {
  bannerGestart = false;
  vensterOnbruikbaar = false;
}

export { CookieConsent };
