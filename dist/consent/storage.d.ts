export type ConsentState = "unknown" | "granted" | "denied";
export declare function readConsent(): ConsentState;
export declare function writeConsent(state: Exclude<ConsentState, "unknown">): void;
export declare const CONSENT_EVENT = "prudai-consent-change";
export declare function emitConsentChange(state: ConsentState): void;
//# sourceMappingURL=storage.d.ts.map