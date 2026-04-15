const STORAGE_KEY = "prudai-consent-v1";
export function readConsent() {
    if (typeof window === "undefined")
        return "unknown";
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === "granted" || raw === "denied")
            return raw;
    }
    catch {
        // localStorage unavailable (private mode, disabled)
    }
    return "unknown";
}
export function writeConsent(state) {
    if (typeof window === "undefined")
        return;
    try {
        window.localStorage.setItem(STORAGE_KEY, state);
    }
    catch {
        // ignore
    }
}
export const CONSENT_EVENT = "prudai-consent-change";
export function emitConsentChange(state) {
    if (typeof window === "undefined")
        return;
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}
//# sourceMappingURL=storage.js.map