import { type CSSProperties } from "react";

import { getStrings, type Locale } from "./i18n";
import { useConsent } from "./useConsent";

export interface CookieBannerProps {
  locale?: Locale;
  policyHref?: string;
  className?: string;
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  position: "fixed",
  left: 16,
  right: 16,
  bottom: 16,
  maxWidth: 520,
  margin: "0 auto",
  padding: "16px 20px",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
  zIndex: 2147483000,
};

const titleStyle: CSSProperties = { margin: "0 0 6px", fontSize: 15, fontWeight: 600 };
const bodyStyle: CSSProperties = { margin: "0 0 12px" };
const actionsStyle: CSSProperties = { display: "flex", gap: 8, justifyContent: "flex-end" };
const buttonBase: CSSProperties = {
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  cursor: "pointer",
};
const rejectStyle: CSSProperties = {
  ...buttonBase,
  background: "#ffffff",
  color: "#111827",
  borderColor: "#d1d5db",
};
const acceptStyle: CSSProperties = {
  ...buttonBase,
  background: "#111827",
  color: "#ffffff",
};
const linkStyle: CSSProperties = { color: "#2563eb", textDecoration: "underline" };

export function CookieBanner({
  locale = "nl",
  policyHref,
  className,
  style,
}: CookieBannerProps) {
  const { state, accept, reject } = useConsent();
  if (state !== "unknown") return null;

  const t = getStrings(locale);

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t.title}
      data-prudai-consent="banner"
      className={className}
      style={{ ...baseStyle, ...style }}
    >
      <p style={titleStyle}>{t.title}</p>
      <p style={bodyStyle}>
        {t.body}
        {policyHref ? (
          <>
            {" "}
            <a href={policyHref} style={linkStyle} target="_blank" rel="noreferrer">
              {t.policyLinkLabel}
            </a>
            .
          </>
        ) : null}
      </p>
      <div style={actionsStyle}>
        <button type="button" onClick={reject} style={rejectStyle} data-prudai-consent="reject">
          {t.reject}
        </button>
        <button type="button" onClick={accept} style={acceptStyle} data-prudai-consent="accept">
          {t.accept}
        </button>
      </div>
    </div>
  );
}
