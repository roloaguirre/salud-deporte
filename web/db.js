// Acceso a Supabase: sesión, carga de datos con la forma que ya lee el panel, y registros rápidos.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const getSession = async () => (await sb.auth.getSession()).data.session;
export async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
}
export const logout = () => sb.auth.signOut();

// PostgREST devuelve máx. 1000 filas por petición: se pagina.
async function all(table, cols, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).order(order).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

export async function loadAll() {
  const [acts, met, kv] = await Promise.all([
    all('v_activities', 'j,started_at', 'started_at'),
    all('daily_metrics', '*', 'day'),
    all('app_kv', 'key,value', 'key'),
  ]);
  const activities = acts.map(r => r.j);
  const k = Object.fromEntries(kv.map(r => [r.key, r.value]));
  const num = v => (v == null ? null : +v);
  const col = (c, withBase) => met.filter(m => m[c] != null).map(m => withBase ? [m.day, num(m[c]), m.extra?.[withBase] ?? null] : [m.day, num(m[c])]);
  const first = activities[0], last = activities.at(-1);
  const firstTr = activities.find(a => a.tr);
  const DATA = {
    meta: {
      updated: new Date().toISOString(), counts: { total: activities.length },
      range: [first.d, last.d], firstGarmin: (firstTr?.d || first.d).slice(0, 10), loadScale: 2.36,
    },
    activities,
  };
  const H = {
    hrv: col('hrv_ms', 'hrv_base'), sleep: col('sleep_hours', 'sleep_base'), rhr: col('resting_hr'), weight: col('weight_kg'),
    load: Object.fromEntries(met.filter(m => m.effort != null).map(m => [m.day, num(m.effort)])),
    intensity: k.intensity || {}, gear: k.gear || [], zones: k.zones || {},
  };
  return { DATA, H, goals: k.goals || {} };
}

export async function loadRoutes() {
  const rows = await all('v_routes', 'id,poly', 'id');
  return Object.fromEntries(rows.map(r => [r.id, r.poly]));
}

// ---- vista "Hoy": check-in, plan de la semana y dolencias activas
export async function hoyData(day, weekEnd) {
  const [ci, ses, ail] = await Promise.all([
    sb.from('checkins').select('*').eq('day', day).maybeSingle(),
    sb.from('plan_sessions').select('*').gte('planned_on', day).lte('planned_on', weekEnd).order('planned_on'),
    sb.from('ailments').select('*').neq('status', 'resuelta').order('started_on'),
  ]);
  for (const r of [ci, ses, ail]) if (r.error) throw new Error(r.error.message);
  return { checkin: ci.data, sessions: ses.data, ailments: ail.data };
}

export async function saveCheckin(row) {
  const s = await getSession();
  const { error } = await sb.from('checkins').upsert({ ...row, user_id: s.user.id }, { onConflict: 'user_id,day' });
  if (error) throw new Error(error.message);
}
