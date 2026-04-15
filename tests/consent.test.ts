import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { readConsent, writeConsent } from "../src/consent/storage";

const globalWithWindow = globalThis as { window?: unknown; localStorage?: Storage };

function installFakeWindow() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
  globalWithWindow.window = { localStorage: storage };
  globalWithWindow.localStorage = storage;
}

describe("consent storage", () => {
  beforeEach(() => {
    installFakeWindow();
  });

  afterEach(() => {
    delete globalWithWindow.window;
    delete globalWithWindow.localStorage;
  });

  test("defaults to unknown", () => {
    expect(readConsent()).toBe("unknown");
  });

  test("round-trips granted", () => {
    writeConsent("granted");
    expect(readConsent()).toBe("granted");
  });

  test("round-trips denied", () => {
    writeConsent("denied");
    expect(readConsent()).toBe("denied");
  });
});
