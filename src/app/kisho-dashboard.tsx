"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseWeatherCsv, validateWeather, WEATHER_CSV_URL,
  WEATHER_SPREADSHEET_URL, type WeatherRecord,
} from "@/features/weather/weather-data";
import {
  buildAccumulatedTemperatureSeries, filterWeatherPeriod, summarizeWeather,
  type BaseTemperature, type WeatherMetric, type WeatherView,
} from "@/features/weather/weather-period";
import TemperatureComparisonChart from "./temperature-comparison-chart";
import {
  temperatureLabel,
  temperatureValue,
  type TemperatureKind,
} from "@/features/weather/weather-temperature";

const show = (value: number | null) => value === null ? "—" : value.toFixed(1);
const dateLabel = (date: string) => {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
};

function AxisChart({ rows, metric, baseTemperature, temperatureKind, label }: {
  rows: WeatherRecord[];
  metric: WeatherMetric;
  baseTemperature: BaseTemperature;
  temperatureKind: TemperatureKind;
  label: string;
}) {
  const values = metric === "rainfall"
    ? rows.map((row) => row.yuasaRain)
    : metric === "temperature"
      ? rows.map((row) => temperatureValue(row, temperatureKind))
      : buildAccumulatedTemperatureSeries(rows, baseTemperature);
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length < 2) return <p className="empty">表示できるデータがありません。</p>;

  const width = 720, height = 290, left = 64, right = 18, top = 24, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const dataMin = metric === "temperature" ? Math.min(...valid) : 0;
  const dataMax = Math.max(...valid);
  const padding = Math.max((dataMax - dataMin) * .08, 1);
  const min = metric === "temperature" ? Math.floor(dataMin - padding) : 0;
  const max = Math.ceil(dataMax + padding);
  const span = Math.max(max - min, 1);
  const x = (index: number) => left + index / Math.max(values.length - 1, 1) * plotWidth;
  const y = (value: number) => top + (max - value) / span * plotHeight;
  const points = values.flatMap((value, index) =>
    value === null ? [] : [`${x(index)},${y(value)}`],
  ).join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => max - span * index / 4);
  const xIndexes = [...new Set(Array.from({ length: 5 }, (_, index) =>
    Math.round((values.length - 1) * index / 4),
  ))];
  const unit = metric === "rainfall" ? "mm" : metric === "temperature" ? "℃" : "℃・日";
  const color = metric === "rainfall" ? "var(--aqua)" : "var(--navy)";

  return <svg className="axis-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
    <text x={left} y="13" className="axis-unit">{unit}</text>
    {yTicks.map((tick) => <g key={tick}>
      <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} className="grid-line" />
      <text x={left - 9} y={y(tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(metric === "temperature" ? 1 : 0)}</text>
    </g>)}
    {xIndexes.map((index) => <g key={index}>
      <line x1={x(index)} y1={top} x2={x(index)} y2={height - bottom} className="grid-line vertical" />
      <text x={x(index)} y={height - 17} textAnchor="middle" className="tick-label">{dateLabel(rows[index].date)}</text>
    </g>)}
    <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="axis-line" />
    <line x1={left} y1={top} x2={left} y2={height - bottom} className="axis-line" />
    <polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
  </svg>;
}

