// ─── app.js ──────────────────────────────────────────────────────────────────
// Dashboard Penjualan 2024
// Handles: data loading, filtering, KPI computation, Chart.js rendering, table

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = {
  indigo:  '#6366f1',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  sky:     '#0ea5e9',
  violet:  '#8b5cf6',
  teal:    '#14b8a6',
  orange:  '#f97316',
};
const COLORS = Object.values(PALETTE);

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRupiah(n) {
  if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + ' M';
  if (n >= 1_000_000)     return 'Rp ' + (n / 1_000_000).toFixed(1) + ' Jt';
  return 'Rp ' + n.toLocaleString('id-ID');
}
function formatDate(str) {
  const d = new Date(str);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
function getMonthKey(str)  { return str.slice(0, 7); } // "2024-01"
function getMonthLabel(key) {
  const [y, m] = key.split('-');
  const names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return names[parseInt(m) - 1] + ' ' + y.slice(2);
}

// ── Chart registry (so we can destroy/recreate on filter change) ───────────────
const charts = {};
function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

// ── Chart defaults ────────────────────────────────────────────────────────────
Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 12;
Chart.defaults.plugins.legend.labels.boxWidth = 12;
Chart.defaults.plugins.legend.labels.padding = 16;

// ── State ─────────────────────────────────────────────────────────────────────
let allData  = [];
let filtered = [];

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('data/sales.json');
    allData    = await res.json();
    populateFilters();
    setDefaultDateRange();
    applyFilters();
    document.getElementById('lastUpdated').textContent =
      'Data per ' + new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  } catch (e) {
    console.error('Gagal memuat data:', e);
    document.getElementById('lastUpdated').textContent = 'Gagal memuat data';
  }
}

// ── Populate select options ───────────────────────────────────────────────────
function populateFilters() {
  const regions    = [...new Set(allData.map(d => d.region))].sort();
  const categories = [...new Set(allData.map(d => d.category))].sort();

  const regSel = document.getElementById('filterRegion');
  regions.forEach(r => regSel.insertAdjacentHTML('beforeend', `<option value="${r}">${r}</option>`));

  const catSel = document.getElementById('filterCategory');
  categories.forEach(c => catSel.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`));
}

function setDefaultDateRange() {
  const dates = allData.map(d => d.date).sort();
  document.getElementById('filterDateFrom').value = dates[0];
  document.getElementById('filterDateTo').value   = dates[dates.length - 1];
}

// ── Filter Logic ──────────────────────────────────────────────────────────────
function applyFilters() {
  const from     = document.getElementById('filterDateFrom').value;
  const to       = document.getElementById('filterDateTo').value;
  const region   = document.getElementById('filterRegion').value;
  const category = document.getElementById('filterCategory').value;

  filtered = allData.filter(d => {
    if (from     && d.date < from)     return false;
    if (to       && d.date > to)       return false;
    if (region   && d.region   !== region)   return false;
    if (category && d.category !== category) return false;
    return true;
  });

  document.getElementById('recordCount').textContent = filtered.length;
  updateKPIs();
  renderCharts();
  renderTable();
}

// ── KPI Computation ───────────────────────────────────────────────────────────
function updateKPIs() {
  const totalRev   = filtered.reduce((s, d) => s + d.revenue, 0);
  const totalUnits = filtered.reduce((s, d) => s + d.units, 0);
  const orders     = filtered.length;
  const avg        = orders ? totalRev / orders : 0;

  document.getElementById('kpiRevenue').textContent   = formatRupiah(totalRev);
  document.getElementById('kpiOrders').textContent    = orders.toLocaleString('id-ID');
  document.getElementById('kpiUnits').textContent     = totalUnits.toLocaleString('id-ID');
  document.getElementById('kpiAvg').textContent       = formatRupiah(Math.round(avg));

  document.getElementById('kpiRevenueSub').textContent   = `dari ${orders} transaksi`;
  document.getElementById('kpiOrdersSub').textContent    = `dalam periode dipilih`;
  document.getElementById('kpiUnitsSub').textContent     = `unit produk terjual`;
  document.getElementById('kpiAvgSub').textContent       = `nilai rata-rata transaksi`;
}

// ── Chart Rendering ───────────────────────────────────────────────────────────

// 1. Revenue Trend (line by month)
function renderTrendChart() {
  destroyChart('trend');
  const map = {};
  filtered.forEach(d => {
    const k = getMonthKey(d.date);
    map[k] = (map[k] || 0) + d.revenue;
  });
  const keys   = Object.keys(map).sort();
  const labels = keys.map(getMonthLabel);
  const data   = keys.map(k => map[k]);

  charts.trend = new Chart(document.getElementById('chartTrend'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan (Rp)',
        data,
        borderColor: PALETTE.indigo,
        backgroundColor: 'rgba(99,102,241,0.12)',
        borderWidth: 2.5,
        pointBackgroundColor: PALETTE.indigo,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: {
            callback: v => formatRupiah(v),
            maxTicksLimit: 5,
          },
          grid: { color: '#f1f5f9' },
        },
        x: { grid: { display: false } }
      }
    }
  });
}

// 2. Category Doughnut
function renderCategoryChart() {
  destroyChart('category');
  const map = {};
  filtered.forEach(d => { map[d.category] = (map[d.category] || 0) + d.revenue; });
  const labels = Object.keys(map).sort();
  const data   = labels.map(l => map[l]);

  charts.category = new Chart(document.getElementById('chartCategory'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.parsed)}`
          }
        }
      }
    }
  });
}

