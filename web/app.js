/* Panel de entrenamiento — Garmin (Tredict) + Strava, con datos en Supabase */
import { getSession, login, logout, loadAll, loadRoutes, hoyData, saveCheckin } from './db.js';
const VER = new URL(import.meta.url).searchParams.get('v') || '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------------------------------------------------------------- constantes
const ICON = {
  ride: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9 8.5 6H7M15 9l-3 7"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M8 21l3-6 3 2v4M6 12l3-3 4 1 2 3 3 1M11 15l2-5"/>',
  swim: '<path d="M3 17c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M3 21c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/><circle cx="16" cy="7" r="2"/><path d="M5 13l5-5 3 3"/>',
  strength: '<path d="M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6 2.5 2.5V21M8 11l3-3 3 2 2 3M11.5 15l1.5-5"/>',
  other: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
};
const SPORTS = {
  ride: { label: 'Ciclismo' }, run: { label: 'Running' }, swim: { label: 'Natación' },
  strength: { label: 'Fuerza' }, walk: { label: 'Caminata' }, other: { label: 'Otros' },
};
const SPORT_KEYS = Object.keys(SPORTS);
const NAV_ICON = {
  hoy: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  resumen: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  actividades: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  rendimiento: '<path d="M3 20h18M6 16l4-5 3 3 5-7"/><path d="M15 7h3v3"/>',
  carga: '<path d="M3 17c3-8 6-8 9-3s6 4 9-4"/><path d="M3 21h18"/>',
  recuperacion: '<path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/><path d="M8 12h2l1-2 2 4 1-2h2"/>',
  mapa: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  objetivos: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  equipo: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7"/>',
};
const VIEWS = {
  hoy: 'Hoy', resumen: 'Resumen', actividades: 'Actividades', rendimiento: 'Rendimiento', carga: 'Carga y forma',
  recuperacion: 'Recuperación', mapa: 'Mapa de calor', calendario: 'Calendario', objetivos: 'Objetivos', equipo: 'Equipo',
};
const PERIODS = [['7d', '7 días'], ['28d', '4 semanas'], ['3m', '3 meses'], ['6m', '6 meses'], ['ytd', 'Este año'], ['12m', '12 meses'], ['all', 'Todo'], ['custom', 'Personalizado']];
const sportColor = sp => css('--' + sp);
const icon = (sp, size = 34) => `<span class="sport-ic" style="background:${sportColor(sp)};width:${size}px;height:${size}px"><svg viewBox="0 0 24 24">${ICON[sp]}</svg></span>`;

// ---------------------------------------------------------------- formato
const NF = {};
const nf = (d = 0) => NF[d] ||= new Intl.NumberFormat('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : nf(d).format(n);
const km = m => fmt(m / 1000, m >= 100000 ? 0 : 1);
const hrs = s => fmt(s / 3600, s >= 360000 ? 0 : 1);
function dur(s) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}
function durLong(s) {
  const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
const mmss = sec => { if (!sec || !isFinite(sec)) return '—'; const m = Math.floor(sec / 60), s = Math.round(sec % 60); return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`; };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const MES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const fDate = d => `${DIA[d.getDay()]} ${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}`;
const fDateShort = d => `${d.getDate()} ${MES[d.getMonth()]}`;
const fTime = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function pace(a) { // texto de ritmo o velocidad según deporte
  if (!a.dist || !a.mt) return '—';
  if (a.sp === 'run' || a.sp === 'walk') return mmss(a.mt / (a.dist / 1000)) + ' /km';
  if (a.sp === 'swim') return mmss(a.mt / (a.dist / 100)) + ' /100m';
  return fmt(a.dist / a.mt * 3.6, 1) + ' km/h';
}
const RPE = ['', 'Extremadamente suave', 'Muy suave', 'Suave', 'Algo exigente', 'Exigente', 'Demandante', 'Muy demandante', 'Agotador', 'Extremadamente agotador', 'Excesivo'];
const enjoyLabel = v => v == null ? null : v < 1.2 ? 'Muy mal' : v < 1.6 ? 'Mal' : v < 1.9 ? 'Algo mal' : v < 2.2 ? 'Neutral' : v < 2.5 ? 'Bien' : v < 2.9 ? 'Disfrutado' : 'Muy disfrutado';

// ---------------------------------------------------------------- fechas
const pd = s => { const [y, m, d, h = 0, mi = 0, se = 0] = s.split(/[-T:]/).map(Number); return new Date(y, m - 1, d, h, mi, se); };
const dk = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addD = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addM = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const sow = d => { const x = sod(d); return addD(x, -((x.getDay() + 6) % 7)); };
const daysBetween = (a, b) => Math.round((sod(b) - sod(a)) / 864e5);
const TODAY = sod(new Date());

function bucketKey(d, g) {
  if (g === 'day') return dk(d);
  if (g === 'week') return dk(sow(d));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function bucketList(from, to, g) {
  const out = []; let d = g === 'week' ? sow(from) : g === 'month' ? new Date(from.getFullYear(), from.getMonth(), 1) : sod(from);
  while (d <= to) { out.push(bucketKey(d, g)); d = g === 'day' ? addD(d, 1) : g === 'week' ? addD(d, 7) : addM(d, 1); }
  return out;
}
function bucketLabel(k, g) {
  if (g === 'month') { const [y, m] = k.split('-'); return `${MES[+m - 1]} ${y.slice(2)}`; }
  const d = pd(k); return fDateShort(d);
}
const autoGran = (from, to) => { const n = daysBetween(from, to); return n <= 45 ? 'day' : n <= 400 ? 'week' : 'month'; };
const GRAN_L = { day: 'día', week: 'semana', month: 'mes' };

// ---------------------------------------------------------------- estado
const state = { view: 'hoy', period: '12m', from: null, to: null, sports: new Set(SPORT_KEYS), compare: false, q: '' };
let DATA, H, ROUTES = null, ACTS = [], BYID = new Map();

function readHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  if (VIEWS[path]) state.view = path;
  const p = new URLSearchParams(qs || '');
  if (p.get('p')) state.period = p.get('p');
  if (p.get('s')) state.sports = new Set(p.get('s').split(',').filter(s => SPORTS[s]));
  else state.sports = new Set(SPORT_KEYS);
  state.compare = p.get('c') === '1';
  state.from = p.get('from') ? pd(p.get('from')) : null;
  state.to = p.get('to') ? pd(p.get('to')) : null;
  if (p.get('q') != null) state.q = p.get('q');
  if (p.get('a') && BYID.has(p.get('a'))) setTimeout(() => openActivity(p.get('a')), 0);
}
function writeHash(push = false) {
  const p = new URLSearchParams();
  if (state.period !== '12m') p.set('p', state.period);
  if (state.sports.size !== SPORT_KEYS.length) p.set('s', [...state.sports].join(','));
  if (state.compare) p.set('c', '1');
  if (state.period === 'custom' && state.from) { p.set('from', dk(state.from)); p.set('to', dk(state.to)); }
  if (state.view === 'actividades' && state.q) p.set('q', state.q);
  const h = `#/${state.view}${p.toString() ? '?' + p : ''}`;
  if (push) history.pushState(null, '', h); else history.replaceState(null, '', h);
}

function range() {
  const to = addD(TODAY, 1); // exclusivo
  let from;
  switch (state.period) {
    case '7d': from = addD(TODAY, -6); break;
    case '28d': from = addD(TODAY, -27); break;
    case '3m': from = addD(addM(TODAY, -3), 1); break;
    case '6m': from = addD(addM(TODAY, -6), 1); break;
    case 'ytd': from = new Date(TODAY.getFullYear(), 0, 1); break;
    case 'all': from = sod(pd(DATA.meta.range[0])); break;
    case 'custom': return { from: state.from || addD(TODAY, -27), to: addD(state.to || TODAY, 1) };
    default: from = addD(addM(TODAY, -12), 1);
  }
  return { from, to };
}
function prevRange({ from, to }) { const n = daysBetween(from, to); return { from: addD(from, -n), to: from }; }
const inR = (a, r) => a._t >= r.from && a._t < r.to;
const filtered = (r = range(), sports = state.sports) => ACTS.filter(a => sports.has(a.sp) && inR(a, r));
const lastDay = r => addD(r.to, -1);

// ---------------------------------------------------------------- métricas
const METRICS = {
  sessions: { label: 'Sesiones', unit: '', get: () => 1, f: v => fmt(v) },
  time: { label: 'Tiempo', unit: 'h', get: a => a.mt / 3600, f: v => fmt(v, v >= 100 ? 0 : 1) },
  dist: { label: 'Distancia', unit: 'km', get: a => a.dist / 1000, f: v => fmt(v, v >= 100 ? 0 : 1) },
  elev: { label: 'Desnivel', unit: 'm', get: a => a.elev || 0, f: v => fmt(v) },
  cal: { label: 'Calorías', unit: 'kcal', get: a => a.cal || 0, f: v => fmt(v) },
  load: { label: 'Carga', unit: '', get: a => a.ld || 0, f: v => fmt(v) },
};
const sum = (arr, f) => arr.reduce((s, a) => s + (f(a) || 0), 0);
const mean = arr => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function deltaHtml(cur, prev, invert = false) {
  if (!prev) return '<span>sin datos previos</span>';
  const p = (cur - prev) / prev * 100;
  if (Math.abs(p) < 0.5) return '<span>= igual que el período anterior</span>';
  return `<span><b>${p > 0 ? '▲' : '▼'} ${fmt(Math.abs(p), Math.abs(p) < 10 ? 1 : 0)}%</b> vs <span class="hide-m">período </span>anterior</span>`;
}

// carga diaria → CTL / ATL / TSB
function fitnessSeries(sports = state.sports) {
  const daily = new Map();
  for (const a of ACTS) if (sports.has(a.sp)) { const k = a.d.slice(0, 10); daily.set(k, (daily.get(k) || 0) + (a.ld || 0)); }
  const start = sod(pd(DATA.meta.range[0]));
  const out = []; let ctl = 0, atl = 0;
  const kc = 1 - Math.exp(-1 / 42), ka = 1 - Math.exp(-1 / 7);
  const win7 = [], win28 = [];
  for (let d = start; d <= TODAY; d = addD(d, 1)) {
    const k = dk(d), l = daily.get(k) || 0;
    const tsb = ctl - atl;
    ctl += (l - ctl) * kc; atl += (l - atl) * ka;
    win7.push(l); win28.push(l); if (win7.length > 7) win7.shift(); if (win28.length > 28) win28.shift();
    const a7 = sum(win7, x => x) / 7, c28 = sum(win28, x => x) / 28;
    out.push({ k, d, load: l, ctl, atl, tsb, acwr: c28 > 5 ? a7 / c28 : null });
  }
  return out;
}

// ---------------------------------------------------------------- charts
let charts = [];
function chart(el, option) {
  const c = echarts.init(el, null, { renderer: 'canvas' });
  c.setOption(withBase(option));
  charts.push(c);
  return c;
}
function withBase(o) {
  const text2 = css('--text-2'), grid = css('--grid'), line = css('--line'), muted = css('--muted');
  const axis = ax => ({
    axisLine: { lineStyle: { color: line } }, axisTick: { show: false },
    axisLabel: { color: muted, fontSize: 11, hideOverlap: true }, splitLine: { lineStyle: { color: grid } }, ...ax,
  });
  return {
    animationDuration: 400, textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: text2 },
    grid: { left: 8, right: 12, top: 34, bottom: 8, containLabel: true, ...o.grid },
    tooltip: {
      trigger: 'axis', confine: true, backgroundColor: css('--surface'), borderColor: line,
      textStyle: { color: css('--text'), fontSize: 12 }, extraCssText: 'box-shadow:0 6px 24px rgba(0,0,0,.12);border-radius:10px;',
      axisPointer: { type: 'line', lineStyle: { color: muted } }, ...o.tooltip,
    },
    legend: o.legend === false ? undefined : { top: 0, right: 0, icon: 'roundRect', itemWidth: 10, itemHeight: 10, textStyle: { color: text2, fontSize: 12 }, ...o.legend },
    ...o,
    xAxis: Array.isArray(o.xAxis) ? o.xAxis.map(axis) : o.xAxis ? axis(o.xAxis) : undefined,
    yAxis: Array.isArray(o.yAxis) ? o.yAxis.map(axis) : o.yAxis ? axis(o.yAxis) : undefined,
  };
}
window.addEventListener('resize', () => { charts.forEach(c => c.resize()); });
// zoom con Ctrl+rueda en escritorio; en pantallas táctiles no se captura el gesto para no bloquear el scroll
const ZOOM = () => matchMedia('(pointer: coarse)').matches ? undefined : [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, moveOnMouseMove: true }];
const ttRow = (color, name, val) => `<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;min-width:150px"><span style="display:flex;gap:6px;align-items:center"><i style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block"></i>${name}</span><b>${val}</b></div>`;

// ---------------------------------------------------------------- shell
function renderNav() {
  $('#nav').innerHTML = Object.entries(VIEWS).map(([k, l]) =>
    `<a href="#/${k}" data-v="${k}" class="${state.view === k ? 'active' : ''}"><svg viewBox="0 0 24 24">${NAV_ICON[k]}</svg>${l}</a>`).join('');
}
function renderFilters() {
  $('#periodSeg').innerHTML = PERIODS.map(([k, l]) => `<button type="button" data-p="${k}" class="${state.period === k ? 'on' : ''}">${l}</button>`).join('');
  $('#customRange').hidden = state.period !== 'custom';
  const r = range();
  $('#dFrom').value = dk(r.from); $('#dTo').value = dk(lastDay(r));
  const all = state.sports.size === SPORT_KEYS.length;
  $('#sportChips').innerHTML = `<button type="button" class="chip ${all ? 'on' : ''}" data-s="all">Todos</button>` +
    SPORT_KEYS.map(s => `<button type="button" class="chip ${!all && state.sports.has(s) ? 'on' : ''} ${!all && !state.sports.has(s) ? 'off' : ''}" data-s="${s}"><i style="background:${sportColor(s)}"></i>${SPORTS[s].label}</button>`).join('');
  $('#compare').checked = state.compare;
  const hideFilters = state.view === 'hoy';
  $('#filters').hidden = hideFilters;
}
function themeLabel() {
  const t = document.documentElement.dataset.theme;
  $('#themeBtn').innerHTML = t === 'dark' ? '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>Tema oscuro'
    : t === 'light' ? '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>Tema claro'
      : '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>Tema del sistema';
}
function render() {
  charts.forEach(c => c.dispose()); charts = [];
  if (mapObj) { mapObj.remove(); mapObj = null; }
  renderNav(); renderFilters();
  $('#title').textContent = VIEWS[state.view];
  document.title = `${VIEWS[state.view]} · Panel de entrenamiento`;
  const v = $('#view'); v.innerHTML = '';
  try { const p = ({ hoy, resumen, actividades, rendimiento, carga, recuperacion, mapa, calendario, objetivos, equipo })[state.view](v); p && p.catch && p.catch(showErr); }
  catch (e) { showErr(e); }
}

