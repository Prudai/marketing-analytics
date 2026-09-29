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
/**
 * Onthoudt welke tags de site heeft. Laadt en queuet bewust niets: dat doet
 * `applyConsent` zodra er toestemming is (Consent Mode basic).
 */
export declare function initGtag({ measurementId, adsConversionId, debug }: GtagInitOptions): void;
export declare function applyConsent({ analytics, marketing }: ConsentState): void;
/**
 * Tag-id's waar een event nu heen mag, volgens de toestemming van de bezoeker.
 * `null` = dit pakket beheert de Google-tag niet (geen `initAnalytics` met een
 * GA4- of Ads-id); wie dan zelf `window.gtag` zet, beheert ook de toestemming.
 */
export declare function consentedTargets(): string[] | null;
/** @internal Alleen voor tests: terug naar een verse paginalading. Niet via de pakketroot. */
export declare function resetGtagForTests(): void;
//# sourceMappingURL=init.d.ts.map