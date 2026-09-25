/* Fairway Notebook — golf rounds, practice and workouts.
   All data is saved in this browser (localStorage). */
(function () {
  'use strict';

  // ---------- Small helpers ----------
  const STORAGE_KEY = 'fairway-notebook-v1';
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
  function roundStats(r) {
    const s = { holes: r.holes.length, par: 0, score: 0, putts: 0, gir: 0, fir: 0, firChances: 0 };
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

  // ---------- Example data (shown until removed) ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const EXAMPLE_PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 3, 4, 5, 4, 4, 3, 4, 5];
  function exampleRound(seed, daysBack, course, tees) {
    const rand = rng(seed);
    const holes = EXAMPLE_PARS.map((par) => {
      const r = rand();
      const over = r < 0.07 ? -1 : r < 0.36 ? 0 : r < 0.78 ? 1 : r < 0.95 ? 2 : 3;
      const score = par + over;
      const p = rand();
      let putts = p < 0.18 ? 1 : p < 0.85 ? 2 : 3;
      if (putts > score - 1) putts = score - 1;
      return { par, score, putts, fir: par >= 4 ? rand() < 0.5 : false };
    });
    return { id: uid(), example: true, date: isoDaysAgo(daysBack), course, tees, holes, notes: '' };
  }
  function exampleData() {
    const rounds = [
      exampleRound(11, 3, 'Pine Hollow GC', 'White'),
      exampleRound(27, 10, 'Pine Hollow GC', 'White'),
      exampleRound(5, 17, 'Riverbend Municipal', 'Blue'),
      exampleRound(42, 24, 'Pine Hollow GC', 'White'),
      exampleRound(8, 31, 'Riverbend Municipal', 'Blue'),
      exampleRound(19, 40, 'Pine Hollow GC', 'White'),
    ];
    rounds[0].notes = 'Lag putting felt better. Missed right with driver on the back nine.';
    const practice = [
      [1, 'Putting', 30, 0, 'Lag ladder, 20–40 ft', 4],
      [5, 'Wedges', 45, 80, '50 / 75 / 100 yd carry ladder', 3],
      [8, 'Driver & woods', 40, 60, 'Start line through an alignment-stick gate', 3],
      [12, 'Chipping', 30, 50, 'One club, three landing spots', 4],
      [15, 'Irons', 50, 90, 'Low point: towel 4 in. behind the ball', 2],
      [20, 'Putting', 25, 0, '3-ft circle, 25 in a row', 5],
      [26, 'Bunker', 20, 40, 'Line in the sand, enter behind it', 3],
    ].map(([d, area, minutes, balls, focus, rating]) => ({ id: uid(), example: true, date: isoDaysAgo(d), area, minutes, balls, focus, rating, notes: '' }));
    const workouts = [
      [2, 'Strength', 50, [['Trap bar deadlift', 4, '5', '185 lb'], ['Split squat', 3, '8', '35 lb DBs'], ['Cable wood chop', 3, '10', '40 lb']]],
      [4, 'Speed', 25, [['Med ball rotational throw', 5, '5', '8 lb'], ['Overspeed swings', 3, '10', 'Light stick']]],
      [6, 'Mobility', 20, [['90/90 hip switch', 2, '10', ''], ['Open books', 2, '10/side', ''], ['Deep squat hold', 3, '45 s', '']]],
      [9, 'Strength', 45, [['Goblet squat', 4, '8', '50 lb'], ['Single-arm row', 3, '10', '45 lb'], ['Pallof press', 3, '12', 'Green band']]],
      [13, 'Conditioning', 30, [['Farmer carry', 4, '40 yd', '60 lb DBs'], ['Lateral bound', 3, '6/side', '']]],
    ].map(([d, type, minutes, ex]) => ({ id: uid(), example: true, date: isoDaysAgo(d), type, minutes, notes: '',
      exercises: ex.map(([name, sets, reps, load]) => ({ name, sets, reps, load })) }));
    return { rounds, practice, workouts };
  }

  // ---------- Storage ----------
  let storageWorks = true;
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { storageWorks = false; }
    return null;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageWorks = true; }
    catch (e) { storageWorks = false; }
  }
  let state = load();
  if (!state || !Array.isArray(state.rounds)) { state = exampleData(); save(); }
  const hasExamples = () => ['rounds', 'practice', 'workouts'].some((k) => state[k].some((x) => x.example));

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
    const full = rounds.filter((r) => r.holes.length === 18);
    const last5 = full.slice(0, 5).map(roundStats);
    const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : null);
    const allLast5 = rounds.slice(0, 5).map(roundStats);
    const girPct = allLast5.length ? (100 * allLast5.reduce((s, x) => s + x.gir, 0)) / allLast5.reduce((s, x) => s + x.holes, 0) : null;
    const firChances = allLast5.reduce((s, x) => s + x.firChances, 0);
    const firPct = firChances ? (100 * allLast5.reduce((s, x) => s + x.fir, 0)) / firChances : null;
    const puttsPer18 = avg(allLast5, (x) => (x.putts * 18) / x.holes);
    const scoreAvg = avg(last5, (x) => x.score);
    const toParAvg = avg(last5, (x) => x.toPar);
    const best = full.length ? Math.min(...full.map((r) => roundStats(r).score)) : null;

    const kpi = (label, value, note) => `<div class="kpi"><span class="label">${label}</span><span class="value">${value}</span><span class="note">${note}</span></div>`;
    $('#kpis').innerHTML = [
      kpi('Scoring avg', scoreAvg == null ? '—' : scoreAvg.toFixed(1), toParAvg == null ? 'Log an 18-hole round' : `${fmtToPar(Math.round(toParAvg))} to par · best ${best}`),
      kpi('Putts / 18', puttsPer18 == null ? '—' : puttsPer18.toFixed(1), 'Last 5 rounds'),
      kpi('Greens hit', girPct == null ? '—' : `${Math.round(girPct)}%`, 'In regulation'),
      kpi('Fairways hit', firPct == null ? '—' : `${Math.round(firPct)}%`, 'Par 4s and 5s'),
    ].join('');

    $('#trend').innerHTML = trendChart(full.slice(0, 10).reverse());
    renderPracticeBars();
    renderWeek();
    renderFeed();

    const total = state.rounds.length + state.practice.length + state.workouts.length;
    $('#dash-sub').textContent = `${state.rounds.length} rounds · ${state.practice.length} practice sessions · ${state.workouts.length} workouts`;
    $('#example-banner').hidden = !hasExamples();
    $('#storage-note').textContent = storageWorks
      ? `Saved in this browser on this device (${total} entries). Copy a backup now and then, or before switching devices.`
      : 'This browser is not allowing the app to save. Entries will be lost when you close the page; copy a backup to keep them.';
  }

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
    recent.forEach((p) => { mins[p.area] = (mins[p.area] || 0) + p.minutes; });
    const max = Math.max(...Object.values(mins));
    $('#practice-bars').innerHTML = '<div class="bars">' + PRACTICE_AREAS.filter((a) => mins[a]).sort((a, b) => mins[b] - mins[a])
      .map((a) => `<div class="bar-row"><span>${esc(a)}</span><div class="bar-track"><div class="bar-fill" style="width:${(100 * mins[a]) / max}%"></div></div><span class="v">${mins[a]} min</span></div>`).join('') + '</div>';
  }

  function renderWeek() {
    const wk = (arr) => arr.filter((x) => daysSince(x.date) < 7);
    const w = wk(state.workouts), p = wk(state.practice), r = wk(state.rounds);
    const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
    $('#week').innerHTML = `<div class="week">
      <div><strong>${w.length}</strong><span>workouts · ${sum(w, (x) => x.minutes)} min</span></div>
      <div><strong>${p.length}</strong><span>practice · ${sum(p, (x) => x.minutes)} min</span></div>
      <div><strong>${r.length}</strong><span>round${r.length === 1 ? '' : 's'} played</span></div></div>`;
  }

  function renderFeed() {
    const items = [
      ...state.rounds.map((r) => { const s = roundStats(r); return { date: r.date, chip: 'Round', cls: '', text: `${esc(r.course)} · ${s.score} (${fmtToPar(s.toPar)})` }; }),
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
      return `<article class="item" data-id="${r.id}">
        <div class="item-top">
          <div><div class="item-title">${esc(r.course)}${r.example ? ' <span class="chip plain">Example</span>' : ''}</div>
          <div class="item-meta"><span>${fmtDate(r.date, true)}</span>${r.tees ? `<span>${esc(r.tees)} tees</span>` : ''}<span>${s.holes} holes</span></div></div>
          <div class="item-score">${s.score}<small>${fmtToPar(s.toPar)}</small></div>
        </div>
        <div class="item-meta num"><span>${s.putts} putts</span><span>GIR ${s.gir}/${s.holes}</span><span>Fairways ${s.fir}/${s.firChances}</span></div>
        ${r.notes ? `<p class="notes">${esc(r.notes)}</p>` : ''}
        <div class="card-detail" hidden>${scorecardTable(r)}</div>
        <div class="item-actions"><button type="button" class="link-btn" data-act="toggle-card">Show scorecard</button><button type="button" class="link-btn danger" data-act="delete" data-kind="rounds">Delete</button></div>
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
  function resetRoundForm() {
    $('#round-form').reset();
    $('#r-date').value = todayISO();
    buildHoleRows(18);
  }
  function prefillParsForCourse() {
    const course = $('#r-course').value.trim().toLowerCase();
    const count = parseInt($('input[name="r-holes"]:checked').value, 10);
    const prev = [...state.rounds].sort(byDateDesc).find((r) => r.course.toLowerCase() === course && r.holes.length >= count);
    if (prev) {
      prev.holes.slice(0, count).forEach((h, i) => { $(`#h-par-${i}`).value = h.par; });
      updateRoundForm();
      toast(`Pars filled in from your last round at ${prev.course}`);
    }
  }

  $('#r-holes-body').addEventListener('input', updateRoundForm);
  $('#r-course').addEventListener('change', prefillParsForCourse);
  $$('input[name="r-holes"]').forEach((radio) => radio.addEventListener('change', () => {
    const pars = readHoles().map((h) => h.par);
    buildHoleRows(parseInt(radio.value, 10), pars);
  }));
  $('#round-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const course = $('#r-course').value.trim();
    if (!course) { toast('Add the course name'); $('#r-course').focus(); return; }
    const holes = readHoles();
    for (let i = 0; i < holes.length; i++) {
      const h = holes[i];
      if (isNaN(h.par) || h.par < 3 || h.par > 6) { toast(`Hole ${i + 1}: par should be 3 to 6`); $(`#h-par-${i}`).focus(); return; }
      if (isNaN(h.score) || h.score < 1) { toast(`Enter a score for hole ${i + 1}`); $(`#h-score-${i}`).focus(); return; }
      if (isNaN(h.putts) || h.putts < 0) { toast(`Enter putts for hole ${i + 1} (0 for a chip-in)`); $(`#h-putts-${i}`).focus(); return; }
      if (h.putts >= h.score) { toast(`Hole ${i + 1}: putts must be fewer than the score`); $(`#h-putts-${i}`).focus(); return; }
    }
    state.rounds.push({ id: uid(), date: $('#r-date').value || todayISO(), course, tees: $('#r-tees').value.trim(), holes, notes: $('#r-notes').value.trim() });
    save(); closeForm('round-form'); renderAll();
    const s = roundStats(state.rounds[state.rounds.length - 1]);
    toast(`Round saved: ${s.score} (${fmtToPar(s.toPar)})`);
  });

  // ---------- Practice ----------
  $('#p-area').innerHTML = PRACTICE_AREAS.map((a) => `<option>${esc(a)}</option>`).join('');
  $('#p-rating').innerHTML = RATINGS.map((r, i) => `<label><input type="radio" name="p-rating" id="p-rating-${i + 1}" value="${i + 1}"${i === 2 ? ' checked' : ''}><span>${r}</span></label>`).join('');

  function renderPractice() {
    const list = [...state.practice].sort(byDateDesc);
    $('#practice-list').innerHTML = list.length ? list.map((p) => `<article class="item" data-id="${p.id}">
        <div class="item-top"><div><div class="item-title">${esc(p.area)}${p.example ? ' <span class="chip plain">Example</span>' : ''}</div>
          <div class="item-meta num"><span>${fmtDate(p.date, true)}</span><span>${p.minutes} min</span>${p.balls ? `<span>${p.balls} balls</span>` : ''}</div></div>
          <span class="stars" aria-label="${RATINGS[p.rating - 1]}">${'●'.repeat(p.rating)}${'○'.repeat(5 - p.rating)}</span></div>
        ${p.focus ? `<div>${esc(p.focus)}</div>` : ''}
        ${p.notes ? `<p class="notes">${esc(p.notes)}</p>` : ''}
        <div class="item-actions"><button type="button" class="link-btn danger" data-act="delete" data-kind="practice">Delete</button></div>
      </article>`).join('') : '<p class="empty">No practice sessions yet.</p>';
  }
  function resetPracticeForm() { $('#practice-form').reset(); $('#p-date').value = todayISO(); }
  $('#practice-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const minutes = parseInt($('#p-minutes').value, 10);
    if (!minutes || minutes < 1) { toast('Enter how many minutes you practiced'); $('#p-minutes').focus(); return; }
    state.practice.push({ id: uid(), date: $('#p-date').value || todayISO(), area: $('#p-area').value, minutes,
      balls: parseInt($('#p-balls').value, 10) || 0, focus: $('#p-focus').value.trim(),
      rating: parseInt($('input[name="p-rating"]:checked').value, 10), notes: $('#p-notes').value.trim() });
    save(); closeForm('practice-form'); renderAll(); toast('Practice session saved');
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
  function resetWorkoutForm() {
    $('#workout-form').reset(); $('#w-date').value = todayISO();
    $('#w-exercises').innerHTML = ''; addExerciseRow(); addExerciseRow();
  }
  function renderWorkouts() {
    const list = [...state.workouts].sort(byDateDesc);
    $('#workout-list').innerHTML = list.length ? list.map((w) => `<article class="item" data-id="${w.id}">
        <div class="item-top"><div><div class="item-title">${esc(w.type)}${w.example ? ' <span class="chip plain">Example</span>' : ''}</div>
          <div class="item-meta num"><span>${fmtDate(w.date, true)}</span><span>${w.minutes} min</span><span>${w.exercises.length} exercise${w.exercises.length === 1 ? '' : 's'}</span></div></div></div>
        ${w.exercises.length ? `<ul class="ex-list">${w.exercises.map((x) => `<li>${esc(x.name)}${x.sets ? ` — ${x.sets} × ${esc(x.reps || '?')}` : ''}${x.load ? ` @ ${esc(x.load)}` : ''}</li>`).join('')}</ul>` : ''}
        ${w.notes ? `<p class="notes">${esc(w.notes)}</p>` : ''}
        <div class="item-actions"><button type="button" class="link-btn danger" data-act="delete" data-kind="workouts">Delete</button></div>
      </article>`).join('') : '<p class="empty">No workouts yet.</p>';
  }
  $('#workout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const minutes = parseInt($('#w-minutes').value, 10);
    if (!minutes || minutes < 1) { toast('Enter how long the workout took'); $('#w-minutes').focus(); return; }
    const exercises = $$('#w-exercises .ex-row').map((row) => {
      const [name, sets, reps, load] = $$('input', row).map((i) => i.value.trim());
      return { name, sets: parseInt(sets, 10) || null, reps, load };
    }).filter((x) => x.name);
    state.workouts.push({ id: uid(), date: $('#w-date').value || todayISO(), type: $('#w-type').value, minutes, exercises, notes: $('#w-notes').value.trim() });
    save(); closeForm('workout-form'); renderAll(); toast('Workout saved');
  });

  // ---------- Opening / closing forms ----------
  const resetters = { 'round-form': resetRoundForm, 'practice-form': resetPracticeForm, 'workout-form': resetWorkoutForm };
  function openForm(id) {
    resetters[id]();
    const f = $(`#${id}`); f.hidden = false;
    $(`[data-open="${id}"]`).hidden = true;
    const first = f.querySelector('input:not([type="date"]), select');
    if (first) first.focus();
  }
  function closeForm(id) { $(`#${id}`).hidden = true; $(`[data-open="${id}"]`).hidden = false; }
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
      armOrRun(btn, 'Tap again to delete', () => {
        const kind = btn.dataset.kind;
        state[kind] = state[kind].filter((x) => x.id !== item.dataset.id);
        save(); renderAll(); toast('Deleted');
      });
    }
  });

  // ---------- Your data: backup, restore, examples, erase ----------
  $('#clear-examples').addEventListener('click', () => {
    ['rounds', 'practice', 'workouts'].forEach((k) => { state[k] = state[k].filter((x) => !x.example); });
    state.examplesCleared = true;
    save(); renderAll(); toast('Examples removed. Everything left is yours.');
  });
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
  $('#do-restore').addEventListener('click', () => {
    try {
      const data = JSON.parse($('#restore-text').value);
      if (!Array.isArray(data.rounds) || !Array.isArray(data.practice) || !Array.isArray(data.workouts)) throw new Error('shape');
      state = data; save(); renderAll();
      $('#restore-box').hidden = true; $('#restore-text').value = '';
      toast('Backup restored');
    } catch (err) {
      toast('That text isn’t a Fairway Notebook backup. Paste the whole thing you copied.');
    }
  });
  $('#erase-all').addEventListener('click', (e) => {
    armOrRun(e.currentTarget, 'Tap again to erase all', () => {
      state = { rounds: [], practice: [], workouts: [], examplesCleared: true };
      save(); renderAll(); toast('All entries erased');
    });
  });

  // ---------- Go ----------
  function renderAll() { renderDashboard(); renderRounds(); renderPractice(); renderWorkouts(); }
  renderAll();
  showView();
})();
