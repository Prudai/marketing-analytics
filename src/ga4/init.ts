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

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export interface GtagInitOptions {
  measurementId?: string;
  adsConversionId?: string;
  debug?: boolean;
}

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

/** Tag-id's uit `initAnalytics`; `null` = geen Google-tag op deze site. */
let options: GtagInitOptions | null = null;
/** Heeft de tag deze pagina al opgestart (defaults, `js`, script)? */
let started = false;
/** Id's waarvoor `config` al is aangeroepen. */
const configured = new Set<string>();
/** Wat de bezoeker nu toestaat, beperkt tot de id's die er zijn. */
let current: ConsentState = { analytics: false, marketing: false };
/** Advertentieklik- en campagneparameters van de URL waarop deze pagina laadde. */
let landingCampaign: Array<[string, string]> = [];

const CAMPAIGN_KEYS = [
  "gclid",
  "gbraid",
  "wbraid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
] as const;

function campaignParams(href: string): Array<[string, string]> {
  try {
    const params = new URL(href).searchParams;
    return CAMPAIGN_KEYS.flatMap((k): Array<[string, string]> => {
      const v = params.get(k);
      return v ? [[k, v]] : [];
    });
  } catch {
    return [];
  }
}

/**
 * De URL die de tag bij het opstarten moet zien. Klikt de bezoeker pas op de
 * banner nadat hij binnen de SPA is doorgeklikt, dan staan gclid/utm van de
 * landingspagina niet meer in de adresbalk. In advanced mode zag gtag.js ze
 * nog (het draaide al op de landingspagina). Voor GA4 zetten we ze terug in
 * de eerste page_view, anders telt GA4 het bezoek niet als advertentie- of
 * campagneverkeer. `undefined` = de huidige URL is goed zoals hij is.
 */
function restoredLocation(): string | undefined {
  if (landingCampaign.length === 0) return undefined;
  try {
    const url = new URL(window.location.href);
    if (CAMPAIGN_KEYS.some((k) => url.searchParams.has(k))) return undefined;
    for (const [k, v] of landingCampaign) url.searchParams.set(k, v);
    return url.toString();
  } catch {
    return undefined;
  }
}

function ensureDataLayer(): void {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    // Must push `arguments` (not a plain Array) — gtag.js's hydration
    // relies on the Arguments object identity when processing the queue.
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

function loadScript(id: string): void {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(script);
}

/**
 * Onthoudt welke tags de site heeft. Laadt en queuet bewust niets: dat doet
 * `applyConsent` zodra er toestemming is (Consent Mode basic).
 */
export function initGtag({ measurementId, adsConversionId, debug }: GtagInitOptions): void {
  if (typeof window === "undefined" || options) return;
  if (!measurementId && !adsConversionId) return;
  options = { measurementId, adsConversionId, debug };
  landingCampaign = campaignParams(window.location.href);
}

/**
 * Google Ads bewaart de advertentieklik niet alleen in het cookie `_gcl_aw`, maar
 * ook in localStorage (`_gcl_ls`). De cookiebanner ruimt alleen cookies op, dus na
 * intrekken bleef de klik in localStorage staan (gemeten op leo.prudai.com,
 * 29-09-2026). localStorage is per origin, dus dit raakt geen andere host.
 */
function wisAdsOpslag(): void {
  try {
    const ls = window.localStorage;
    const sleutels: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && /^_gcl/.test(k)) sleutels.push(k);
    }
    for (const k of sleutels) ls.removeItem(k);
  } catch {
    // localStorage geblokkeerd of afwezig: dan is er ook niets bewaard.
  }
}

/**
 * Past de keuze uit de cookiebanner toe. Wordt aangeroepen bij het eerste
 * akkoord, bij elke paginalading met een opgeslagen akkoord, en bij elke
 * wijziging van de voorkeuren.
 */