export default function KishoDashboard() {
  const [rows, setRows] = useState<WeatherRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [view, setView] = useState<WeatherView>("30days");
  const [metric, setMetric] = useState<WeatherMetric>("rainfall");
  const [baseTemperature, setBaseTemperature] = useState<BaseTemperature>(5);
  const [temperatureKind, setTemperatureKind] = useState<TemperatureKind>("mean");
  const [comparisonYears, setComparisonYears] = useState<string[]>([]);
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
      const latestDate = data.at(-1)?.date ?? "";
      const initialStart = new Date(`${latestDate}T00:00:00`);
      initialStart.setDate(initialStart.getDate() - 29);
      setStartDate(initialStart.toISOString().slice(0, 10));
      setEndDate(latestDate);
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "不明なエラー");
      setStatus("error");
    }
  };

  useEffect(() => { void load(); }, []);
  const latest = rows.at(-1);
  const currentYear = latest?.date.slice(0, 4) ?? "";
  const availableComparisonYears = [...new Set(rows.map((row) => row.date.slice(0, 4)))]
    .filter((year) => year !== currentYear)
    .sort((left, right) => right.localeCompare(left));
  const toggleComparisonYear = (year: string) => {
    setComparisonYears((selectedYears) =>
      selectedYears.includes(year)
        ? selectedYears.filter((item) => item !== year)
        : selectedYears.length < 2
          ? [...selectedYears, year]
          : selectedYears,
    );
  };
  const selected = useMemo(
    () => filterWeatherPeriod(rows, view, startDate, endDate),
    [rows, view, startDate, endDate],
  );
  const summary = useMemo(
    () => summarizeWeather(selected, baseTemperature),
    [selected, baseTemperature],
  );
  const accumulatedSeries = useMemo(
    () => buildAccumulatedTemperatureSeries(selected, baseTemperature),
    [selected, baseTemperature],
  );
  const issues = useMemo(() => validateWeather(rows), [rows]);
  const invalidPeriod = view === "custom" && Boolean(startDate && endDate && startDate > endDate);
  const periodLabel = view === "30days"
    ? "直近30日"
    : view === "year"
      ? `${latest?.date.slice(0, 4) ?? ""}年`
      : `${startDate.replaceAll("-", "/")}〜${endDate.replaceAll("-", "/")}`;
  const metricLabel = metric === "rainfall" ? "降水量" : metric === "temperature" ? temperatureLabel(temperatureKind) : "積算温度";
  const selectedTemperature = temperatureKind === "maximum"
    ? summary.maximumTemperature
    : temperatureKind === "minimum"
      ? summary.minimumTemperature
      : summary.meanTemperature;

  return <main className="kisho-shell">
    <header className="kisho-header">
      <div><p className="eyebrow">KISHO BOT · WAKAYAMA</p><h1>気象データBot</h1>
        <p>期間と表示情報を選び、湯浅の雨と川辺の気温を確認できます。</p></div>
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
          <button className={view === "30days" ? "active" : ""} onClick={() => setView("30days")}>30日</button>
          <button className={view === "custom" ? "active" : ""} onClick={() => setView("custom")}>指定期間</button>
          <button className={view === "year" ? "active" : ""} onClick={() => setView("year")}>今年</button>
        </div></div>
        {view === "custom" && <div className="date-fields">
          <label>開始日<input type="date" min={rows[0]?.date} max={endDate || latest.date} value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
          <span>〜</span>
          <label>終了日<input type="date" min={startDate || rows[0]?.date} max={latest.date} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>}
        <div className="control-group"><span>表示情報</span><div className="segmented compact">
          <button className={metric === "rainfall" ? "active" : ""} onClick={() => setMetric("rainfall")}>降水量</button>
          <button className={metric === "temperature" ? "active" : ""} onClick={() => setMetric("temperature")}>気温</button>
          <button className={metric === "accumulated" ? "active" : ""} onClick={() => setMetric("accumulated")}>積算温度</button>
        </div></div>
        {metric === "temperature" && <div className="control-group"><span>気温の種類</span><div className="segmented compact">
          <button className={temperatureKind === "maximum" ? "active" : ""} onClick={() => setTemperatureKind("maximum")}>最高気温</button>
          <button className={temperatureKind === "mean" ? "active" : ""} onClick={() => setTemperatureKind("mean")}>平均気温</button>
          <button className={temperatureKind === "minimum" ? "active" : ""} onClick={() => setTemperatureKind("minimum")}>最低気温</button>
        </div></div>}
        {view === "year" && metric === "temperature" && <div className="control-group"><span>比較年（2つまで）</span><div className="year-options">
          {availableComparisonYears.map((year) => <label key={year} className={comparisonYears.includes(year) ? "selected" : ""}>
            <input type="checkbox" checked={comparisonYears.includes(year)} disabled={!comparisonYears.includes(year) && comparisonYears.length >= 2} onChange={() => toggleComparisonYear(year)} />
            {year}年
          </label>)}
        </div></div>}
        {metric === "accumulated" && <div className="control-group"><span>積算温度の基準温度</span><div className="segmented compact">
          {([3, 5, 8] as const).map((temperature) => <button key={temperature} className={baseTemperature === temperature ? "active" : ""} onClick={() => setBaseTemperature(temperature)}>{temperature}℃</button>)}
        </div><p className="formula-note">Σ max（日平均気温 − 基準温度, 0）</p></div>}
        {invalidPeriod && <p className="period-error">開始日は終了日以前にしてください。</p>}
      </section>

      {!invalidPeriod && selected.length > 0 ? <>
        <section className="cards single">
          {metric === "rainfall" && <article className="card rain"><p>湯浅 · {periodLabel}</p><h2>期間降水量</h2><strong>{show(summary.rainTotal)}<small>mm</small></strong>
            <dl><div><dt>降雨日数</dt><dd>{summary.rainDays} 日</dd></div><div><dt>日最大降水量</dt><dd>{show(summary.rainMaximum)} mm</dd></div></dl></article>}
          {metric === "temperature" && <article className="card warm"><p>川辺 · {periodLabel}</p><h2>期間{temperatureLabel(temperatureKind)}</h2><strong>{show(selectedTemperature)}<small>℃</small></strong>
            <dl><div><dt>期間平均気温</dt><dd>{show(summary.meanTemperature)} ℃</dd></div><div><dt>期間最高 / 最低</dt><dd>{show(summary.maximumTemperature)} / {show(summary.minimumTemperature)} ℃</dd></div></dl></article>}
          {metric === "accumulated" && <article className="card warm"><p>川辺 · {periodLabel} · 基準{baseTemperature}℃</p><h2>有効積算温度</h2><strong>{show(summary.accumulatedTemperature)}<small>℃・日</small></strong>
            <dl><div><dt>気温観測日</dt><dd>{summary.temperatureObservedDays} 日</dd></div><div><dt>気温欠測日</dt><dd>{summary.temperatureMissingDays} 日</dd></div></dl></article>}
        </section>

        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">WEATHER TREND</p><h2>{periodLabel}の{metricLabel}</h2></div><span>{summary.days.toLocaleString("ja-JP")}日分</span></div>
          <div className="charts single"><article>
            {view === "year" && metric === "temperature"
              ? <TemperatureComparisonChart allRows={rows} currentRows={selected} currentYear={currentYear} comparisonYears={comparisonYears} kind={temperatureKind} />
              : <AxisChart rows={selected} metric={metric} baseTemperature={baseTemperature} temperatureKind={temperatureKind} label={`${periodLabel}の${metricLabel}`} />}
          </article></div>
        </section>

        <section className="panel">
          <div className="section-title"><div><p className="eyebrow">OBSERVATIONS</p><h2>観測データ</h2></div><span>{selected.length.toLocaleString("ja-JP")}日分</span></div>
          <div className="table-wrap"><table><thead><tr><th>日付</th>
            {metric === "rainfall" && <><th>湯浅 降水量</th><th>川辺 降水量</th></>}
            {metric === "temperature" && <th>川辺 {temperatureLabel(temperatureKind)}</th>}
            {metric === "accumulated" && <><th>川辺 平均</th><th>積算温度</th></>}
          </tr></thead><tbody>{selected.map((row, index) => ({ row, accumulated: accumulatedSeries[index] })).reverse().map(({ row, accumulated }) => <tr key={row.date}><th>{row.date.replaceAll("-", "/")}</th>
            {metric === "rainfall" && <><td>{show(row.yuasaRain)} mm</td><td>{show(row.kawabeRain)} mm</td></>}
            {metric === "temperature" && <td>{show(temperatureValue(row, temperatureKind))} ℃</td>}
            {metric === "accumulated" && <><td>{show(row.meanTemp)} ℃</td><td>{show(accumulated)} ℃・日</td></>}
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
