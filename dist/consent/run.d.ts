import * as CookieConsent from "vanilla-cookieconsent";
import type { ConsentState } from "../ga4/init";
/**
 * Toestemmingsrevisie, gelijk op alle sites. Een opgeslagen keuze met een andere
 * revisie telt niet meer en de banner vraagt opnieuw. 3 sinds v0.4.4: de keuze
 * geldt sindsdien voor alle Prudai-websites samen (zie `GEDEELD_DOMEIN`), een
 * ruimere reikwijdte dan "deze site", dus iedereen wordt één keer opnieuw gevraagd.
 */
export declare const CONSENT_REVISIE = 3;
/**
 * Eén toestemming voor alle Prudai-websites (besluit Beau 29-09-2026). De keuze
 * staat in `cc_cookie` op `.prudai.com`, zodat akkoord of intrekken op één site
 * direct op alle `*.prudai.com`-sites geldt. Daarvóór schreef elke host zijn eigen
 * cookie, maar die van prudai.com (`Domain=prudai.com`) was ook op de subdomeinen
 * zichtbaar en won daar: intrekken op leo.prudai.com hield na herladen geen stand
 * (gemeten op productie 29-09-2026).
 */
export declare const GEDEELD_DOMEIN = "prudai.com";
/** Domein voor `cc_cookie`: `prudai.com` op de Prudai-sites, anders de standaard. */
export declare function toestemmingsDomein(host: string): string | undefined;
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
/**
 * Waar de cookiekeuze voor geldt, zoals de banner het zegt (v0.4.5).
 * - `prudai` (standaard): de gedeelde keuze op .prudai.com, "alle websites van Prudai".
 * - `site`: een eigen domein buiten prudai.com (bv. ai-geletterdheid-training.nl), waar de keuze
 *   alleen voor die website geldt. Verandert alleen de tekst; het cookie volgt altijd de host.
 */
export type BannerBereik = "prudai" | "site";
export interface RunConsentOptions {
    policyHref?: string;
    /** Standaard `prudai`; zie {@link BannerBereik}. */
    bereik?: BannerBereik;
    /**
     * @deprecated Sinds v0.4.4 toont elke site de categorie Marketing: de keuze is
     * gedeeld over alle Prudai-sites, en een site zonder die categorie zou haar bij
     * opslaan uit de gedeelde keuze wissen. Of er echt een Ads-tag laadt, bepaalt
     * `googleAds` in `initAnalytics`. Deze optie wordt genegeerd.
     */
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