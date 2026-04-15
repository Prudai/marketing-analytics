import * as CookieConsent from "vanilla-cookieconsent";
export async function runConsent(options) {
    const applyCurrent = () => {
        const granted = CookieConsent.acceptedCategory("analytics");
        options.onAnalyticsConsentChange(granted);
    };
    await CookieConsent.run({
        guiOptions: {
            consentModal: { layout: "box inline", position: "bottom right" },
            preferencesModal: { layout: "box", position: "right" },
        },
        categories: {
            necessary: { readOnly: true, enabled: true },
            analytics: {
                services: {
                    ga4: {
                        label: "Google Analytics 4",
                        cookies: [{ name: /^_ga/ }],
                    },
                },
            },
        },
        onFirstConsent: applyCurrent,
        onConsent: applyCurrent,
        onChange: applyCurrent,
        language: {
            default: "nl",
            autoDetect: "browser",
            translations: {
                nl: {
                    consentModal: {
                        title: "Cookies op deze site",
                        description: "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze site gebruiken, zodat we 'm kunnen verbeteren. Essenti\u00eble functies werken altijd zonder cookies.",
                        acceptAllBtn: "Alles accepteren",
                        acceptNecessaryBtn: "Alleen noodzakelijk",
                        showPreferencesBtn: "Voorkeuren",
                        footer: options.policyHref
                            ? `<a href="${options.policyHref}" target="_blank" rel="noreferrer">Privacybeleid</a>`
                            : undefined,
                    },
                    preferencesModal: {
                        title: "Cookievoorkeuren",
                        acceptAllBtn: "Alles accepteren",
                        acceptNecessaryBtn: "Alleen noodzakelijk",
                        savePreferencesBtn: "Voorkeuren opslaan",
                        closeIconLabel: "Sluiten",
                        sections: [
                            {
                                title: "Noodzakelijk",
                                description: "Deze cookies zijn nodig om de site te laten werken en kunnen niet uitgezet worden.",
                                linkedCategory: "necessary",
                            },
                            {
                                title: "Analytics",
                                description: "Helpen ons te begrijpen hoe bezoekers de site gebruiken (geaggregeerd, niet persoonlijk identificeerbaar).",
                                linkedCategory: "analytics",
                            },
                        ],
                    },
                },
                en: {
                    consentModal: {
                        title: "Cookies on this site",
                        description: "We use analytics cookies to understand how visitors use our site so we can improve it. Essential features always work without cookies.",
                        acceptAllBtn: "Accept all",
                        acceptNecessaryBtn: "Only necessary",
                        showPreferencesBtn: "Preferences",
                        footer: options.policyHref
                            ? `<a href="${options.policyHref}" target="_blank" rel="noreferrer">Privacy policy</a>`
                            : undefined,
                    },
                    preferencesModal: {
                        title: "Cookie preferences",
                        acceptAllBtn: "Accept all",
                        acceptNecessaryBtn: "Only necessary",
                        savePreferencesBtn: "Save preferences",
                        closeIconLabel: "Close",
                        sections: [
                            {
                                title: "Necessary",
                                description: "Required to operate the site; cannot be disabled.",
                                linkedCategory: "necessary",
                            },
                            {
                                title: "Analytics",
                                description: "Help us understand how visitors use the site (aggregated, not personally identifiable).",
                                linkedCategory: "analytics",
                            },
                        ],
                    },
                },
            },
        },
    });
}
export { CookieConsent };
//# sourceMappingURL=run.js.map