// 3. Region Polar Area
function renderRegionChart() {
  destroyChart('region');
  const map = {};
  filtered.forEach(d => { map[d.region] = (map[d.region] || 0) + d.revenue; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(e => e[0]);
  const data   = sorted.map(e => e[1]);
  const bgColors  = COLORS.slice(0, labels.length).map(c => c + 'cc'); // 80% opacity
  const brdColors = COLORS.slice(0, labels.length);

  charts.region = new Chart(document.getElementById('chartRegion'), {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan',
        data,
        backgroundColor: bgColors,
        borderColor: brdColors,
        borderWidth: 2,
        hoverBackgroundColor: brdColors,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 }, boxWidth: 12, padding: 14 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatRupiah(ctx.parsed.r)}`
          }
        }
      },
      scales: {
        r: {
          ticks: {
            callback: v => formatRupiah(v),
            maxTicksLimit: 4,
            backdropColor: 'transparent',
            font: { size: 10 },
          },
          grid: { color: '#e2e8f0' },
          angleLines: { color: '#e2e8f0' },
        }
      }
    }
  });
}

// 4. Top Products Bar
function renderProductChart() {
  destroyChart('product');
  const map = {};
  filtered.forEach(d => { map[d.product] = (map[d.product] || 0) + d.revenue; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(e => e[0]);
  const data   = sorted.map(e => e[1]);

  charts.product = new Chart(document.getElementById('chartProduct'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pendapatan',
        data,
        backgroundColor: PALETTE.indigo,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          ticks: { callback: v => formatRupiah(v), maxTicksLimit: 4 },
          grid: { color: '#f1f5f9' },
        },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

function renderCharts() {
  renderTrendChart();
  renderCategoryChart();
  renderRegionChart();
  renderProductChart();
}

// ── Table Rendering ───────────────────────────────────────────────────────────
const CATEGORY_BADGES = {
  'Elektronik': 'bg-indigo-100 text-indigo-700',
  'Furniture':  'bg-amber-100 text-amber-700',
  'Fashion':    'bg-rose-100 text-rose-700',
  'Makanan':    'bg-emerald-100 text-emerald-700',
};

function renderTable() {
  const tbody = document.getElementById('tableBody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-slate-400 text-sm">Tidak ada data untuk filter ini.</td></tr>`;
    return;
  }
  // Show latest 30 rows (sorted by date desc)
  const rows = [...filtered].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  tbody.innerHTML = rows.map(d => {
    const badge = CATEGORY_BADGES[d.category] || 'bg-slate-100 text-slate-600';
    return `<tr class="hover:bg-slate-50 transition-colors">
      <td class="px-4 py-3 text-slate-600">${formatDate(d.date)}</td>
      <td class="px-4 py-3 font-medium text-slate-800">${d.product}</td>
      <td class="px-4 py-3"><span class="text-xs px-2 py-0.5 rounded-full font-medium ${badge}">${d.category}</span></td>
      <td class="px-4 py-3 text-slate-600">${d.region}</td>
      <td class="px-4 py-3 text-right text-slate-700">${d.units.toLocaleString('id-ID')}</td>
      <td class="px-4 py-3 text-right font-semibold text-slate-800">${formatRupiah(d.revenue)}</td>
    </tr>`;
  }).join('');
}

// ── Event Listeners ───────────────────────────────────────────────────────────
['filterDateFrom', 'filterDateTo', 'filterRegion', 'filterCategory'].forEach(id => {
  document.getElementById(id).addEventListener('change', applyFilters);
});

document.getElementById('btnResetFilter').addEventListener('click', () => {
  setDefaultDateRange();
  document.getElementById('filterRegion').value   = '';
  document.getElementById('filterCategory').value = '';
  applyFilters();
});

// ── Start ─────────────────────────────────────────────────────────────────────
init();
