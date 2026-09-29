import * as CookieConsent from "vanilla-cookieconsent";
import type { ConsentState } from "../ga4/init";
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