function showErr(e) { console.error(e); $('#view').insertAdjacentHTML('afterbegin', `<div class="card empty">Algo falló al dibujar esta vista: ${esc(e.message)}</div>`); }
function bindShell() {
  window.addEventListener('hashchange', () => { readHash(); render(); window.scrollTo(0, 0); });
  $('#nav').addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  $('#periodSeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    state.period = b.dataset.p;
    if (state.period === 'custom' && !state.from) { const r = range(); state.from = r.from; state.to = lastDay(r); }
    writeHash(); render();
  });
  const onDate = () => { state.from = pd($('#dFrom').value); state.to = pd($('#dTo').value); if (state.to < state.from) [state.from, state.to] = [state.to, state.from]; writeHash(); render(); };
  $('#dFrom').addEventListener('change', onDate); $('#dTo').addEventListener('change', onDate);
  $('#sportChips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const s = b.dataset.s, all = state.sports.size === SPORT_KEYS.length;
    if (s === 'all') state.sports = new Set(SPORT_KEYS);
    else if (all) state.sports = new Set([s]);
    else if (state.sports.has(s)) { state.sports.delete(s); if (!state.sports.size) state.sports = new Set(SPORT_KEYS); }
    else state.sports.add(s);
    writeHash(); render();
  });
  $('#compare').addEventListener('change', e => { state.compare = e.target.checked; writeHash(); render(); });
  $('#menuBtn').addEventListener('click', () => {
    $('#sidebar').classList.add('open');
    const s = document.createElement('div'); s.className = 'scrim'; s.onclick = closeMenu; document.body.appendChild(s);
  });
  $('#themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme;
    const next = !cur ? 'light' : cur === 'light' ? 'dark' : null;
    if (next) document.documentElement.dataset.theme = next; else delete document.documentElement.dataset.theme;
    try { next ? localStorage.setItem('theme', next) : localStorage.removeItem('theme'); } catch (e) { }
    themeLabel(); render();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!document.documentElement.dataset.theme) render(); });
  $('#modal').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); hideSearch(); }
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); $('#search').focus(); }
  });
  bindSearch();
}
function closeMenu() { $('#sidebar').classList.remove('open'); $$('.scrim').forEach(s => s.remove()); }

// ---------------------------------------------------------------- búsqueda
function searchActs(q, list = ACTS) {
  const toks = norm(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return list;
  return list.filter(a => toks.every(t => a._s.includes(t)));
}
let searchSel = -1;
function bindSearch() {
  const inp = $('#search'), box = $('#searchResults');
  inp.addEventListener('input', () => {
    const q = inp.value.trim(); searchSel = -1;
    if (!q) return hideSearch();
    const res = searchActs(q).slice().reverse();
    box.innerHTML = res.slice(0, 8).map(a => `<button type="button" data-id="${a.id}">${icon(a.sp, 28)}<span class="t" style="flex:1;min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.name)}</b><small style="color:var(--muted)">${fDate(a._t)} · ${km(a.dist)} km · ${durLong(a.mt)}</small></span></button>`).join('') +
      `<button type="button" class="all" data-all="1">Ver ${fmt(res.length)} resultado${res.length === 1 ? '' : 's'} en Actividades →</button>`;
    box.hidden = false;
  });
  inp.addEventListener('keydown', e => {
    const items = $$('button', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); searchSel = Math.max(0, Math.min(items.length - 1, searchSel + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((b, i) => b.classList.toggle('sel', i === searchSel));
    }
    if (e.key === 'Enter') { e.preventDefault(); (items[searchSel] || items.at(-1))?.click(); }
  });
  box.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.id) openActivity(b.dataset.id);
    else { state.q = inp.value.trim(); state.view = 'actividades'; state.period = 'all'; state.sports = new Set(SPORT_KEYS); writeHash(true); render(); }
    hideSearch(); inp.blur();
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) hideSearch(); });
}
function hideSearch() { $('#searchResults').hidden = true; }

