const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { SECTOR_LABELS } = require('./stocks');

const W = 1200;
const H = 500;

const CHART_PRIMARY = '#a1cf3a';
const CHART_GOLD = '#ffd700';
const CHART_GRID = 'rgba(255,255,255,0.08)';
const CHART_TEXT = '#cfd8e3';
const CHART_MUTED = '#9aa7b5';
const BG = '#161a20';

const TICKER_COLORS = [
  '#a1cf3a',
  '#4fc3f7',
  '#ff8a65',
  '#ba68c8',
  '#f06292',
  '#ffd54f',
  '#4dd0e1',
  '#aed581',
  '#7986cb',
  '#e57373',
  '#81c784',
  '#ffb74d',
];

const FONT = (() => {
  const families = GlobalFonts.families.map((f) => f.family.toLowerCase());
  if (families.some((f) => f.includes('segoe ui'))) return 'Segoe UI';
  if (families.some((f) => f.includes('arial'))) return 'Arial';
  if (families.some((f) => f.includes('dejavu'))) return 'DejaVu Sans';
  return 'sans-serif';
})();

function colorForIndex(i) {
  return TICKER_COLORS[i % TICKER_COLORS.length];
}

// "HH:MM" label from a timestamp field.
function timeLabel(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function tickStep(range, targetTicks) {
  if (range <= 0) return 1;
  const rough = range / Math.max(targetTicks, 1);
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / pow;
  let step;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * pow;
}

// Draw axes gridlines, y labels, and x time labels. Returns the plot rect.
function drawCanvas(ctx, opts) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';

  // Title
  ctx.fillStyle = '#e8edf3';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(opts.title, 30, 40);

  // Subtitle
  if (opts.subtitle) {
    ctx.fillStyle = CHART_MUTED;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(opts.subtitle, 32, 64);
  }

  const top = opts.subtitle ? 92 : 64;
  const padL = 90;
  const padR = 30;
  const padB = 44;

  const rect = { x: padL, y: top, w: W - padL - padR, h: H - top - padB };

  // Horizontal gridlines + y labels
  const dataRange = opts.max - opts.min;
  if (dataRange > 0) {
    const step = tickStep(dataRange, 6);
    const first = Math.ceil(opts.min / step) * step;
    for (let v = first; v <= opts.max + 1e-9; v += step) {
      const frac = (v - opts.min) / dataRange;
      const y = rect.y + rect.h - frac * rect.h;
      ctx.strokeStyle = CHART_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
      ctx.fillStyle = CHART_TEXT;
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(opts.formatY(v), rect.x - 10, y + 4);
    }
  }

  // Vertical gridlines + x time labels
  const n = opts.labels ? opts.labels.length : 0;
  if (n > 0) {
    const maxTicks = Math.min(n, 12);
    const s = Math.max(1, Math.floor(n / maxTicks));
    for (let i = 0; i < n; i += s) {
      const x = rect.x + (i / Math.max(n - 1, 1)) * rect.w;
      ctx.strokeStyle = CHART_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
      ctx.stroke();
      ctx.fillStyle = CHART_TEXT;
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(opts.labels[i], x, rect.y + rect.h + 20);
    }
  }

  // Axis border
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);

  return rect;
}

