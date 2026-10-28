export interface InitAnalyticsConfig {
    siteId: string;
    environment?: string;
    release?: string;
    ga4?: {
        measurementId: string;
        debug?: boolean;
    };
    googleAds?: {
        conversionId: string;
    };
    sentry?: {
        dsn: string;
        tracesSampleRate?: number;
        /**
         * Noodroute (v0.4.8): stuurt fouten die Sentry nog niet kon melden bij het verlaten van de pagina
         * of als de Sentry-chunk niet laadt als minimaal event naar de DSN (zonder cookies, zonder query
         * en hash in de URL). Zet op `false` als de site event processors gebruikt die events moeten
         * schonen (`Sentry.addEventProcessor`): die draaien niet op de noodroute. Standaard `true`.
         */
        noodroute?: boolean;
    };
    consent?: {
        policyHref?: string;
        /**
         * Waar de keuze voor geldt in de bannertekst (v0.4.5): `prudai` (standaard, gedeeld op
         * .prudai.com) of `site` (eigen domein buiten prudai.com: "je keuze geldt voor deze website").
         */
        bereik?: "prudai" | "site";
    };
}
//# sourceMappingURL=config.d.ts.map