// ---------------------------------------------------------------- vista: resumen
function resumen(v) {
  const r = range(), pr = prevRange(r), acts = filtered(r), prev = filtered(pr);
  const g = autoGran(r.from, lastDay(r));
  const buckets = bucketList(r.from, lastDay(r), g);
  const metric = resumen.metric ||= 'time';
  v.innerHTML = `
    <div class="kpis" id="kpis"></div>
    <div class="grid">
      <div class="card c8"><div class="card-h"><div><h3 id="volTitle"></h3><p id="volSub"></p></div><div class="seg" id="granSeg"></div></div><div class="chart lg" id="volChart"></div></div>
      <div class="card c4"><div class="card-h"><div><h3>Distribución por deporte</h3><p>Tiempo de entrenamiento en el período</p></div></div><div class="chart" id="donut"></div><div id="donutTbl"></div></div>
      <div class="card c4"><div class="card-h"><div><h3>Estado de hoy</h3><p>Garmin: HRV, FC en reposo, sueño y forma</p></div><a href="#/recuperacion">Ver más</a></div><div id="ready"></div></div>
      <div class="card c4"><div class="card-h"><div><h3>Hallazgos del período</h3><p>Lectura automática de tus datos</p></div></div><div class="insights" id="insights"></div></div>
      <div class="card c4"><div class="card-h"><div><h3>Últimas actividades</h3><p>Toca una para ver el detalle</p></div><a href="#/actividades">Ver todas</a></div><div class="list" id="recent"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Por tipo de sesión</h3><p>Ordenado por tiempo total</p></div></div><div class="tbl-wrap" id="subTbl"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>¿Cuándo entrenas?</h3><p>Sesiones por día y hora de inicio</p></div></div><div class="chart" id="when"></div></div>
    </div>`;

  // KPIs
  const kp = $('#kpis');
  for (const [k, m] of Object.entries(METRICS)) {
    const cur = sum(acts, m.get), pv = sum(prev, m.get);
    const el = document.createElement('div');
    el.className = `card kpi ${metric === k ? 'sel' : ''}`;
    el.innerHTML = `<div class="lbl">${m.label}</div><div class="val">${m.f(cur)}<small>${m.unit}</small></div><div class="delta">${deltaHtml(cur, pv)}</div><div class="spark"></div>`;
    el.onclick = () => { resumen.metric = k; render(); };
    kp.appendChild(el);
    const byB = new Map(buckets.map(b => [b, 0]));
    for (const a of acts) { const b = bucketKey(a._t, g); if (byB.has(b)) byB.set(b, byB.get(b) + m.get(a)); }
    chart($('.spark', el), {
      legend: false, grid: { left: 0, right: 0, top: 4, bottom: 0, containLabel: false }, tooltip: { show: false },
      xAxis: { type: 'category', show: false, data: buckets, boundaryGap: false }, yAxis: { type: 'value', show: false, min: 0 },
      series: [{ type: 'line', data: [...byB.values()], smooth: .3, symbol: 'none', lineStyle: { width: 1.6, color: css('--accent') }, areaStyle: { color: css('--accent-soft'), opacity: .8 } }],
    });
  }

  // volumen
  const gran = resumen.gran && resumen.granFor === state.period ? resumen.gran : g;
  const bks = bucketList(r.from, lastDay(r), gran);
  $('#granSeg').innerHTML = ['day', 'week', 'month'].map(x => `<button type="button" data-g="${x}" class="${x === gran ? 'on' : ''}">${GRAN_L[x][0].toUpperCase() + GRAN_L[x].slice(1)}</button>`).join('');
  $('#granSeg').onclick = e => { const b = e.target.closest('button'); if (b) { resumen.gran = b.dataset.g; resumen.granFor = state.period; render(); } };
  const M = METRICS[metric];
  $('#volTitle').textContent = `${M.label} por ${GRAN_L[gran]}`;
  $('#volSub').textContent = `${M.f(sum(acts, M.get))} ${M.unit} en total · promedio ${M.f(sum(acts, M.get) / Math.max(1, bks.length))} ${M.unit} por ${GRAN_L[gran]}${state.compare ? ' · línea = período anterior' : ''}`;
  const series = SPORT_KEYS.filter(s => state.sports.has(s)).map(s => {
    const m = new Map(bks.map(b => [b, 0]));
    for (const a of acts) if (a.sp === s) { const b = bucketKey(a._t, gran); if (m.has(b)) m.set(b, m.get(b) + M.get(a)); }
    return { name: SPORTS[s].label, type: 'bar', stack: 'v', data: [...m.values()].map(x => +x.toFixed(2)), itemStyle: { color: sportColor(s), borderColor: css('--surface'), borderWidth: 1 }, barMaxWidth: 26, emphasis: { focus: 'series' } };
  }).filter(s => s.data.some(x => x));
  if (state.compare) {
    const pb = bucketList(pr.from, lastDay(pr), gran), m = new Map(pb.map(b => [b, 0]));
    for (const a of prev) { const b = bucketKey(a._t, gran); if (m.has(b)) m.set(b, m.get(b) + M.get(a)); }
    series.push({ name: 'Período anterior', type: 'line', data: [...m.values()].slice(-bks.length).map(x => +x.toFixed(2)), symbol: 'none', lineStyle: { width: 2, color: css('--muted') }, itemStyle: { color: css('--muted') }, z: 5 });
  }
  const vc = chart($('#volChart'), {
    xAxis: { type: 'category', data: bks.map(b => bucketLabel(b, gran)) },
    yAxis: { type: 'value', name: M.unit, nameTextStyle: { color: css('--muted'), align: 'left' } },
    tooltip: { formatter: ps => { const tot = ps.filter(p => p.seriesName !== 'Período anterior').reduce((s, p) => s + (p.value || 0), 0); return `<b>${gran === 'week' ? 'Semana del ' : ''}${ps[0].axisValue}</b>` + ps.filter(p => p.value).map(p => ttRow(p.color, p.seriesName, `${M.f(p.value)} ${M.unit}`)).join('') + (ps.length > 1 ? `<div style="border-top:1px solid ${css('--line')};margin-top:4px;padding-top:4px">${ttRow('transparent', 'Total', `${M.f(tot)} ${M.unit}`)}</div>` : ''); } },
    dataZoom: bks.length > 60 ? ZOOM() : undefined,
    series,
  });
  vc.on('click', p => { // ir a actividades del bucket
    const b = bks[p.dataIndex]; let from, to;
    if (gran === 'day') { from = pd(b); to = from; } else if (gran === 'week') { from = pd(b); to = addD(from, 6); } else { from = pd(b + '-01'); to = addD(addM(from, 1), -1); }
    state.period = 'custom'; state.from = from; state.to = to; state.view = 'actividades'; writeHash(true); render();
  });

  // donut
  const bySp = SPORT_KEYS.map(s => ({ s, v: sum(acts.filter(a => a.sp === s), a => a.mt) })).filter(x => x.v);
  const tot = sum(bySp, x => x.v) || 1;
  chart($('#donut'), {
    legend: false, tooltip: { trigger: 'item', formatter: p => `<b>${p.name}</b><br>${durLong(p.value)} · ${fmt(p.percent, 1)}%` },
    series: [{ type: 'pie', radius: ['58%', '82%'], padAngle: 1.5, itemStyle: { borderRadius: 4, borderColor: css('--surface'), borderWidth: 2 }, label: { show: true, position: 'center', formatter: () => `{a|${hrs(tot)} h}\n{b|en total}`, rich: { a: { fontSize: 22, fontWeight: 650, color: css('--text') }, b: { fontSize: 12, color: css('--muted'), padding: [4, 0, 0, 0] } } }, emphasis: { scale: false, label: { show: true } }, data: bySp.map(x => ({ name: SPORTS[x.s].label, value: x.v, itemStyle: { color: sportColor(x.s) } })) }],
  });
  $('#donutTbl').innerHTML = `<div class="list">${bySp.sort((a, b) => b.v - a.v).map(x => `<div class="row" style="cursor:default;padding:6px 2px"><i class="dot" style="background:${sportColor(x.s)}"></i><span class="t">${SPORTS[x.s].label}</span><span class="m">${hrs(x.v)} h · ${fmt(x.v / tot * 100)}%</span></div>`).join('')}</div>`;

  readiness($('#ready'));
  $('#insights').innerHTML = insights(r, acts, prev).map(i => `<div class="insight"><span class="ico"><svg viewBox="0 0 24 24">${i.icon}</svg></span><span>${i.html}</span></div>`).join('') || '<div class="empty">Sin datos en el período</div>';
  $('#recent').innerHTML = acts.slice(-6).reverse().map(rowHtml).join('') || '<div class="empty">Sin actividades en el período</div>';
  bindRows($('#recent'));

  // tabla por tipo
  const subs = {};
  for (const a of acts) { const k = a.sp + '|' + a.sub; (subs[k] ||= { sp: a.sp, sub: a.sub, n: 0, mt: 0, dist: 0, elev: 0, ld: 0 }); const s = subs[k]; s.n++; s.mt += a.mt; s.dist += a.dist; s.elev += a.elev || 0; s.ld += a.ld || 0; }
  const rows = Object.values(subs).sort((a, b) => b.mt - a.mt);
  $('#subTbl').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Tipo</th><th class="num">Sesiones</th><th class="num">Horas</th><th class="num">Km</th><th class="num hide-m">Desnivel</th><th class="num hide-m">Carga</th></tr></thead><tbody>${rows.map(s => `<tr data-sp="${s.sp}" data-sub="${esc(s.sub)}"><td><span style="display:inline-flex;gap:8px;align-items:center"><i class="dot" style="background:${sportColor(s.sp)}"></i>${SPORTS[s.sp].label} · ${esc(s.sub)}</span></td><td class="num">${fmt(s.n)}</td><td class="num">${hrs(s.mt)}</td><td class="num">${km(s.dist)}</td><td class="num hide-m">${fmt(s.elev)} m</td><td class="num hide-m">${fmt(s.ld)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sin datos</div>';
  $$('#subTbl tbody tr').forEach(tr => tr.onclick = () => { actividades.sub = tr.dataset.sp + '|' + tr.dataset.sub; state.view = 'actividades'; writeHash(true); render(); });

  whenHeatmap($('#when'), acts);
}

function whenHeatmap(el, acts) {
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const a of acts) grid[(a._t.getDay() + 6) % 7][a._t.getHours()]++;
  const data = []; let max = 0;
  grid.forEach((row, d) => row.forEach((n, h) => { data.push([h, d, n]); max = Math.max(max, n); }));
  chart(el, {
    legend: false, grid: { top: 8, bottom: 40, left: 4, right: 8 },
    tooltip: { trigger: 'item', formatter: p => `<b>${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][p.value[1]]} · ${p.value[0]}:00–${p.value[0] + 1}:00</b><br>${p.value[2]} sesiones` },
    xAxis: { type: 'category', data: [...Array(24).keys()].map(h => `${h}h`), splitLine: { show: false } },
    yAxis: { type: 'category', data: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'], inverse: true, splitLine: { show: false } },
    visualMap: { min: 0, max: Math.max(1, max), calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 120, textStyle: { color: css('--muted'), fontSize: 11 }, inRange: { color: [css('--seq-0'), css('--seq-1'), css('--seq-3'), css('--seq-5')] }, text: ['más', 'menos'] },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: css('--surface'), borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: css('--text'), borderWidth: 1 } } }],
  });
}

const IC = {
  up: '<path d="M7 17 17 7M9 7h8v8"/>', down: '<path d="M7 7l10 10M17 9v8H9"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  star: '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>', heart: NAV_ICON.recuperacion, flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', cal: NAV_ICON.calendario,
};
function insights(r, acts, prev) {
  const out = [];
  if (!acts.length) return out;
  const mt = sum(acts, a => a.mt), pmt = sum(prev, a => a.mt);
  const weeks = Math.max(1, daysBetween(r.from, r.to) / 7);
  if (pmt) {
    const p = (mt - pmt) / pmt * 100;
    out.push({ icon: p >= 0 ? IC.up : IC.down, html: `Entrenaste <b>${hrs(mt)} h</b>, ${p >= 0 ? 'un' : 'un'} <b>${fmt(Math.abs(p))}% ${p >= 0 ? 'más' : 'menos'}</b> que en el período anterior.` });
  }
  const wk = mt / 3600 / weeks, g = goals();
  out.push({ icon: IC.clock, html: `Promedio de <b>${fmt(wk, 1)} h por semana</b> (tu rango meta es ${fmt(g.weekHoursMin)}–${fmt(g.weekHoursMax)} h)${wk < g.weekHoursMin ? ': por debajo del rango.' : wk > g.weekHoursMax ? ': por sobre el rango, ojo con la fatiga.' : ': dentro del rango.'}` });
  const bySp = SPORT_KEYS.map(s => [s, sum(acts.filter(a => a.sp === s), a => a.mt)]).sort((a, b) => b[1] - a[1]);
  if (bySp[0][1]) out.push({ icon: ICON[bySp[0][0]], html: `<b>${SPORTS[bySp[0][0]].label}</b> es tu deporte principal: ${fmt(bySp[0][1] / mt * 100)}% del tiempo.` });
  const longest = [...acts].sort((a, b) => b.mt - a.mt)[0];
  out.push({ icon: IC.star, html: `Sesión más larga: <a href="#" data-open="${longest.id}">${esc(longest.name)}</a> · ${durLong(longest.mt)}${longest.dist ? ' · ' + km(longest.dist) + ' km' : ''}.` });
  const prs = sum(acts, a => a.pr);
  if (prs) out.push({ icon: IC.flag, html: `<b>${fmt(prs)} récords personales</b> en segmentos de Strava en este período.` });
  const hrvs = H.hrv.filter(x => pd(x[0]) >= addD(TODAY, -7));
  const base = H.hrv.at(-1)?.[2];
  if (hrvs.length && base) {
    const m = mean(hrvs.map(x => x[1])), p = (m - base) / base * 100;
    out.push({ icon: IC.heart, html: `HRV de los últimos 7 días: <b>${fmt(m)} ms</b>, ${Math.abs(p) < 3 ? 'en línea con' : `${fmt(Math.abs(p))}% ${p > 0 ? 'sobre' : 'bajo'}`} tu línea base (${base} ms).` });
  }
  const fs = fitnessSeries(), now = fs.at(-1), ago = fs.at(-29);
  if (now && ago && ago.ctl > 1) { const p = (now.ctl - ago.ctl) / ago.ctl * 100; out.push({ icon: IC.zap, html: `Tu fitness (CTL) ${Math.abs(p) < 3 ? 'se mantiene estable' : p > 0 ? `subió <b>${fmt(p)}%</b>` : `bajó <b>${fmt(-p)}%</b>`} en las últimas 4 semanas.` }); }
  return out;
}

// estado de hoy
const ST = { good: ['--good', 'Bien'], warning: ['--warning', 'Atención'], serious: ['--serious', 'Bajo'] };
const stHtml = (s, label) => `<span class="status"><i style="background:${css(ST[s][0])}"></i>${label || ST[s][1]}</span>`;
function readinessData() {
  const hrv = H.hrv.slice(-3), base = H.hrv.at(-1)?.[2];
  const out = [];
  if (hrv.length && base) {
    const m = mean(hrv.map(x => x[1])), p = (m - base) / base * 100;
    out.push({ k: 'HRV (3 noches)', v: `${fmt(m)} ms`, sub: `base ${base} ms · ${p >= 0 ? '+' : ''}${fmt(p)}%`, s: p >= -5 ? 'good' : p >= -12 ? 'warning' : 'serious', lbl: p >= -5 ? 'Normal' : p >= -12 ? 'Algo bajo' : 'Bajo' });
  }
  const rhr = H.rhr.slice(-30);
  if (rhr.length > 5) {
    const last = rhr.at(-1)[1], m = mean(rhr.slice(0, -1).map(x => x[1])), d = last - m;
    out.push({ k: 'FC reposo', v: `${last} lpm`, sub: `prom. 30 días ${fmt(m)}`, s: d <= 2 ? 'good' : d <= 5 ? 'warning' : 'serious', lbl: d <= 2 ? 'Normal' : d <= 5 ? 'Algo alta' : 'Alta' });
  }
  const sl = H.sleep.at(-1);
  if (sl) {
    const b = sl[2] || mean(H.sleep.slice(-14).map(x => x[1])), p = (sl[1] - b) / b * 100;
    out.push({ k: 'Sueño anoche', v: `${fmt(sl[1], 1)} h`, sub: `base ${fmt(b, 1)} h`, s: p >= -10 ? 'good' : p >= -20 ? 'warning' : 'serious', lbl: p >= -10 ? 'Suficiente' : p >= -20 ? 'Corto' : 'Muy corto' });
  }
  const f = fitnessSeries(new Set(SPORT_KEYS)).at(-1);
  if (f) out.push({ k: 'Forma (TSB)', v: fmt(f.tsb), sub: `fitness ${fmt(f.ctl)} · fatiga ${fmt(f.atl)}`, s: f.tsb >= -10 ? 'good' : f.tsb >= -25 ? 'warning' : 'serious', lbl: f.tsb > 5 ? 'Fresco' : f.tsb >= -10 ? 'Equilibrado' : f.tsb >= -25 ? 'Cargado' : 'Muy cargado' });
  return out;
}
function readiness(el, wide = false) {
  const d = readinessData();
  if (!d.length) { el.innerHTML = '<div class="empty">Sin datos de recuperación</div>'; return; }
  const worst = d.some(x => x.s === 'serious') ? 'serious' : d.some(x => x.s === 'warning') ? 'warning' : 'good';
  const msg = { good: 'Listo para entrenar con normalidad', warning: 'Entrena, pero modera la intensidad', serious: 'Prioriza recuperar: sesión suave o descanso' }[worst];
  if (wide) {
    el.innerHTML = `<div style="margin-bottom:12px">${stHtml(worst, msg)}</div><div class="stat-grid">${d.map(x => `<div class="stat"><span>${x.k}</span><b>${x.v}</b><small>${x.sub}</small><div style="margin-top:4px">${stHtml(x.s, x.lbl)}</div></div>`).join('')}</div><p class="note">Último dato de Garmin: ${H.hrv.at(-1) ? fDate(pd(H.hrv.at(-1)[0])) : '—'}. Orientativo, no reemplaza cómo te sientes.</p>`;
    return;
  }
  el.innerHTML = `<div style="margin-bottom:10px">${stHtml(worst, msg)}</div><div class="list">${d.map(x => `<div class="row" style="cursor:default;padding:8px 2px"><span class="t"><b>${x.k}</b><small>${x.sub}</small></span><span class="m"><b>${x.v}</b>${stHtml(x.s, x.lbl)}</span></div>`).join('')}</div><p class="note">Último dato de Garmin: ${H.hrv.at(-1) ? fDate(pd(H.hrv.at(-1)[0])) : '—'}. Orientativo, no reemplaza cómo te sientes.</p>`;
}

function rowHtml(a) {
  return `<div class="row" data-id="${a.id}">${icon(a.sp)}<span class="t"><b>${esc(a.name)}</b><small>${fDate(a._t)} · ${fTime(a._t)} · ${esc(a.sub)}</small></span><span class="m"><b>${a.dist ? km(a.dist) + ' km' : durLong(a.mt)}</b>${a.dist ? durLong(a.mt) : (a.hr ? a.hr + ' lpm' : '')}</span></div>`;
}
function bindRows(el) {
  el.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openActivity(o.dataset.open); return; }
    const r = e.target.closest('[data-id]'); if (r) openActivity(r.dataset.id);
  });
}
document.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o && !e.defaultPrevented) { e.preventDefault(); openActivity(o.dataset.open); } });

// ---------------------------------------------------------------- vista: actividades
function actividades(v) {
  const r = range();
  const base = filtered(r);
  const subs = [...new Set(base.map(a => a.sp + '|' + a.sub))].sort();
  const f = actividades.f ||= { env: 'all', min: '', hr: false, pr: false, notes: false, sort: 'd', dir: -1, limit: 50 };
  v.innerHTML = `<div class="card">
    <div class="toolbar">
      <input class="input" id="aq" type="search" placeholder="Filtrar por nombre, nota, lugar, tipo…" value="${esc(state.q)}">
      <select id="asub"><option value="">Todos los tipos</option>${subs.map(s => { const [sp, sub] = s.split('|'); return `<option value="${esc(s)}" ${actividades.sub === s ? 'selected' : ''}>${SPORTS[sp].label} · ${esc(sub)}</option>`; }).join('')}</select>
      <select id="aenv"><option value="all">Interior y exterior</option><option value="out" ${f.env === 'out' ? 'selected' : ''}>Solo exterior</option><option value="in" ${f.env === 'in' ? 'selected' : ''}>Solo interior</option></select>
      <input class="input" id="amin" type="number" min="0" step="1" placeholder="Km mínimos" value="${esc(f.min)}" style="min-width:110px;flex:0">
      <label class="toggle"><input type="checkbox" id="ahr" ${f.hr ? 'checked' : ''}>Con FC</label>
      <label class="toggle"><input type="checkbox" id="apr" ${f.pr ? 'checked' : ''}>Con récords</label>
      <label class="toggle"><input type="checkbox" id="anotes" ${f.notes ? 'checked' : ''}>Con notas</label>
      <button class="btn" id="acsv" type="button"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>CSV</button>
    </div>
    <div id="asum" class="note" style="margin:0 0 10px"></div>
    <div class="tbl-wrap" id="atbl"></div>
    <div class="more" id="amore"></div>
  </div>`;
  const COLS = [
    ['d', 'Fecha', a => `${fDateShort(a._t)} ${a._t.getFullYear()}<br><small style="color:var(--muted)">${fTime(a._t)}</small>`, a => a.d],
    ['name', 'Actividad', a => `<span style="display:inline-flex;gap:9px;align-items:center;max-width:320px">${icon(a.sp, 26)}<span style="overflow:hidden;text-overflow:ellipsis">${esc(a.name)}<br><small style="color:var(--muted);font-weight:400">${esc(a.sub)}${a.loc ? ' · ' + esc(a.loc) : ''}</small></span></span>`, a => norm(a.name)],
    ['dist', 'Distancia', a => a.dist ? km(a.dist) + ' km' : '—', a => a.dist, 'num'],
    ['mt', 'Tiempo', a => dur(a.mt), a => a.mt, 'num'],
    ['pace', 'Ritmo / vel.', a => pace(a), a => a.dist && a.mt ? (a.sp === 'ride' ? -a.dist / a.mt : a.mt / a.dist) : Infinity, 'num hide-m'],
    ['elev', 'Desnivel', a => a.elev ? fmt(a.elev) + ' m' : '—', a => a.elev || 0, 'num hide-m'],
    ['hr', 'FC media', a => a.hr ? a.hr + ' lpm' : '—', a => a.hr || 0, 'num hide-m'],
    ['ld', 'Carga', a => fmt(a.ld), a => a.ld || 0, 'num hide-m'],
    ['pr', '', a => (a.pr ? `<span class="badge" title="Récords personales">🏅 ${a.pr}</span> ` : '') + (a.kud ? `<span class="badge hide-m" title="Kudos">👍 ${a.kud}</span>` : ''), a => a.pr || 0, 'hide-m'],
  ];
  const apply = () => {
    let list = searchActs(state.q, base);
    if (actividades.sub) { const [sp, sub] = actividades.sub.split('|'); list = list.filter(a => a.sp === sp && a.sub === sub); }
    if (f.env !== 'all') list = list.filter(a => f.env === 'in' ? a.indoor : !a.indoor);
    if (+f.min) list = list.filter(a => a.dist >= +f.min * 1000);
    if (f.hr) list = list.filter(a => a.hr); if (f.pr) list = list.filter(a => a.pr); if (f.notes) list = list.filter(a => a.desc);
    const col = COLS.find(c => c[0] === f.sort);
    list = [...list].sort((a, b) => { const x = col[3](a), y = col[3](b); return (x < y ? -1 : x > y ? 1 : 0) * f.dir; });
    return list;
  };
  const draw = () => {
    const list = apply();
    $('#asum').innerHTML = `${fmt(list.length)} actividades · ${hrs(sum(list, a => a.mt))} h · ${km(sum(list, a => a.dist))} km · ${fmt(sum(list, a => a.elev || 0))} m de desnivel`;
    $('#atbl').innerHTML = list.length ? `<table class="tbl"><thead><tr>${COLS.map(c => `<th data-k="${c[0]}" class="${c[4] || ''}">${c[1]} ${f.sort === c[0] ? `<span class="arr">${f.dir > 0 ? '↑' : '↓'}</span>` : ''}</th>`).join('')}</tr></thead><tbody>${list.slice(0, f.limit).map(a => `<tr data-id="${a.id}">${COLS.map(c => `<td class="${c[4] || ''} ${c[0] === 'name' ? 'name' : ''}">${c[2](a)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty">No hay actividades que coincidan con los filtros</div>';
    $('#amore').innerHTML = list.length > f.limit ? `<span>Mostrando ${fmt(f.limit)} de ${fmt(list.length)}</span><button class="btn" id="amoreBtn" type="button">Mostrar más</button>` : '';
    $$('#atbl th').forEach(th => th.onclick = () => { const k = th.dataset.k; if (f.sort === k) f.dir *= -1; else { f.sort = k; f.dir = k === 'name' ? 1 : -1; } draw(); });
    $('#amoreBtn') && ($('#amoreBtn').onclick = () => { f.limit += 100; draw(); });
  };
  bindRows($('#atbl'));
  $('#aq').oninput = e => { state.q = e.target.value; f.limit = 50; writeHash(); draw(); };
  $('#asub').onchange = e => { actividades.sub = e.target.value; draw(); };
  $('#aenv').onchange = e => { f.env = e.target.value; draw(); };
  $('#amin').oninput = e => { f.min = e.target.value; draw(); };
  $('#ahr').onchange = e => { f.hr = e.target.checked; draw(); };
  $('#apr').onchange = e => { f.pr = e.target.checked; draw(); };
  $('#anotes').onchange = e => { f.notes = e.target.checked; draw(); };
  $('#acsv').onclick = () => {
    const list = apply();
    const head = ['fecha', 'nombre', 'deporte', 'tipo', 'distancia_km', 'tiempo_movimiento_s', 'desnivel_m', 'fc_media', 'fc_max', 'potencia_media', 'calorias', 'carga', 'relative_effort', 'rpe', 'lugar', 'strava_id'];
    const rows = list.map(a => [a.d, a.name, SPORTS[a.sp].label, a.sub, (a.dist / 1000).toFixed(2), a.mt, a.elev || '', a.hr || '', a.hrMax || '', a.pw || '', a.cal || '', a.ld || '', a.re ?? '', a.rpe ?? '', a.loc || '', a.sid || '']);
    const csv = [head, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    const l = document.createElement('a'); l.href = url; l.download = `actividades-${dk(TODAY)}.csv`; l.click(); URL.revokeObjectURL(url);
  };
  draw();
}

// ---------------------------------------------------------------- vista: rendimiento
function rendimiento(v) {
  const tab = rendimiento.tab ||= 'run';
  const r = range();
  v.innerHTML = `<div class="tabs" id="rtabs">${['run', 'ride', 'swim'].map(s => `<button type="button" data-t="${s}" class="${tab === s ? 'on' : ''}">${SPORTS[s].label}</button>`).join('')}</div>
    <div class="stat-grid" id="rtiles"></div>
    <div class="grid">
      <div class="card c12"><div class="card-h"><div><h3 id="r1t"></h3><p id="r1s"></p></div><div class="seg" id="envSeg"></div></div><div class="chart lg" id="r1"></div></div>
      <div class="card c6"><div class="card-h"><div><h3 id="r2t"></h3><p id="r2s"></p></div></div><div class="chart" id="r2"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Distancia por sesión</h3><p>Cuántas salidas de cada largo</p></div></div><div class="chart" id="r3"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Intensidad por mes</h3><p>Tiempo en FC baja / media / alta (Garmin vía Tredict)</p></div></div><div class="chart" id="r4"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Récords y mejores marcas</h3><p>En el período · ritmo = promedio de la sesión completa</p></div></div><div class="tbl-wrap" id="rrec"></div></div>
    </div>`;
  $('#rtabs').onclick = e => { const b = e.target.closest('button'); if (b) { rendimiento.tab = b.dataset.t; render(); } };
  const env = rendimiento.env ||= 'out';
  $('#envSeg').innerHTML = [['out', 'Exterior'], ['in', 'Interior'], ['all', 'Todo']].map(([k, l]) => `<button type="button" data-e="${k}" class="${env === k ? 'on' : ''}">${l}</button>`).join('');
  $('#envSeg').onclick = e => { const b = e.target.closest('button'); if (b) { rendimiento.env = b.dataset.e; render(); } };
  let acts = filtered(r, new Set([tab])).filter(a => a.dist > 0 && a.mt > 0);
  if (tab === 'swim') acts = acts.filter(a => a.dist >= 100);
  const envActs = acts.filter(a => env === 'all' || (env === 'in' ? a.indoor : !a.indoor));
  if (!acts.length) { $('#rtiles').innerHTML = '<div class="empty" style="grid-column:1/-1">Sin sesiones de este deporte en el período</div>'; }

  const isRun = tab === 'run', isSwim = tab === 'swim';
  const perf = a => isRun ? a.mt / (a.dist / 1000) : isSwim ? a.mt / (a.dist / 100) : a.dist / a.mt * 3.6;
  const perfF = x => isRun || isSwim ? mmss(x) : fmt(x, 1);
  const perfU = isRun ? '/km' : isSwim ? '/100m' : 'km/h';
  const totD = sum(acts, a => a.dist), totT = sum(acts, a => a.mt);
  const withHr = envActs.filter(a => a.hr);
  const effic = a => (a.dist / a.mt * 60) / a.hr; // metros por latido
  const tiles = [
    ['Sesiones', fmt(acts.length), `${hrs(totT)} h en total`],
    ['Distancia', km(totD) + ' km', `media ${km(totD / Math.max(1, acts.length))} km por sesión`],
    [isRun ? 'Ritmo medio' : isSwim ? 'Ritmo medio' : 'Velocidad media', perfF(isRun ? totT / (totD / 1000) : isSwim ? totT / (totD / 100) : totD / totT * 3.6) + ' ' + perfU, 'ponderado por distancia'],
    ['FC media', withHr.length ? fmt(mean(withHr.map(a => a.hr))) + ' lpm' : '—', `${withHr.length} sesiones con FC`],
    ['Más larga', acts.length ? km(Math.max(...acts.map(a => a.dist))) + ' km' : '—', ''],
    [tab === 'ride' ? 'Desnivel' : 'Cadencia media', tab === 'ride' ? fmt(sum(acts, a => a.elev || 0)) + ' m' : (mean(acts.filter(a => a.cad).map(a => a.cad)) ? fmt(mean(acts.filter(a => a.cad).map(a => a.cad))) + (isRun ? ' ppm' : ' br/min') : '—'), ''],
  ];
  if (acts.length) $('#rtiles').innerHTML = tiles.map(t => `<div class="stat"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');

  // 1. tendencia de ritmo/velocidad
  $('#r1t').textContent = isRun || isSwim ? 'Evolución del ritmo' : 'Evolución de la velocidad';
  $('#r1s').textContent = `Cada punto es una sesión (tamaño = distancia) · línea = media móvil de 30 días`;
  const pts = envActs.map(a => [a._t.getTime(), +perf(a).toFixed(2), a.dist, a.id]).filter(p => isFinite(p[1]) && p[1] > 0 && (isRun ? p[1] < 600 : isSwim ? p[1] < 400 : p[1] < 60));
  const roll = rolling(pts, 30);
  const maxD = Math.max(1, ...pts.map(p => p[2]));
  const c1 = chart($('#r1'), {
    tooltip: { trigger: 'item', formatter: p => { if (p.seriesType === 'line') return `Media 30 días: <b>${perfF(p.value[1])} ${perfU}</b>`; const a = BYID.get(p.value[3]); return `<b>${esc(a.name)}</b><br>${fDate(a._t)}<br>${km(a.dist)} km · ${durLong(a.mt)}<br><b>${perfF(p.value[1])} ${perfU}</b>${a.hr ? ' · ' + a.hr + ' lpm' : ''}`; } },
    xAxis: { type: 'time', splitLine: { show: false } },
    yAxis: { type: 'value', inverse: isRun || isSwim, axisLabel: { formatter: x => perfF(x) }, ...(isRun || isSwim ? { min: v2 => Math.floor(v2.min / 30) * 30, max: v2 => Math.ceil(v2.max / 30) * 30, interval: isRun ? 30 : 15 } : { scale: true }) },
    dataZoom: ZOOM(),
    series: [
      { name: 'Sesión', type: 'scatter', data: pts, symbolSize: p => 6 + 14 * Math.sqrt(p[2] / maxD), itemStyle: { color: sportColor(tab), opacity: .55, borderColor: css('--surface'), borderWidth: 1 } },
      { name: 'Media 30 días', type: 'line', data: roll, symbol: 'none', smooth: .2, lineStyle: { width: 2, color: css('--text-2') }, itemStyle: { color: css('--text-2') } },
    ],
  });
  c1.on('click', p => p.seriesType === 'scatter' && openActivity(p.value[3]));

  // 2. eficiencia aeróbica o volumen mensual
  if (!isSwim && withHr.length > 2) {
    $('#r2t').textContent = 'Eficiencia aeróbica';
    $('#r2s').textContent = `Metros recorridos por latido (más alto = mejor) · ${env === 'out' ? 'solo exterior' : env === 'in' ? 'solo interior' : 'todas'}`;
    const ep = withHr.map(a => [a._t.getTime(), +effic(a).toFixed(3), a.dist, a.id]).filter(p => p[1] > 0 && p[1] < 6);
    const c2 = chart($('#r2'), {
      tooltip: { trigger: 'item', formatter: p => { if (p.seriesType === 'line') return `Media 30 días: <b>${fmt(p.value[1], 2)} m/latido</b>`; const a = BYID.get(p.value[3]); return `<b>${esc(a.name)}</b><br>${fDate(a._t)}<br>${pace(a)} · ${a.hr} lpm<br><b>${fmt(p.value[1], 2)} m/latido</b>`; } },
      xAxis: { type: 'time', splitLine: { show: false } }, yAxis: { type: 'value', scale: true, axisLabel: { formatter: x => fmt(x, 2) } },
      series: [
        { name: 'Sesión', type: 'scatter', data: ep, symbolSize: 8, itemStyle: { color: sportColor(tab), opacity: .55, borderColor: css('--surface'), borderWidth: 1 } },
        { name: 'Media 30 días', type: 'line', data: rolling(ep, 30), symbol: 'none', lineStyle: { width: 2, color: css('--text-2') }, itemStyle: { color: css('--text-2') } },
      ],
    });
    c2.on('click', p => p.seriesType === 'scatter' && openActivity(p.value[3]));
  } else {
    $('#r2t').textContent = 'Volumen mensual'; $('#r2s').textContent = 'Kilómetros por mes';
    const bks = bucketList(r.from, lastDay(r), 'month'), m = new Map(bks.map(b => [b, 0]));
    for (const a of acts) { const b = bucketKey(a._t, 'month'); if (m.has(b)) m.set(b, m.get(b) + a.dist / 1000); }
    chart($('#r2'), { legend: false, xAxis: { type: 'category', data: bks.map(b => bucketLabel(b, 'month')) }, yAxis: { type: 'value' }, tooltip: { valueFormatter: x => fmt(x, 1) + ' km' }, series: [{ name: 'Km', type: 'bar', data: [...m.values()].map(x => +x.toFixed(2)), barMaxWidth: 26, itemStyle: { color: sportColor(tab), borderRadius: [4, 4, 0, 0] } }] });
  }

  // 3. histograma de distancias
  const edges = isRun ? [0, 5, 8, 12, 16, 21.1, 30, 999] : isSwim ? [0, .5, 1, 1.5, 2, 3, 999] : [0, 20, 40, 60, 80, 100, 150, 9999];
  const lbls = edges.slice(0, -1).map((e, i) => edges[i + 1] >= 999 ? `${fmt(e, e % 1 ? 1 : 0)}+ km` : `${fmt(e, e % 1 ? 1 : 0)}–${fmt(edges[i + 1], edges[i + 1] % 1 ? 1 : 0)}`);
  const hist = lbls.map(() => 0);
  for (const a of acts) { const k2 = a.dist / 1000; const i = edges.findIndex((e, j) => k2 >= e && k2 < edges[j + 1]); if (i >= 0) hist[i]++; }
  chart($('#r3'), { legend: false, grid: { left: 4 }, xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', data: lbls, inverse: true, splitLine: { show: false } }, tooltip: { trigger: 'item', formatter: p => `<b>${p.name} km</b><br>${p.value} sesiones` }, series: [{ type: 'bar', data: hist, barMaxWidth: 22, itemStyle: { color: sportColor(tab), borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: css('--text-2'), fontSize: 11, formatter: p => p.value || '' } }] });

  // 4. intensidad mensual (Tredict)
  const key = { run: 'running', ride: 'cycling', swim: 'swimming' }[tab];
  const months = Object.entries(H.intensity[key] || {}).filter(([m]) => { const d = pd(m.slice(0, 4) + '-' + m.slice(4) + '-01'); return d >= new Date(r.from.getFullYear(), r.from.getMonth(), 1) && d < r.to; }).sort();
  if (months.length) {
    const ramp = [css('--seq-2'), css('--seq-3'), css('--seq-5')];
    chart($('#r4'), {
      xAxis: { type: 'category', data: months.map(([m]) => `${MES[+m.slice(4) - 1]} ${m.slice(2, 4)}`) }, yAxis: { type: 'value', axisLabel: { formatter: x => x + '%' }, max: 100 },
      tooltip: { formatter: ps => `<b>${ps[0].axisValue}</b>` + ps.map(p => ttRow(p.color, p.seriesName, `${fmt(p.value)}% · ${fmt(p.data.min / 60, 1)} h`)).join('') },
      series: ['FC baja', 'FC media', 'FC alta'].map((n, i) => ({ name: n, type: 'bar', stack: 'i', barMaxWidth: 26, itemStyle: { color: ramp[i], borderColor: css('--surface'), borderWidth: 1 }, data: months.map(([, z]) => { const t = z.reduce((s, x) => s + x, 0) || 1; return { value: +(z[i] / t * 100).toFixed(1), min: z[i] }; }) })),
    });
  } else $('#r4').innerHTML = '<div class="empty">Garmin/Tredict tiene distribución de intensidad desde julio 2025. Amplía el período.</div>';

  // récords
  const rec = [];
  const top = (label, arr, val, sub) => { const a = arr[0]; if (a) rec.push([label, val(a), a, sub ? sub(a) : '']); };
  top('Más larga (distancia)', [...acts].sort((a, b) => b.dist - a.dist), a => km(a.dist) + ' km', a => durLong(a.mt));
  top('Más larga (tiempo)', [...acts].sort((a, b) => b.mt - a.mt), a => durLong(a.mt), a => km(a.dist) + ' km');
  if (!isSwim) top('Más desnivel', [...acts].sort((a, b) => (b.elev || 0) - (a.elev || 0)), a => fmt(a.elev) + ' m', a => km(a.dist) + ' km');
  const thr = isRun ? [[5, '5 km'], [10, '10 km'], [21.1, 'media maratón'], [42, 'maratón']] : isSwim ? [[1, '1 km'], [1.9, '1,9 km']] : [[40, '40 km'], [90, '90 km']];
  for (const [d, l] of thr) {
    const arr = acts.filter(a => a.dist >= d * 1000 * .98 && !a.indoor).sort((a, b) => isRun || isSwim ? perf(a) - perf(b) : perf(b) - perf(a));
    top(`${isRun || isSwim ? 'Ritmo' : 'Velocidad'} más rápido · sesiones ≥ ${l}`, arr, a => perfF(perf(a)) + ' ' + perfU, a => km(a.dist) + ' km · ' + dur(a.mt));
  }
  top('Mayor carga', [...acts].sort((a, b) => (b.ld || 0) - (a.ld || 0)), a => fmt(a.ld), a => a.hr ? a.hr + ' lpm' : '');
  const wk = {}; for (const a of acts) { const k = dk(sow(a._t)); wk[k] = (wk[k] || 0) + a.dist; }
  const bw = Object.entries(wk).sort((a, b) => b[1] - a[1])[0];
  $('#rrec').innerHTML = `<table class="tbl"><thead><tr><th>Marca</th><th class="num">Valor</th><th>Sesión</th></tr></thead><tbody>${rec.map(([l, val, a, sub]) => `<tr data-id="${a.id}"><td style="white-space:normal">${l}</td><td class="num"><b>${val}</b><br><small style="color:var(--muted)">${sub}</small></td><td class="name" style="max-width:200px">${esc(a.name)}<br><small style="color:var(--muted);font-weight:400">${fDate(a._t)}</small></td></tr>`).join('')}${bw ? `<tr style="cursor:default"><td>Semana con más kilómetros</td><td class="num"><b>${km(bw[1])} km</b></td><td>Semana del ${fDateShort(pd(bw[0]))} ${pd(bw[0]).getFullYear()}</td></tr>` : ''}</tbody></table>`;
  bindRows($('#rrec'));
}
function rolling(pts, days) {
  const s = [...pts].sort((a, b) => a[0] - b[0]), out = [], w = days * 864e5;
  let j = 0, acc = 0;
  for (let i = 0; i < s.length; i++) {
    acc += s[i][1];
    while (s[j][0] < s[i][0] - w) { acc -= s[j][1]; j++; }
    if (i - j + 1 >= 3) out.push([s[i][0], +(acc / (i - j + 1)).toFixed(3)]);
  }
  return out;
}

// ---------------------------------------------------------------- vista: carga y forma
function carga(v) {
  const r = range(), fs = fitnessSeries(), win = fs.filter(x => x.d >= r.from && x.d < r.to);
  const now = fs.at(-1);
  v.innerHTML = `<div class="stat-grid" id="ctiles"></div>
    <div class="grid">
      <div class="card c12"><div class="card-h"><div><h3>Fitness y fatiga</h3><p>Fitness (CTL, 42 días) y fatiga (ATL, 7 días) a partir de la carga diaria · barras = carga del día</p></div></div><div class="chart lg" id="cfit"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Forma (TSB)</h3><p>Fitness − fatiga. Positivo = fresco; muy negativo = acumulando cansancio</p></div></div><div class="chart" id="ctsb"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Relación aguda:crónica</h3><p>Carga 7 días vs 28 días · zona segura 0,8–1,3</p></div></div><div class="chart" id="cacwr"></div></div>
      <div class="card c12"><div class="card-h"><div><h3>Carga semanal por deporte</h3><p>Suma de la carga de cada semana</p></div></div><div class="chart" id="cweek"></div></div>
    </div>
    <p class="note">Carga = esfuerzo de Tredict (calculado con FC de Garmin) desde ${fDate(pd(DATA.meta.firstGarmin))}; antes se estima con el Relative Effort de Strava × ${fmt(DATA.meta.loadScale, 2)} para mantener la misma escala. Respeta el filtro de deportes.</p>`;
  const prev28 = fs.at(-29);
  const tsbS = now.tsb > 5 ? ['good', 'Fresco'] : now.tsb >= -10 ? ['good', 'Equilibrado'] : now.tsb >= -25 ? ['warning', 'Cargado'] : ['serious', 'Muy cargado'];
  const ac = now.acwr, acS = ac == null ? null : ac < .8 ? ['warning', 'Carga baja'] : ac <= 1.3 ? ['good', 'Zona segura'] : ac <= 1.5 ? ['warning', 'Subiendo rápido'] : ['serious', 'Riesgo de sobrecarga'];
  const w7 = fs.slice(-7).map(x => x.load), mono = mean(w7) / (Math.sqrt(mean(w7.map(x => (x - mean(w7)) ** 2))) || 1);
  $('#ctiles').innerHTML = [
    ['Fitness (CTL)', fmt(now.ctl), prev28 ? `${now.ctl >= prev28.ctl ? '▲' : '▼'} ${fmt(Math.abs(now.ctl - prev28.ctl))} vs hace 4 semanas` : ''],
    ['Fatiga (ATL)', fmt(now.atl), 'últimos 7 días ponderados'],
    ['Forma (TSB)', fmt(now.tsb), stHtml(...tsbS.slice(0, 1), tsbS[1])],
    ['Aguda:crónica', ac ? fmt(ac, 2) : '—', acS ? stHtml(acS[0], acS[1]) : ''],
    ['Carga 7 días', fmt(sum(fs.slice(-7), x => x.load)), `promedio 4 sem.: ${fmt(sum(fs.slice(-28), x => x.load) / 4)}`],
    ['Monotonía', fmt(mono, 1), mono > 2 ? stHtml('warning', 'Poca variación') : 'variedad de carga OK'],
  ].map(t => `<div class="stat"><span>${t[0]}</span><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');
  const x = win.map(p => p.k);
  const lbl = k => fDate(pd(k));
  chart($('#cfit'), {
    xAxis: { type: 'category', data: x, axisLabel: { formatter: k => { const d = pd(k); return fDateShort(d); } } },
    yAxis: { type: 'value' }, dataZoom: ZOOM(),
    tooltip: { formatter: ps => `<b>${lbl(ps[0].axisValue)}</b>` + ps.map(p => ttRow(p.color, p.seriesName, fmt(p.value))).join('') },
    series: [
      { name: 'Carga del día', type: 'bar', data: win.map(p => p.load), itemStyle: { color: css('--seq-1') }, barMaxWidth: 8 },
      { name: 'Fitness (CTL)', type: 'line', data: win.map(p => +p.ctl.toFixed(1)), symbol: 'none', lineStyle: { width: 2.2, color: css('--ride') }, itemStyle: { color: css('--ride') }, areaStyle: { color: css('--accent-soft'), opacity: .5 } },
      { name: 'Fatiga (ATL)', type: 'line', data: win.map(p => +p.atl.toFixed(1)), symbol: 'none', lineStyle: { width: 2, color: css('--run') }, itemStyle: { color: css('--run') } },
    ],
  });
  const blue = css('--ride'), red = css('--critical');
  chart($('#ctsb'), {
    legend: false, xAxis: { type: 'category', data: x, axisLabel: { formatter: k => fDateShort(pd(k)) } }, yAxis: { type: 'value' },
    tooltip: { formatter: ps => `<b>${lbl(ps[0].axisValue)}</b><br>Forma: <b>${fmt(ps[0].value)}</b>` },
    series: [{ name: 'TSB', type: 'bar', barCategoryGap: '10%', data: win.map(p => ({ value: +p.tsb.toFixed(1), itemStyle: { color: p.tsb < 0 ? red : blue } })),
      markLine: { silent: true, symbol: 'none', label: { color: css('--muted'), fontSize: 10, position: 'insideStartTop' }, lineStyle: { color: css('--line'), type: 'solid' }, data: [{ yAxis: 0, label: { formatter: '0' } }, { yAxis: -25, label: { formatter: 'muy cargado' } }, { yAxis: 10, label: { formatter: 'fresco' } }] } }],
  });
  chart($('#cacwr'), {
    legend: false, xAxis: { type: 'category', data: x, axisLabel: { formatter: k => fDateShort(pd(k)) } }, yAxis: { type: 'value', min: 0, max: v2 => Math.max(2, Math.ceil(v2.max * 10) / 10) },
    tooltip: { formatter: ps => `<b>${lbl(ps[0].axisValue)}</b><br>Aguda:crónica <b>${ps[0].value == null ? '—' : fmt(ps[0].value, 2)}</b>` },
    series: [{ type: 'line', data: win.map(p => p.acwr == null ? null : +p.acwr.toFixed(2)), symbol: 'none', lineStyle: { width: 1.8, color: css('--text-2') },
      markArea: { silent: true, itemStyle: { color: css('--good'), opacity: .1 }, data: [[{ yAxis: .8 }, { yAxis: 1.3 }]] },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: css('--serious'), type: 'solid', opacity: .6 }, label: { formatter: '1,5', color: css('--muted'), fontSize: 10 }, data: [{ yAxis: 1.5 }] } }],
  });
  const bks = bucketList(r.from, lastDay(r), 'week'), acts = filtered(r);
  chart($('#cweek'), {
    xAxis: { type: 'category', data: bks.map(b => bucketLabel(b, 'week')) }, yAxis: { type: 'value' },
    tooltip: { formatter: ps => `<b>Semana del ${ps[0].axisValue}</b>` + ps.filter(p => p.value).map(p => ttRow(p.color, p.seriesName, fmt(p.value))).join('') + ttRow('transparent', 'Total', fmt(ps.reduce((s, p) => s + (p.value || 0), 0))) },
    series: SPORT_KEYS.filter(s => state.sports.has(s)).map(s => { const m = new Map(bks.map(b => [b, 0])); for (const a of acts) if (a.sp === s) { const b = bucketKey(a._t, 'week'); if (m.has(b)) m.set(b, m.get(b) + (a.ld || 0)); } return { name: SPORTS[s].label, type: 'bar', stack: 'w', barMaxWidth: 22, data: [...m.values()], itemStyle: { color: sportColor(s), borderColor: css('--surface'), borderWidth: 1 } }; }).filter(s => s.data.some(Boolean)),
  });
}

// ---------------------------------------------------------------- vista: recuperación
function recuperacion(v) {
  const r = range();
  const inr = arr => arr.filter(x => { const d = pd(x[0]); return d >= r.from && d < r.to; });
  const hrv = inr(H.hrv), sleep = inr(H.sleep), rhr = inr(H.rhr), weight = inr(H.weight);
  v.innerHTML = `<div class="grid">
      <div class="card c12"><div class="card-h"><div><h3>Estado de hoy</h3><p>Comparado con tu propia línea base</p></div></div><div id="ready"></div></div>
      <div class="card c12"><div class="card-h"><div><h3>Variabilidad cardíaca (HRV)</h3><p>RMSSD nocturno de Garmin y su línea base de 2 semanas</p></div></div><div class="chart" id="hhrv"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Sueño</h3><p>Horas por noche y línea base</p></div></div><div class="chart" id="hsleep"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>FC en reposo</h3><p>Mínimo diario (dinámico) · línea = media de 7 días</p></div></div><div class="chart" id="hrhr"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>¿La carga afecta tu HRV?</h3><p id="corrTxt">Carga del día vs HRV de esa noche</p></div></div><div class="chart" id="hcorr"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Disfrute y esfuerzo percibido</h3><p>Lo que anotas en Garmin después de entrenar</p></div></div><div class="chart" id="henj"></div></div>
    </div>
    <p class="note">Datos de salud desde Garmin Connect vía Tredict (historial desde ${H.hrv[0] ? fDate(pd(H.hrv[0][0])) : '—'}). Peso registrado: ${H.weight.length ? H.weight.map(w => `${fmt(w[1], 1)} kg (${fDateShort(pd(w[0]))} ${w[0].slice(0, 4)})`).join(', ') : '—'}.</p>`;
  readiness($('#ready'), true);
  const ids = [];
  const gap = arr => { const out = []; for (let i = 0; i < arr.length; i++) { if (i && arr[i][0] - arr[i - 1][0] > 3 * 864e5) out.push([arr[i - 1][0] + 864e5, null]); out.push(arr[i]); } return out; };
  const tline = (el, name, data, color, extra = [], opts = {}) => {
    const c = chart(el, {
      xAxis: { type: 'time', splitLine: { show: false } }, yAxis: { type: 'value', scale: true, ...opts.y },
      tooltip: { formatter: ps => `<b>${fDate(new Date(ps[0].value[0]))}</b>` + ps.filter(p => p.value[1] != null).map(p => ttRow(p.color, p.seriesName, fmt(p.value[1], opts.dec || 0) + (opts.u || ''))).join('') },
      dataZoom: ZOOM(),
      series: [{ name, type: opts.bar ? 'bar' : 'line', data: opts.bar ? data : gap(data), symbol: 'circle', symbolSize: 4, showSymbol: data.length < 60, barMaxWidth: 8, lineStyle: { width: 1.6, color }, itemStyle: { color, borderRadius: opts.bar ? [3, 3, 0, 0] : 0 } }, ...extra],
    });
    c.group = 'health'; ids.push(c);
  };
  const T = s => pd(s).getTime();
  tline($('#hhrv'), 'HRV', hrv.map(x => [T(x[0]), x[1]]), css('--ride'), [{ name: 'Línea base', type: 'line', data: gap(hrv.filter(x => x[2]).map(x => [T(x[0]), x[2]])), symbol: 'none', lineStyle: { width: 2, color: css('--muted') }, itemStyle: { color: css('--muted') } }], { u: ' ms' });
  tline($('#hsleep'), 'Sueño', sleep.map(x => [T(x[0]), x[1]]), css('--violet') || css('--seq-3'), [{ name: 'Línea base', type: 'line', data: gap(sleep.filter(x => x[2]).map(x => [T(x[0]), x[2]])), symbol: 'none', lineStyle: { width: 2, color: css('--muted') }, itemStyle: { color: css('--muted') } }], { bar: true, u: ' h', dec: 1, y: { scale: false, min: 0 } });
  const r7 = rhr.map((x, i) => [T(x[0]), mean(rhr.slice(Math.max(0, i - 6), i + 1).map(y => y[1]))]);
  tline($('#hrhr'), 'FC reposo', rhr.map(x => [T(x[0]), x[1]]), css('--run'), [{ name: 'Media 7 días', type: 'line', data: gap(r7), symbol: 'none', lineStyle: { width: 2, color: css('--muted') }, itemStyle: { color: css('--muted') } }], { u: ' lpm' });
  echarts.connect('health');

  // correlación carga vs HRV
  const loadDay = {}; for (const a of ACTS) { const k = a.d.slice(0, 10); loadDay[k] = (loadDay[k] || 0) + (a.ld || 0); }
  const cp = hrv.map(x => { const prevDay = dk(addD(pd(x[0]), -1)); return [loadDay[prevDay] || 0, x[1], x[0]]; });
  const n = cp.length, mx = mean(cp.map(p => p[0])), my = mean(cp.map(p => p[1]));
  const cov = sum(cp, p => (p[0] - mx) * (p[1] - my)), vx = sum(cp, p => (p[0] - mx) ** 2), vy = sum(cp, p => (p[1] - my) ** 2);
  const rr = vx && vy ? cov / Math.sqrt(vx * vy) : 0, slope = vx ? cov / vx : 0;
  const xs = cp.map(p => p[0]);
  if (n > 5) $('#corrTxt').innerHTML = `Carga del día vs HRV de esa noche · <b>r = ${fmt(rr, 2)}</b>: ${Math.abs(rr) < .15 ? 'casi sin relación' : rr < 0 ? 'más carga → HRV más bajo esa noche' : 'más carga → HRV más alto'}`;
  chart($('#hcorr'), {
    legend: false, grid: { top: 30 },
    tooltip: { trigger: 'item', formatter: p => p.seriesType === 'scatter' ? `<b>Noche del ${fDate(pd(p.value[2]))}</b><br>Carga del día: ${fmt(p.value[0])}<br>HRV: ${p.value[1]} ms` : '' },
    xAxis: { type: 'value', name: 'carga del día', nameLocation: 'middle', nameGap: 24, nameTextStyle: { color: css('--muted') } }, yAxis: { type: 'value', scale: true, name: 'HRV ms', nameTextStyle: { color: css('--muted') } },
    series: [{ type: 'scatter', data: cp, symbolSize: 7, itemStyle: { color: css('--ride'), opacity: .5 } },
      ...(n > 5 ? [{ type: 'line', symbol: 'none', silent: true, data: [[Math.min(...xs), my + slope * (Math.min(...xs) - mx)], [Math.max(...xs), my + slope * (Math.max(...xs) - mx)]], lineStyle: { color: css('--text-2'), width: 2 } }] : [])],
  });

  // disfrute / RPE por mes
  const rated = filtered(r).filter(a => a.enj != null || a.rpe != null);
  if (rated.length) {
    const bks = bucketList(r.from, lastDay(r), 'month');
    const agg = k => bks.map(b => { const xs2 = rated.filter(a => bucketKey(a._t, 'month') === b && a[k] != null).map(a => a[k]); return xs2.length ? +mean(xs2).toFixed(2) : null; });
    chart($('#henj'), {
      xAxis: { type: 'category', data: bks.map(b => bucketLabel(b, 'month')) },
      yAxis: [{ type: 'value', min: 1, max: 10, name: 'RPE / 10', nameTextStyle: { color: css('--muted') } }],
      tooltip: { formatter: ps => `<b>${ps[0].axisValue}</b>` + ps.filter(p => p.value != null).map(p => ttRow(p.color, p.seriesName, p.seriesName.startsWith('Disfrute') ? `${fmt(p.value, 1)} · ${enjoyLabel((p.value - 1) / 9 * 2 + 1)}` : `${fmt(p.value, 1)} · ${RPE[Math.round(p.value)]}`)).join('') },
      series: [
        { name: 'Esfuerzo percibido (RPE)', type: 'line', data: agg('rpe'), connectNulls: true, symbolSize: 7, lineStyle: { width: 2, color: css('--run') }, itemStyle: { color: css('--run') } },
        { name: 'Disfrute (escala 1–10)', type: 'line', data: agg('enj').map(x => x == null ? null : +(1 + (x - 1) / 2 * 9).toFixed(2)), connectNulls: true, symbolSize: 7, lineStyle: { width: 2, color: css('--swim') }, itemStyle: { color: css('--swim') } },
      ],
    });
  } else $('#henj').innerHTML = '<div class="empty">Aún no hay sesiones calificadas en este período. Califica disfrute y esfuerzo en Garmin/Tredict después de entrenar y aparecerán aquí.</div>';
}

// ---------------------------------------------------------------- vista: mapa
let mapObj = null;
async function mapa(v) {
  v.innerHTML = `<div class="card" style="padding:12px 14px"><div class="toolbar" style="margin:0;justify-content:space-between">
      <div class="map-legend" id="mleg"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" id="mmode"></div><button class="btn" id="mfit" type="button">Ver todo</button></div></div></div>
    <div class="map" id="map"><div class="loading">Cargando rutas…</div></div>
    <p class="note">Rutas resumidas de Strava. Por privacidad se ocultan los primeros y últimos 400 m de cada ruta. Toca una línea para ver la actividad.</p>`;
  if (!ROUTES) ROUTES = await loadRoutes();
  if (state.view !== 'mapa' || !$('#map')) return;
  const mode = mapa.mode ||= 'heat';
  $('#mmode').innerHTML = [['heat', 'Calor'], ['sport', 'Por deporte']].map(([k, l]) => `<button type="button" data-m="${k}" class="${mode === k ? 'on' : ''}">${l}</button>`).join('');
  $('#mmode').onclick = e => { const b = e.target.closest('button'); if (b) { mapa.mode = b.dataset.m; render(); } };
  const acts = filtered().filter(a => ROUTES[a.id]);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light' || document.documentElement.dataset.theme === 'dark';
  const heatDark = mode === 'heat' || dark;
  $('#map').innerHTML = '';
  mapObj = L.map('map', { preferCanvas: true, zoomControl: true, attributionControl: true });
  L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${heatDark ? 'World_Dark_Gray_Base' : 'World_Light_Gray_Base'}/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 16, attribution: 'Mapa base © Esri, HERE, Garmin, © OpenStreetMap' }).addTo(mapObj);
  const renderer = L.canvas({ padding: .5 });
  const bounds = [], lines = [];
  const cnt = {};
  const heat = '#ff7a3d';
  for (const a of acts) {
    const pts = decodePoly(ROUTES[a.id]);
    cnt[a.sp] = (cnt[a.sp] || 0) + 1;
    const col = mode === 'heat' ? heat : sportColor(a.sp);
    const ln = L.polyline(pts, { renderer, color: col, weight: mode === 'heat' ? 2 : 2.2, opacity: mode === 'heat' ? .32 : .55, interactive: true });
    ln.on('click', ev => {
      lines.forEach(l => l.setStyle({ opacity: mode === 'heat' ? .12 : .2 })); ln.setStyle({ opacity: 1, weight: 4 }); ln.bringToFront();
      L.popup().setLatLng(ev.latlng).setContent(`<b>${esc(a.name)}</b><br>${fDate(a._t)} · ${km(a.dist)} km<br><a href="#" data-open="${a.id}">Ver detalle</a>`).openOn(mapObj);
    });
    ln.addTo(mapObj); lines.push(ln); bounds.push(...pts);
  }
  mapObj.on('popupclose', () => lines.forEach(l => l.setStyle({ opacity: mode === 'heat' ? .32 : .55, weight: mode === 'heat' ? 2 : 2.2 })));
  $('#mleg').innerHTML = `<b style="color:var(--text)">${fmt(acts.length)} rutas</b>` + (mode === 'sport' ? Object.entries(cnt).map(([s, n]) => `<span><i style="background:${sportColor(s)}"></i>${SPORTS[s].label} ${n}</span>`).join('') : '<span>Más brillante = más pasadas</span>');
  const fitAll = () => bounds.length && mapObj.fitBounds(L.latLngBounds(bounds), { padding: [20, 20] });
  $('#mfit').onclick = fitAll;
  if (!bounds.length) { mapObj.setView([-33.44, -70.62], 11); return; }
  // centrar en la zona más frecuente (mediana de inicios)
  const lat = median(acts.map(a => decodePoly(ROUTES[a.id])[0][0])), lng = median(acts.map(a => decodePoly(ROUTES[a.id])[0][1]));
  const near = bounds.filter(p => Math.abs(p[0] - lat) < .5 && Math.abs(p[1] - lng) < .6);
  mapObj.fitBounds(L.latLngBounds(near.length > 50 ? near : bounds), { padding: [20, 20] });
}
const polyCache = new Map();
function decodePoly(str) {
  if (polyCache.has(str)) return polyCache.get(str);
  let i = 0, lat = 0, lng = 0; const pts = [];
  while (i < str.length) {
    for (const w of [0, 1]) { let b, sh = 0, res = 0; do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); const d = (res & 1) ? ~(res >> 1) : (res >> 1); if (w === 0) lat += d; else lng += d; }
    pts.push([lat / 1e5, lng / 1e5]);
  }
  polyCache.set(str, pts); return pts;
}

