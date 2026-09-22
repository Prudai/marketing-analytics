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
export declare const HERKOMST_SLEUTEL = "prudai_herkomst";
export type Herkomst = {
    /** Pad + query van de eerste pagina in deze tab. */
    landing: string;
    /** document.referrer bij binnenkomst; leeg = direct of onbekend. */
    verwijzer: string;
    gclid?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    utm_matchtype?: string;
    /** ISO-tijdstip van vastleggen. */
    vastgelegd: string;
    /** Pad van de pagina waar het formulier stond (alleen bij leesHerkomst). */
    pagina?: string;
};
/**
 * Legt de herkomst van deze tab vast als dat nog niet gebeurd is (of als de
 * huidige URL een nieuwe campagneklik draagt). Idempotent; veilig zonder
 * window (SSR/prerender) en zonder opslag (privémodus).
 */
export declare function legHerkomstVast(): Herkomst | undefined;
/**
 * Herkomst voor een formulierinzending: de vastgelegde eerste aanraking plus
 * de pagina waar het formulier stond. `undefined` buiten de browser.
 */
export declare function leesHerkomst(): Herkomst | undefined;
//# sourceMappingURL=herkomst.d.ts.map