/* Admin console (admin.html). Adds the crew roster view and the crew selector on top of
   the shared dashboard, and widens notifications to the whole crew. */
(function () {
  'use strict';
  const C = window.CHC, app = C.app, s = C.session.get();
  if (!s) return location.replace('index.html');
  if (s.role !== 'admin') return location.replace('user.html');
  const me = C.ADMINS.find(a => a.id === s.id) || C.ADMINS[0];
  const { USERS, METRICS, HEADLINE, RANK, overall, flagged, latest, statusOf, fmt } = C, $ = C.$;

  app.nav.unshift(['crew', 'user']);
  app.titles.crew = 'Crew';
  const crewWorst = () => C.worst(USERS.map(overall));

  // roster: one card per crew member, worst status first
  app.views.crew = () => {
    const sorted = USERS.slice().sort((a, b) => RANK[overall(b)] - RANK[overall(a)] || C.score(a) - C.score(b));
    const crit = USERS.filter(u => overall(u) === 'critical').length, risk = USERS.filter(u => overall(u) === 'elevated').length;
    const line = crit ? `<b>${crit}</b> need${crit > 1 ? '' : 's'} you now` : risk ? `<b>${risk}</b> to keep an eye on` : 'all <b>steady</b>';
    const alerts = USERS.flatMap(u => flagged(u).map(x => ({ u, ...x }))).sort((a, b) => RANK[b.s] - RANK[a.s]);
    return `<section class="hero sub" style="padding-top:30px">
        <div><div class="meta"><span class="cap">Expedition 12</span><span class="cap">Station Meridian</span><span class="cap">${USERS.length} crew aboard</span></div>
          <h2>${USERS.length} crew,<br>${line}.</h2>
          <p class="lede">Open a crew member to see their full record, log a reading on their behalf or review their history.</p></div>
      </section>
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4" style="margin-bottom:16px">${sorted.map(u => {
        const o = overall(u), f = flagged(u);
        return `<button class="glass crew" data-route="overview" data-user="${u.id}">
          <div style="grid-row:span 2">${C.gauge(C.score(u), o, 96)}</div>
          <div><div class="flex items-center gap-3 flex-wrap"><h3>${u.name}</h3><span class="badge ${o}"><span class="dot ${o}"></span>${C.OVERALL[o]}</span></div>
            <div class="cap" style="margin-top:6px">${u.alias}, ${u.role}, day ${u.day}</div></div>
          <div class="mute text-sm">${f.length ? f.map(x => `${METRICS[x.k].name} ${fmt(x.k, x.p)} ${METRICS[x.k].unit}`).join(', ') : 'Nothing out of range.'}</div>
          <div class="vals" style="grid-column:1/-1">${HEADLINE.map(k => { const p = latest(u, k); return `<div><span><span class="dot ${statusOf(k, p)}"></span>${METRICS[k].short}</span><b>${fmt(k, p)} <small class="mute" style="font-size:12px">${METRICS[k].unit}</small></b></div>`; }).join('')}</div>
        </button>`; }).join('')}</div>
      <section class="glass panel"><div class="panel-head"><div><span class="cap">Across the crew</span><h2>Open alerts</h2></div></div>
        ${alerts.length ? `<ul class="todo">${alerts.map(a => `<li class="${a.s}"><h3>${a.u.name}: ${C.ALERT_TITLE[a.k]}</h3><p>${METRICS[a.k].name} ${fmt(a.k, a.p)} ${METRICS[a.k].unit}, ${C.limitText(a.k, a.p)}. <button class="btn sm ghost" style="margin-left:8px" data-route="${METRICS[a.k].section}" data-user="${a.u.id}" data-metric="${a.k}">Open</button></p></li>`).join('')}</ul>` : '<div class="mute">No open alerts.</div>'}
      </section>`;
  };

  app.hooks.scene = route => route === 'crew' ? { tint: C.TINT[crewWorst()], word: 'CREW' } : null;
  app.hooks.notifications = () => USERS.flatMap(u => C.notifications(u).filter(n => !n.quiet).map(n => ({ ...n, title: `${u.name}: ${n.title}` }))).sort((a, b) => b.t - a.t);
  app.hooks.afterRender = u => {
    const onCrew = app.state.route === 'crew';
    $('#banner').hidden = onCrew;
    $('#userSel').innerHTML = USERS.map(x => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${x.name} (${x.alias})</option>`).join('');
    $('#adminNote').textContent = onCrew ? 'Choose a crew member to open their dashboard.' : `${u.role}, mission day ${u.day}.`;
    if (onCrew) { $('#greet').textContent = `Hi, ${me.name}.`; }
  };
  document.addEventListener('input', e => {
    if (e.target.id !== 'userSel') return;
    app.state.userId = e.target.value; app.state.hist.page = 0;
    app.state.route === 'crew' ? app.go('overview') : app.render(true);
  });

  const first = USERS.slice().sort((a, b) => RANK[overall(b)] - RANK[overall(a)])[0];
  app.boot({ role: 'admin', account: me, userId: first.id });
})();