// ---------------------------------------------------------------- vista: calendario
function calendario(v) {
  const years = [...new Set(ACTS.map(a => a._t.getFullYear()))].sort();
  const year = calendario.year ||= TODAY.getFullYear();
  const metric = calendario.metric ||= 'time';
  const cm = calendario.month ||= new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  v.innerHTML = `<div class="card"><div class="card-h"><div><h3>Año ${year}</h3><p id="ysum"></p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" id="cmet"></div><select id="cyear">${years.map(y => `<option ${y === year ? 'selected' : ''}>${y}</option>`).join('')}</select></div></div>
      <div class="chart" id="ccal" style="height:210px"></div><div id="cday"></div></div>
    <div class="card"><div class="card-h"><div><h3 id="mtitle"></h3><p id="msum"></p></div><div style="display:flex;gap:6px"><button class="btn" id="mprev" type="button">←</button><button class="btn" id="mnow" type="button">Hoy</button><button class="btn" id="mnext" type="button">→</button></div></div><div class="month-grid" id="mgrid"></div></div>
    <div class="card"><div class="card-h"><div><h3>Resumen por mes</h3><p>Horas por deporte, año ${year}</p></div></div><div class="tbl-wrap" id="mtbl"></div></div>`;
  const M = { time: ['Horas', a => a.mt / 3600, 1], dist: ['Km', a => a.dist / 1000, 0], load: ['Carga', a => a.ld || 0, 0], sessions: ['Sesiones', () => 1, 0] };
  $('#cmet').innerHTML = Object.entries(M).map(([k, [l]]) => `<button type="button" data-m="${k}" class="${metric === k ? 'on' : ''}">${l}</button>`).join('');
  $('#cmet').onclick = e => { const b = e.target.closest('button'); if (b) { calendario.metric = b.dataset.m; render(); } };
  $('#cyear').onchange = e => { calendario.year = +e.target.value; render(); };
  const ya = ACTS.filter(a => a._t.getFullYear() === year && state.sports.has(a.sp));
  const byDay = {}; for (const a of ya) { const k = a.d.slice(0, 10); (byDay[k] ||= []).push(a); }
  const [ml, mf, md] = M[metric];
  const data = Object.entries(byDay).map(([k, arr]) => [k, +sum(arr, mf).toFixed(2)]);
  const max = Math.max(1, ...data.map(d => d[1]));
  const daysOn = Object.keys(byDay).length;
  $('#ysum').textContent = `${fmt(ya.length)} sesiones · ${hrs(sum(ya, a => a.mt))} h · ${km(sum(ya, a => a.dist))} km · ${daysOn} días activos · racha más larga ${longestStreak(Object.keys(byDay))} días`;
  const narrow = innerWidth < 700;
  const c = chart($('#ccal'), {
    legend: false, tooltip: { trigger: 'item', formatter: p => { const arr = byDay[p.value[0]] || []; return `<b>${fDate(pd(p.value[0]))}</b><br>${fmt(p.value[1], md)} ${ml.toLowerCase()}` + arr.map(a => ttRow(sportColor(a.sp), esc(a.name).slice(0, 34), durLong(a.mt))).join(''); } },
    visualMap: { show: false, min: 0, max: max * .8, inRange: { color: [css('--seq-1'), css('--seq-3'), css('--seq-5')] } },
    calendar: { range: String(year), top: 26, left: narrow ? 20 : 34, right: 8, bottom: 4, cellSize: ['auto', narrow ? 11 : 20], splitLine: { show: false }, itemStyle: { color: css('--seq-0'), borderColor: css('--surface'), borderWidth: 2 }, yearLabel: { show: false }, dayLabel: { firstDay: 1, nameMap: ['D', 'L', 'M', 'M', 'J', 'V', 'S'], color: css('--muted'), fontSize: 10 }, monthLabel: { nameMap: MES, color: css('--muted'), fontSize: 11 } },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data, itemStyle: { borderRadius: 3 } }],
  });
  c.on('click', p => { const arr = byDay[p.value[0]] || []; $('#cday').innerHTML = `<h3 style="font-size:14px;margin:14px 0 4px">${fDate(pd(p.value[0]))}</h3><div class="list">${arr.map(rowHtml).join('')}</div>`; bindRows($('#cday')); });

  // mes
  const drawMonth = () => {
    const m0 = calendario.month, start = sow(m0), end = new Date(m0.getFullYear(), m0.getMonth() + 1, 0);
    $('#mtitle').textContent = `${MES_L[m0.getMonth()][0].toUpperCase() + MES_L[m0.getMonth()].slice(1)} ${m0.getFullYear()}`;
    const ma = ACTS.filter(a => a._t >= m0 && a._t <= addD(end, 1) && a._t.getMonth() === m0.getMonth() && state.sports.has(a.sp));
    $('#msum').textContent = `${ma.length} sesiones · ${hrs(sum(ma, a => a.mt))} h · ${km(sum(ma, a => a.dist))} km`;
    let html = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(d => `<div class="dow">${d}</div>`).join('');
    for (let d = start; d <= end || (d.getDay() !== 1); d = addD(d, 1)) {
      const k = dk(d), arr = ACTS.filter(a => a.d.startsWith(k) && state.sports.has(a.sp));
      html += `<div class="day ${d.getMonth() !== m0.getMonth() ? 'out' : ''} ${+d === +TODAY ? 'today' : ''}"><span class="n">${d.getDate()}</span>${arr.map(a => `<span class="a" data-id="${a.id}" title="${esc(a.name)}"><i class="dot" style="background:${sportColor(a.sp)};width:8px;height:8px"></i><span>${a.dist ? km(a.dist) + ' km' : durLong(a.mt)}</span></span>`).join('')}</div>`;
      if (d > end && d.getDay() === 0) break;
    }
    $('#mgrid').innerHTML = html;
  };
  bindRows($('#mgrid'));
  $('#mprev').onclick = () => { calendario.month = addM(calendario.month, -1); drawMonth(); };
  $('#mnext').onclick = () => { calendario.month = addM(calendario.month, 1); drawMonth(); };
  $('#mnow').onclick = () => { calendario.month = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1); drawMonth(); };
  drawMonth();

  // tabla mensual
  const sps = SPORT_KEYS.filter(s => state.sports.has(s) && ya.some(a => a.sp === s));
  $('#mtbl').innerHTML = `<table class="tbl"><thead><tr><th>Mes</th>${sps.map(s => `<th class="num"><span style="display:inline-flex;gap:6px;align-items:center"><i class="dot" style="background:${sportColor(s)}"></i>${SPORTS[s].label}</span></th>`).join('')}<th class="num">Total h</th><th class="num">Sesiones</th></tr></thead><tbody>${MES_L.map((mn, i) => { const arr = ya.filter(a => a._t.getMonth() === i); if (!arr.length) return ''; return `<tr style="cursor:default"><td>${mn[0].toUpperCase() + mn.slice(1)}</td>${sps.map(s => `<td class="num">${hrs(sum(arr.filter(a => a.sp === s), a => a.mt))}</td>`).join('')}<td class="num"><b>${hrs(sum(arr, a => a.mt))}</b></td><td class="num">${arr.length}</td></tr>`; }).join('')}</tbody></table>`;
}
function longestStreak(days) {
  const s = [...days].sort(); let best = 0, cur = 0, prev = null;
  for (const k of s) { const d = pd(k); cur = prev && daysBetween(prev, d) === 1 ? cur + 1 : 1; best = Math.max(best, cur); prev = d; }
  return best;
}

