/* Fairway Notebook — golf rounds, practice and workouts.
   Data is saved to your Supabase database (connection in config.js, tables in supabase/setup.sql). */
(function () {
  'use strict';

  // ---------- Small helpers ----------
  const STORAGE_KEY = 'fairway-notebook-v1'; // where versions before 2.0 kept data in this browser
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const todayISO = () => isoDaysAgo(0);
  function parseISO(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
  function fmtDate(iso, withYear) {
    const opts = { month: 'short', day: 'numeric' };
    if (withYear) opts.year = 'numeric';
    return parseISO(iso).toLocaleDateString(undefined, opts);
  }
  function daysSince(iso) { return Math.round((parseISO(todayISO()) - parseISO(iso)) / 86400000); }
  function relDay(iso) {
    const n = daysSince(iso);
    if (n === 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 7) return `${n} days ago`;
    return fmtDate(iso);
  }
  const fmtToPar = (n) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

  const PRACTICE_AREAS = ['Driver & woods', 'Irons', 'Wedges', 'Chipping', 'Bunker', 'Putting', 'On-course'];
  const WORKOUT_TYPES = ['Strength', 'Speed', 'Mobility', 'Conditioning'];
  const RATINGS = ['Rough', 'Meh', 'Solid', 'Good', 'Dialed in'];
  const EXERCISES = ['Trap bar deadlift', 'Goblet squat', 'Split squat', 'Romanian deadlift', 'Hip thrust', 'Push-up', 'Single-arm row',
    'Pallof press', 'Cable wood chop', 'Med ball rotational throw', 'Med ball slam', 'Overspeed swings', 'Lateral bound',
    '90/90 hip switch', 'Open books', 'Deep squat hold', 'Thoracic rotation', 'Dead bug', 'Side plank', 'Farmer carry'];

  // ---------- Round math ----------
  const isGIR = (h) => h.score - h.putts <= h.par - 2;
  // A round is either hole by hole (r.holes) or total only (r.total, r.holeCount, optional r.par and r.differential).
  const isDetailed = (r) => Array.isArray(r.holes) && r.holes.length > 0;
  const holeCount = (r) => (isDetailed(r) ? r.holes.length : r.holeCount || 18);
  const toParNote = (s) => (s.toPar == null ? '' : ` (${fmtToPar(s.toPar)})`);
  function roundStats(r) {
    if (!isDetailed(r)) {
      const par = r.par || null;
      return { detailed: false, holes: holeCount(r), par, score: r.total, putts: null, gir: null, fir: null, firChances: 0, toPar: par ? r.total - par : null };
    }
    const s = { detailed: true, holes: r.holes.length, par: 0, score: 0, putts: 0, gir: 0, fir: 0, firChances: 0 };
    r.holes.forEach((h) => {
      s.par += h.par; s.score += h.score; s.putts += h.putts;
      if (isGIR(h)) s.gir++;
      if (h.par >= 4) { s.firChances++; if (h.fir) s.fir++; }
    });
    s.toPar = s.score - s.par;
    return s;
  }
  function markClass(score, par) {
    const d = score - par;
    return d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'double';
  }

  // ---------- Database (Supabase) ----------
  // Connection details live in config.js. Row level security in the database keeps every row private to its owner.
  const CFG = window.FAIRWAY_CONFIG || {};
  const configured = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  const recoveryLink = /type=recovery/.test(location.hash); // arrived from a "reset password" email
  const sb = configured ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
  const TABLES = { rounds: 'rounds', practice: 'practice_sessions', workouts: 'workouts', routines: 'routines' };
  const emptyState = () => ({ rounds: [], practice: [], workouts: [], routines: [] });
  let routinesMissing = false; // true until the v2.1 part of supabase/setup.sql has been run
  let state = emptyState();
  let currentUser = null;
  const n = (v) => (v == null ? null : Number(v));

  // App objects use camelCase; database columns use snake_case.
  const toRow = {
    rounds: (r) => {
      const s = roundStats(r);
      return {
        date: r.date, course: r.course, tees: r.tees || '', hole_count: s.holes, total: s.score, par: s.par || null,
        holes: isDetailed(r) ? r.holes : null, notes: r.notes || '', source: r.source === 'ghin' ? 'ghin' : 'manual',
        score_type: r.scoreType || null, course_rating: r.courseRating ?? null, slope: r.slope ?? null, pcc: r.pcc ?? null,
        differential: r.differential ?? null, used_in_handicap: r.usedInHandicap ?? null,
      };
    },
    practice: (p) => {
      const row = { date: p.date, area: p.area, minutes: p.minutes, balls: p.balls || 0, focus: p.focus || '', rating: p.rating, notes: p.notes || '' };
      if (p.routineId) row.routine_id = p.routineId; // only sent when used, so older databases still work
      if (p.drills) row.drills = p.drills;
      return row;
    },
    workouts: (w) => {
      const row = { date: w.date, type: w.type, minutes: w.minutes, exercises: w.exercises || [], notes: w.notes || '' };
      if (w.routineId) row.routine_id = w.routineId;
      return row;
    },
    routines: (r) => ({ kind: r.kind, name: r.name, day: r.day || '', focus: r.type || '', sort: r.sort || 0, items: r.items || [], notes: r.notes || '' }),
  };
  const fromRow = {
    rounds: (x) => {
      const r = { id: x.id, date: x.date, course: x.course, tees: x.tees || '', notes: x.notes || '', source: x.source,
        holeCount: x.hole_count, total: x.total, scoreType: x.score_type || '', courseRating: n(x.course_rating), slope: n(x.slope),
        pcc: n(x.pcc), differential: n(x.differential), usedInHandicap: x.used_in_handicap };
      if (Array.isArray(x.holes) && x.holes.length) r.holes = x.holes; else if (x.par) r.par = x.par;
      return r;
    },
    practice: (x) => ({ id: x.id, date: x.date, area: x.area, minutes: x.minutes, balls: x.balls, focus: x.focus || '', rating: x.rating, notes: x.notes || '',
      routineId: x.routine_id || null, drills: Array.isArray(x.drills) ? x.drills : null }),
    workouts: (x) => ({ id: x.id, date: x.date, type: x.type, minutes: x.minutes, exercises: x.exercises || [], notes: x.notes || '', routineId: x.routine_id || null }),
    routines: (x) => ({ id: x.id, kind: x.kind, name: x.name, day: x.day || '', type: x.focus || '', sort: x.sort || 0, items: x.items || [], notes: x.notes || '' }),
  };
  async function dbLoad() {
    const kinds = Object.keys(TABLES);
    const results = await Promise.all(kinds.map((k) => sb.from(TABLES[k]).select('*').order(k === 'routines' ? 'sort' : 'date', { ascending: k === 'routines' })));
    // The routines table arrived in v2.1; if it isn't there yet, carry on without it and prompt for the update.
    const ri = kinds.indexOf('routines');
    routinesMissing = !!results[ri].error;
    if (routinesMissing) results[ri] = { data: [], error: null };
    const failed = results.find((res) => res.error);
    if (failed) throw failed.error;
    const next = emptyState();
    kinds.forEach((k, i) => { next[k] = results[i].data.map(fromRow[k]); });
    state = next;
  }
  async function dbInsert(kind, items) {
    if (!items.length) return [];
    const { data, error } = await sb.from(TABLES[kind]).insert(items.map(toRow[kind])).select();
    if (error) throw error;
    const saved = data.map(fromRow[kind]);
    state[kind].push(...saved);
    return saved;
  }
  async function dbUpdate(kind, item) {
    if (kind === 'routines') {
      const { error } = await sb.from(TABLES[kind]).update(toRow[kind](item)).eq('id', item.id);
      if (error) throw error;
      state.routines = state.routines.map((r) => (r.id === item.id ? item : r));
      return;
    }
    const { error } = await sb.from(TABLES[kind]).update(toRow[kind](item)).eq('id', item.id);
    if (error) throw error;
  }
  async function dbDelete(kind, id) {
    const { error } = await sb.from(TABLES[kind]).delete().eq('id', id);
    if (error) throw error;
    state[kind] = state[kind].filter((x) => x.id !== id);
  }
  async function dbDeleteAll() {
    for (const k of Object.keys(TABLES)) {
      if (k === 'routines' && routinesMissing) continue;
      const { error } = await sb.from(TABLES[k]).delete().not('id', 'is', null);
      if (error) throw error;
    }
    state = emptyState();
  }
  // Runs a database change with the button disabled; shows a message if it fails. Returns true on success.
  async function busy(btn, work) {
    if (btn) btn.disabled = true;
    try { await work(); return true; }
    catch (err) { console.error(err); toast(`Couldn’t save to your database: ${err.message || err}`); return false; }
    finally { if (btn) btn.disabled = false; renderAll(); }
  }

  // ---------- Adding entries without duplicates (backup restore, moving old browser data) ----------
  const sameEntry = {
    rounds: (a, b) => sameRound(a, b),
    practice: (a, b) => a.date === b.date && a.area === b.area && a.minutes === b.minutes && (a.focus || '') === (b.focus || ''),
    workouts: (a, b) => a.date === b.date && a.type === b.type && a.minutes === b.minutes,
    routines: (a, b) => a.kind === b.kind && a.name === b.name,
  };
  async function mergeIn(data) {
    let added = 0;
    for (const k of Object.keys(TABLES)) {
      if (k === 'routines' && routinesMissing) continue;
      // Links to routines can't be carried across accounts or restores, so they're dropped here.
      const incoming = (data[k] || []).filter((x) => !x.example).map((x) => ({ ...x, routineId: null }));
      const fresh = incoming.filter((x, i) => !state[k].some((y) => sameEntry[k](x, y)) && incoming.findIndex((y) => sameEntry[k](x, y)) === i);
      added += (await dbInsert(k, fresh)).length;
    }
    return added;
  }

  // ---------- Data saved in this browser by earlier versions ----------
  const LEGACY_DONE_KEY = 'fairway-notebook-moved';
  function legacyData() {
    try {
      if (localStorage.getItem(LEGACY_DONE_KEY)) return null;
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!d || !Array.isArray(d.rounds)) return null;
      const count = ['rounds', 'practice', 'workouts'].reduce((s, k) => s + (d[k] || []).filter((x) => !x.example).length, 0);
      return count ? { data: d, count } : null;
    } catch (e) { return null; }
  }
  function markLegacyDone() { try { localStorage.setItem(LEGACY_DONE_KEY, new Date().toISOString()); } catch (e) { /* ignore */ } }

  // ---------- Toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // Two-tap confirm for destructive buttons (dialogs are not used)
  function armOrRun(btn, label, run) {
    if (btn.classList.contains('armed')) { run(); return; }
    const original = btn.textContent;
    btn.classList.add('armed'); btn.textContent = label;
    setTimeout(() => { btn.classList.remove('armed'); btn.textContent = original; }, 3000);
  }

  // ---------- Navigation ----------
  const VIEWS = ['dashboard', 'rounds', 'practice', 'workouts'];
  function currentView() { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'dashboard'; }
  function showView() {
    const v = currentView();
    VIEWS.forEach((name) => { $(`#view-${name}`).hidden = name !== v; });
    $$('.tabs a').forEach((a) => a.toggleAttribute('aria-current', false));
    $(`.tabs a[data-view="${v}"]`).setAttribute('aria-current', 'page');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showView);

  // ---------- Dashboard ----------
  function renderDashboard() {
    const rounds = [...state.rounds].sort(byDateDesc);
    // Scoring uses every 18-hole round; putts, greens and fairways use hole-by-hole rounds only.
    const full = rounds.filter((r) => holeCount(r) === 18);
    const last5 = full.slice(0, 5).map(roundStats);
    const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
    const detailed5 = rounds.filter(isDetailed).slice(0, 5).map(roundStats);
    const girPct = detailed5.length ? (100 * detailed5.reduce((s, x) => s + x.gir, 0)) / detailed5.reduce((s, x) => s + x.holes, 0) : null;
    const firChances = detailed5.reduce((s, x) => s + x.firChances, 0);
    const firPct = firChances ? (100 * detailed5.reduce((s, x) => s + x.fir, 0)) / firChances : null;
    const puttsPer18 = avg(detailed5, (x) => (x.putts * 18) / x.holes);
    const scoreAvg = avg(last5, (x) => x.score);
    const toParAvg = last5.length && last5.every((x) => x.toPar != null) ? avg(last5, (x) => x.toPar) : null;
    const best = full.length ? Math.min(...full.map((r) => roundStats(r).score)) : null;
    const detailNote = detailed5.length ? `Last ${detailed5.length} hole-by-hole round${detailed5.length === 1 ? '' : 's'}` : 'Needs a hole-by-hole round';

    const kpi = (label, value, note) => `<div class="kpi"><span class="label">${label}</span><span class="value">${value}</span><span class="note">${note}</span></div>`;
    $('#kpis').innerHTML = [
      kpi('Scoring avg', scoreAvg == null ? '—' : scoreAvg.toFixed(1), scoreAvg == null ? 'Log an 18-hole round' : `${toParAvg == null ? `Last ${last5.length} rounds` : `${fmtToPar(Math.round(toParAvg))} to par`} · best ${best}`),
      kpi('Putts / 18', puttsPer18 == null ? '—' : puttsPer18.toFixed(1), detailNote),
      kpi('Greens hit', girPct == null ? '—' : `${Math.round(girPct)}%`, detailed5.length ? 'In regulation' : detailNote),
      kpi('Fairways hit', firPct == null ? '—' : `${Math.round(firPct)}%`, detailed5.length ? 'Par 4s and 5s' : detailNote),
    ].join('');

    $('#trend').innerHTML = trendChart(full.slice(0, 10).reverse());
    renderPracticeBars();
    renderWeek();
    renderFeed();

    const total = state.rounds.length + state.practice.length + state.workouts.length;
    $('#dash-sub').textContent = `${state.rounds.length} rounds · ${state.practice.length} practice sessions · ${state.workouts.length} workouts`;
    $('#storage-note').textContent = `${total} entries saved to your account${currentUser ? ` (${currentUser.email})` : ''}. They're the same on any device you sign in from.`;
    const legacy = legacyData();
    $('#migrate-banner').hidden = !legacy || migrateDismissed;
    if (legacy) $('#migrate-count').textContent = `${legacy.count} entr${legacy.count === 1 ? 'y' : 'ies'}`;
  }
  let migrateDismissed = false;

  function trendChart(rs) {
    if (rs.length < 2) return '<p class="empty">Log two 18-hole rounds to see your trend.</p>';
    const scores = rs.map((r) => roundStats(r).score);
    const W = 360, H = 170, L = 30, R = 34, T = 14, B = 24;
    let lo = Math.floor((Math.min(...scores) - 1) / 5) * 5;
    let hi = Math.ceil((Math.max(...scores) + 1) / 5) * 5;
    if (hi - lo < 10) hi = lo + 10;
    const x = (i) => L + (i * (W - L - R)) / (rs.length - 1);
    const y = (v) => T + ((hi - v) * (H - T - B)) / (hi - lo);
    let g = '';
    for (let v = lo; v <= hi; v += 5) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis-label" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`);
    const area = `M${x(0)},${y(lo)} L${pts.join(' L')} L${x(scores.length - 1)},${y(lo)} Z`;
    const dots = scores.map((s, i) => `<circle class="dot${i === scores.length - 1 ? ' last' : ''}" cx="${x(i)}" cy="${y(s)}" r="${i === scores.length - 1 ? 5 : 3.5}"><title>${fmtDate(rs[i].date)}: ${s}</title></circle>`).join('');
    const last = scores.length - 1;
    const labels = `<text class="axis-label" x="${x(0)}" y="${H - 6}" text-anchor="start">${fmtDate(rs[0].date)}</text><text class="axis-label" x="${x(last)}" y="${H - 6}" text-anchor="end">${fmtDate(rs[last].date)}</text>`;
    const endLabel = `<text class="end-label" x="${x(last) + 9}" y="${y(scores[last]) + 4}">${scores[last]}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores for the last ${rs.length} rounds, most recent ${scores[last]}">${g}<path class="area" d="${area}"/><polyline class="line" points="${pts.join(' ')}"/>${dots}${endLabel}${labels}</svg>`;
  }

  function renderPracticeBars() {
    const recent = state.practice.filter((p) => daysSince(p.date) <= 30);
    if (!recent.length) { $('#practice-bars').innerHTML = '<p class="empty">No practice logged in the last 30 days.</p>'; return; }
    const mins = {};
    recent.forEach((p) => {
      if (p.drills && p.drills.length) p.drills.forEach((d) => { mins[d.area] = (mins[d.area] || 0) + (d.minutes || 0); });
      else mins[p.area] = (mins[p.area] || 0) + p.minutes;
    });
    const max = Math.max(...Object.values(mins));
    $('#practice-bars').innerHTML = '<div class="bars">' + PRACTICE_AREAS.filter((a) => mins[a]).sort((a, b) => mins[b] - mins[a])
      .map((a) => `<div class="bar-row"><span>${esc(a)}</span><div class="bar-track"><div class="bar-fill" style="width:${(100 * mins[a]) / max}%"></div></div><span class="v">${mins[a]} min</span></div>`).join('') + '</div>';
  }

  // Weeks run Monday to Sunday.
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  function weekStartISO() { return isoDaysAgo((new Date().getDay() + 6) % 7); }
  function renderWeek() {
    const start = weekStartISO();
    const wk = (arr) => arr.filter((x) => x.date >= start && x.date <= todayISO());
    const w = wk(state.workouts), p = wk(state.practice), r = wk(state.rounds);
    const sum = (arr) => arr.reduce((s, x) => s + (x.minutes || 0), 0);
    const goal = (kind) => state.routines.filter((x) => x.kind === kind).length || 3;
    const meter = (label, done, target, mins) => `<div class="meter"><div class="meter-top"><span>${label}</span><span class="num"><strong>${done}</strong> / ${target}${mins ? ` · ${mins} min` : ''}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, (100 * done) / target)}%"></div></div></div>`;
    const doneIds = new Set([...w, ...p].map((x) => x.routineId).filter(Boolean));
    const plan = [...state.routines].sort((a, b) => (DAYS.indexOf(a.day) + 9) % 9 - (DAYS.indexOf(b.day) + 9) % 9 || a.sort - b.sort);
    const planList = plan.length ? `<ul class="plan">${plan.map((x) => `<li class="${doneIds.has(x.id) ? 'done' : ''}"><span class="tick" aria-hidden="true">${doneIds.has(x.id) ? '✓' : ''}</span><span class="day">${esc(x.day || '—')}</span><span>${esc(x.name)}</span><span class="chip ${x.kind === 'practice' ? 'sand' : 'plain'}">${x.kind === 'practice' ? 'Practice' : 'Workout'}</span></li>`).join('')}</ul>`
      : '<p class="hint">Load the starter routines on the Practice or Workouts page to see your weekly plan here.</p>';
    $('#week-range').textContent = `${fmtDate(start)} – ${fmtDate(isoDaysAgo((new Date().getDay() + 6) % 7 - 6))} · ${r.length} round${r.length === 1 ? '' : 's'} played`;
    $('#week').innerHTML = meter('Workouts', w.length, goal('workout'), sum(w)) + meter('Practice', p.length, goal('practice'), sum(p)) + planList;
  }

  function renderFeed() {
    const items = [
      ...state.rounds.map((r) => { const s = roundStats(r); return { date: r.date, chip: 'Round', cls: '', text: `${esc(r.course)} · ${s.score}${toParNote(s)}` }; }),
      ...state.practice.map((p) => ({ date: p.date, chip: 'Practice', cls: 'sand', text: `${esc(p.area)} · ${p.minutes} min` })),
      ...state.workouts.map((w) => ({ date: w.date, chip: 'Workout', cls: 'plain', text: `${esc(w.type)} · ${w.minutes} min` })),
    ].sort(byDateDesc).slice(0, 6);
    $('#feed').innerHTML = items.length
      ? items.map((i) => `<li><span class="chip ${i.cls}">${i.chip}</span><span>${i.text}</span><span class="when">${relDay(i.date)}</span></li>`).join('')
      : '<li class="empty">Nothing logged yet.</li>';
  }

  // ---------- Rounds ----------
  function scorecardTable(r) {
    const n = r.holes.length;
    const sections = n === 18 ? [[0, 9, 'Out'], [9, 18, 'In']] : [[0, 9, 'Tot']];
    let hole = '<th>Hole</th>', par = '<td>Par</td>', score = '<td>Score</td>', putts = '<td>Putts</td>';
    sections.forEach(([a, b, label]) => {
      const seg = r.holes.slice(a, b);
      seg.forEach((h, i) => {
        hole += `<th>${a + i + 1}</th>`;
        par += `<td>${h.par}</td>`;
        score += `<td><span class="mark ${markClass(h.score, h.par)}">${h.score}</span></td>`;
        putts += `<td>${h.putts}</td>`;
      });
      const t = (f) => seg.reduce((s, h) => s + h[f], 0);
      hole += `<th class="tot">${label}</th>`; par += `<td class="tot">${t('par')}</td>`; score += `<td class="tot">${t('score')}</td>`; putts += `<td class="tot">${t('putts')}</td>`;
    });
    if (n === 18) {
      const s = roundStats(r);
      hole += '<th class="tot">Tot</th>'; par += `<td class="tot">${s.par}</td>`; score += `<td class="tot">${s.score}</td>`; putts += `<td class="tot">${s.putts}</td>`;
    }
    return `<div class="table-scroll"><table class="scorecard"><thead><tr>${hole}</tr></thead><tbody><tr>${par}</tr><tr>${score}</tr><tr>${putts}</tr></tbody></table></div>
      <div class="legend"><span><span class="mark eagle"></span>Eagle</span><span><span class="mark birdie"></span>Birdie</span><span><span class="mark bogey"></span>Bogey</span><span><span class="mark double"></span>Double+</span></div>`;
  }

  function renderRounds() {
    const list = [...state.rounds].sort(byDateDesc);
    $('#round-list').innerHTML = list.length ? list.map((r) => {
      const s = roundStats(r);
      const chips = (r.example ? ' <span class="chip plain">Example</span>' : '')
        + (r.source === 'ghin' ? ' <span class="chip plain">GHIN</span>' : s.detailed ? '' : ' <span class="chip plain">Total only</span>')
        + (r.usedInHandicap ? ' <span class="chip" title="One of the differentials GHIN is using for your index">In index</span>' : '');
      const ghinBits = [
        r.scoreType ? `<span>${esc(r.scoreType)}</span>` : '',
        r.par ? `<span>Par ${r.par}</span>` : '',
        r.courseRating != null ? `<span>${r.courseRating.toFixed(1)} / ${r.slope ?? '—'}</span>` : '',
        r.pcc ? `<span>PCC ${r.pcc > 0 ? '+' : ''}${r.pcc}</span>` : '',
        r.differential != null ? `<span>Diff ${r.differential.toFixed(1)}</span>` : '',
      ].join('');
      const statLine = s.detailed
        ? `<div class="item-meta num"><span>${s.putts} putts</span><span>GIR ${s.gir}/${s.holes}</span><span>Fairways ${s.fir}/${s.firChances}</span>${r.differential != null ? `<span>Diff ${r.differential.toFixed(1)}</span>` : ''}</div>`
        : (ghinBits ? `<div class="item-meta num">${ghinBits}</div>` : '');
      return `<article class="item" data-id="${r.id}">
        <div class="item-top">
          <div><div class="item-title">${esc(r.course)}${chips}</div>
          <div class="item-meta"><span>${fmtDate(r.date, true)}</span>${r.tees ? `<span>${esc(r.tees)} tees</span>` : ''}<span>${s.holes} holes</span></div></div>
          <div class="item-score">${s.score}${s.toPar == null ? '' : `<small>${fmtToPar(s.toPar)}</small>`}</div>
        </div>
        ${statLine}
        ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ''}
        ${s.detailed ? `<div class="card-detail" hidden>${scorecardTable(r)}</div>` : ''}
        <div class="item-actions">${s.detailed ? '<button type="button" class="link-btn" data-act="toggle-card">Show scorecard</button>' : ''}<button type="button" class="link-btn danger" data-act="delete" data-kind="rounds">Delete</button></div>
      </article>`;
    }).join('') : '<p class="empty">No rounds yet. Tap “New round” after your next 9 or 18.</p>';
    const courses = [...new Set(state.rounds.map((r) => r.course))];
    $('#course-list').innerHTML = courses.map((c) => `<option value="${esc(c)}"></option>`).join('');
  }

  function buildHoleRows(count, pars) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const par = pars && pars[i] ? pars[i] : 4;
      html += `<tr class="${i === 9 ? 'split' : ''}" data-hole="${i}">
        <td>${i + 1}</td>
        <td><input type="number" id="h-par-${i}" min="3" max="6" value="${par}" inputmode="numeric" aria-label="Hole ${i + 1} par"></td>
        <td><input type="number" id="h-score-${i}" min="1" max="15" inputmode="numeric" aria-label="Hole ${i + 1} score"></td>
        <td><input type="number" id="h-putts-${i}" min="0" max="8" inputmode="numeric" aria-label="Hole ${i + 1} putts"></td>
        <td class="fir-cell"><input type="checkbox" id="h-fir-${i}" aria-label="Hole ${i + 1} fairway hit"></td>
        <td class="gir-cell gir-no">–</td></tr>`;
    }
    $('#r-holes-body').innerHTML = html;
    updateRoundForm();
  }
  function readHoles() {
    return $$('#r-holes-body tr').map((tr, i) => ({
      par: parseInt($(`#h-par-${i}`).value, 10),
      score: parseInt($(`#h-score-${i}`).value, 10),
      putts: parseInt($(`#h-putts-${i}`).value, 10),
      fir: $(`#h-fir-${i}`).checked,
    }));
  }
  function updateRoundForm() {
    const holes = readHoles();
    let par = 0, score = 0, putts = 0, gir = 0, fir = 0, firCh = 0;
    holes.forEach((h, i) => {
      const firBox = $(`#h-fir-${i}`);
      const par3 = h.par === 3;
      firBox.hidden = par3; if (par3) firBox.checked = false;
      par += h.par || 0;
      if (!isNaN(h.score)) score += h.score;
      if (!isNaN(h.putts)) putts += h.putts;
      if (!par3) { firCh++; if (h.fir) fir++; }
      const cell = $$('#r-holes-body tr')[i].querySelector('.gir-cell');
      const known = !isNaN(h.score) && !isNaN(h.putts);
      const hit = known && isGIR(h);
      if (hit) gir++;
      cell.textContent = known ? (hit ? '✓' : '✗') : '–';
      cell.className = `gir-cell ${hit ? 'gir-yes' : 'gir-no'}`;
    });
    $('#r-totals').innerHTML = `<td>Tot</td><td>${par}</td><td>${score || '–'}</td><td>${putts || '–'}</td><td>${fir}/${firCh}</td><td>${gir}</td>`;
  }
  const roundMode = () => $('input[name="r-mode"]:checked').value;
  function showRoundMode() {
    const total = roundMode() === 'total';
    $('#r-total-fields').hidden = !total;
    $('#r-hole-fields').hidden = total;
  }
  function resetRoundForm() {
    $('#round-form').reset();
    $('#r-date').value = todayISO();
    buildHoleRows(18);
    showRoundMode();
  }
  function prefillParsForCourse() {
    const course = $('#r-course').value.trim().toLowerCase();
    const count = parseInt($('input[name="r-holes"]:checked').value, 10);
    const sorted = [...state.rounds].sort(byDateDesc);
    if (roundMode() === 'total') {
      // Fill course par from the last round here with the same number of holes
      if ($('#r-par').value) return;
      const prev = sorted.find((r) => r.course.toLowerCase() === course && holeCount(r) === count && roundStats(r).par);
      if (prev) { $('#r-par').value = roundStats(prev).par; toast(`Par filled in from your last round at ${prev.course}`); }
      return;
    }
    const prev = sorted.find((r) => r.course.toLowerCase() === course && isDetailed(r) && r.holes.length >= count);
    if (prev) {
      prev.holes.slice(0, count).forEach((h, i) => { $(`#h-par-${i}`).value = h.par; });
      updateRoundForm();
      toast(`Pars filled in from your last round at ${prev.course}`);
    }
  }

  $('#r-holes-body').addEventListener('input', updateRoundForm);
  $('#r-course').addEventListener('change', prefillParsForCourse);
  $$('input[name="r-mode"]').forEach((radio) => radio.addEventListener('change', () => { showRoundMode(); if ($('#r-course').value.trim()) prefillParsForCourse(); }));
  $$('input[name="r-holes"]').forEach((radio) => radio.addEventListener('change', () => {
    const pars = readHoles().map((h) => h.par);
    buildHoleRows(parseInt(radio.value, 10), pars);
  }));
  $('#round-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('#round-form button[type=submit]');
    const course = $('#r-course').value.trim();
    if (!course) { toast('Add the course name'); $('#r-course').focus(); return; }
    if (roundMode() === 'total') {
      const count = parseInt($('input[name="r-holes"]:checked').value, 10);
      const total = parseInt($('#r-total').value, 10);
      const par = parseInt($('#r-par').value, 10);
      const diff = parseFloat($('#r-diff').value);
      if (!(total >= count) || total > count * 10) { toast(`Enter your total score for the ${count} holes`); $('#r-total').focus(); return; }
      if ($('#r-par').value && !(par >= count * 3 && par <= count * 5)) { toast('Course par looks off. Leave it blank if you’re not sure.'); $('#r-par').focus(); return; }
      const r = { id: uid(), date: $('#r-date').value || todayISO(), course, tees: $('#r-tees').value.trim(), holeCount: count, total, notes: $('#r-notes').value.trim() };
      if (par) r.par = par;
      if (!isNaN(diff)) r.differential = diff;
      if (await busy(btn, () => dbInsert('rounds', [r]))) { closeForm('round-form'); toast(`Round saved: ${total}${toParNote(roundStats(r))}`); }
      return;
    }
    const holes = readHoles();
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (isNaN(h.par) || h.par < 3 || h.par > 6) { toast(`Hole ${i + 1}: par should be 3 to 6`); $(`#h-par-${i}`).focus(); return; }
      if (isNaN(h.score) || h.score < 1) { toast(`Enter a score for hole ${i + 1}`); $(`#h-score-${i}`).focus(); return; }
      if (isNaN(h.putts) || h.putts < 0) { toast(`Enter putts for hole ${i + 1} (0 for a chip-in)`); $(`#h-putts-${i}`).focus(); return; }
      if (h.putts >= h.score) { toast(`Hole ${i + 1}: putts must be fewer than the score`); $(`#h-putts-${i}`).focus(); return; }
    }
    const r = { id: uid(), date: $('#r-date').value || todayISO(), course, tees: $('#r-tees').value.trim(), holes, notes: $('#r-notes').value.trim() };
    const s = roundStats(r);
    if (await busy(btn, () => dbInsert('rounds', [r]))) { closeForm('round-form'); toast(`Round saved: ${s.score}${toParNote(s)}`); }
  });

  // ---------- GHIN import ----------
  // Reads the GHIN score history export as-is. Columns are matched by header name, so order doesn't matter:
  // Date, Score, Holes, Score Type, Course, Tees, Course Rating, Slope, PCC, Differential, Used in Handicap
  const GHIN_COLUMNS = {
    date: 'date', score: 'score', holes: 'holes', 'score type': 'scoreType', course: 'course', tees: 'tees',
    'course rating': 'courseRating', slope: 'slope', pcc: 'pcc', differential: 'differential', 'used in handicap': 'usedInHandicap',
  };
  const GHIN_REQUIRED = ['date', 'score', 'holes', 'course'];
  function parseDate(s) {
    const pad = (n) => String(n).padStart(2, '0');
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[1])}-${pad(m[2])}`;
    return null;
  }
  // CSV rows, honouring quoted fields (a course name can contain a comma)
  function csvRows(text) {
    const rows = []; let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',' || c === '\t') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f));
  }
  const num = (s) => (s === '' || s == null || isNaN(parseFloat(s)) ? null : parseFloat(s));
  const sameRound = (a, b) => a.date === b.date && a.course.toLowerCase() === b.course.toLowerCase()
    && holeCount(a) === holeCount(b) && roundStats(a).score === roundStats(b).score;
  function parseGhin(text) {
    const rows = csvRows(text.replace(/^﻿/, ''));
    const out = { fresh: [], updates: [], unchanged: 0, bad: [], error: null };
    if (!rows.length) return out;
    const col = {};
    // No header row (e.g. only the data lines were copied)? If the first row starts with a date, assume GHIN's standard column order.
    const hasHeader = !parseDate(rows[0][0] || '');
    const header = hasHeader ? rows[0].map((h) => h.toLowerCase()) : Object.keys(GHIN_COLUMNS);
    header.forEach((h, i) => { if (GHIN_COLUMNS[h]) col[GHIN_COLUMNS[h]] = i; });
    const missing = GHIN_REQUIRED.filter((k) => col[GHIN_COLUMNS[k]] == null);
    if (missing.length) { out.error = `This doesn’t look like a GHIN export. It needs the header row with ${missing.map((k) => `“${k[0].toUpperCase() + k.slice(1)}”`).join(', ')}.`; return out; }
    const get = (r, key) => (col[key] == null ? '' : r[col[key]] ?? '');
    const dataRows = hasHeader ? rows.slice(1) : rows;
    dataRows.forEach((r, i) => {
      const line = i + (hasHeader ? 2 : 1);
      const date = parseDate(get(r, 'date'));
      const course = get(r, 'course');
      const count = parseInt(get(r, 'holes'), 10);
      const total = parseInt(get(r, 'score'), 10);
      if (!date || !course || (count !== 9 && count !== 18) || !(total >= count && total <= count * 10)) { out.bad.push(line); return; }
      const used = get(r, 'usedInHandicap').toLowerCase();
      const ghin = {
        scoreType: get(r, 'scoreType'), tees: get(r, 'tees'),
        courseRating: num(get(r, 'courseRating')), slope: num(get(r, 'slope')), pcc: num(get(r, 'pcc')),
        differential: num(get(r, 'differential')), usedInHandicap: used === 'yes' ? true : used === 'no' ? false : null,
      };
      const r2 = { id: uid(), date, course, holeCount: count, total, notes: '', source: 'ghin', ...ghin };
      const existing = state.rounds.find((x) => sameRound(x, r2));
      if (existing) {
        // Already here: refresh the GHIN fields (e.g. "Used in Handicap" changes as new scores are posted)
        const changed = Object.keys(ghin).some((k) => (existing[k] ?? null) !== (ghin[k] ?? null) && !(k === 'tees' && !ghin.tees));
        if (changed) out.updates.push({ existing, ghin }); else out.unchanged++;
      } else if (!out.fresh.some((x) => sameRound(x, r2))) out.fresh.push(r2);
    });
    return out;
  }
  function importSummary(res) {
    if (res.error) return res.error;
    const parts = [`${res.fresh.length} new round${res.fresh.length === 1 ? '' : 's'}`];
    if (res.updates.length) parts.push(`${res.updates.length} to update`);
    if (res.unchanged) parts.push(`${res.unchanged} already up to date`);
    if (res.bad.length) parts.push(`couldn’t read line${res.bad.length === 1 ? '' : 's'} ${res.bad.join(', ')}`);
    return parts.join(' · ');
  }
  function previewImport() {
    const text = $('#import-text').value;
    $('#import-preview').textContent = text.trim() ? importSummary(parseGhin(text)) : '';
  }
  function resetImportForm() { $('#import-form').reset(); $('#import-preview').textContent = ''; }
  $('#import-text').addEventListener('input', previewImport);
  $('#import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((text) => { $('#import-text').value = text; previewImport(); }, () => toast('Couldn’t read that file'));
  });
  $('#import-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.submitter || $('#import-form button[type=submit]');
    const res = parseGhin($('#import-text').value);
    $('#import-preview').textContent = importSummary(res);
    if (res.error) { toast('That isn’t a GHIN score export'); return; }
    if (res.bad.length) { toast(`Fix or remove line${res.bad.length === 1 ? '' : 's'} ${res.bad.join(', ')} first`); return; }
    if (!res.fresh.length && !res.updates.length) { toast('Everything is already up to date'); return; }
    const ok = await busy(btn, async () => {
      await dbInsert('rounds', res.fresh);
      for (const { existing, ghin } of res.updates) {
        const updated = { ...existing };
        Object.entries(ghin).forEach(([k, v]) => { if (!(k === 'tees' && !v)) updated[k] = v; });
        await dbUpdate('rounds', updated);
        Object.assign(existing, updated);
      }
    });
    if (!ok) return;
    closeForm('import-form');
    const bits = [];
    if (res.fresh.length) bits.push(`${res.fresh.length} added`);
    if (res.updates.length) bits.push(`${res.updates.length} updated`);
    toast(`GHIN import: ${bits.join(', ')}`);
  });

  // ---------- Practice ----------
  $('#p-area').innerHTML = PRACTICE_AREAS.map((a) => `<option>${esc(a)}</option>`).join('');
  $('#p-rating').innerHTML = RATINGS.map((r, i) => `<label><input type="radio" name="p-rating" id="p-rating-${i + 1}" value="${i + 1}"${i === 2 ? ' checked' : ''}><span>${r}</span></label>`).join('');

  function renderPractice() {
    const list = [...state.practice].reverse().sort(byDateDesc); // newest first, even on the same day
    $('#practice-list').innerHTML = list.length ? list.map((p) => `<article class="item" data-id="${p.id}">
        <div class="item-top"><div><div class="item-title">${esc(p.drills && p.drills.length ? p.focus : p.area)}${p.example ? ' <span class="chip plain">Example</span>' : ''}</div>
          <div class="item-meta num"><span>${fmtDate(p.date, true)}</span><span>${p.minutes} min</span>${p.balls ? `<span>${p.balls} balls</span>` : ''}</div></div>
          <span class="stars" aria-label="${RATINGS[p.rating - 1]}">${'●'.repeat(p.rating)}${'○'.repeat(5 - p.rating)}</span></div>
        ${p.focus && !(p.drills && p.drills.length) ? `<div>${esc(p.focus)}</div>` : ''}
        ${p.drills && p.drills.length ? `<ul class="drill-results">${p.drills.map((d) => `<li><span>${esc(d.name)}</span><span class="num ${hitTarget(d) ? 'hit' : ''}">${fmtResult(d)}</span></li>`).join('')}</ul>` : ''}
        ${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}
        <div class="item-actions"><button type="button" class="link-btn danger" data-act="delete" data-kind="practice">Delete</button></div>
      </article>`).join('') : '<p class="empty">No practice sessions yet.</p>';
  }
  function resetPracticeForm() { $('#practice-form').reset(); $('#p-date').value = todayISO(); }
  $('#practice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const minutes = parseInt($('#p-minutes').value, 10);
    if (!minutes || minutes < 1) { toast('Enter how many minutes you practiced'); $('#p-minutes').focus(); return; }
    const p = { date: $('#p-date').value || todayISO(), area: $('#p-area').value, minutes,
      balls: parseInt($('#p-balls').value, 10) || 0, focus: $('#p-focus').value.trim(),
      rating: parseInt($('input[name="p-rating"]:checked').value, 10), notes: $('#p-notes').value.trim() };
    if (await busy(e.submitter, () => dbInsert('practice', [p]))) { closeForm('practice-form'); toast('Practice session saved'); }
  });

  // ---------- Workouts ----------
  $('#w-type').innerHTML = WORKOUT_TYPES.map((t) => `<option>${t}</option>`).join('');
  $('#exercise-list').innerHTML = EXERCISES.map((x) => `<option value="${esc(x)}"></option>`).join('');
  let exCounter = 0;
  function addExerciseRow() {
    const n = exCounter++;
    const row = document.createElement('div');
    row.className = 'ex-row';
    row.innerHTML = `<input type="text" id="ex-name-${n}" list="exercise-list" placeholder="Goblet squat" aria-label="Exercise">
      <input type="number" id="ex-sets-${n}" min="1" max="20" inputmode="numeric" placeholder="3" aria-label="Sets">
      <input type="text" id="ex-reps-${n}" placeholder="8" aria-label="Reps">
      <input type="text" id="ex-load-${n}" placeholder="50 lb" aria-label="Load">
      <button type="button" class="remove" aria-label="Remove exercise">×</button>`;
    row.querySelector('.remove').addEventListener('click', () => row.remove());
    $('#w-exercises').appendChild(row);
    return row;
  }
  $('#add-exercise').addEventListener('click', () => addExerciseRow().querySelector('input').focus());
  let workoutRoutineId = null;
  function resetWorkoutForm() {
    $('#workout-form').reset(); $('#w-date').value = todayISO();
    $('#w-exercises').innerHTML = ''; addExerciseRow(); addExerciseRow();
    workoutRoutineId = null; $('#w-title').textContent = 'Workout'; $('#w-routine-hint').hidden = true;
  }
  function renderWorkouts() {
    const list = [...state.workouts].reverse().sort(byDateDesc);
    $('#workout-list').innerHTML = list.length ? list.map((w) => `<article class="item" data-id="${w.id}">
        <div class="item-top"><div><div class="item-title">${esc(w.type)}${w.example ? ' <span class="chip plain">Example</span>' : ''}</div>
          <div class="item-meta num"><span>${fmtDate(w.date, true)}</span><span>${w.minutes} min</span><span>${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}</span>${routineName(w.routineId) ? `<span>${esc(routineName(w.routineId))}</span>` : ''}</div></div></div>
        ${w.exercises.length ? `<ul class="ex-list">${w.exercises.map((x) => `<li>${esc(x.name)}${x.sets ? ` — ${x.sets} × ${esc(x.reps || '?')}` : ''}${x.load ? ` @ ${esc(x.load)}` : ''}</li>`).join('')}</ul>` : ''}
        ${w.notes ? `<p class="notes">${esc(w.notes)}</p>` : ''}
        <div class="item-actions"><button type="button" class="link-btn danger" data-act="delete" data-kind="workouts">Delete</button></div>
      </article>`).join('') : '<p class="empty">No workouts yet.</p>';
  }
  $('#workout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const minutes = parseInt($('#w-minutes').value, 10);
    if (!minutes || minutes < 1) { toast('Enter how long the workout took'); $('#w-minutes').focus(); return; }
    const exercises = $$('#w-exercises .ex-row').map((row) => {
      const [name, sets, reps, load] = $$('input', row).map((i) => i.value.trim());
      return { name, sets: parseInt(sets, 10) || null, reps, load };
    }).filter((x) => x.name);
    const w = { date: $('#w-date').value || todayISO(), type: $('#w-type').value, minutes, exercises, notes: $('#w-notes').value.trim(), routineId: workoutRoutineId };
    if (await busy(e.submitter, () => dbInsert('workouts', [w]))) { closeForm('workout-form'); toast('Workout saved'); }
  });

  // ---------- Routines (practice plans and workout plans) ----------
  const routineName = (id) => (id ? (state.routines.find((r) => r.id === id) || {}).name || '' : '');
  const byRoutineOrder = (a, b) => (a.sort || 0) - (b.sort || 0) || a.name.localeCompare(b.name);
  const hasResult = (d) => d.result != null && d.result !== '' && !isNaN(d.result);
  function fmtResult(d) {
    if (d.score === 'made') return hasResult(d) ? `${d.result} / ${d.outOf}` : '—';
    if (d.score === 'strokes') return hasResult(d) ? `${d.result} strokes` : '—';
    return '✓';
  }
  function hitTarget(d) {
    if (!hasResult(d) || d.target == null) return false;
    return d.score === 'strokes' ? d.result <= d.target : d.result >= d.target;
  }
  // Past results for a drill, newest first (matched by drill name and scoring type).
  function drillHistory(name, score) {
    const out = [];
    [...state.practice].sort(byDateDesc).forEach((p) => (p.drills || []).forEach((d) => {
      if (d.name === name && d.score === score && hasResult(d)) out.push(d);
    }));
    return out;
  }
  function drillStats(item) {
    if (item.score === 'none') return '';
    const h = drillHistory(item.name, item.score);
    if (!h.length) return `Target ${item.score === 'strokes' ? '≤ ' : ''}${item.target ?? '—'}${item.score === 'made' ? ` of ${item.outOf}` : ''}`;
    const best = item.score === 'strokes' ? Math.min(...h.map((d) => d.result)) : Math.max(...h.map((d) => d.result));
    const unit = item.score === 'made' ? `/${item.outOf}` : '';
    return `Last ${h[0].result}${unit} · Best ${best}${unit} · Target ${item.score === 'strokes' ? '≤ ' : ''}${item.target ?? '—'}`;
  }
  const lastLoad = (name) => {
    for (const w of [...state.workouts].sort(byDateDesc)) {
      const x = w.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase() && e.load);
      if (x) return x.load;
    }
    return '';
  };

  function renderRoutines(kind) {
    const box = $(kind === 'practice' ? '#practice-routines' : '#workout-routines');
    if (routinesMissing) {
      box.innerHTML = `<div class="banner"><p><strong>One-time database update needed.</strong> Run the latest <code>supabase/setup.sql</code> in the Supabase SQL Editor (the whole file is safe to re-run), then reload this page to use routines.</p></div>`;
      return;
    }
    const list = state.routines.filter((r) => r.kind === kind).sort(byRoutineOrder);
    const doneThisWeek = new Set((kind === 'practice' ? state.practice : state.workouts).filter((x) => x.date >= weekStartISO()).map((x) => x.routineId));
    const cards = list.map((r) => {
      const mins = kind === 'practice' ? r.items.reduce((s, d) => s + (Number(d.minutes) || 0), 0) : 0;
      const meta = kind === 'practice'
        ? `${r.items.length} drills · ${mins} min`
        : `${r.items.length} exercises${r.type ? ` · ${esc(r.type)}` : ''}`;
      const preview = r.items.slice(0, 4).map((d) => esc(d.name)).join(' · ') + (r.items.length > 4 ? ' …' : '');
      return `<article class="routine" data-rid="${r.id}">
        <div class="routine-top"><span class="day">${esc(r.day || 'Any')}</span>${doneThisWeek.has(r.id) ? '<span class="chip">Done this week</span>' : ''}</div>
        <div class="item-title">${esc(r.name)}</div>
        <div class="item-meta">${meta}</div>
        <p class="routine-preview">${preview}</p>
        <div class="row-actions"><button type="button" class="btn small primary" data-ract="start">Start</button><button type="button" class="btn small ghost" data-ract="edit">Edit</button></div>
      </article>`;
    }).join('');
    const empty = `<div class="panel routine-empty"><p>${kind === 'practice'
      ? 'Routines turn practice into a plan: set drills, time for each, and a score to beat.'
      : 'Routines keep your workouts consistent: the same exercises each week, with your last weights filled in.'}</p>
      <div class="row-actions"><button type="button" class="btn small primary" data-ract="starter">Load starter routines</button><button type="button" class="btn small ghost" data-ract="new">Build my own</button></div></div>`;
    box.innerHTML = `<div class="routines-head"><h2>Routines</h2>${list.length ? '<button type="button" class="link-btn" data-ract="new">New routine</button>' : ''}</div>`
      + (list.length ? `<div class="routine-grid">${cards}</div>` : empty);
  }

  async function loadStarterRoutines(btn) {
    const starters = (window.STARTER_ROUTINES || []).filter((s) => !state.routines.some((r) => r.kind === s.kind && r.name === s.name))
      .map((s) => ({ kind: s.kind, name: s.name, day: s.day || '', type: s.focus || '', sort: s.sort || 0, notes: s.notes || '', items: s.items }));
    if (!starters.length) { toast('Starter routines are already loaded'); return; }
    if (await busy(btn, () => dbInsert('routines', starters))) toast(`Added ${starters.length} routines: 3 practice sessions and 3 workouts`);
  }

  // Running a practice routine
  let runRoutine = null;
  $('#run-rating').innerHTML = RATINGS.map((r, i) => `<label><input type="radio" name="run-rating" id="run-rating-${i + 1}" value="${i + 1}"${i === 2 ? ' checked' : ''}><span>${r}</span></label>`).join('');
  function startPractice(r) {
    runRoutine = r;
    $('#practice-run-form').reset();
    $('#run-title').textContent = r.name;
    $('#run-notes-hint').textContent = r.notes || '';
    $('#run-date').value = todayISO();
    $('#run-drills').innerHTML = r.items.map((d, i) => `<div class="drill" data-i="${i}">
        <div class="drill-top"><label class="drill-done"><input type="checkbox" id="run-done-${i}" checked><span class="drill-name">${esc(d.name)}</span></label><span class="drill-meta">${esc(d.area)} · ${d.minutes} min</span></div>
        ${d.how ? `<p class="drill-how">${esc(d.how)}</p>` : ''}
        ${d.score === 'none' ? '' : `<div class="drill-score"><label class="inline">${d.score === 'made' ? 'Result' : 'Strokes'}<input type="number" id="run-result-${i}" min="0" max="${d.score === 'made' ? d.outOf : 200}" inputmode="numeric" aria-label="${esc(d.name)} result">${d.score === 'made' ? `<span>/ ${d.outOf}</span>` : ''}</label><span class="drill-stats">${esc(drillStats(d))}</span></div>`}
      </div>`).join('');
    updateRunTotal();
    openForm('practice-run-form', false);
    $('#practice-run-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function updateRunTotal() {
    if (!runRoutine) return;
    const mins = runRoutine.items.reduce((s, d, i) => s + ($(`#run-done-${i}`).checked ? Number(d.minutes) || 0 : 0), 0);
    $('#run-total').textContent = `${mins} minutes of practice`;
  }
  $('#run-drills').addEventListener('input', (e) => {
    const m = e.target.id.match(/^run-result-(\d+)$/);
    if (m && e.target.value !== '') $(`#run-done-${m[1]}`).checked = true;
    updateRunTotal();
  });
  $('#run-drills').addEventListener('change', updateRunTotal);
  $('#practice-run-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = runRoutine;
    const drills = [];
    for (let i = 0; i < r.items.length; i++) {
      if (!$(`#run-done-${i}`).checked) continue;
      const d = r.items[i];
      const d2 = { name: d.name, area: d.area, minutes: Number(d.minutes) || 0, score: d.score, outOf: d.outOf ?? null, target: d.target ?? null, result: null };
      if (d.score !== 'none') {
        const raw = $(`#run-result-${i}`).value;
        if (raw !== '') {
          const v = parseInt(raw, 10);
          if (isNaN(v) || v < 0 || (d.score === 'made' && v > d.outOf)) { toast(`${d.name}: enter a number from 0 to ${d.score === 'made' ? d.outOf : 'your strokes'}`); $(`#run-result-${i}`).focus(); return; }
          d2.result = v;
        }
      }
      drills.push(d2);
    }
    if (!drills.length) { toast('Tick at least one drill you did'); return; }
    const byArea = {};
    drills.forEach((d) => { byArea[d.area] = (byArea[d.area] || 0) + d.minutes; });
    const area = Object.keys(byArea).sort((a, b) => byArea[b] - byArea[a])[0];
    const p = { date: $('#run-date').value || todayISO(), area, minutes: Math.max(1, drills.reduce((s, d) => s + d.minutes, 0)),
      balls: parseInt($('#run-balls').value, 10) || 0, focus: r.name, rating: parseInt($('input[name="run-rating"]:checked').value, 10),
      notes: $('#run-notes').value.trim(), routineId: r.id, drills };
    if (await busy(e.submitter, () => dbInsert('practice', [p]))) {
      closeForm('practice-run-form');
      const hits = drills.filter(hitTarget).length, scored = drills.filter(hasResult).length;
      toast(scored ? `Session saved · ${hits} of ${scored} drill targets hit` : 'Session saved');
    }
  });

  // Starting a workout routine fills in the workout form, with your last weights for each exercise.
  function startWorkout(r) {
    openForm('workout-form', false);
    workoutRoutineId = r.id;
    $('#w-title').textContent = r.name;
    if (r.notes) { $('#w-routine-hint').textContent = r.notes; $('#w-routine-hint').hidden = false; }
    if (r.type && WORKOUT_TYPES.includes(r.type)) $('#w-type').value = r.type;
    $('#w-exercises').innerHTML = '';
    r.items.forEach((x) => {
      const row = addExerciseRow();
      const [name, sets, reps, load] = $$('input', row);
      name.value = x.name; sets.value = x.sets || ''; reps.value = x.reps || '';
      const last = lastLoad(x.name);
      load.value = last || (x.load && x.load !== 'Warm-up' ? x.load : '');
      if (x.load === 'Warm-up') load.placeholder = 'Warm-up';
      if (last) load.title = `Last time: ${last}`;
    });
    $('#workout-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Routine editor
  let editing = null; // { kind, routine (null when new) }
  const AREA_OPTIONS = (sel) => PRACTICE_AREAS.map((a) => `<option${a === sel ? ' selected' : ''}>${esc(a)}</option>`).join('');
  function itemRow(kind, d = {}) {
    const row = document.createElement('div');
    row.className = 'rf-item';
    if (kind === 'practice') {
      row.innerHTML = `<div class="rf-grid practice">
          <label class="wide">Drill<input type="text" data-f="name" value="${esc(d.name || '')}" placeholder="Up-and-down circle"></label>
          <label>Area<select data-f="area">${AREA_OPTIONS(d.area || 'Putting')}</select></label>
          <label>Minutes<input type="number" data-f="minutes" min="1" max="180" inputmode="numeric" value="${d.minutes ?? ''}"></label>
          <label>Scoring<select data-f="score"><option value="none"${d.score === 'none' || !d.score ? ' selected' : ''}>Just do it</option><option value="made"${d.score === 'made' ? ' selected' : ''}>Made out of…</option><option value="strokes"${d.score === 'strokes' ? ' selected' : ''}>Strokes (lower is better)</option></select></label>
          <label data-show="made">Out of<input type="number" data-f="outOf" min="1" max="100" inputmode="numeric" value="${d.outOf ?? ''}"></label>
          <label data-show="made strokes">Target<input type="number" data-f="target" min="0" max="200" inputmode="numeric" value="${d.target ?? ''}"></label>
          <label class="wide">How<input type="text" data-f="how" value="${esc(d.how || '')}" placeholder="Setup and what counts"></label>
        </div>`;
    } else {
      row.innerHTML = `<div class="rf-grid workout">
          <label class="wide">Exercise<input type="text" data-f="name" list="exercise-list" value="${esc(d.name || '')}" placeholder="Goblet squat"></label>
          <label>Sets<input type="number" data-f="sets" min="1" max="20" inputmode="numeric" value="${d.sets ?? ''}"></label>
          <label>Reps<input type="text" data-f="reps" value="${esc(d.reps || '')}" placeholder="8"></label>
          <label>Load / note<input type="text" data-f="load" value="${esc(d.load || '')}" placeholder="Optional"></label>
        </div>`;
    }
    row.insertAdjacentHTML('beforeend', `<div class="rf-item-actions"><button type="button" class="link-btn" data-move="-1" aria-label="Move up">↑</button><button type="button" class="link-btn" data-move="1" aria-label="Move down">↓</button><button type="button" class="link-btn danger" data-remove>Remove</button></div>`);
    syncScoreFields(row);
    return row;
  }
  function syncScoreFields(row) {
    const sel = row.querySelector('[data-f="score"]');
    if (!sel) return;
    row.querySelectorAll('[data-show]').forEach((el) => { el.hidden = !el.dataset.show.split(' ').includes(sel.value); });
  }
  function openEditor(kind, routine) {
    editing = { kind, routine };
    const form = $('#routine-form');
    const view = $(kind === 'practice' ? '#practice-routines' : '#workout-routines');
    view.after(form);
    form.reset();
    $('#rf-title').textContent = routine ? `Edit: ${routine.name}` : kind === 'practice' ? 'New practice routine' : 'New workout routine';
    $('#rf-type-wrap').hidden = kind !== 'workout';
    $('#rf-type').innerHTML = WORKOUT_TYPES.map((t) => `<option>${t}</option>`).join('');
    $('#rf-name').value = routine ? routine.name : '';
    $('#rf-day').value = routine ? routine.day : '';
    if (routine && routine.type) $('#rf-type').value = routine.type;
    $('#rf-notes').value = routine ? routine.notes : '';
    $('#rf-add').textContent = kind === 'practice' ? 'Add drill' : 'Add exercise';
    $('#rf-delete').hidden = !routine;
    $('#rf-items').innerHTML = '';
    (routine ? routine.items : [{}, {}]).forEach((d) => $('#rf-items').appendChild(itemRow(kind, d)));
    form.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#rf-name').focus({ preventScroll: true });
  }
  function closeEditor() { $('#routine-form').hidden = true; editing = null; }
  $('#rf-add').addEventListener('click', () => { const row = itemRow(editing.kind); $('#rf-items').appendChild(row); row.querySelector('input').focus(); });
  $('#rf-cancel').addEventListener('click', closeEditor);
  $('#rf-items').addEventListener('change', (e) => { if (e.target.dataset.f === 'score') syncScoreFields(e.target.closest('.rf-item')); });
  $('#rf-items').addEventListener('click', (e) => {
    const row = e.target.closest('.rf-item');
    if (!row) return;
    if (e.target.hasAttribute('data-remove')) row.remove();
    if (e.target.dataset.move === '-1' && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
    if (e.target.dataset.move === '1' && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
  });
  function readItems(kind) {
    return $$('#rf-items .rf-item').map((row) => {
      const v = (f) => { const el = row.querySelector(`[data-f="${f}"]`); return el ? el.value.trim() : ''; };
      const int = (f) => (v(f) === '' ? null : parseInt(v(f), 10));
      if (kind === 'practice') {
        const score = v('score');
        return { name: v('name'), area: v('area'), minutes: int('minutes') || 0, how: v('how'), score,
          outOf: score === 'made' ? int('outOf') : null, target: score === 'none' ? null : int('target') };
      }
      return { name: v('name'), sets: int('sets'), reps: v('reps'), load: v('load') };
    }).filter((x) => x.name);
  }
  $('#routine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const { kind, routine } = editing;
    const name = $('#rf-name').value.trim();
    if (!name) { toast('Give the routine a name'); $('#rf-name').focus(); return; }
    const items = readItems(kind);
    if (!items.length) { toast(kind === 'practice' ? 'Add at least one drill' : 'Add at least one exercise'); return; }
    const bad = kind === 'practice' && items.find((d) => !d.minutes || (d.score === 'made' && !d.outOf));
    if (bad) { toast(`${bad.name}: add ${!bad.minutes ? 'minutes' : 'how many it’s out of'}`); return; }
    const data = { kind, name, day: $('#rf-day').value, type: kind === 'workout' ? $('#rf-type').value : '', notes: $('#rf-notes').value.trim(), items,
      sort: routine ? routine.sort : Math.max(0, ...state.routines.filter((r) => r.kind === kind).map((r) => r.sort || 0)) + 1 };
    const ok = await busy(e.submitter, () => (routine ? dbUpdate('routines', { ...routine, ...data }) : dbInsert('routines', [data])));
    if (ok) { closeEditor(); toast(routine ? 'Routine updated' : 'Routine added'); }
  });
  $('#rf-delete').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    armOrRun(btn, 'Tap again to delete routine', async () => {
      const id = editing.routine.id;
      if (await busy(btn, () => dbDelete('routines', id))) { closeEditor(); toast('Routine deleted. Past sessions are kept.'); }
    });
  });

  // Routine card buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ract]');
    if (!btn) return;
    const kind = btn.closest('#practice-routines') ? 'practice' : 'workout';
    const card = btn.closest('[data-rid]');
    const routine = card ? state.routines.find((r) => r.id === card.dataset.rid) : null;
    const act = btn.dataset.ract;
    if (act === 'starter') loadStarterRoutines(btn);
    else if (act === 'new') openEditor(kind, null);
    else if (act === 'edit' && routine) openEditor(kind, routine);
    else if (act === 'start' && routine) (kind === 'practice' ? startPractice : startWorkout)(routine);
  });

  // ---------- Opening / closing forms ----------
  const resetters = { 'round-form': resetRoundForm, 'import-form': resetImportForm, 'practice-form': resetPracticeForm, 'workout-form': resetWorkoutForm, 'practice-run-form': () => {} };
  function openForm(id, focus = true) {
    resetters[id]();
    const f = $(`#${id}`); f.hidden = false;
    const opener = $(`[data-open="${id}"]`); if (opener) opener.hidden = true;
    const first = f.querySelector('input:not([type="date"]), select');
    if (focus && first) first.focus();
  }
  function closeForm(id) { $(`#${id}`).hidden = true; const opener = $(`[data-open="${id}"]`); if (opener) opener.hidden = false; }
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => openForm(b.dataset.open)));
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeForm(b.dataset.close)));

  // ---------- List actions (delete, show scorecard) ----------
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const item = btn.closest('.item');
    if (btn.dataset.act === 'toggle-card') {
      const d = item.querySelector('.card-detail');
      d.hidden = !d.hidden;
      btn.textContent = d.hidden ? 'Show scorecard' : 'Hide scorecard';
    } else if (btn.dataset.act === 'delete') {
      armOrRun(btn, 'Tap again to delete', async () => {
        if (await busy(btn, () => dbDelete(btn.dataset.kind, item.dataset.id))) toast('Deleted');
      });
    }
  });

  // ---------- Your data: move old data, backup, restore, erase ----------
  $('#do-migrate').addEventListener('click', async (e) => {
    const legacy = legacyData();
    if (!legacy) return;
    let added = 0;
    if (await busy(e.currentTarget, async () => { added = await mergeIn(legacy.data); })) {
      markLegacyDone(); renderAll();
      toast(added ? `Moved ${added} entr${added === 1 ? 'y' : 'ies'} into your account` : 'Those entries were already in your account');
    }
  });
  $('#skip-migrate').addEventListener('click', () => { migrateDismissed = true; renderAll(); });
  $('#copy-backup').addEventListener('click', () => {
    const text = JSON.stringify(state);
    const done = () => toast('Backup copied. Paste it into a note or email to yourself.');
    const fallback = () => {
      $('#restore-box').hidden = false;
      const ta = $('#restore-text'); ta.value = text; ta.select();
      toast('Copy the selected text below to save your backup');
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (err) { fallback(); }
  });
  $('#show-restore').addEventListener('click', () => { const b = $('#restore-box'); b.hidden = !b.hidden; if (!b.hidden) $('#restore-text').focus(); });
  $('#do-restore').addEventListener('click', async (e) => {
    let data;
    try {
      data = JSON.parse($('#restore-text').value);
      if (!Array.isArray(data.rounds) || !Array.isArray(data.practice) || !Array.isArray(data.workouts)) throw new Error('shape');
    } catch (err) {
      toast('That text isn’t a Fairway Notebook backup. Paste the whole thing you copied.'); return;
    }
    let added = 0;
    if (await busy(e.currentTarget, async () => { added = await mergeIn(data); })) {
      $('#restore-box').hidden = true; $('#restore-text').value = '';
      toast(added ? `Restored ${added} entr${added === 1 ? 'y' : 'ies'} (anything already here was skipped)` : 'Everything in that backup is already here');
    }
  });
  $('#erase-all').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    armOrRun(btn, 'Tap again to erase all', async () => {
      if (await busy(btn, dbDeleteAll)) toast('All entries erased');
    });
  });

  // ---------- Sign in ----------
  const AUTH_PANES = ['auth-setup', 'auth-loading', 'signin-form', 'newpw-form'];
  function showAuth(pane, msg) {
    $('#auth').hidden = false; $('main').hidden = true; $('.tabs').hidden = true;
    AUTH_PANES.forEach((id) => { $(`#${id}`).hidden = id !== pane; });
    if (msg != null) { const m = $(`#${pane} .auth-msg`); if (m) m.textContent = msg; }
  }
  function showApp() { $('#auth').hidden = true; $('main').hidden = false; $('.tabs').hidden = false; }
  async function enterApp(session) {
    currentUser = session.user;
    $('#who').textContent = currentUser.email;
    showAuth('auth-loading');
    try { await dbLoad(); }
    catch (err) {
      showAuth('signin-form', `Signed in, but your data couldn’t be loaded (${err.message || err}). Has supabase/setup.sql been run?`);
      return;
    }
    showApp(); renderAll(); showView();
  }
  $('#signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#si-email').value.trim(), password = $('#si-password').value;
    if (!email || !password) { $('#signin-msg').textContent = 'Enter your email and password.'; return; }
    const btn = e.submitter || $('#signin-form button[type=submit]');
    btn.disabled = true; $('#signin-msg').textContent = 'Signing in…';
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (error) { $('#signin-msg').textContent = /invalid/i.test(error.message) ? 'That email and password don’t match.' : error.message; return; }
    $('#si-password').value = '';
    enterApp(data.session);
  });
  $('#forgot').addEventListener('click', async () => {
    const email = $('#si-email').value.trim();
    if (!email) { $('#signin-msg').textContent = 'Type your email above first, then tap “Forgot password?” again.'; $('#si-email').focus(); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    $('#signin-msg').textContent = error ? error.message : 'Check your email for a link to choose a new password.';
  });
  $('#newpw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('#np-password').value;
    if (password.length < 8) { $('#newpw-msg').textContent = 'Use at least 8 characters.'; return; }
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) { $('#newpw-msg').textContent = error.message; return; }
    $('#np-password').value = '';
    const { data: s } = await sb.auth.getSession();
    toast('Password updated');
    if (s.session) enterApp(s.session); else showAuth('signin-form', data.user ? 'Password updated. Sign in with it now.' : '');
  });
  $('#sign-out').addEventListener('click', () => sb.auth.signOut());

  async function boot() {
    if (!configured) { showAuth('auth-setup'); return; }
    showAuth('auth-loading');
    sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') showAuth('newpw-form');
      if (event === 'SIGNED_OUT') { currentUser = null; state = emptyState(); showAuth('signin-form', ''); }
    });
    const { data } = await sb.auth.getSession();
    if (recoveryLink && data.session) showAuth('newpw-form');
    else if (data.session) enterApp(data.session);
    else showAuth('signin-form');
  }

  // ---------- Go ----------
  function renderExerciseList() {
    const names = new Set(EXERCISES);
    state.routines.filter((r) => r.kind === 'workout').forEach((r) => r.items.forEach((x) => names.add(x.name)));
    state.workouts.forEach((w) => w.exercises.forEach((x) => x.name && names.add(x.name)));
    $('#exercise-list').innerHTML = [...names].sort().map((x) => `<option value="${esc(x)}"></option>`).join('');
  }
  function renderAll() { renderDashboard(); renderRounds(); renderPractice(); renderWorkouts(); renderRoutines('practice'); renderRoutines('workout'); renderExerciseList(); }
  boot();
})();
