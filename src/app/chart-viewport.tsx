"use client";

import { useEffect, useState, type ReactNode } from "react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.5;

export default function ChartViewport({
  children,
  legend,
}: {
  children: ReactNode;
  legend?: ReactNode;
}) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.body.classList.add("chart-modal-open");
    window.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("chart-modal-open");
      window.removeEventListener("keydown", close);
    };
  }, [expanded]);

  const changeZoom = (amount: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
  };

  return <div className={expanded ? "chart-viewer expanded" : "chart-viewer"}>
    <div className="chart-toolbar">
      <span>グラフ操作</span>
      <div>
        <button type="button" onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom === MIN_ZOOM} aria-label="縮小">−</button>
        <output aria-live="polite">{zoom.toFixed(1)}倍</output>
        <button type="button" onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom === MAX_ZOOM} aria-label="拡大">＋</button>
        <button type="button" className="expand-button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "閉じる" : "全画面"}
        </button>
      </div>
    </div>
    {legend}
    <div className="chart-scroll" tabIndex={0} aria-label="拡大したグラフは横にスクロールできます">
      <div className="chart-scale" style={{ width: `${zoom * 100}%` }}>
        {children}
      </div>
    </div>
    <p className="chart-help">＋で拡大し、グラフを左右に動かせます。</p>
  </div>;
}
