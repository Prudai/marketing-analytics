import * as CookieConsent from "vanilla-cookieconsent";
export interface RunConsentOptions {
    policyHref?: string;
    onAnalyticsConsentChange: (granted: boolean) => void;
}
export declare function runConsent(options: RunConsentOptions): Promise<void>;
export { CookieConsent };
//# sourceMappingURL=run.d.ts.map