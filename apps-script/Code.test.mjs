import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const context = vm.createContext({
  console,
  Set,
  Date,
  Math,
  Number,
  Object,
  String,
  Array,
  JSON,
  encodeURIComponent,
});
vm.runInContext(readFileSync(new URL("./Code.js", import.meta.url), "utf8"), context);

const run = (source) => vm.runInContext(source, context);

describe("Apps Script weather stations", () => {
  it("海老名は神奈川県の地点番号を使う", () => {
    expect(run("WEATHER_CONFIG.STATIONS.EBINA.precNo")).toBe("46");
    expect(run("WEATHER_CONFIG.STATIONS.EBINA.blockNo")).toBe("0388");
    expect(run("buildJmaDailyUrl_('46', '0388', 2026, 8)")).toContain(
      "prec_no=46&block_no=0388&year=2026&month=8",
    );
  });

  it("地点・観測項目ごとの最古日を保持する", () => {
    expect(run("WEATHER_CONFIG.HISTORICAL_START_DATE")).toBe("1976-01-01");
    expect(run("WEATHER_CONFIG.STATIONS.YUASA.startDate")).toBe("1976-01-01");
    expect(run("WEATHER_CONFIG.STATIONS.EBINA.startDate")).toBe("1976-01-01");
    expect(run("WEATHER_CONFIG.STATIONS.EBINA.temperatureStartDate")).toBe("1978-01-17");
    expect(run("WEATHER_CONFIG.STATIONS.KAWABE.startDate")).toBe("1999-03-04");
    expect(run("WEATHER_CONFIG.HISTORICAL_CHUNK_YEARS")).toBe(12);
  });

  it("詳細日別表から降水量と平均・最高・最低気温を読む", () => {
    const cells = ["1", "18.5", "9.0", "12:00", "4.0", "12:00", "24.6", "30.7", "14:00", "22.6"];
    const html = `<table id="tablefix1"><tr class="mtx">${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr></table>`;
    context.fixtureHtml = html;
    const record = run("parseJmaDailyTable_(fixtureHtml, 2026, 8, WEATHER_CONFIG.STATIONS.EBINA)[0]");
    expect(record.rainfall).toBe(18.5);
    expect(record.averageTemperature).toBe(24.6);
    expect(record.maximumTemperature).toBe(30.7);
    expect(record.minimumTemperature).toBe(22.6);
  });

  it("欠測記号を0に変換しない", () => {
    expect(run("parseJmaNumericValue_('///')")).toBeNull();
    expect(run("parseJmaNumericValue_('0.0')")).toBe(0);
  });
});
