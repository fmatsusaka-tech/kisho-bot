"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseWeatherCsv,
  validateWeather,
  WEATHER_CSV_URL,
  WEATHER_SPREADSHEET_URL,
  type WeatherRecord,
} from "@/features/weather/weather-data";

const show = (value: number | null) => value === null ? "—" : value.toFixed(1);

function Sparkline({ rows, field, color }: {
  rows: WeatherRecord[];
  field: "meanTemp" | "yuasaRain";
  color: string;
}) {
  const values = rows.map((row) => row[field]);
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length < 2) return <p>表示できるデータがありません。</p>;
  const min = Math.min(0, ...valid), max = Math.max(...valid), span = Math.max(1, max - min);
  const points = values.flatMap((value, index) => value === null ? [] : [
    `${index / Math.max(1, values.length - 1) * 100},${38 - (value - min) / span * 34}`,
  ]).join(" ");
  return <svg className="sparkline" viewBox="0 0 100 42" role="img" aria-label="直近30日の推移">
    <line x1="0" y1="38" x2="100" y2="38" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function KishoDashboard() {
  const [rows, setRows] = useState<WeatherRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = async () => {
    setStatus("loading");
    try {
      const response = await fetch(WEATHER_CSV_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = parseWeatherCsv(await response.text());
      if (!data.length) throw new Error("有効な観測データがありません。");
      setRows(data);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "不明なエラー");
      setStatus("error");
    }
  };

  useEffect(() => { void load(); }, []);
  const latest = rows.at(-1);
  const recent = rows.slice(-30);
  const issues = useMemo(() => validateWeather(rows), [rows]);

  return <main className="kisho-shell">
    <header className="kisho-header">
      <div>
        <p className="eyebrow">KISHO BOT · WAKAYAMA</p>
        <h1>みかん畑の気象</h1>
        <p>湯浅の雨と、川辺の気温。畑を見るための気象記録です。</p>
      </div>
      <span className={`state ${status}`}>{status === "loading" ? "読込中" : status === "ready" ? "更新済み" : "取得失敗"}</span>
    </header>

    {status === "error" && <section className="error-box">
      <strong>気象データを取得できませんでした</strong><p>{error}</p>
      <button onClick={() => void load()}>もう一度読み込む</button>
    </section>}

    {latest && <>
      <section className="latest">
        <div><span>最新観測日</span><strong>{latest.date.replaceAll("-", "/")}</strong></div>
        <div><span>川辺 平均気温</span><strong>{show(latest.meanTemp)}<small>℃</small></strong></div>
        <div><span>湯浅 降水量</span><strong>{show(latest.yuasaRain)}<small>mm</small></strong></div>
      </section>

      <section className="cards">
        <article className="card warm"><p>川辺 · 気温</p><h2>15日平均</h2><strong>{show(latest.meanTemp15)}<small>℃</small></strong>
          <dl><div><dt>30日平均</dt><dd>{show(latest.meanTemp30)} ℃</dd></div><div><dt>当日の最高 / 最低</dt><dd>{show(latest.maxTemp)} / {show(latest.minTemp)} ℃</dd></div></dl>
        </article>
        <article className="card rain"><p>湯浅 · 雨</p><h2>15日積算</h2><strong>{show(latest.yuasaRain15)}<small>mm</small></strong>
          <dl><div><dt>30日積算</dt><dd>{show(latest.yuasaRain30)} mm</dd></div><div><dt>当日</dt><dd>{show(latest.yuasaRain)} mm</dd></div></dl>
        </article>
      </section>

      <section className="panel">
        <div className="section-title"><div><p className="eyebrow">LAST 30 DAYS</p><h2>最近の推移</h2></div><span>直近30日</span></div>
        <div className="charts">
          <article><h3>川辺 平均気温</h3><b>{show(latest.meanTemp)} ℃</b><Sparkline rows={recent} field="meanTemp" color="#dc6838" /></article>
          <article><h3>湯浅 降水量</h3><b>{show(latest.yuasaRain)} mm</b><Sparkline rows={recent} field="yuasaRain" color="#287ca5" /></article>
        </div>
      </section>

      <section className="panel">
        <div className="section-title"><div><p className="eyebrow">OBSERVATIONS</p><h2>直近の観測</h2></div><span>{rows.length.toLocaleString("ja-JP")}日分</span></div>
        <div className="table-wrap"><table><thead><tr><th>日付</th><th>川辺 平均</th><th>最高</th><th>最低</th><th>湯浅 雨</th><th>川辺 雨</th></tr></thead>
          <tbody>{rows.slice(-15).reverse().map((row) => <tr key={row.date}><th>{row.date.replaceAll("-", "/")}</th><td>{show(row.meanTemp)} ℃</td><td>{show(row.maxTemp)} ℃</td><td>{show(row.minTemp)} ℃</td><td>{show(row.yuasaRain)} mm</td><td>{show(row.kawabeRain)} mm</td></tr>)}</tbody>
        </table></div>
      </section>

      <section className="health"><div><p className="eyebrow">DATA HEALTH</p><h2>{issues.length ? `${issues.length}件の確認事項` : "基本チェックは正常です"}</h2>
        <p>欠測は0に置き換えず「—」で表示します。毎朝の取得では直近3日を再取得し、気象庁の訂正を反映します。</p></div>
        <a href={WEATHER_SPREADSHEET_URL} target="_blank" rel="noreferrer">元データを開く ↗</a>
      </section>
    </>}
    <footer><span>観測地点：気象庁アメダス 川辺・湯浅</span><span>データ期間：2015年以降（順次整備）</span></footer>
  </main>;
}
