import { describe, expect, it } from "vitest";
import { parseWeatherCsv, rainfallValue, validateWeather } from "./weather-data";

const header = "年月日,降水量（湯浅）,平均気温（川辺）,最高気温（川辺）,最低気温（川辺）,日較差（川辺）,15日平均気温（川辺）,30日平均気温（川辺）,15日積算降水量（湯浅）,30日積算降水量（湯浅）,降水量（川辺・比較用）,降水量（海老名）,平均気温（海老名）,最高気温（海老名）,最低気温（海老名）";

describe("weather data", () => {
  it("欠測を0にせず日付順で読む", () => {
    const rows = parseWeatherCsv(`${header}\n2020/1/2,0,7,9,4,5,7,7,10,20,0,1,8,12,3\n2020/1/1,,6,8,3,5,,,,,,,,,`);
    expect(rows.map((row) => row.date)).toEqual(["2020-01-01", "2020-01-02"]);
    expect(rows[0].yuasaRain).toBeNull();
    expect(rows[1].yuasaRain).toBe(0);
  });

  it("列不足を拒否する", () => {
    expect(() => parseWeatherCsv("年月日\n2020/1/1")).toThrow("必要な列");
  });

  it("重複、気温逆転、負の降水量を検出する", () => {
    const row = parseWeatherCsv(`${header}\n2020/1/1,-1,6,3,8,5,,,,,0,0,7,10,2`)[0];
    expect(validateWeather([row, row])).toEqual([
      "2020-01-01: 気温逆転",
      "2020-01-01: 負の降水量",
      "2020-01-01: 重複",
      "2020-01-01: 気温逆転",
      "2020-01-01: 負の降水量",
    ]);
  });

  it("指定した地点の降水量を選ぶ", () => {
    const row = parseWeatherCsv(`${header}\n2020/1/1,12,6,8,3,5,,,,,7,4,9,12,5`)[0];
    expect(rainfallValue(row, "yuasa")).toBe(12);
    expect(rainfallValue(row, "kawabe")).toBe(7);
    expect(rainfallValue(row, "ebina")).toBe(4);
  });
});
