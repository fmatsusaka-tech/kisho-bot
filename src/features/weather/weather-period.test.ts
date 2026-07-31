import { describe, expect, it } from "vitest";
import {
  buildAccumulatedTemperatureSeries,
  filterWeatherPeriod,
  summarizeWeather,
} from "./weather-period";
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
  it("30日は末尾30件を選ぶ", () => {
    const longRows = Array.from({ length: 35 }, (_, index) =>
      row(`2026-01-${String(index + 1).padStart(2, "0")}`, 10, 12, 8, 0),
    );
    expect(filterWeatherPeriod(longRows, "30days", "", "")).toHaveLength(30);
    expect(filterWeatherPeriod(longRows, "30days", "", "")[0].date)
      .toBe("2026-01-06");
  });

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

describe("accumulated temperature", () => {
  it.each([
    [3, [3, 3, 9]],
    [5, [1, 1, 5]],
    [8, [0, 0, 1]],
  ] as const)("基準温度%d度の累積系列を作る", (base, expected) => {
    expect(buildAccumulatedTemperatureSeries(rows.slice(1), base))
      .toEqual(expected);
  });

  it("欠測を0℃として減算せず、欠測日数を分ける", () => {
    expect(summarizeWeather(rows.slice(1), 5)).toMatchObject({
      accumulatedTemperature: 5,
      temperatureObservedDays: 2,
      temperatureMissingDays: 1,
    });
  });
});
