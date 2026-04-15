const strings = {
    nl: {
        title: "Cookies op deze site",
        body: "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze site gebruiken, zodat we die kunnen verbeteren. Essenti\u00eble functies werken zonder cookies.",
        accept: "Accepteren",
        reject: "Weigeren",
        policyLinkLabel: "Privacybeleid",
    },
    en: {
        title: "Cookies on this site",
        body: "We use analytics cookies to understand how visitors use our site so we can improve it. Essential functionality works without cookies.",
        accept: "Accept",
        reject: "Reject",
        policyLinkLabel: "Privacy policy",
    },
};
export function getStrings(locale) {
    return strings[locale] ?? strings.en;
}
//# sourceMappingURL=i18n.js.map