// Plot a single normalized/bounded series as a filled area line.
function plotLine(ctx, rect, series, opts) {
  const color = opts.color;
  const n = series.length;
  if (n === 0) return;

  // Build polygon points in plot space.
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    const x = rect.x + (i / Math.max(n - 1, 1)) * rect.w;
    const frac = (series[i] - opts.min) / (opts.max - opts.min || 1);
    const y = rect.y + rect.h - frac * rect.h;
    xs.push(x);
    ys.push(y);
  }

  // Fill under the line (gradient) if requested.
  if (opts.fill) {
    const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    grad.addColorStop(0, opts.fill.start);
    grad.addColorStop(1, opts.fill.end);
    ctx.beginPath();
    ctx.moveTo(xs[0], rect.y + rect.h);
    for (let i = 0; i < n; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(xs[n - 1], rect.y + rect.h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // Line.
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (i === 0) ctx.moveTo(xs[i], ys[i]);
    else ctx.lineTo(xs[i], ys[i]);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = opts.lineWidth || 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Latest-point dot.
  ctx.beginPath();
  ctx.arc(xs[n - 1], ys[n - 1], 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawLegend(ctx, items, rect) {
  let x = rect.x;
  const y = rect.y + rect.h + 40;
  ctx.font = `11px ${FONT}`;
  const gap = 20;
  items.forEach((it) => {
    const tw = ctx.measureText(it.label).width;
    const itemW = 12 + 6 + tw;
    if (x + itemW > rect.x + rect.w) x = rect.x;
    ctx.fillStyle = it.color;
    ctx.fillRect(x, y - 8, 12, 3);
    x += 16;
    ctx.fillStyle = CHART_TEXT;
    ctx.fillText(it.label, x, y);
    x += tw + gap;
  });
}

async function renderSingleStockChart(stock, history) {
  const prices = history.map((p) => p.price);
  const labels = history.map((p) => timeLabel(p.t));
  const changePct = prices.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.12 || max * 0.02 || 1;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const subtitle = `${SECTOR_LABELS[stock.sector] || stock.sector} · ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% over period`;
  const rect = drawCanvas(ctx, {
    title: `${stock.name} (${stock.ticker})`,
    subtitle,
    labels,
    min: min - pad,
    max: max + pad,
    formatY: (v) => (v < 1000 ? String(Math.round(v)) : v.toLocaleString('en-US', { maximumFractionDigits: 0 })),
  });

  plotLine(ctx, rect, prices, {
    color: CHART_PRIMARY,
    lineWidth: 2.5,
    min: min - pad,
    max: max + pad,
    fill: { start: 'rgba(161,207,58,0.30)', end: 'rgba(161,207,58,0.0)' },
  });

  return canvas.toBuffer('image/png');
}

async function renderComparisonChart(all) {
  // Normalize each stock to % change from its first point.
  const maxLen = Math.max(...all.map((s) => s.history.length));
  // Use a reference time series for x labels.
  const ref = all.find((s) => s.history.length === maxLen);
  const labels = [];
  for (let i = 0; i < maxLen; i++) {
    labels[i] = timeLabel(ref ? ref.history[i]?.t : 0);
  }

  const series = all.map((item) => {
    const first = item.history[0] ? item.history[0].price : 0;
    return item.history.map((p) => (first ? ((p.price - first) / first) * 100 : 0));
  });

  let min = 0;
  let max = 0;
  series.forEach((s) => {
    s.forEach((v) => {
      if (v < min) min = v;
      if (v > max) max = v;
    });
  });
  const pad = (max - min) * 0.12 || 1;
  min -= pad;
  max += pad;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const rect = drawCanvas(ctx, {
    title: 'Market Comparison — % Change Over Period',
    labels,
    min,
    max,
    formatY: (v) => `${Math.round(v)}%`,
  });

  series.forEach((s, i) => {
    plotLine(ctx, rect, s, {
      color: colorForIndex(i),
      lineWidth: 2,
      min,
      max,
      fill: false,
    });
  });

  drawLegend(
    ctx,
    all.map((item, i) => ({ color: colorForIndex(i), label: item.ticker })),
    rect,
  );

  return canvas.toBuffer('image/png');
}

async function renderPortfolioChart(history) {
  const values = history.map((p) => p.value);
  const labels = history.map((p) => timeLabel(p.t));

  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || max * 0.02 || 1;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  const rect = drawCanvas(ctx, {
    title: 'Portfolio Value Over Time',
    labels,
    min: min - pad,
    max: max + pad,
    formatY: (v) => (v < 1000 ? String(Math.round(v)) : v.toLocaleString('en-US', { maximumFractionDigits: 0 })),
  });

  plotLine(ctx, rect, values, {
    color: CHART_GOLD,
    lineWidth: 2.5,
    min: min - pad,
    max: max + pad,
    fill: { start: 'rgba(255,215,0,0.25)', end: 'rgba(255,215,0,0.0)' },
  });

  return canvas.toBuffer('image/png');
}

module.exports = {
  renderSingleStockChart,
  renderComparisonChart,
  renderPortfolioChart,
};