// ---------------------------------------------------------------- vista: objetivos
function defaultGoals() {
  const y = TODAY.getFullYear() - 1;
  const ya = ACTS.filter(a => a._t.getFullYear() === y);
  const nice = (x, step) => Math.max(step, Math.round(x / step) * step);
  return {
    weekHoursMin: 10, weekHoursMax: 12, weekSessions: 5,
    yearRideKm: nice(sum(ya.filter(a => a.sp === 'ride'), a => a.dist / 1000), 250),
    yearRunKm: nice(sum(ya.filter(a => a.sp === 'run'), a => a.dist / 1000), 50),
    yearSwimKm: nice(sum(ya.filter(a => a.sp === 'swim'), a => a.dist / 1000), 5),
    yearElev: nice(sum(ya, a => a.elev || 0), 5000),
    yearHours: nice(sum(ya, a => a.mt / 3600), 25),
  };
}
function goals() {
  let g = {}; try { g = JSON.parse(localStorage.getItem('goals') || '{}'); } catch (e) { }
  return { ...defaultGoals(), ...(DATA.goals || {}), ...g };
}
function objetivos(v) {
  const g = goals();
  const wk0 = sow(TODAY), wkActs = ACTS.filter(a => a._t >= wk0);
  const y0 = new Date(TODAY.getFullYear(), 0, 1), yActs = ACTS.filter(a => a._t >= y0);
  const yFrac = (daysBetween(y0, TODAY) + 1) / (daysBetween(y0, new Date(TODAY.getFullYear() + 1, 0, 1)));
  const wFrac = (daysBetween(wk0, TODAY) + 1) / 7;
  const daysLeft = daysBetween(TODAY, new Date(TODAY.getFullYear(), 11, 31));
  const goal = (title, cur, target, unit, frac, dec = 0, extra = '') => {
    const pct = Math.min(100, cur / target * 100);
    const exp = frac * target, ahead = cur - exp;
    const proj = frac > 0 ? cur / frac : 0;
    return `<div class="goal"><div class="goal-h"><b>${title}</b><span>${fmt(cur, dec)} / ${fmt(target, dec)} ${unit}</span></div>
      <div class="bar"><i style="width:${pct}%;background:${pct >= 100 ? css('--good') : css('--accent')}"></i><em style="left:calc(${Math.min(100, frac * 100)}% - 1px)" title="Donde deberías ir hoy"></em></div>
      <small>${pct >= 100 ? '✓ Meta cumplida' : `${ahead >= 0 ? '▲ ' + fmt(ahead, dec) + ' ' + unit + ' adelantado' : '▼ ' + fmt(-ahead, dec) + ' ' + unit + ' atrasado'} respecto al ritmo · proyección ${fmt(proj, dec)} ${unit}`}${extra}</small></div>`;
  };
  const yr = (sp, key, t) => { const cur = sum(yActs.filter(a => a.sp === sp), a => a.dist / 1000); const need = Math.max(0, t - cur) / Math.max(1, daysLeft / 7); return goal(`${SPORTS[sp].label} ${TODAY.getFullYear()}`, cur, t, 'km', yFrac, 0, cur < t ? ` · necesitas ${fmt(need, 0)} km/semana` : ''); };
  // historial semanal
  const weeks = []; for (let i = 25; i >= 0; i--) { const s = addD(wk0, -7 * i); const arr = ACTS.filter(a => a._t >= s && a._t < addD(s, 7)); weeks.push({ s, h: sum(arr, a => a.mt) / 3600, n: arr.length }); }
  const done = weeks.slice(0, -1);
  const inRange = done.filter(w => w.h >= g.weekHoursMin && w.h <= g.weekHoursMax).length;
  const over = done.filter(w => w.h > g.weekHoursMax).length;
  let streak = 0; for (let i = done.length - 1; i >= 0 && done[i].h >= g.weekHoursMin; i--) streak++;
  v.innerHTML = `<div class="grid">
    <div class="card c6"><div class="card-h"><div><h3>Esta semana</h3><p>Desde el lunes ${fDateShort(wk0)} · la marca vertical indica dónde deberías ir hoy</p></div></div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${goal('Horas de entrenamiento', sum(wkActs, a => a.mt) / 3600, g.weekHoursMin, 'h', wFrac, 1, ` · rango ${fmt(g.weekHoursMin)}–${fmt(g.weekHoursMax)} h`)}
        ${goal('Sesiones', wkActs.length, g.weekSessions, '', wFrac)}
      </div></div>
    <div class="card c6"><div class="card-h"><div><h3>Consistencia (25 semanas)</h3><p>Semanas dentro del rango ${fmt(g.weekHoursMin)}–${fmt(g.weekHoursMax)} h</p></div></div>
      <div class="stat-grid"><div class="stat"><span>En rango</span><b>${inRange} / ${done.length}</b></div><div class="stat"><span>Sobre el rango</span><b>${over}</b><small>cuidado con sobrecarga</small></div><div class="stat"><span>Racha actual</span><b>${streak} sem.</b><small>≥ ${fmt(g.weekHoursMin)} h</small></div></div>
      <div class="chart sm" id="gweeks"></div></div>
    <div class="card c6"><div class="card-h"><div><h3>Metas del año ${TODAY.getFullYear()}</h3><p>Por defecto basadas en tu ${TODAY.getFullYear() - 1}; edítalas abajo</p></div></div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${goal('Horas totales', sum(yActs, a => a.mt) / 3600, g.yearHours, 'h', yFrac)}
        ${yr('ride', 'yearRideKm', g.yearRideKm)}${yr('run', 'yearRunKm', g.yearRunKm)}${yr('swim', 'yearSwimKm', g.yearSwimKm)}
        ${goal('Desnivel acumulado', sum(yActs, a => a.elev || 0), g.yearElev, 'm', yFrac)}
      </div></div>
    <div class="card c6"><div class="card-h"><div><h3>Editar metas</h3><p>Se guardan en este navegador</p></div></div>
      <form class="goal-edit" id="gform">
        ${[['weekHoursMin', 'Horas semanales (mínimo)'], ['weekHoursMax', 'Horas semanales (máximo)'], ['weekSessions', 'Sesiones por semana'], ['yearHours', 'Horas en el año'], ['yearRideKm', 'Km de ciclismo en el año'], ['yearRunKm', 'Km de running en el año'], ['yearSwimKm', 'Km de natación en el año'], ['yearElev', 'Desnivel en el año (m)']].map(([k, l]) => `<label for="g_${k}">${l}</label><input class="input" type="number" min="0" step="any" id="g_${k}" name="${k}" value="${g[k]}">`).join('')}
        <span></span><span style="display:flex;gap:8px"><button class="btn" type="button" id="greset">Restablecer</button><button class="btn primary" type="submit">Guardar</button></span>
      </form></div>
  </div>`;
  chart($('#gweeks'), {
    legend: false, grid: { top: 10 },
    xAxis: { type: 'category', data: weeks.map(w => fDateShort(w.s)) }, yAxis: { type: 'value' },
    tooltip: { formatter: ps => `<b>Semana del ${ps[0].axisValue}</b><br>${fmt(ps[0].value, 1)} h · ${weeks[ps[0].dataIndex].n} sesiones` },
    series: [{ type: 'bar', barMaxWidth: 18, data: weeks.map((w, i) => ({ value: +w.h.toFixed(2), itemStyle: { color: i === weeks.length - 1 ? css('--seq-2') : css('--accent'), borderRadius: [4, 4, 0, 0] } })),
      markArea: { silent: true, itemStyle: { color: css('--good'), opacity: .1 }, data: [[{ yAxis: g.weekHoursMin }, { yAxis: g.weekHoursMax }]] } }],
  });
  $('#gform').onsubmit = e => { e.preventDefault(); const o = {}; new FormData(e.target).forEach((val, k) => { o[k] = +val; }); try { localStorage.setItem('goals', JSON.stringify(o)); } catch (er) { } render(); };
  $('#greset').onclick = () => { try { localStorage.removeItem('goals'); } catch (er) { } render(); };
}

