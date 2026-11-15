/* Console engine shared by user.html and admin.html: routing, the dashboard views,
   charts, manual entry, notifications and the assistant. Each page boots it with its
   own role and can add views or hooks (see user.js and admin.js). */
(function () {
  'use strict';
  const C = window.CHC;
  const { METRICS, SECTIONS, HEADLINE, RANK, LABEL, OVERALL, COLOR, latest, statusOf, fmt, flagged, sectionKeys, sectionStatus, overall, limitText, recs, ago, NOW, DAY } = C;
  const $ = C.$ = (s, r = document) => r.querySelector(s);
  const esc = C.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  const tFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  const app = C.app = {
    role: 'user', account: null, hooks: {},
    state: { userId: null, route: '', sel: { overview: 'hr', cardio: 'hr', bone: 'density', behaviour: 'sleep', radiation: 'dose' }, range: 30, acked: {}, seen: new Set(), chats: {}, hist: { section: 'all', from: '', to: '', q: '', page: 0 } },
    nav: [['overview', 'home'], ['cardio', 'heart'], ['bone', 'bone'], ['behaviour', 'brain'], ['radiation', 'sun'], ['history', 'history']],
    titles: { overview: 'Overview', cardio: 'Cardio health', bone: 'Bone health', behaviour: 'Behaviour', radiation: 'Radiation', 'ask-ai': 'Ask AI', history: 'History', account: 'Account & devices' },
    words: { 'ask-ai': 'ASK', history: 'LOG', account: 'ACCOUNT' },
    views: {},
    subject: () => C.findUser(app.state.userId),
  };
  const state = app.state, user = app.subject;

  /* ---------- small pieces ---------- */
  const ic = C.ic = (n, cls = '') => `<i class="ic ic-${n} ${cls}"></i>`;
  const SVG = C.SVG = {
    plus: '<svg class="s" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg class="s" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-6z"/></svg>',
    search: '<svg class="s" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    spark: '<svg class="s" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
    warn: '<svg class="s" style="width:24px;height:24px" viewBox="0 0 24 24"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg>',
  };
  C.gauge = (score, status, size = 210, label = 'Readiness') => {
    const r = size / 2 - 12, c = 2 * Math.PI * r, m = size / 2;
    const ticks = Array.from({ length: 60 }, (_, i) => { const a = i / 60 * 6.283, r1 = r - 12, r2 = r - (i % 5 ? 16 : 20); return `<line class="tick" x1="${(m + Math.cos(a) * r1).toFixed(1)}" y1="${(m + Math.sin(a) * r1).toFixed(1)}" x2="${(m + Math.cos(a) * r2).toFixed(1)}" y2="${(m + Math.sin(a) * r2).toFixed(1)}"/>`; }).join('');
    return `<svg class="gauge" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label} ${score} out of 100">
      ${ticks}<circle class="trk" cx="${m}" cy="${m}" r="${r}" stroke-width="3"/>
      <circle class="arc" cx="${m}" cy="${m}" r="${r}" stroke-width="5" stroke="${COLOR[status] === COLOR.nominal ? '#38BDF8' : COLOR[status]}" style="color:${COLOR[status] === COLOR.nominal ? '#38BDF8' : COLOR[status]};--c:${c.toFixed(1)};stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${(c * (1 - score / 100)).toFixed(1)}"/>
      <text x="${m}" y="${m + size * .085}" font-size="${size * .3}" font-weight="200">${score}</text>
      ${size > 120 ? `<text x="${m}" y="${m + size * .2}" font-size="10" letter-spacing="2.4" fill="#94A3B8" style="fill:#94A3B8">${label.toUpperCase()}</text>` : ''}</svg>`;
  };
  function sparkline(u, k) {
    const pts = u.data[k].slice(-14).map(p => p.v), lo = Math.min(...pts), hi = Math.max(...pts), w = 84, h = 36, s = statusOf(k, latest(u, k)), col = s === 'nominal' ? '#38BDF8' : COLOR[s];
    const xy = pts.map((v, i) => [i / (pts.length - 1) * w, h - 3 - (hi === lo ? .5 : (v - lo) / (hi - lo)) * (h - 6)]);
    const d = xy.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''), e = xy[xy.length - 1];
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}L${w} ${h}L0 ${h}Z" fill="${col}" opacity=".12"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${e[0]}" cy="${e[1].toFixed(1)}" r="2.6" fill="#fff"/></svg>`;
  }
  function instrument(u, k, on, label) {
    const m = METRICS[k], p = latest(u, k), s = statusOf(k, p), wk = u.data[k].filter(x => x.t <= p.t - 6.5 * DAY).pop();
    let bar, sub = '';
    if (k === 'sleep' && p.st) {
      const [d, r, l] = p.st.map(f => (f * p.v).toFixed(1));
      bar = `<div class="stages" title="Sleep stages"><i style="width:${p.st[0] * 100}%;background:#3b5fc9"></i><i style="width:${p.st[1] * 100}%;background:#818CF8"></i><i style="width:${p.st[2] * 100}%;background:#38BDF8"></i></div>`;
      sub = `Deep ${d} h, REM ${r} h, light ${l} h`;
    } else {
      const z = C.zones(k, p.v);
      bar = `<div class="zone" title="Position against the limits">${z.parts.map(x => `<i style="width:${x.w}%;background:${COLOR[x.c]}"></i>`).join('')}<b style="left:${z.at}%"></b></div>`;
      if (k === 'density') sub = `${(1.05 * p.v / 100).toFixed(2)} g/cmÂ², ${m.note}`;
      else if (wk) { const d = +(p.v - wk.v).toFixed(m.dec); sub = `${d > 0 ? '+' : ''}${d} ${m.unit} vs a week ago`; }
    }
    return `<button class="glass inst ${on ? 'on' : ''}" data-action="pick" data-metric="${k}" aria-pressed="${on}">
      <div class="lab">${ic(SECTIONS[m.section].icon)}<span>${label || m.name}</span><span class="dot ${s}" style="margin-left:auto" title="${LABEL[s]}"></span></div>
      <div class="row"><div class="val">${fmt(k, p)}<small>${m.unit}</small></div>${sparkline(u, k)}</div>${bar}<div class="sub">${sub}</div></button>`;
  }
  function chartPanel(k) {
    const m = METRICS[k];
    return `<section class="glass panel"><div class="panel-head">
        <div class="mr-auto"><span class="cap">Trend</span><h2>${m.name}</h2></div>
        <div class="seg" role="group" aria-label="Time range">${[7, 14, 30].map(d => `<button data-action="range" data-days="${d}" class="${state.range === d ? 'on' : ''}">${d} days</button>`).join('')}</div></div>
      <div class="chart-wrap"><canvas id="mainChart" role="img" aria-label="${m.name} trend"></canvas></div>
      <div class="mute text-sm" style="margin-top:10px">Dashed lines mark the limits. White points are manual entries.</div></section>`;
  }
  function recPanel(u, sec) {
    return `<section class="glass panel"><div class="panel-head"><div><span class="cap">${SECTIONS[sec].label}</span><h2>What to do</h2></div></div>
      <ul class="todo">${recs(u, sec).map(r => `<li class="${r.level || ''}"><h3>${r.title}</h3><p>${r.body}</p></li>`).join('')}</ul>
      <button class="btn sm" style="margin-top:10px" data-route="ask-ai">${SVG.spark}Ask AI about this</button></section>`;
  }

  /* ---------- charts ---------- */
  const charts = {};
  function killCharts() { for (const k in charts) { charts[k].destroy(); delete charts[k]; } }
  const FONT = { family: '"Instrument Sans", sans-serif', size: 11 }, TICK = { color: '#94A3B8', font: FONT }, GRID = 'rgba(148,163,184,.09)';
  const TIP = { backgroundColor: 'rgba(11,15,25,.95)', borderColor: 'rgba(56,189,248,.4)', borderWidth: 1, padding: 12, cornerRadius: 10, titleFont: FONT, bodyFont: { ...FONT, size: 13 } };
  const limitsPlugin = { id: 'limits', afterDatasetsDraw(c, _a, o) {
    if (!o || !o.lines) return; const { ctx, chartArea: a, scales: { y } } = c;
    o.lines.forEach(l => { const py = y.getPixelForValue(l.v); if (py < a.top || py > a.bottom) return;
      ctx.save(); ctx.strokeStyle = l.c; ctx.fillStyle = l.c; ctx.setLineDash([4, 6]); ctx.lineWidth = 1; ctx.globalAlpha = .8;
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      ctx.font = '11px "Instrument Sans", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(l.t, a.left + 6, py - 5); ctx.restore(); }); } };
  const crosshair = { id: 'crosshair', afterDraw(c) {
    const act = c.tooltip && c.tooltip.getActiveElements(); if (!act || !act.length) return;
    const { ctx, chartArea: a } = c, x = act[0].element.x;
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore(); } };
  function metricChart(canvas, u, k, days) {
    if (!window.Chart || !canvas) return;
    const m = METRICS[k], pts = u.data[k].filter(p => p.t >= NOW - days * DAY);
    const grad = canvas.getContext('2d').createLinearGradient(0, 0, 0, 310);
    grad.addColorStop(0, 'rgba(56,189,248,.34)'); grad.addColorStop(1, 'rgba(56,189,248,0)');
    const dots = col => ({ pointRadius: pts.map(p => p.src === 'Manual' ? 5 : (days <= 14 ? 2.5 : 0)), pointBackgroundColor: pts.map(p => p.src === 'Manual' ? '#fff' : col), pointBorderColor: col, pointBorderWidth: 2, pointHoverRadius: 6, pointHoverBackgroundColor: '#fff' });
    const base = { borderWidth: 2, tension: .38, cubicInterpolationMode: 'monotone' };
    const datasets = [{ ...base, label: m.pair ? 'Systolic' : m.name, data: pts.map(p => ({ x: p.t, y: p.v, src: p.src })), borderColor: '#38BDF8', backgroundColor: grad, fill: !m.pair, ...dots('#38BDF8') }];
    if (m.pair) datasets.push({ ...base, label: 'Diastolic', data: pts.map(p => ({ x: p.t, y: p.v2, src: p.src })), borderColor: '#A5B4FC', ...dots('#A5B4FC') });
    const lines = [], add = (arr, w) => arr && lines.push({ v: arr[0], c: '#F59E0B', t: `Elevated ${w} ${arr[0]}` }, { v: arr[1], c: '#EF4444', t: `Critical ${w} ${arr[1]}` });
    add(m.hi, 'above'); add(m.lo, 'below');
    const all = pts.flatMap(p => m.pair ? [p.v, p.v2] : [p.v]), lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo || 1) * .25;
    if (charts.mainChart) charts.mainChart.destroy();
    charts.mainChart = new Chart(canvas, { type: 'line', data: { datasets }, plugins: [limitsPlugin, crosshair], options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'nearest', axis: 'x', intersect: false },
      animation: reduceMotion ? false : { duration: 900, easing: 'easeOutCubic' },
      scales: {
        x: { type: 'linear', min: pts[0].t, max: Math.max(pts[pts.length - 1].t, NOW), grid: { display: false }, border: { color: GRID }, ticks: { ...TICK, maxTicksLimit: 8, callback: v => dFmt.format(v) } },
        y: { suggestedMin: lo - pad, suggestedMax: hi + pad, grid: { color: GRID }, border: { display: false }, ticks: { ...TICK, maxTicksLimit: 6 }, title: { display: true, text: m.unit, color: '#94A3B8', font: FONT } } },
      plugins: { limits: { lines }, legend: { display: !!m.pair, align: 'end', labels: { color: '#cbd5e1', boxWidth: 14, boxHeight: 2, font: FONT } },
        tooltip: { ...TIP, displayColors: !!m.pair, callbacks: { title: i => `${dFmt.format(i[0].parsed.x)}, ${tFmt.format(i[0].parsed.x)}`, label: i => ` ${i.dataset.label}: ${i.parsed.y} ${m.unit}${i.raw.src === 'Manual' ? ' (manual)' : ''}` } } } } });
  }
  function histChart(rows) {
    if (!window.Chart || !$('#histChart')) return;
    const days = {}; rows.forEach(r => { if (r.status === 'none') return; const d = ymd(r.t); (days[d] = days[d] || { nominal: 0, elevated: 0, critical: 0, t: r.t })[r.status]++; });
    const keys = Object.keys(days).sort();
    if (charts.histChart) charts.histChart.destroy();
    charts.histChart = new Chart($('#histChart'), { type: 'bar',
      data: { labels: keys.map(k => dFmt.format(days[k].t)), datasets: ['nominal', 'elevated', 'critical'].map(s => ({ label: LABEL[s], data: keys.map(k => days[k][s]), backgroundColor: COLOR[s], borderRadius: 3, borderSkipped: false, borderColor: '#0f172a', borderWidth: 1, maxBarThickness: 22 })) },
      options: { responsive: true, maintainAspectRatio: false, animation: reduceMotion ? false : { duration: 500 },
        scales: { x: { stacked: true, grid: { display: false }, border: { color: GRID }, ticks: { ...TICK, maxTicksLimit: 10 } }, y: { stacked: true, grid: { color: GRID }, border: { display: false }, ticks: { ...TICK, precision: 0, maxTicksLimit: 5 } } },
        plugins: { legend: { align: 'end', labels: { color: '#cbd5e1', boxWidth: 10, boxHeight: 10, font: FONT } }, tooltip: { ...TIP, mode: 'index' } } } });
  }

  /* ---------- views ---------- */
  const headline = u => {
    const f = flagged(u), o = overall(u);
    if (o === 'critical') return `${C.ALERT_TITLE[f[0].k]}. ${METRICS[f[0].k].name} is ${fmt(f[0].k, f[0].p)} ${METRICS[f[0].k].unit}, ${limitText(f[0].k, f[0].p)}.`;
    if (o === 'elevated') return `${f.length} of 12 readings ${f.length > 1 ? 'are' : 'is'} drifting out of range: ${f.slice(0, 3).map(x => METRICS[x.k].name.toLowerCase()).join(', ')}.`;
    return 'All 12 monitored readings are inside their normal range.';
  };
  app.views.overview = u => {
    const o = overall(u), k = state.sel.overview, admin = app.role === 'admin';
    return `<section class="hero">
        <div><div class="meta"><span class="cap">Expedition 12</span><span class="cap">Mission day ${u.day}</span><span class="cap">${u.role}</span></div>
          <h2>${admin ? `<b>${u.name}</b><br>${u.alias}` : `Hi, <b>${u.name}</b>!`}</h2>
          <p class="lede">${headline(u)}</p>
          <div class="acts" style="align-items:center"><span class="badge ${o}"><span class="dot ${o}"></span>Overall: ${OVERALL[o]}</span>
            <button class="btn sm" data-route="ask-ai">${SVG.spark}Ask AI</button><button class="btn sm ghost" data-action="openEntry">${SVG.plus}Log metric</button></div></div>
        <div class="ringbox">${C.gauge(C.score(u), o)}</div>
      </section>
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" style="margin-bottom:16px">${HEADLINE.map(h => instrument(u, h, h === k, METRICS[h].short)).join('')}</div>
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4"><div class="xl:col-span-3 min-w-0">${chartPanel(k)}</div><div class="xl:col-span-2 min-w-0">${recPanel(u, METRICS[k].section)}</div></div>`;
  };
  function category(u, sec) {
    const s = sectionStatus(u, sec), k = state.sel[sec];
    return `<section class="hero sub">
        <div><div class="meta"><span class="cap">${u.name}</span><span class="cap">Mission day ${u.day}</span></div>
          <h2>${SECTIONS[sec].label.replace(/^(\S+)/, '<b>$1</b>')}</h2><p class="lede">${SECTIONS[sec].blurb}</p>
          <div class="acts" style="margin-top:16px"><span class="badge ${s}"><span class="dot ${s}"></span>${LABEL[s]}</span></div></div>
        <div class="ringbox" style="padding:12px">${C.gauge(C.score(u, sec), s, 150, 'Score')}</div>
      </section>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4" style="margin-bottom:16px">${sectionKeys(sec).map(x => instrument(u, x, x === k)).join('')}</div>
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-4"><div class="xl:col-span-3 min-w-0">${chartPanel(k)}</div><div class="xl:col-span-2 min-w-0">${recPanel(u, sec)}</div></div>`;
  }
  const msgHtml = m => `<div class="msg ${m.who}"><span class="av ${m.who === 'ai' ? 'ai' : ''}">${m.who === 'ai' ? SVG.spark : ic('user')}</span><div class="bub">${m.typing ? '<span class="typing"><i></i><i></i><i></i></span>' : esc(m.text)}</div></div>`;
  app.views['ask-ai'] = u => {
    const admin = app.role === 'admin';
    const chat = state.chats[u.id] || (state.chats[u.id] = [{ who: 'ai', text: admin ? `I have ${u.name}'s latest readings loaded. What do you want to review?` : `Hello ${u.name}. I can read your latest readings and explain what they mean. What would you like to look at?` }]);
    const my = admin ? 'their' : 'my';
    return `<section class="hero sub" style="padding-bottom:14px"><div><span class="cap">Health assistant</span><h2>Ask <b>AI</b></h2></div></section>
      <section class="glass chat">
        <div class="msgs" id="msgs" aria-live="polite">${chat.map(msgHtml).join('')}</div>
        <div class="chips">${[`Analyze ${my} heart rate spikes`, 'Radiation safety recommendations', `How is ${my} bone health?`, 'Sleep recovery advice', 'Summarise the current status'].map(q => `<button class="btn sm ghost" data-action="ask" data-q="${q}">${q}</button>`).join('')}</div>
        <form class="composer" id="chatForm"><input class="input" id="chatIn" placeholder="Ask about ${admin ? esc(u.name) + "'s" : 'your'} health data" autocomplete="off" aria-label="Message">
          <button class="btn primary" type="submit" aria-label="Send" style="width:46px;padding:0">${SVG.send}</button></form>
        <div class="mute" style="font-size:12px;padding:0 22px 12px">Replies are simulated from ${esc(u.name)}'s current readings. Not medical advice.</div>
      </section>`;
  };
  app.views.history = u => {
    const h = state.hist;
    return `<section class="hero sub" style="padding-bottom:14px"><div><span class="cap">${u.name}, every recorded reading</span><h2>Data <b>log</b></h2></div></section>
      <section class="glass panel" style="margin-bottom:16px"><div class="panel-head"><div><span class="cap">Master overview</span><h2>Readings by status, per day</h2></div></div>
        <div class="chart-wrap" style="height:200px"><canvas id="histChart" role="img" aria-label="Daily count of nominal, elevated and critical readings"></canvas></div></section>
      <section class="glass panel">
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 items-end" style="margin-bottom:16px">
          <label class="field col-span-2">Search<span class="relative block"><span class="absolute mute" style="left:12px;top:12px">${SVG.search}</span><input class="input" id="hQ" style="padding-left:40px" placeholder="Metric, value or note" value="${esc(h.q)}"></span></label>
          <label class="field">Section<select class="input" id="hSec"><option value="all">All sections</option>${Object.entries(SECTIONS).map(([k, s]) => `<option value="${k}" ${h.section === k ? 'selected' : ''}>${s.label}</option>`).join('')}<option value="custom" ${h.section === 'custom' ? 'selected' : ''}>Custom</option></select></label>
          <label class="field">From<input class="input" type="date" id="hFrom" value="${h.from}"></label>
          <label class="field">To<input class="input" type="date" id="hTo" value="${h.to}"></label>
        </div><div id="histTable"></div></section>`;
  };
  app.views.account = u => {
    const me = app.account, admin = app.role === 'admin';
    const devs = [['Wrist biomonitor', 'Heart rate, SpO2, sleep', 'nominal', 'Synced 10m ago'], ['Blood pressure cuff', 'Systolic and diastolic', 'nominal', 'Synced 3h ago'], ['Personal dosimeter', 'Absorbed dose', 'nominal', 'Live'], ['Bone ultrasound scanner', 'Density scan', 'elevated', 'Last used 8d ago'], ['Cognition test tablet', 'Reaction time, stress survey', 'nominal', 'Synced today']];
    const rows = C.histRows(u);
    return `<section class="hero sub" style="padding-bottom:14px"><div><span class="cap">${admin ? 'Administrator account' : 'Crew account'}</span><h2>${esc(me.name).replace(/(\S+)$/, '<b>$1</b>')}</h2></div></section>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section class="glass panel"><div class="panel-head"><div><span class="cap">Account</span><h2>Identity and mission</h2></div></div>
        <dl class="kv"><dt>User ID</dt><dd class="num">${me.id}</dd><dt>Registration number</dt><dd class="num">${me.reg}</dd><dt>Role</dt><dd>${me.role}</dd><dt>Mission</dt><dd>Expedition 12, long-duration stay</dd><dt>Station</dt><dd>Station Meridian, lunar orbit</dd>${admin ? '<dt>Access</dt><dd>All crew records</dd>' : `<dt>Mission day</dt><dd class="num">${me.day}</dd>`}</dl>
        <button class="btn danger" style="margin-top:24px" data-action="logout">${ic('logout')}Log out</button></section>
      <section class="glass panel"><div class="panel-head"><div><span class="cap">${u.name}</span><h2>Connected biometric devices</h2></div></div>
        ${devs.map(d => `<div class="dev"><span class="dot ${d[2]}"></span><div class="mr-auto"><div>${d[0]}</div><div class="mute text-sm">${d[1]}</div></div><span class="mute text-sm">${d[3]}</span></div>`).join('')}
        <div class="panel-head" style="margin-top:20px"><div><span class="cap">Logging</span><h2>${rows.length} records on file</h2></div></div>
        <div class="mute text-sm">${rows.filter(r => r.src === 'Manual').length} entered manually, the rest from sensors.</div>
        <div class="flex gap-2 flex-wrap" style="margin-top:12px"><button class="btn sm" data-action="openEntry">${SVG.plus}Log metric</button><button class="btn sm ghost" data-route="history">Open history</button></div></section></div>`;
  };

  /* ---------- history table ---------- */
  function filteredRows(u) {
    const h = state.hist, q = h.q.trim().toLowerCase();
    return C.histRows(u).filter(r => (h.section === 'all' || r.sec === h.section) && (!h.from || ymd(r.t) >= h.from) && (!h.to || ymd(r.t) <= h.to) && (!q || `${r.name} ${r.val} ${r.notes} ${r.src} ${LABEL[r.status] || ''}`.toLowerCase().includes(q)));
  }
  function renderHistTable() {
    const rows = filteredRows(user()), per = 15, pages = Math.max(1, Math.ceil(rows.length / per));
    state.hist.page = Math.max(0, Math.min(state.hist.page, pages - 1));
    const pg = rows.slice(state.hist.page * per, state.hist.page * per + per);
    $('#histTable').innerHTML = rows.length ? `<div style="overflow:auto;max-height:540px;border:1px solid var(--line);border-radius:14px"><table class="tbl"><thead><tr><th>Date</th><th>Time</th><th>Metric</th><th class="r">Value</th><th>Section</th><th>Source</th><th>Status</th><th>Notes</th></tr></thead><tbody>
      ${pg.map(r => `<tr><td>${dFmt.format(r.t)}</td><td>${tFmt.format(r.t)}</td><td>${esc(r.name)}</td><td class="r">${esc(r.val)}</td><td class="mute">${r.sec === 'custom' ? 'Custom' : SECTIONS[r.sec].label}</td><td>${r.src}</td><td><span class="badge ${r.status}">${LABEL[r.status] || 'Not assessed'}</span></td><td class="wrap">${esc(r.notes)}</td></tr>`).join('')}</tbody></table></div>
      <div class="flex items-center gap-3 flex-wrap" style="margin-top:14px"><span class="mute text-sm mr-auto">${rows.length} records, page ${state.hist.page + 1} of ${pages}</span>
        <button class="btn sm ghost" data-action="page" data-d="-1" ${state.hist.page === 0 ? 'disabled' : ''}>Previous</button><button class="btn sm ghost" data-action="page" data-d="1" ${state.hist.page >= pages - 1 ? 'disabled' : ''}>Next</button></div>`
      : `<div class="mute" style="padding:30px;text-align:center">No records match these filters. <button class="btn sm" data-action="clearFilters" style="margin-left:8px">Clear filters</button></div>`;
    histChart(rows);
  }

  /* ---------- assistant ---------- */
  function ask(q) {
    q = q.trim(); if (!q) return;
    const u = user(), chat = state.chats[u.id]; chat.push({ who: 'me', text: q }); const wait = { who: 'ai', typing: true }; chat.push(wait);
    const paint = () => { const el = $('#msgs'); if (el && state.route === 'ask-ai' && user() === u) { el.innerHTML = chat.map(msgHtml).join(''); el.scrollTop = el.scrollHeight; } };
    paint(); setTimeout(() => { wait.typing = false; wait.text = C.answer(q, u, app.role === 'admin'); paint(); }, reduceMotion ? 0 : 750);
  }

  /* ---------- chrome: strip, notifications, nav ---------- */
  function renderStrip(u) {
    const f = flagged(u), o = overall(u), el = $('#banner'), who = app.role === 'admin' ? `${u.name}: ` : '';
    if (o === 'critical') {
      const c = f.filter(x => x.s === 'critical'), top = c[0], acked = state.acked[u.id] === top.k + top.p.t;
      el.innerHTML = `<div class="cw critical ${acked ? 'acked' : ''}" role="alert">${SVG.warn}
        <div><strong>${who}${acked ? 'Acknowledged. ' : 'Danger. '}${C.ALERT_TITLE[top.k]}.</strong> ${METRICS[top.k].name} is ${fmt(top.k, top.p)} ${METRICS[top.k].unit}, ${limitText(top.k, top.p)}${c.length > 1 ? `. ${c.length - 1} more critical reading${c.length > 2 ? 's' : ''}` : ''}.</div>
        <div class="acts"><button class="btn sm" data-route="${METRICS[top.k].section}" data-metric="${top.k}">View ${SECTIONS[METRICS[top.k].section].label.toLowerCase()}</button>
          ${acked ? '' : '<button class="btn sm" data-action="ack">Acknowledge</button>'}<button class="btn sm" data-action="notify">${app.role === 'admin' ? 'Message crew member' : 'Notify flight surgeon'}</button></div></div>`;
    } else if (o === 'elevated') {
      el.innerHTML = `<div class="cw elevated"><span class="dot elevated"></span><div><strong>${who}Caution.</strong> ${f.length} reading${f.length > 1 ? 's are' : ' is'} elevated: ${f.map(x => METRICS[x.k].name.toLowerCase()).join(', ')}.</div>
        <div class="acts"><button class="btn sm" data-route="${METRICS[f[0].k].section}" data-metric="${f[0].k}">Review</button></div></div>`;
    } else el.innerHTML = `<div class="cw"><span class="dot nominal"></span><div><strong>${who}All systems nominal.</strong> Last sensor sync ${ago(latest(u, 'hr').t)}.</div></div>`;
  }
  const noteList = () => app.hooks.notifications ? app.hooks.notifications() : C.notifications(user());
  function renderNotes() {
    const list = noteList(); list.forEach(n => n.quiet && state.seen.add(n.id));
    const unread = list.filter(n => !state.seen.has(n.id)).length, c = $('#noteCount');
    c.hidden = !unread; c.textContent = unread;
    $('#notes').innerHTML = `<span class="cap">Notifications</span>${list.map(n => `<div class="note"><span class="dot ${n.level}"></span><div><b>${esc(n.title)}</b><span>${esc(n.body)}</span></div><time>${ago(n.t)}</time></div>`).join('')}`;
  }
  function renderNav() {
    const u = user(), nav = $('#nav');
    nav.querySelectorAll('.nav-btn').forEach(b => b.remove());
    app.nav.forEach(([r, icon]) => {
      const s = SECTIONS[r] ? sectionStatus(u, r) : null, on = state.route === r;
      nav.insertAdjacentHTML('beforeend', `<button class="nav-btn ${on ? 'on' : ''}" data-route="${r}" title="${app.titles[r]}" ${on ? 'aria-current="page"' : ''}>${ic(icon)}<span class="t">${app.titles[r]}</span>${s && s !== 'nominal' ? `<span class="dot ${s}"></span>` : ''}</button>`);
    });
    const i = app.nav.findIndex(n => n[0] === state.route), sl = $('#navSlider');
    sl.style.opacity = i < 0 ? 0 : 1; if (i >= 0) sl.style.transform = `translateY(${i * 50}px)`;
    document.querySelectorAll('.rail-foot [data-route]').forEach(b => b.classList.toggle('on', b.dataset.route === state.route));
  }

  /* ---------- render + routing ---------- */
  const render = app.render = (animate = true) => {
    const u = user(), sec = SECTIONS[state.route] ? state.route : null; killCharts();
    document.title = `${app.titles[state.route]} | Crew Health Console`;
    $('#pageTitle').textContent = app.titles[state.route];
    $('#greet').textContent = app.role === 'admin' ? `Hi, ${app.account.name}. Viewing ${u.name} (${u.alias}).` : `Hi, ${u.name}!`;
    renderNav(); renderStrip(u); renderNotes();
    const custom = app.hooks.scene && app.hooks.scene(state.route);
    C.scene.set(custom || { tint: C.TINT[sec ? sectionStatus(u, sec) : overall(u)], word: sec ? SECTIONS[sec].word : state.route === 'overview' ? { nominal: 'NOMINAL', elevated: 'CAUTION', critical: 'DANGER' }[overall(u)] : app.words[state.route] || '' });
    $('#view').innerHTML = `<div class="${animate ? 'view' : ''}">${sec ? category(u, sec) : app.views[state.route](u)}</div>`;
    if (state.route === 'overview' || sec) metricChart($('#mainChart'), u, state.sel[sec || 'overview'], state.range);
    if (state.route === 'history') renderHistTable();
    if (state.route === 'ask-ai') { const m = $('#msgs'); m.scrollTop = m.scrollHeight; }
    if (app.hooks.afterRender) app.hooks.afterRender(u);
  };
  const go = app.go = (route, replace) => {
    if (!app.titles[route]) route = app.nav[0][0];
    const changed = route !== state.route; state.route = route;
    if (location.hash.slice(1) !== route) { try { replace ? history.replaceState(null, '', '#' + route) : (location.hash = route); } catch (e) {} }
    render(changed); if (changed) $('#canvas').scrollTop = 0;
  };
  const toast = app.toast = text => { const h = $('#toastHost'); h.innerHTML = `<div class="glass toast" role="status">${esc(text)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => h.innerHTML = '', 2800); };

  /* ---------- manual entry ---------- */
  function openEntry() {
    const u = user(), ctx = SECTIONS[state.route] ? state.route : 'overview';
    $('#eMetric').innerHTML = Object.entries(SECTIONS).map(([s, d]) => `<optgroup label="${d.label}">${sectionKeys(s).map(k => `<option value="${k}">${METRICS[k].name}</option>`).join('')}</optgroup>`).join('') + '<option value="custom">Custom metric</option>';
    $('#eMetric').value = state.sel[ctx];
    $('#entryFor').textContent = `Record for ${u.name} (${u.alias}). Saved entries appear in the charts and history straight away.`;
    $('#eTime').value = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    ['#eVal', '#eVal2', '#eNotes', '#eName'].forEach(s => $(s).value = ''); $('#entryErr').textContent = '';
    syncEntry(); $('#entry').hidden = false; $('#eVal').focus();
  }
  function syncEntry() {
    const k = $('#eMetric').value, m = METRICS[k];
    $('#eNameWrap').hidden = k !== 'custom'; $('#eVal2Wrap').hidden = !(m && m.pair);
    $('#eUnitWrap').classList.toggle('col-span-2', !!(m && m.pair));
    $('#eValLab').textContent = m && m.pair ? 'Systolic' : 'Value';
    $('#eUnit').value = m ? m.unit : ''; $('#eUnit').readOnly = !!m;
  }
  function saveEntry(e) {
    e.preventDefault();
    const u = user(), k = $('#eMetric').value, m = METRICS[k], v = parseFloat($('#eVal').value), v2 = parseFloat($('#eVal2').value), t = new Date($('#eTime').value).getTime(), notes = $('#eNotes').value.trim(), err = $('#entryErr');
    if (!isFinite(v)) return err.textContent = 'Enter a numeric value.';
    if (m && m.pair && !isFinite(v2)) return err.textContent = 'Enter the diastolic value as well.';
    if (!isFinite(t)) return err.textContent = 'Choose a date and time.';
    if (t > Date.now() + 6e4) return err.textContent = 'The time cannot be in the future.';
    if (k === 'custom') {
      const name = $('#eName').value.trim(); if (!name) return err.textContent = 'Name the custom metric.';
      u.custom.push({ t, name, v, unit: $('#eUnit').value.trim(), notes });
    } else {
      const p = { t, v: C.round(k, v), src: 'Manual', notes }; if (m.pair) p.v2 = Math.round(v2);
      u.data[k].push(p); u.data[k].sort((a, b) => a.t - b.t);
      state.sel[m.section] = k; if (HEADLINE.includes(k)) state.sel.overview = k;
    }
    C.saveManual(); $('#entry').hidden = true; render(false); toast('Record saved');
  }

  /* ---------- events ---------- */
  function wire() {
    document.addEventListener('click', e => {
      const notes = $('#notes');
      if (!notes.hidden && !e.target.closest('#notes') && !e.target.closest('[data-action="toggleNotes"]')) notes.hidden = true;
      if (e.target.id === 'entry') return $('#entry').hidden = true;
      const r = e.target.closest('[data-route]');
      if (r) { if (r.dataset.user) state.userId = r.dataset.user; const k = r.dataset.metric; if (k) state.sel[METRICS[k].section] = k; return go(r.dataset.route); }
      const b = e.target.closest('[data-action]'); if (!b) return;
      const u = user(), a = b.dataset.action;
      if (a === 'pick') { state.sel[SECTIONS[state.route] ? state.route : 'overview'] = b.dataset.metric; render(false); }
      else if (a === 'range') { state.range = +b.dataset.days; render(false); }
      else if (a === 'toggleNotes') { notes.hidden = !notes.hidden; if (!notes.hidden) { noteList().forEach(n => state.seen.add(n.id)); $('#noteCount').hidden = true; } }
      else if (a === 'openEntry') openEntry();
      else if (a === 'closeEntry') $('#entry').hidden = true;
      else if (a === 'ack') { const c = flagged(u)[0]; state.acked[u.id] = c.k + c.p.t; renderStrip(u); toast('Alert acknowledged'); }
      else if (a === 'notify') { const admin = app.role === 'admin'; u.extraNotes.push({ id: 'msg' + Date.now(), level: 'elevated', title: admin ? `Message sent to ${u.name}` : 'Flight surgeon notified', body: 'Simulated message from this console', t: Date.now() }); renderNotes(); toast(admin ? `Message sent to ${u.name} (simulated)` : 'Flight surgeon notified (simulated)'); }
      else if (a === 'ask') ask(b.dataset.q);
      else if (a === 'page') { state.hist.page += +b.dataset.d; renderHistTable(); }
      else if (a === 'clearFilters') { state.hist = { section: 'all', from: '', to: '', q: '', page: 0 }; render(false); }
      else if (a === 'logout') { C.session.clear(); location.href = 'index.html'; }
    });
    document.addEventListener('input', e => {
      const id = e.target.id, h = state.hist, map = { hQ: 'q', hSec: 'section', hFrom: 'from', hTo: 'to' };
      if (map[id]) { h[map[id]] = e.target.value; h.page = 0; renderHistTable(); }
      else if (id === 'eMetric') syncEntry();
    });
    document.addEventListener('submit', e => { if (e.target.id === 'chatForm') { e.preventDefault(); const i = $('#chatIn'); ask(i.value); i.value = ''; } });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#entry').hidden = true; $('#notes').hidden = true; } });
    $('#entryForm').addEventListener('submit', saveEntry);
    addEventListener('hashchange', () => { const r = location.hash.slice(1); if (app.titles[r] && r !== state.route) go(r); });
  }

  /* ---------- boot: called by user.js / admin.js ---------- */
  app.boot = ({ role, account, userId }) => {
    app.role = role; app.account = account; state.userId = userId;
    C.scene.init($('#scene')); wire();
    const r = location.hash.slice(1); go(app.titles[r] ? r : app.nav[0][0], true);
  };
})();
