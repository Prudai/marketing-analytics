import { type ConsentState } from "./storage";
export interface UseConsentResult {
    state: ConsentState;
    accept: () => void;
    reject: () => void;
}
export declare function useConsent(): UseConsentResult;
//# sourceMappingURL=useConsent.d.ts.map