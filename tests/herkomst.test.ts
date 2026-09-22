import { beforeEach, describe, expect, test } from "bun:test";

// Minimale browser: location, referrer en een sessionStorage in geheugen.
const opslag = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.window = globalThis;
g.sessionStorage = {
  getItem: (k: string) => opslag.get(k) ?? null,
  setItem: (k: string, v: string) => void opslag.set(k, v),
  removeItem: (k: string) => void opslag.delete(k),
};
function ga(pathname: string, search = "", referrer = "") {
  g.location = { pathname, search };
  g.document = { referrer };
}

const { legHerkomstVast, leesHerkomst, HERKOMST_SLEUTEL } = await import("../src/herkomst");

describe("herkomst", () => {
  beforeEach(() => opslag.clear());

  test("advertentieklik: gclid + utm uit de URL, verwijzer en landingspagina", () => {
    ga("/oplossingen/ai-contractanalyse", "?gclid=abc&utm_source=google&utm_medium=cpc&utm_term=ai%20contractanalyse", "https://www.google.com/");
    const h = legHerkomstVast()!;
    expect(h.gclid).toBe("abc");
    expect(h.utm_medium).toBe("cpc");
    expect(h.utm_term).toBe("ai contractanalyse");
    expect(h.verwijzer).toBe("https://www.google.com/");
    expect(h.landing).toBe("/oplossingen/ai-contractanalyse?gclid=abc&utm_source=google&utm_medium=cpc&utm_term=ai%20contractanalyse");
    expect(opslag.has(HERKOMST_SLEUTEL)).toBe(true);
  });

  test("eerste aanraking wint bij navigatie binnen de site", () => {
    ga("/", "", "https://www.google.com/");
    legHerkomstVast();
    ga("/contact", "", "https://leo.prudai.com/");
    const h = leesHerkomst()!;
    expect(h.landing).toBe("/");
    expect(h.verwijzer).toBe("https://www.google.com/");
    expect(h.pagina).toBe("/contact");
  });

  test("een nieuwe campagneklik in dezelfde tab overschrijft de oude herkomst", () => {
    ga("/", "", "");
    legHerkomstVast();
    ga("/oplossingen/juridische-ai-assistent", "?gclid=xyz", "https://www.google.com/");
    expect(legHerkomstVast()!.gclid).toBe("xyz");
  });

  test("direct bezoek: lege verwijzer, geen parameters", () => {
    ga("/plans", "", "");
    const h = leesHerkomst()!;
    expect(h.verwijzer).toBe("");
    expect(h.gclid).toBeUndefined();
    expect(h.utm_source).toBeUndefined();
  });

  test("knipt waarden af op 300 tekens en overleeft kapotte opslag", () => {
    ga("/", "?utm_campaign=" + "x".repeat(500), "");
    expect(legHerkomstVast()!.utm_campaign!.length).toBe(300);
    opslag.set(HERKOMST_SLEUTEL, "{niet json");
    ga("/contact", "", "https://duckduckgo.com/");
    expect(leesHerkomst()!.verwijzer).toBe("https://duckduckgo.com/");
  });
});
