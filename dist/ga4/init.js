let loaded = false;
let measurementIdCache = null;
function ensureDataLayer() {
    window.dataLayer = window.dataLayer ?? [];
    if (!window.gtag) {
        window.gtag = function gtag(...args) {
            window.dataLayer.push(args);
        };
    }
}
export function initGa4({ measurementId, debug }) {
    if (typeof window === "undefined" || !measurementId || loaded)
        return;
    loaded = true;
    measurementIdCache = measurementId;
    ensureDataLayer();
    window.gtag("consent", "default", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
        functionality_storage: "granted",
        security_storage: "granted",
        wait_for_update: 500,
    });
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
        anonymize_ip: true,
        debug_mode: debug === true ? true : undefined,
    });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
}
export function applyAnalyticsConsent(granted) {
    if (!window.gtag)
        return;
    window.gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: granted ? "granted" : "denied",
    });
    if (granted && measurementIdCache) {
        window.gtag("event", "page_view", {
            page_location: window.location.href,
            page_title: document.title,
            send_to: measurementIdCache,
        });
    }
}
//# sourceMappingURL=init.js.map