const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { SECTOR_LABELS } = require('./stocks');

// Palette for the market theme (matches Racket's green/gold identity)
const CHART_PRIMARY = '#a1cf3a';
const CHART_GOLD = '#ffd700';
const CHART_GRID = 'rgba(255,255,255,0.08)';
const CHART_TEXT = '#cfd8e3';

// A distinct color per ticker so the comparison chart stays readable.
const TICKER_COLORS = [
  '#a1cf3a', // green
  '#4fc3f7', // light blue
  '#ff8a65', // orange
  '#ba68c8', // purple
  '#f06292', // pink
  '#ffd54f', // gold
  '#4dd0e1', // cyan
  '#aed581', // lime
  '#7986cb', // indigo
  '#e57373', // red
  '#81c784', // green2
  '#ffb74d', // amber
];

function colorForIndex(i) {
  return TICKER_COLORS[i % TICKER_COLORS.length];
}

const canvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 500,
  backgroundColour: '#161a20',
});

// Base options shared by all market charts.
function baseOptions(title, opts = {}) {
  return {
    responsive: false,
    animation: false,
    plugins: {
      legend: opts.legend === undefined ? { display: false } : opts.legend,
      title: {
        display: true,
        text: title,
        color: opts.subtitle ? undefined : '#e8edf3',
        font: { family: 'Segoe UI', size: 20, weight: 'bold' },
      },
      subtitle: opts.subtitle
        ? { display: true, text: opts.subtitle, color: '#9aa7b5', font: { family: 'Segoe UI', size: 13 } }
        : false,
    },
    scales: {
      x: {
        grid: { color: CHART_GRID },
        ticks: { color: CHART_TEXT, maxTicksLimit: opts.xTicks || 12, font: { family: 'Segoe UI', size: 11 } },
      },
      y: {
        grid: { color: CHART_GRID },
        ticks: { color: CHART_TEXT, font: { family: 'Segoe UI', size: 11 } },
      },
    },
    ...opts.extraScales,
    layout: { padding: { top: 20, right: 20, bottom: 10, left: 10 } },
  };
}

const timeLabels = (points) =>
  points.map((p) => {
    const d = new Date(p.t);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });

// Single-stock line chart with gradient fill under the line.
async function renderSingleStockChart(stock, history) {
  const labels = timeLabels(history);
  const prices = history.map((p) => p.price);
  const changePct = history.length > 1 ? ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100 : 0;

  const gradient = (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 500);
    g.addColorStop(0, 'rgba(161,207,58,0.35)');
    g.addColorStop(1, 'rgba(161,207,58,0.0)');
    return g;
  };

  const data = {
    labels,
    datasets: [
      {
        label: stock.ticker,
        data: prices,
        borderColor: CHART_PRIMARY,
        backgroundColor: 'rgba(161,207,58,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2.5,
      },
    ],
  };

  const subtitle = `${SECTOR_LABELS[stock.sector] || stock.sector} · ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% over period`;
  const config = {
    type: 'line',
    data,
    options: baseOptions(`${stock.name} (${stock.ticker})`, { subtitle }),
  };
  return canvas.renderToBuffer(config);
}

// Multi-line comparison chart, all stocks normalized to a % change from start.
async function renderComparisonChart(all) {
  const labels = timeLabels(all[0].history);
  const datasets = all.map((item, i) => {
    const first = item.history[0] ? item.history[0].price : 0;
    const norm = item.history.map((p) => (first ? ((p.price - first) / first) * 100 : 0));
    return {
      label: item.ticker,
      data: norm,
      borderColor: colorForIndex(i),
      fill: false,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
    };
  });

  const data = { labels, datasets };
  const options = baseOptions('Market Comparison — % Change Over Period', {
    legend: { display: true, labels: { color: CHART_TEXT, font: { family: 'Segoe UI', size: 11 } } },
    yTitle: true,
  });
  options.scales.y.title = { display: true, text: '% change', color: CHART_TEXT };
  options.scales.y.ticks.callback = (v) => `${v}%`;

  const config = { type: 'line', data, options };
  return canvas.renderToBuffer(config);
}

// Portfolio value line chart over time.
async function renderPortfolioChart(history) {
  const labels = timeLabels(history);
  const values = history.map((p) => p.value);

  const data = {
    labels,
    datasets: [
      {
        label: 'Portfolio Value',
        data: values,
        borderColor: CHART_GOLD,
        backgroundColor: 'rgba(255,215,0,0.15)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2.5,
      },
    ],
  };

  const config = { type: 'line', data, options: baseOptions('Portfolio Value Over Time', {}) };

  return canvas.renderToBuffer(config);
}

module.exports = {
  renderSingleStockChart,
  renderComparisonChart,
  renderPortfolioChart,
};
