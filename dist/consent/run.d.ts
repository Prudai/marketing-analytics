import * as CookieConsent from "vanilla-cookieconsent";
import type { ConsentState } from "../ga4/init";
export interface RunConsentOptions {
    policyHref?: string;
    /** Show a Marketing category (Google Ads conversion measurement). */
    marketing?: boolean;
    onConsentChange: (state: ConsentState) => void;
}
export declare function runConsent(options: RunConsentOptions): Promise<void>;
export { CookieConsent };
//# sourceMappingURL=run.d.ts.map