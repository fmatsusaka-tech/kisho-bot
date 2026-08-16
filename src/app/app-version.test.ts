import { describe, expect, it } from "vitest";
import { APP_VERSION } from "./app-version";

describe("APP_VERSION", () => {
  it("今回の公開バージョンを2.03として表示する", () => {
    expect(APP_VERSION).toBe("2.03");
  });
});
