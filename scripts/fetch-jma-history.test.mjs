import { describe, expect, it } from "vitest";
import { parseDetailedDailyAmedasHtml, STATIONS } from "./fetch-jma-history.mjs";

const row = (cells) => `<table id="tablefix1"><tr class="mtx">${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr></table>`;

describe("historical JMA parser", () => {
  it("詳細日別表の降水量と気温を取得する", () => {
    const records = parseDetailedDailyAmedasHtml(row(["1", "0.0", "", "", "", "", "24.6", "30.7", "", "22.6"]), 1976, 1, STATIONS.ebina);
    expect(records[0]).toEqual({ date: "1976-01-01", meanTemp: 24.6, maxTemp: 30.7, minTemp: 22.6, rainfall: 0 });
  });

  it("湯浅の気温は取得せず、欠測をnullにする", () => {
    const records = parseDetailedDailyAmedasHtml(row(["2", "///", "", "", "", "", "10", "12", "", "8"]), 1976, 1, STATIONS.yuasa);
    expect(records[0]).toEqual({ date: "1976-01-02", meanTemp: null, maxTemp: null, minTemp: null, rainfall: null });
  });
});