// ---------------------------------------------------------------- vista: equipo
function equipo(v) {
  const r = range();
  const gear = H.gear || [];
  const stats = id => { const arr = ACTS.filter(a => a.gear === id); const inr = arr.filter(a => inR(a, r)); return { n: arr.length, last: arr.at(-1), pkm: sum(inr, a => a.dist) / 1000, pn: inr.length }; };
  const card = g => {
    const s = stats(g.id), shoe = g.type === 'Shoe';
    const wear = shoe ? Math.min(100, g.km / 800 * 100) : null;
    const ws = shoe ? (g.km >= 800 ? ['serious', 'Reemplazar'] : g.km >= 600 ? ['warning', 'Desgaste alto'] : ['good', 'En buen estado']) : null;
    return `<div class="card c4 gear-card"><div style="display:flex;gap:12px;align-items:center">${icon(shoe ? 'run' : 'ride')}<div><h4>${esc(g.name)}</h4><small style="color:var(--muted)">${shoe ? 'Zapatillas' : 'Bicicleta' + (g.frame ? ' · ' + ({ Road: 'Ruta', Gravel: 'Gravel', Mtb: 'MTB' }[g.frame] || g.frame) : '')}${g.retired ? ' · retirada' : ''}</small></div></div>
      <div class="stat-grid"><div class="stat"><span>Total (Strava)</span><b>${fmt(g.km)} km</b></div>${s.n ? `<div class="stat"><span>En el período</span><b>${fmt(s.pkm)} km</b><small>${s.pn} sesiones</small></div>` : ''}</div>
      ${shoe && !g.retired ? `<div class="goal"><div class="bar"><i style="width:${wear}%;background:${css(ST[ws[0]][0])}"></i></div><small>${stHtml(ws[0], ws[1])} · vida útil típica 600–800 km</small></div>` : ''}
      <small style="color:var(--muted)">${s.last ? `Último uso: <a href="#" data-open="${s.last.id}">${fDate(s.last._t)}</a>` : 'Strava no informa qué actividades usaron este equipo'}</small></div>`;
  };
  const active = gear.filter(g => !g.retired), retired = gear.filter(g => g.retired);
  v.innerHTML = `<div class="grid">${active.map(card).join('')}</div>
    <div class="card"><div class="card-h"><div><h3>Km por mes · zapatillas en uso</h3><p>Según las actividades con zapatilla asignada en Strava</p></div></div><div class="chart" id="gchart"></div></div>
    ${retired.length ? `<h3 style="font-size:15px;margin-top:6px">Retirado</h3><div class="grid">${retired.map(card).join('')}</div>` : ''}`;
  const shoes = active.filter(g => g.type === 'Shoe');
  const bks = bucketList(r.from, lastDay(r), 'month');
  const pal = [css('--ride'), css('--run'), css('--swim'), css('--strength')];
  chart($('#gchart'), {
    xAxis: { type: 'category', data: bks.map(b => bucketLabel(b, 'month')) }, yAxis: { type: 'value' },
    tooltip: { valueFormatter: x => fmt(x, 1) + ' km' },
    series: shoes.map((g, i) => { const m = new Map(bks.map(b => [b, 0])); for (const a of ACTS) if (a.gear === g.id && inR(a, r)) { const b = bucketKey(a._t, 'month'); m.set(b, (m.get(b) || 0) + a.dist / 1000); } return { name: g.name, type: 'bar', stack: 's', barMaxWidth: 24, data: [...m.values()].map(x => +x.toFixed(1)), itemStyle: { color: pal[i % 4], borderColor: css('--surface'), borderWidth: 1 } }; }),
  });
}

