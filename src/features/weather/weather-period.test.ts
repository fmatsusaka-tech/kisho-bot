import { describe, expect, it } from "vitest";
import { filterWeatherPeriod, summarizeWeather } from "./weather-period";
import type { WeatherRecord } from "./weather-data";

const row = (
  date: string,
  meanTemp: number | null,
  maxTemp: number | null,
  minTemp: number | null,
  yuasaRain: number | null,
): WeatherRecord => ({
  date, meanTemp, maxTemp, minTemp, yuasaRain,
  meanTemp15: null, meanTemp30: null, yuasaRain15: null,
  yuasaRain30: null, kawabeRain: null,
});

const rows = [
  row("2025-12-31", 5, 8, 2, 1),
  row("2026-01-01", 6, 10, 1, 0),
  row("2026-01-02", null, 12, -1, null),
  row("2026-01-03", 9, 13, 3, 5),
];

describe("filterWeatherPeriod", () => {
  it("今年は最新データが属する年を選ぶ", () => {
    expect(filterWeatherPeriod(rows, "year", "", "").map((item) => item.date))
      .toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
  });

  it("開始日と終了日を含む指定期間を選ぶ", () => {
    expect(filterWeatherPeriod(rows, "custom", "2026-01-02", "2026-01-03"))
      .toHaveLength(2);
  });

  it("開始日が終了日より後なら空にする", () => {
    expect(filterWeatherPeriod(rows, "custom", "2026-01-03", "2026-01-01"))
      .toEqual([]);
  });
});

describe("summarizeWeather", () => {
  it("欠測を0扱いせず期間集計する", () => {
    expect(summarizeWeather(rows.slice(1))).toEqual({
      days: 3,
      rainTotal: 5,
      rainDays: 1,
      rainMaximum: 5,
      meanTemperature: 7.5,
      maximumTemperature: 13,
      minimumTemperature: -1,
    });
  });
});
