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
  const canvas = ctx.canvas;
  const W = canvas.width;
  const H = canvas.height;

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
  const padR = opts.legendW || 30;
  const padB = opts.padB || 44;

  const rect = { x: padL, y: top, w: W - padL - padR, h: H - top - padB, right: W - padR };

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

// Faceted "market by sector" comparison chart.
// each input item: { ticker, name, sector, history: [{ price, t }] }
async function renderComparisonChart(all) {
  const sectorOrder = Object.keys(SECTOR_LABELS);
  const tickerColor = new Map(all.map((s, i) => [s.ticker, colorForIndex(i)]));

  // Normalize each stock to % change from its first point.
  const items = all.map((s) => {
    const first = s.history[0] ? s.history[0].price : 0;
    return {
      ticker: s.ticker,
      sector: s.sector,
      color: tickerColor.get(s.ticker),
      data: s.history.map((p) => (first ? ((p.price - first) / first) * 100 : 0)),
    };
  });

  // Shared % range across ALL sectors so panels are directly comparable.
  let min = 0;
  let max = 0;
  for (const it of items)
    for (const v of it.data) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  const span = Math.max(max - min, 1);
  // Force 0% baseline inside the visible range on both sides.
  min -= span * 0.25;
  max += span * 0.25;

  // Group by sector, ordered by SECTOR_LABELS then insertion order.
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.sector)) groups.set(it.sector, []);
    groups.get(it.sector).push(it);
  }
  const sectorKeys = [...groups.keys()].sort((a, b) => {
    const ia = sectorOrder.indexOf(a);
    const ib = sectorOrder.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  // Responsive grid of panels (2 columns). Rows grow as sectors are added.
  const COLS = 2;
  const ROWS = Math.ceil(sectorKeys.length / COLS);
  const cellW = 610;
  const cellH = 240;
  const headerH = 42;
  const margin = { l: 20, t: 76, r: 20, b: 16 };

  const canvas = createCanvas(margin.l + COLS * cellW + margin.r, margin.t + ROWS * cellH + margin.b);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Main title + subtitle.
  ctx.fillStyle = '#e8edf3';
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Market Performance by Sector', margin.l, 36);
  ctx.fillStyle = CHART_MUTED;
  ctx.font = `13px ${FONT}`;
  ctx.fillText('% change over the period · one panel per sector', margin.l + 2, 56);

  // Shared y tick step used by every panel.
  const yStep = tickStep(max - min, 4);

  sectorKeys.forEach((sec, idx) => {
    const row = Math.floor(idx / COLS);
    const col = idx % COLS;
    const x0 = margin.l + col * cellW;
    const y0 = margin.t + row * cellH;
    const g = groups.get(sec);

    // Panel background.
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fillRect(x0, y0, cellW, cellH);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.strokeRect(x0, y0, cellW, cellH);

    // Sector header.
    ctx.fillStyle = '#e8edf3';
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(SECTOR_LABELS[sec] || sec, x0 + 10, y0 + 26);

    // Plot rect inside the panel.
    const padL = 56;
    const padB = 26;
    const px = x0 + padL;
    const py = y0 + headerH;
    const pw = cellW - padL - 46;
    const ph = cellH - headerH - padB;

    // Horizontal gridlines + y labels (labels on the leftmost column only).
    const firstTick = Math.ceil(min / yStep) * yStep;
    for (let v = firstTick; v <= max + 1e-9; v += yStep) {
      const frac = (v - min) / (max - min);
      const y = py + ph - frac * ph;
      ctx.strokeStyle = CHART_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + pw, y);
      ctx.stroke();
      if (col === 0) {
        ctx.fillStyle = CHART_TEXT;
        ctx.font = `11px ${FONT}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${v > 0 && v < 10 ? v.toFixed(1) : Math.round(v)}%`, px - 8, y + 4);
      }
    }

    // Dashed 0% baseline.
    if (min < 0 && max > 0) {
      const frac = (0 - min) / (max - min);
      const y0p = py + ph - frac * ph;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, y0p);
      ctx.lineTo(px + pw, y0p);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vertical gridlines + x time labels (bottom row only).
    const maxTicks = Math.min(8, pw / 70);
    const nMax = Math.max(...g.map((it) => it.data.length));
    const sStep = nMax > maxTicks ? Math.ceil(nMax / maxTicks) : 1;
    const ref = all.find((s) => s.ticker === g[0].ticker);
    for (let i = 0; i < nMax; i += sStep) {
      const x = px + (i / Math.max(nMax - 1, 1)) * pw;
      ctx.strokeStyle = CHART_GRID;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x, py + ph);
      ctx.stroke();
      if (row === ROWS - 1 && ref && ref.history[i]) {
        ctx.fillStyle = CHART_TEXT;
        ctx.font = `10px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel(ref.history[i].t), x, py + ph + 16);
      }
    }

    // Draw each stock's line, then direct-label it at the line's end.
    for (const it of g) {
      const n = it.data.length;
      if (n === 0) continue;
      const xs = [];
      const ys = [];
      for (let i = 0; i < n; i++) {
        const xval = px + (i / Math.max(n - 1, 1)) * pw;
        const frac = (it.data[i] - min) / (max - min);
        const yp = py + ph - frac * ph;
        xs.push(xval);
        ys.push(yp);
      }
      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(xs[i], ys[i]);
      ctx.strokeStyle = it.color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();

      const ex = xs[n - 1];
      const ey = ys[n - 1];
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.arc(ex, ey, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Ticker label directly at the end of the line (the "best" axis label).
      ctx.font = `bold 12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(it.ticker, ex + 7, ey + 4);
    }
  });

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
