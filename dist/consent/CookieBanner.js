import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { getStrings } from "./i18n";
import { useConsent } from "./useConsent";
const baseStyle = {
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
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
    zIndex: 2147483000,
};
const titleStyle = { margin: "0 0 6px", fontSize: 15, fontWeight: 600 };
const bodyStyle = { margin: "0 0 12px" };
const actionsStyle = { display: "flex", gap: 8, justifyContent: "flex-end" };
const buttonBase = {
    border: "1px solid transparent",
    borderRadius: 8,
    padding: "8px 14px",
    fontSize: 14,
    cursor: "pointer",
};
const rejectStyle = {
    ...buttonBase,
    background: "#ffffff",
    color: "#111827",
    borderColor: "#d1d5db",
};
const acceptStyle = {
    ...buttonBase,
    background: "#111827",
    color: "#ffffff",
};
const linkStyle = { color: "#2563eb", textDecoration: "underline" };
export function CookieBanner({ locale = "nl", policyHref, className, style, }) {
    const { state, accept, reject } = useConsent();
    if (state !== "unknown")
        return null;
    const t = getStrings(locale);
    return (_jsxs("div", { role: "dialog", "aria-live": "polite", "aria-label": t.title, "data-prudai-consent": "banner", className: className, style: { ...baseStyle, ...style }, children: [_jsx("p", { style: titleStyle, children: t.title }), _jsxs("p", { style: bodyStyle, children: [t.body, policyHref ? (_jsxs(_Fragment, { children: [" ", _jsx("a", { href: policyHref, style: linkStyle, target: "_blank", rel: "noreferrer", children: t.policyLinkLabel }), "."] })) : null] }), _jsxs("div", { style: actionsStyle, children: [_jsx("button", { type: "button", onClick: reject, style: rejectStyle, "data-prudai-consent": "reject", children: t.reject }), _jsx("button", { type: "button", onClick: accept, style: acceptStyle, "data-prudai-consent": "accept", children: t.accept })] })] }));
}
//# sourceMappingURL=CookieBanner.js.map