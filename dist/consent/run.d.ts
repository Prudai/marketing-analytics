import * as CookieConsent from "vanilla-cookieconsent";
import type { ConsentState } from "../ga4/init";
/**
 * Is de banner op deze pagina gestart? Pas na `CookieConsent.run()` kan het
 * voorkeurenvenster open; daarvóór gooit `showPreferences()` een TypeError.
 */
/** Toestemmingsrevisie, gelijk op alle sites (zie `revision` in runConsent). */
export declare const CONSENT_REVISIE = 2;
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
export declare function wisDomeinen(host: string): string[];
export interface RunConsentOptions {
    policyHref?: string;
    /** Show a Marketing category (Google Ads conversion measurement). */
    marketing?: boolean;
    onConsentChange: (state: ConsentState) => void;
}
export declare function runConsent(options: RunConsentOptions): Promise<void>;
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
export declare function openCookieVoorkeuren(): boolean;
/** @internal Alleen voor tests: terug naar een pagina zonder banner. Niet via de pakketroot. */
export declare function resetConsentForTests(): void;
export { CookieConsent };
//# sourceMappingURL=run.d.ts.map