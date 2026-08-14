import { describe, expect, it } from "vitest";
import { splitComparisonYears } from "./weather-comparison-years";

describe("splitComparisonYears", () => {
  it("2020年以降と2019年以前を分ける", () => {
    expect(splitComparisonYears(["2026", "2020", "2019", "1976"])).toEqual({
      recent: ["2026", "2020"],
      historical: ["2019", "1976"],
    });
  });
});