export function applyConsent({ analytics, marketing }: ConsentState): void {
  if (typeof window === "undefined" || !options) return;
  const { measurementId, adsConversionId, debug } = options;

  const previous = current;
  current = {
    analytics: analytics && Boolean(measurementId),
    marketing: marketing && Boolean(adsConversionId),
  };

  if (!started) {
    // Basic: zonder toestemming blijft de tag helemaal weg. Een eerder bewaarde
    // advertentieklik gaat dan ook weg (verse paginalading met opgeslagen
    // weigering, of "Alleen noodzakelijk" als eerste keuze).
    if (!current.analytics && !current.marketing) {
      if (adsConversionId) wisAdsOpslag();
      return;
    }
    ensureDataLayer();
    window.gtag!("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "granted",
      security_storage: "granted",
    });
  }

  window.gtag!("consent", "update", {
    ad_storage: current.marketing ? "granted" : "denied",
    ad_user_data: current.marketing ? "granted" : "denied",
    ad_personalization: current.marketing ? "granted" : "denied",
    analytics_storage: current.analytics ? "granted" : "denied",
  });

  // Ingetrokken toestemming: `ga-disable-<G-id>` is Googles gedocumenteerde
  // uitschakelvlag voor GA4, zodat ook de automatische page_views van
  // routewissels stoppen. Voor Google Ads is die vlag niet gedocumenteerd; daar
  // doen de denied-signalen en de send_to-poort in events.ts het werk.
  // Gemeten 29-09-2026: routewissels, scrollen en herladen na intrekken geven
  // 0 verzoeken naar Google. Eén uitzondering: events van vóór het intrekken die
  // gtag nog niet verstuurd had (GA4 bundelt een paar seconden), gaan nog één
  // keer mee, een paar seconden later en met de toestemmingsstand van toen
  // (gcs=G111). gtag heeft geen publieke manier om die wachtrij te legen; de
  // verwerking vóór het intrekken blijft rechtmatig (AVG art. 7 lid 3).
  const flags = window as unknown as Record<string, boolean>;
  if (measurementId) flags[`ga-disable-${measurementId}`] = !current.analytics;
  if (adsConversionId) flags[`ga-disable-${adsConversionId}`] = !current.marketing;
  // Pas na de denied-update en de uitschakelvlaggen. Alleen op een site mét
  // Ads-tag: /vera en /zia draaien zonder Ads op dezelfde origin als prudai.com
  // en mogen de klik niet wissen van een bezoeker die daar wél toestemming gaf.
  if (adsConversionId && !current.marketing) wisAdsOpslag();

  if (!started) {
    window.gtag!("js", new Date());
  }

  if (measurementId && current.analytics) {
    if (!configured.has(measurementId)) {
      // Normaal stuurt `config` zelf de page_view van de pagina waarop het
      // akkoord valt (bij campagne-herstel doen we dat hieronder als event);
      // routewissels daarna meet GA4 via de history-events.
      configured.add(measurementId);
      const restored = restoredLocation();
      // Let op: een sleutel `send_page_view: undefined` zet de automatische
      // page_view óók uit (gemeten 29-09-2026), dus alleen meegeven als false.
      window.gtag!("config", measurementId, {
        anonymize_ip: true,
        debug_mode: debug === true ? true : undefined,
        ...(restored ? { send_page_view: false } : {}),
      });
      if (restored) {
        // Eén keer, als event: een page_location in `config` zou blijven
        // plakken aan elke latere routewissel.
        window.gtag!("event", "page_view", {
          page_location: restored,
          page_title: document.title,
          send_to: measurementId,
        });
      }
    } else if (!previous.analytics) {
      // Opnieuw toegestaan nadat het eerder op deze pagina was ingetrokken.
      window.gtag!("event", "page_view", {
        page_location: window.location.href,
        page_title: document.title,
        send_to: measurementId,
      });
    }
  }

  if (adsConversionId && current.marketing && !configured.has(adsConversionId)) {
    configured.add(adsConversionId);
    // Geen page_location-herstel hier: de conversielinker leest de gclid uit
    // de echte adresbalk, niet uit page_location (gemeten 29-09-2026).
    window.gtag!("config", adsConversionId);
  }

  if (!started) {
    started = true;
    loadScript(current.analytics ? measurementId! : adsConversionId!);
  }
}

/**
 * Tag-id's waar een event nu heen mag, volgens de toestemming van de bezoeker.
 * `null` = dit pakket beheert de Google-tag niet (geen `initAnalytics` met een
 * GA4- of Ads-id); wie dan zelf `window.gtag` zet, beheert ook de toestemming.
 */
export function consentedTargets(): string[] | null {
  if (!options) return null;
  const targets: string[] = [];
  if (current.analytics && options.measurementId) targets.push(options.measurementId);
  if (current.marketing && options.adsConversionId) targets.push(options.adsConversionId);
  return targets;
}

/** @internal Alleen voor tests: terug naar een verse paginalading. Niet via de pakketroot. */
export function resetGtagForTests(): void {
  options = null;
  started = false;
  configured.clear();
  current = { analytics: false, marketing: false };
  landingCampaign = [];
}
