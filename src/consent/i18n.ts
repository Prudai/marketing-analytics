export type Locale = "nl" | "en";

export interface ConsentStrings {
  title: string;
  body: string;
  accept: string;
  reject: string;
  policyLinkLabel: string;
}

const strings: Record<Locale, ConsentStrings> = {
  nl: {
    title: "Cookies op deze site",
    body:
      "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze site gebruiken, zodat we die kunnen verbeteren. Essenti\u00eble functies werken zonder cookies.",
    accept: "Accepteren",
    reject: "Weigeren",
    policyLinkLabel: "Privacybeleid",
  },
  en: {
    title: "Cookies on this site",
    body:
      "We use analytics cookies to understand how visitors use our site so we can improve it. Essential functionality works without cookies.",
    accept: "Accept",
    reject: "Reject",
    policyLinkLabel: "Privacy policy",
  },
};

export function getStrings(locale: Locale): ConsentStrings {
  return strings[locale] ?? strings.en;
}