// ---------------------------------------------------------------- detalle de actividad
let detailMap = null;
async function openActivity(id) {
  const a = BYID.get(id); if (!a) return;
  const st = (l, val, sub = '') => val == null || val === '—' ? '' : `<div class="stat"><span>${l}</span><b>${val}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  $('#modalBody').innerHTML = `<div class="detail-h">${icon(a.sp, 44)}<div><h2>${esc(a.name)}</h2><small>${fDate(a._t)} · ${fTime(a._t)} · ${SPORTS[a.sp].label} · ${esc(a.sub)}${a.loc ? ' · ' + esc(a.loc) : ''}</small></div></div>
    ${a.desc ? `<p class="desc">${esc(a.desc)}</p>` : ''}
    <div class="stat-grid">
      ${st('Distancia', a.dist ? km(a.dist) + ' km' : null)}
      ${st('Tiempo en movimiento', dur(a.mt), a.et && a.et - a.mt > 60 ? `total ${dur(a.et)}` : '')}
      ${st(a.sp === 'ride' ? 'Velocidad media' : 'Ritmo medio', a.dist ? pace(a) : null, a.spdMax && a.sp === 'ride' ? `máx ${fmt(a.spdMax * 3.6, 1)} km/h` : '')}
      ${st('Desnivel', a.elev ? fmt(a.elev) + ' m' : null)}
      ${st('FC media', a.hr ? a.hr + ' lpm' : null, a.hrMax ? `máx ${a.hrMax} lpm` : '')}
      ${st('Potencia media', a.pw && a.sp === 'ride' ? a.pw + ' W' : null, a.pwMax && a.sp === 'ride' ? `máx ${a.pwMax} W` : '')}
      ${st('Cadencia', a.cad ? fmt(a.cad) + (a.sp === 'run' ? ' ppm' : ' rpm') : null)}
      ${st('Calorías', a.cal ? fmt(a.cal) + ' kcal' : null)}
      ${st('Carga', fmt(a.ld), a.re != null ? `Relative Effort Strava ${a.re}` : '')}
      ${st('Esfuerzo percibido', a.rpe ? `${a.rpe}/10` : null, a.rpe ? RPE[Math.round(a.rpe)] : '')}
      ${st('Disfrute', a.enj ? enjoyLabel(a.enj) : null)}
      ${st('Body Battery', a.bbMax != null ? `${a.bbMax} → ${a.bbMin}` : null, 'al inicio → al final')}
      ${st('Temperatura', a.temp != null ? fmt(a.temp, 1) + ' °C' : null, 'medida por el reloj')}
      ${st('Respiración', a.resp ? a.resp + ' rpm' : null)}
      ${st('Series', a.sets ? `${a.sets}` : null, a.reps ? `${a.reps} repeticiones` : '')}
      ${st('Kudos', a.kud ? a.kud : null, a.pr ? `${a.pr} récords · ${a.ach} logros` : '')}
    </div>
    ${a.route ? '<div class="map-sm" id="dmap" style="margin-top:14px"></div>' : ''}
    <div class="links">${a.sid ? `<a class="btn" href="https://www.strava.com/activities/${a.sid}" target="_blank" rel="noopener">Abrir en Strava ↗</a>` : ''}${a.tr ? `<a class="btn" href="https://www.tredict.com/app/training/activity/${a.tr}" target="_blank" rel="noopener">Abrir en Tredict ↗</a>` : ''}${a.dev ? `<span class="badge">${esc(a.dev)}</span>` : ''}${a.tr && a.sid ? '<span class="badge">Garmin + Strava</span>' : a.tr ? '<span class="badge">Solo Garmin</span>' : '<span class="badge">Solo Strava</span>'}</div>`;
  $('#modal').hidden = false; document.body.style.overflow = 'hidden';
  if (a.route) {
    if (!ROUTES) ROUTES = await loadRoutes();
    const pts = ROUTES[a.id] && decodePoly(ROUTES[a.id]);
    if (pts && $('#dmap')) {
      detailMap && detailMap.remove();
      detailMap = L.map('dmap', { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(detailMap);
      const ln = L.polyline(pts, { color: sportColor(a.sp), weight: 4, opacity: .95 }).addTo(detailMap);
      detailMap.fitBounds(ln.getBounds(), { padding: [16, 16] });
      setTimeout(() => { if (detailMap) { detailMap.invalidateSize(); detailMap.fitBounds(ln.getBounds(), { padding: [16, 16] }); } }, 80);
    }
  }
}
function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; if (detailMap) { detailMap.remove(); detailMap = null; } }

// ---------------------------------------------------------------- hoy
const SCALES = [
  ['energy', 'Energía', ['Agotado', 'Baja', 'Normal', 'Buena', 'Alta'], 1],
  ['mood', 'Ánimo', ['Mal', 'Bajo', 'Normal', 'Bien', 'Excelente'], 1],
  ['work_stress', 'Estrés de trabajo', ['Nulo', 'Poco', 'Medio', 'Alto', 'Máximo'], 1],
  ['soreness', 'Dolor muscular (0–10)', ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 0],
];
async function hoy(v) {
  const day = dk(TODAY);
  v.innerHTML = `
    <div class="grid">
      <div class="card c6"><div class="card-h"><div><h3>Estado de hoy</h3><p>HRV, FC en reposo, sueño y forma</p></div><a href="#/recuperacion">Ver más</a></div><div id="ready"></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Check-in de hoy</h3><p>${fDate(TODAY)} · 10 segundos</p></div></div><div id="checkin"><div class="loading">Cargando…</div></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Próximos 7 días</h3><p>Sesiones planificadas</p></div></div><div id="plan"><div class="loading">Cargando…</div></div></div>
      <div class="card c6"><div class="card-h"><div><h3>Dolencias activas</h3><p>Seguimiento de molestias</p></div></div><div id="ail"><div class="loading">Cargando…</div></div></div>
      <div class="card c12"><div class="card-h"><div><h3>Últimas actividades</h3><p>Toca una para ver el detalle</p></div><a href="#/actividades">Ver todas</a></div><div class="list" id="recent"></div></div>
    </div>`;
  readiness($('#ready'));
  const recent = $('#recent');
  recent.innerHTML = ACTS.slice(-6).reverse().map(rowHtml).join('');
  bindRows(recent);
  let d;
  try { d = await hoyData(day, dk(addD(TODAY, 7))); } catch (e) { for (const id of ['#checkin', '#plan', '#ail']) $(id).innerHTML = `<div class="empty">No se pudo cargar (${esc(e.message)})</div>`; return; }

  // check-in
  const cur = { energy: d.checkin?.energy, mood: d.checkin?.mood, work_stress: d.checkin?.work_stress, soreness: d.checkin?.soreness };
  const ck = $('#checkin');
  const paint = () => {
    ck.innerHTML = SCALES.map(([k, l, opts, base]) => `<div style="margin-bottom:10px"><div class="note" style="margin:0 0 4px">${l}</div><div class="chips" style="flex-wrap:wrap">${opts.map((o, i) =>
      `<button type="button" class="chip ${cur[k] === i + base ? 'on' : ''}" data-k="${k}" data-v="${i + base}">${o}</button>`).join('')}</div></div>`).join('') +
      `<textarea id="ckNote" rows="2" placeholder="Nota (puedes dictarla con el micrófono del teclado): cómo dormiste, molestias, ánimo…" style="width:100%;margin:6px 0 10px;padding:8px;font:inherit;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text)">${esc(d.checkin?.note || '')}</textarea>
      <button type="button" class="btn primary" id="ckSave">${d.checkin ? 'Actualizar check-in' : 'Guardar check-in'}</button> <span class="note" id="ckMsg"></span>`;
  };
  paint();
  ck.addEventListener('click', async e => {
    const b = e.target.closest('.chip[data-k]');
    if (b) { const note = $('#ckNote').value; d.checkin = { ...d.checkin, note }; cur[b.dataset.k] = +b.dataset.v; paint(); return; }
    if (!e.target.closest('#ckSave')) return;
    const msg = $('#ckMsg'); msg.textContent = 'Guardando…';
    try { await saveCheckin({ day, ...cur, note: $('#ckNote').value || null }); d.checkin = { ...cur, note: $('#ckNote').value }; msg.textContent = 'Guardado ✓'; $('#ckSave').textContent = 'Actualizar check-in'; }
    catch (err) { msg.textContent = 'No se pudo guardar: ' + err.message; }
  });

  // plan
  $('#plan').innerHTML = d.sessions.length ? `<div class="list">${d.sessions.map(s => {
    const dt = pd(s.planned_on), sp = SPORTS[s.sport] ? s.sport : 'other';
    return `<div class="row" style="cursor:default">${icon(sp)}<span class="t"><b>${esc(s.title || SPORTS[sp].label)}${s.key_session ? ' ★' : ''}</b><small>${fDate(dt)}${s.details ? ' · ' + esc(s.details) : ''}</small></span></div>`;
  }).join('')}</div>` : '<div class="empty">Sin sesiones planificadas. Pídeme el plan de la semana en el chat y queda aquí.</div>';

  // dolencias
  $('#ail').innerHTML = d.ailments.length ? `<div class="list">${d.ailments.map(a =>
    `<div class="row" style="cursor:default"><span class="t"><b>${esc(a.title)}</b><small>${esc(a.body_zone)} · desde ${fDateShort(pd(a.started_on))}${a.actions ? ' · ' + esc(a.actions) : ''}</small></span><span class="m">${stHtml(a.status === 'activa' ? 'serious' : 'warning', a.status === 'activa' ? 'Activa' : 'Vigilando')}</span></div>`).join('')}</div>`
    : '<div class="empty">Sin dolencias registradas. Cuéntamelas en el chat y las registro.</div>';
}

// ---------------------------------------------------------------- acceso
function showLogin() {
  return new Promise(resolve => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:99;display:grid;place-items:center;background:var(--bg,#f6f5f2);padding:16px';
    el.innerHTML = `<form class="card" style="width:min(360px,100%);display:grid;gap:10px"><h3>Seguimiento de salud y deporte</h3><p class="note" style="margin:0">Inicia sesión para ver tus datos.</p>
      <input id="lgEmail" type="email" autocomplete="username" placeholder="Correo" required style="padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text)">
      <input id="lgPass" type="password" autocomplete="current-password" placeholder="Contraseña" required style="padding:9px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--text)">
      <button class="btn primary" type="submit">Entrar</button><div class="note" id="lgMsg" style="margin:0"></div></form>`;
    document.body.appendChild(el);
    $('form', el).addEventListener('submit', async e => {
      e.preventDefault(); $('#lgMsg', el).textContent = 'Entrando…';
      try { await login($('#lgEmail', el).value.trim(), $('#lgPass', el).value); el.remove(); resolve(); }
      catch (err) { $('#lgMsg', el).textContent = err.message; }
    });
  });
}

// ---------------------------------------------------------------- inicio
async function init() {
  if (!await getSession()) await showLogin();
  $('#view').innerHTML = '<div class="loading">Cargando tus datos…</div>';
  const { DATA: d, H: h, goals: goalsCfg } = await loadAll();
  DATA = d; DATA.goals = goalsCfg; H = h;
  ACTS = d.activities.map(a => ({ ...a, _t: pd(a.d), _s: norm([a.name, a.desc, a.loc, a.sub, SPORTS[a.sp]?.label, fDate(pd(a.d)), MES_L[pd(a.d).getMonth()]].join(' ')) })).sort((a, b) => a._t - b._t);
  BYID = new Map(ACTS.map(a => [a.id, a]));
  const up = new Date(d.meta.updated);
  $('#updated').innerHTML = `Actualizado ${fDate(up)} ${fTime(up)}<br>${fmt(d.meta.counts.total)} actividades desde ${pd(d.meta.range[0]).getFullYear()}<br><a href="#" id="logoutLink">Cerrar sesión</a>`;
  $('#logoutLink').addEventListener('click', async e => { e.preventDefault(); await logout(); location.reload(); });
  themeLabel(); readHash(); bindShell(); render();
}
init().catch(e => { console.error(e); $('#view').innerHTML = `<div class="empty">No se pudieron cargar los datos (${esc(e.message)}).</div>`; });
