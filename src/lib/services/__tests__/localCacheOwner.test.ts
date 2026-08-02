import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_CACHE_OWNER_KEY,
  claimLocalCacheOwner,
  clearProductLocalCache,
  getActiveLocalCacheUserId,
  readUserScopedLocalStorage,
  scopedStorageKey,
  writeUserScopedLocalStorage,
} from "@/lib/services/localCacheOwner";

describe("localCacheOwner", () => {
  beforeEach(() => localStorage.clear());

  it("does not read or write financial data before a user namespace is active", () => {
    expect(writeUserScopedLocalStorage("plano-do-milhao-v6", "secret")).toBe(false);
    expect(readUserScopedLocalStorage("plano-do-milhao-v6")).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("namespaces values by user and never reads another account cache", () => {
    claimLocalCacheOwner("user-a");
    expect(writeUserScopedLocalStorage("plano-do-milhao-v6", "A")).toBe(true);
    const keyA = scopedStorageKey("plano-do-milhao-v6", "user-a") as string;
    expect(localStorage.getItem(keyA)).toBe("A");

    claimLocalCacheOwner("user-b");
    expect(getActiveLocalCacheUserId()).toBe("user-b");
    expect(readUserScopedLocalStorage("plano-do-milhao-v6")).toBeNull();
    expect(localStorage.getItem(keyA)).toBeNull();
  });

  it("deletes legacy unscoped keys when a session claims the browser", () => {
    localStorage.setItem("plano-do-milhao-v6", "legacy-plan");
    localStorage.setItem("plano-do-milhao-app-v7", "legacy-app");
    localStorage.setItem("unrelated", "keep");

    expect(claimLocalCacheOwner("user-a")).toBe(true);
    expect(localStorage.getItem("plano-do-milhao-v6")).toBeNull();
    expect(localStorage.getItem("plano-do-milhao-app-v7")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });

  it("clears only the requested user namespace plus global legacy keys", () => {
    localStorage.setItem(scopedStorageKey("plano-do-milhao-v6", "user-a") as string, "A");
    localStorage.setItem(scopedStorageKey("plano-do-milhao-v6", "user-b") as string, "B");
    localStorage.setItem("plano-do-milhao-v5", "legacy");
    localStorage.setItem(LOCAL_CACHE_OWNER_KEY, "user-a");

    const removed = clearProductLocalCache("user-a");
    expect(removed).toEqual(expect.arrayContaining([
      scopedStorageKey("plano-do-milhao-v6", "user-a") as string,
      "plano-do-milhao-v5",
    ]));
    expect(localStorage.getItem(scopedStorageKey("plano-do-milhao-v6", "user-b") as string)).toBe("B");
    expect(localStorage.getItem(LOCAL_CACHE_OWNER_KEY)).toBeNull();
  });
});
