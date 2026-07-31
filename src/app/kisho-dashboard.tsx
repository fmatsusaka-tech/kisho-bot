"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseWeatherCsv, validateWeather, WEATHER_CSV_URL,
  WEATHER_SPREADSHEET_URL, type WeatherRecord,
} from "@/features/weather/weather-data";
import {
  filterWeatherPeriod, summarizeWeather,
  type BaseTemperature, type WeatherMetric, type WeatherView,
} from "@/features/weather/weather-period";

const show = (value: number | null) => value === null ? "—" : value.toFixed(1);

function WeatherChart({ rows, field, color, label }: {
  rows: WeatherRecord[];
  field: "meanTemp" | "yuasaRain";
  color: string;
  label: string;
}) {
  const values = rows.map((row) => row[field]);
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length < 2) return <p className="empty">表示できるデータがありません。</p>;
  const min = Math.min(0, ...valid), max = Math.max(...valid), span = Math.max(1, max - min);
  const points = values.flatMap((value, index) => value === null ? [] : [
    `${index / Math.max(1, values.length - 1) * 100},${38 - (value - min) / span * 34}`,
  ]).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 42" role="img" aria-label={label}>
    <line x1="0" y1="38" x2="100" y2="38" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function KishoDashboard() {
  const [rows, setRows] = useState<WeatherRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<WeatherView>("year");
  const [metric, setMetric] = useState<WeatherMetric>("all");
  const [baseTemperature, setBaseTemperature] = useState<BaseTemperature>(5);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const load = async () => {
    setStatus("loading");
    try {
      const response = await fetch(WEATHER_CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = parseWeatherCsv(await response.text());
      if (!data.length) throw new Error("有効な観測データがありません。");
      setRows(data);
      const latest = data.at(-1)?.date ?? "";
      const thirtyDaysAgo = new Date(`${latest}T00:00:00`);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));
      setEndDate(latest);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "不明なエラー");
      setStatus("error");
    }
  };

  useEffect(() => { void load(); }, []);
  const latest = rows.at(-1);
  const selected = useMemo(
    () => filterWeatherPeriod(rows, view, startDate, endDate),
    [rows, view, startDate, endDate],
  );
  const summary = useMemo(
    () => summarizeWeather(selected, baseTemperature),
    [selected, baseTemperature],
  );
  const issues = useMemo(() => validateWeather(rows), [rows]);
  const invalidPeriod = view === "custom" && Boolean(startDate && endDate && startDate > endDate);
  const showTemperature = metric !== "rainfall";
  const showRainfall = metric !== "temperature";
  const periodLabel = view === "year"
    ? `${latest?.date.slice(0, 4) ?? ""}年`
    : `${startDate.replaceAll("-", "/")}〜${endDate.replaceAll("-", "/")}`;

  return <main className="kisho-shell">
    <header className="kisho-header">
      <div><p className="eyebrow">KISHO BOT · WAKAYAMA</p><h1>気象データBot</h1>
        <p>湯浅の雨と、川辺の気温。期間と表示情報を選んで確認できます。</p></div>
      <span className={`state ${status}`}>{status === "loading" ? "読込中" : status === "ready" ? "更新済み" : "取得失敗"}</span>
    </header>

    {status === "error" && <section className="error-box"><strong>気象データを取得できませんでした</strong>
      <p>{error}</p><button onClick={() => void load()}>もう一度読み込む</button></section>}

    {latest && <>
      <section className="latest">
        <div><span>最新観測日</span><strong>{latest.date.replaceAll("-", "/")}</strong></div>
        <div><span>川辺 平均気温</span><strong>{show(latest.meanTemp)}<small>℃</small></strong></div>
        <div><span>湯浅 降水量</span><strong>{show(latest.yuasaRain)}<small>mm</small></strong></div>
      </section>

      <section className="controls panel">
        <div className="control-group"><span>期間</span><div className="segmented">
          <button className={view === "year" ? "active" : ""} onClick={() => setView("year")}>今年の気象データ</button>
          <button className={view === "custom" ? "active" : ""} onClick={() => setView("custom")}>指定期間の気象データ</button>
        </div></div>
        {view === "custom" && <div className="date-fields">
          <label>開始日<input type="date" min={rows[0]?.date} max={endDate || latest.date} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <span>〜</span>
          <label>終了日<input type="date" min={startDate || rows[0]?.date} max={latest.date} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>}
        <div className="control-group"><span>表示情報</span><div className="segmented compact">
          <button className={metric === "all" ? "active" : ""} onClick={() => setMetric("all")}>気温と降水量</button>
          <button className={metric === "temperature" ? "active" : ""} onClick={() => setMetric("temperature")}>気温</button>
          <button className={metric === "rainfall" ? "active" : ""} onClick={() => setMetric("rainfall")}>降水量</button>
        </div></div>
        {showTemperature && <div className="control-group"><span>積算温度の基準温度</span><div className="segmented compact">
          {([3, 5, 8] as const).map((temperature) => <button key={temperature} className={baseTemperature === temperature ? "active" : ""} onClick={() => setBaseTemperature(temperature)}>{temperature}℃</button>)}
        </div><p className="formula-note">日平均気温から基準温度を引き、0を下回る日は加算しません。</p></div>}
        {invalidPeriod && <p className="period-error">開始日は終了日以前にしてください。</p>}
      </section>

      {!invalidPeriod && selected.length > 0 ? <>
        <section className={`cards ${metric !== "all" ? "single" : ""}`}>
          {showTemperature && <article className="card warm"><p>川辺 · {periodLabel}</p><h2>期間平均気温</h2><strong>{show(summary.meanTemperature)}<small>℃</small></strong>
            <dl><div><dt>有効積算温度（基準{baseTemperature}℃）</dt><dd>{show(summary.accumulatedTemperature)} ℃・日</dd></div><div><dt>期間最高気温</dt><dd>{show(summary.maximumTemperature)} ℃</dd></div><div><dt>期間最低気温</dt><dd>{show(summary.minimumTemperature)} ℃</dd></div>{summary.temperatureMissingDays > 0 && <div><dt>気温欠測日</dt><dd>{summary.temperatureMissingDays} 日</dd></div>}</dl></article>}
          {showRainfall && <article className="card rain"><p>湯浅 · {periodLabel}</p><h2>期間降水量</h2><strong>{show(summary.rainTotal)}<small>mm</small></strong>
            <dl><div><dt>降雨日数</dt><dd>{summary.rainDays} 日</dd></div><div><dt>日最大降水量</dt><dd>{show(summary.rainMaximum)} mm</dd></div></dl></article>}
        </section>

        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">WEATHER TREND</p><h2>{periodLabel}の推移</h2></div><span>{summary.days.toLocaleString("ja-JP")}日分</span></div>
          <div className={`charts ${metric !== "all" ? "single" : ""}`}>
            {showTemperature && <article><h3>川辺 平均気温</h3><b>{show(summary.meanTemperature)} ℃ 平均</b><WeatherChart rows={selected} field="meanTemp" color="var(--navy)" label={`${periodLabel}の川辺平均気温`} /></article>}
            {showRainfall && <article><h3>湯浅 降水量</h3><b>{show(summary.rainTotal)} mm 合計</b><WeatherChart rows={selected} field="yuasaRain" color="var(--aqua)" label={`${periodLabel}の湯浅降水量`} /></article>}
          </div>
        </section>

        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">OBSERVATIONS</p><h2>観測データ</h2></div><span>{selected.length.toLocaleString("ja-JP")}日分</span></div>
          <div className="table-wrap"><table><thead><tr><th>日付</th>
            {showTemperature && <><th>川辺 平均</th><th>最高</th><th>最低</th></>}
            {showRainfall && <><th>湯浅 雨</th><th>川辺 雨</th></>}
          </tr></thead><tbody>{selected.slice().reverse().map((row) => <tr key={row.date}><th>{row.date.replaceAll("-", "/")}</th>
            {showTemperature && <><td>{show(row.meanTemp)} ℃</td><td>{show(row.maxTemp)} ℃</td><td>{show(row.minTemp)} ℃</td></>}
            {showRainfall && <><td>{show(row.yuasaRain)} mm</td><td>{show(row.kawabeRain)} mm</td></>}
          </tr>)}</tbody></table></div>
        </section>
      </> : !invalidPeriod && <section className="panel empty">選択した期間のデータがありません。</section>}

      <section className="health"><div><p className="eyebrow">DATA HEALTH</p><h2>{issues.length ? `${issues.length}件の確認事項` : "基本チェックは正常です"}</h2>
        <p>欠測は0に置き換えず「—」で表示します。毎朝、直近3日を再取得して気象庁の訂正を反映します。</p></div>
        <a href={WEATHER_SPREADSHEET_URL} target="_blank" rel="noreferrer">元データを開く ↗</a></section>
    </>}
    <footer><span>観測地点：気象庁アメダス 川辺・湯浅</span><span>データ期間：2015年以降（順次整備）</span></footer>
  </main>;
}
