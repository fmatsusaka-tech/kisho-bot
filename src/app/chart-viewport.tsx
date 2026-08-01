"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

const MIN_ZOOM = 0.5;
const INITIAL_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.5;

export default function ChartViewport({ children, legend }: { children: ReactNode; legend?: ReactNode }) {
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [axisOverlay, setAxisOverlay] = useState({ width: 0, height: 0, clipWidth: 58 });
  const viewerRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const scale = scaleRef.current;
    if (!scale) return;
    const update = () => {
      const chart = scale.querySelector("svg");
      setAxisOverlay({
        width: scale.offsetWidth,
        height: chart?.getBoundingClientRect().height ?? 0,
        clipWidth: Number(chart?.getAttribute("data-axis-width")) || 58,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scale);
    return () => observer.disconnect();
  }, [zoom]);

  const changeZoom = (amount: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
  };
  const openChartWindow = () => {
    const chart = viewerRef.current?.querySelector(".chart-scale svg");
    const legendMarkup = viewerRef.current?.querySelector(".chart-legend")?.outerHTML ?? "";
    const popup = window.open("", "_blank");
    if (!chart || !popup) {
      setPopupBlocked(true);
      return;
    }
    const popupAxisWidth = Number(chart.getAttribute("data-axis-width")) || 58;
    setPopupBlocked(false);
    popup.document.open();
    popup.document.write(`<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes">
<title>気象データBot・グラフ</title>
<style>
:root{--chart-red:#e11d48;--chart-blue:#2563eb;--chart-green:#16a34a;--navy:#12304a}
*{box-sizing:border-box}body{margin:0;padding:16px;background:#fff;color:var(--navy);font-family:system-ui,-apple-system,sans-serif}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
h1{margin:0;font-size:1rem}button{min-height:42px;border:0;border-radius:10px;padding:0 15px;background:var(--navy);color:#fff;font:inherit;font-weight:800}
.chart-legend{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:10px;font-size:.8rem;font-weight:800}
.chart-legend span{display:inline-flex;align-items:center;gap:7px}.chart-legend i{width:26px;border-top-width:3px}
.scroll{position:relative;overflow:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch}
.chart-frame{width:max(calc(100vw - 32px),720px)}.chart-frame.all{width:max(calc(100vw - 32px),860px)}
.axis-sticky{position:sticky;left:0;z-index:3;float:left;overflow:hidden;margin-right:-${popupAxisWidth}px;background:#fff;box-shadow:8px 0 12px -12px #12304a}
svg{display:block;width:100%;height:auto}
.grid-line{stroke:#c6eaf2;stroke-width:1}.grid-line.vertical{stroke-dasharray:3 5}
.axis-line{stroke:var(--navy);stroke-width:1.25}.tick-label,.axis-unit{fill:#36566d;font-family:inherit;font-size:11px;font-weight:700}
.axis-unit{font-size:12px;font-weight:900}p{font-size:.75rem;font-weight:700}
</style></head><body>
<header><h1>気象データBot・グラフ</h1><button onclick="window.close()">閉じる</button></header>
${legendMarkup}<div class="scroll"><div class="axis-sticky" style="width:${popupAxisWidth}px"><div class="chart-frame${chart.classList.contains("all-weather-axis") ? " all" : ""}">${chart.outerHTML}</div></div><div class="chart-frame${chart.classList.contains("all-weather-axis") ? " all" : ""}">${chart.outerHTML}</div></div>
<p>ピンチ操作で拡大・縮小できます。横に動かしても縦目盛は左端に固定されます。</p>
</body></html>`);
    popup.document.close();
    popup.opener = null;
  };

  return <div className="chart-viewer" ref={viewerRef}>
    <div className="chart-toolbar"><span>グラフ操作</span><div>
      <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom === MIN_ZOOM} aria-label="縮小">−</button>
      <output aria-live="polite">{zoom.toFixed(1)}倍</output>
      <button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom === MAX_ZOOM} aria-label="拡大">＋</button>
      <button type="button" className="expand-button" onClick={openChartWindow}>別画面で開く</button>
    </div></div>
    {popupBlocked && <p className="popup-error" role="alert">別画面を開けませんでした。ブラウザのポップアップを許可してください。</p>}
    {legend}
    <div className="chart-scroll" tabIndex={0} aria-label="拡大したグラフは横にスクロールできます">
      {axisOverlay.height > 0 && <div className="chart-axis-sticky" aria-hidden="true" style={{ width: axisOverlay.clipWidth, height: axisOverlay.height, marginBottom: -axisOverlay.height }}>
        <div className="chart-axis-copy" style={{ width: axisOverlay.width }}>{children}</div>
      </div>}
      <div className="chart-scale" ref={scaleRef} style={{ width: `${zoom * 100}%` }}>{children}</div>
    </div>
    <p className="chart-help">0.5倍まで縮小、最大5倍まで拡大できます。横に動かしても縦目盛は左端に固定されます。</p>
  </div>;
}
