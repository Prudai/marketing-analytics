import { useEffect, useState } from "react";
import { CONSENT_EVENT, emitConsentChange, readConsent, writeConsent, } from "./storage";
export function useConsent() {
    const [state, setState] = useState(() => readConsent());
    useEffect(() => {
        const onChange = (event) => {
            const detail = event.detail;
            if (detail)
                setState(detail);
        };
        window.addEventListener(CONSENT_EVENT, onChange);
        return () => window.removeEventListener(CONSENT_EVENT, onChange);
    }, []);
    const accept = () => {
        writeConsent("granted");
        emitConsentChange("granted");
    };
    const reject = () => {
        writeConsent("denied");
        emitConsentChange("denied");
    };
    return { state, accept, reject };
}
//# sourceMappingURL=useConsent.js.map