import { useEffect, useState } from "react";

import {
  CONSENT_EVENT,
  type ConsentState,
  emitConsentChange,
  readConsent,
  writeConsent,
} from "./storage";

export interface UseConsentResult {
  state: ConsentState;
  accept: () => void;
  reject: () => void;
}

export function useConsent(): UseConsentResult {
  const [state, setState] = useState<ConsentState>(() => readConsent());

  useEffect(() => {
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<ConsentState>).detail;
      if (detail) setState(detail);
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
