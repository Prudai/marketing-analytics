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