(function () {
  'use strict';
  const C = window.CHC = window.CHC || {};
  const DAY = 864e5, NOW = Date.now();
  const API_BASE = 'http://localhost:8082/api';

  C.SECTIONS = {
    cardio:    { label: 'Cardio health', icon: 'heart', word: 'CARDIO',    blurb: 'Heart rate, blood pressure and oxygen saturation in reduced gravity.' },
    bone:      { label: 'Bone health',   icon: 'bone',  word: 'BONE',      blurb: 'Bone density and the markers that show how fast bone is being lost.' },
    behaviour: { label: 'Behaviour',     icon: 'brain', word: 'MIND',      blurb: 'Sleep, stress and reaction time as signs of fatigue and cognitive load.' },
    radiation: { label: 'Radiation',     icon: 'sun',   word: 'RADIATION', blurb: 'Absorbed dose, mission exposure and the blood count that responds to it.' },
  };

  C.METRICS = {
    hr:      { section: 'cardio',    name: 'Heart rate',              short: 'Cardiovascular', unit: 'bpm',      dec: 0, hi: [90, 105],  lo: [48, 42] },
    bp:      { section: 'cardio',    name: 'Blood pressure',          unit: 'mmHg',     dec: 0, hi: [130, 145], lo: [95, 85], hi2: [85, 95] },
    spo2:    { section: 'cardio',    name: 'Blood oxygen (SpO2)',     unit: '%',        dec: 1, lo: [95, 92] },
    density: { section: 'bone',      name: 'Bone density',            short: 'Bone health',    unit: '%',        dec: 1, lo: [97, 94], note: 'of pre-flight baseline' },
    ntx:     { section: 'bone',      name: 'Resorption marker (NTx)', unit: 'nM BCE',   dec: 0, hi: [65, 85] },
    ucal:    { section: 'bone',      name: 'Urinary calcium',         unit: 'mg/24h',   dec: 0, hi: [250, 320] },
    dose:    { section: 'radiation', name: 'Daily absorbed dose',     short: 'Radiation',      unit: 'mSv/day',  dec: 2, hi: [0.8, 1.5] },
    cum:     { section: 'radiation', name: 'Cumulative exposure',     unit: 'mSv',      dec: 1, hi: [150, 300] },
    lymph:   { section: 'radiation', name: 'Lymphocyte count',        unit: 'cells/ÂµL', dec: 0, lo: [1500, 1000] },
    sleep:   { section: 'behaviour', name: 'Last night sleep',        short: 'Behaviour',      unit: 'h',        dec: 1, lo: [6.5, 5.5] },
    stress:  { section: 'behaviour', name: 'Stress index',            unit: '/ 100',    dec: 0, hi: [45, 70] },
    react:   { section: 'behaviour', name: 'Reaction time',           unit: 'ms',       dec: 0, hi: [300, 380] },
  };

  C.HEADLINE = ['hr', 'density', 'sleep', 'dose'];
  C.RANK = { nominal: 0, elevated: 1, critical: 2 };
  C.LABEL = { nominal: 'Nominal', elevated: 'Elevated', critical: 'Critical' };
  C.OVERALL = { nominal: 'Good', elevated: 'Risk', critical: 'Bad' };
  C.COLOR = { nominal: '#10B981', elevated: '#F59E0B', critical: '#EF4444' };
  C.TINT = { nominal: '#38BDF8', elevated: '#F59E0B', critical: '#EF4444' };
  C.ALERT_TITLE = {
    dose: 'High radiation warning', cum: 'Mission exposure limit', lymph: 'Low lymphocyte count',
    hr: 'Heart rate out of range', bp: 'Blood pressure out of range', spo2: 'Low blood oxygen',
    density: 'Bone density loss', ntx: 'Bone resorption raised', ucal: 'Urinary calcium raised',
    sleep: 'Short sleep', stress: 'Stress index raised', react: 'Slow reaction time'
  };

  const { METRICS, RANK, LABEL } = C;
  C.round = (k, v) => { const f = 10 ** METRICS[k].dec; return Math.round(v * f) / f; };

  C.session = {
    get() {
      try { const s = JSON.parse(sessionStorage.getItem('chc.session')); if (s && s.id) return s; } catch (e) {}
      try { const s = JSON.parse(window.name); if (s && s.chc) return s.chc; } catch (e) {}
      return null;
    },
    set(s) {
      try { sessionStorage.setItem('chc.session', JSON.stringify(s)); } catch (e) {}
      window.name = JSON.stringify({ chc: s });
    },
    clear() {
      try { sessionStorage.removeItem('chc.session'); } catch (e) {}
      window.name = '';
    },
  };

  C.ADMINS = [];
  C.USERS = [];
  C.findUser = id => C.USERS.find(u => String(u.id) === String(id));

  async function request(path, options = {}) {
    const sess = C.session.get();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (sess && sess.token) headers['Authorization'] = `Bearer ${sess.token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => res.statusText)}`);
    return res.status === 204 ? null : res.json();
  }

  function normalizeUser(raw) {
    const data = {};
    for (const k of Object.keys(METRICS)) {
      const list = (raw.data && Array.isArray(raw.data[k])) ? raw.data[k] : [];
      data[k] = list
        .map(p => ({
          t: typeof p.t === 'string' ? Date.parse(p.t) : Number(p.t),
          v: Number(p.v),
          v2: p.v2 != null ? Number(p.v2) : undefined,
          src: p.src || 'Sensor',
          st: p.st || undefined,
          notes: p.notes || ''
        }))
        .sort((a, b) => a.t - b.t);
    }
    return {
      id: String(raw.id),
      alias: raw.alias || raw.name || `Astronaut ${raw.id}`,
      role: raw.role || 'Crew member',
      day: raw.day || 1,
      name: raw.name || `User ${raw.id}`,
      reg: raw.reg || `REG-${raw.id}`,
      data,
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      devices: Array.isArray(raw.devices) ? raw.devices : [],
      dbNotifications: Array.isArray(raw.notifications) ? raw.notifications : [],
      extraNotes: Array.isArray(raw.extraNotes) ? raw.extraNotes : []
    };
  }

  C.api = {
    async login(credentials) {
      const sessionData = await request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      C.session.set(sessionData);
      return sessionData;
    },
    async fetchCrew() {
      const list = await request('/crew');
      C.USERS = (list || []).map(normalizeUser);
      return C.USERS;
    },
    async fetchUser(userId) {
      const raw = await request(`/crew/${encodeURIComponent(userId)}`);
      const user = normalizeUser(raw);
      const idx = C.USERS.findIndex(u => u.id === user.id);
      if (idx >= 0) C.USERS[idx] = user; else C.USERS.push(user);
      return user;
    },
    async fetchAdmins() {
      C.ADMINS = (await request('/admins')) || [];
      return C.ADMINS;
    },
    async addReading(userId, metricKey, reading) {
      const sess = C.session.get();
      const payload = {
        metric: metricKey, t: reading.t || Date.now(), v: reading.v, v2: reading.v2 ?? null,
        src: reading.src || 'Manual', notes: reading.notes || '', loggedBy: sess ? sess.id : null
      };
      const saved = await request(`/crew/${encodeURIComponent(userId)}/readings`, { method: 'POST', body: JSON.stringify(payload) });
      const user = C.findUser(userId);
      if (user && user.data[metricKey]) {
        user.data[metricKey].push({
          t: Number(saved.t || payload.t), v: Number(saved.v ?? payload.v),
          v2: saved.v2 != null ? Number(saved.v2) : payload.v2, src: saved.src || 'Manual', notes: saved.notes || payload.notes
        });
        user.data[metricKey].sort((a, b) => a.t - b.t);
      }
      return saved;
    },
    async addCustomReading(userId, customEntry) {
      const sess = C.session.get();
      const payload = {
        t: customEntry.t || Date.now(), name: customEntry.name, v: customEntry.v,
        unit: customEntry.unit, notes: customEntry.notes || '', loggedBy: sess ? sess.id : null
      };
      const saved = await request(`/crew/${encodeURIComponent(userId)}/custom`, { method: 'POST', body: JSON.stringify(payload) });
      const user = C.findUser(userId);
      if (user) user.custom.push(saved || payload);
      return saved;
    }
  };

  C.loadFromBackend = async function () {
    const sess = C.session.get();
    if (!sess) return;
    if (sess.role === 'admin') await Promise.all([C.api.fetchAdmins(), C.api.fetchCrew()]);
    else await C.api.fetchUser(sess.id);
  };

  C.saveManual = async function (userId, metricKey, point) {
    if (userId && metricKey && point) return C.api.addReading(userId, metricKey, point);
  };

  const EMPTY_PT = { t: NOW, v: 0, v2: 0, src: 'None' };
  const latest = C.latest = (u, k) => {
    const arr = u && u.data && u.data[k];
    return (arr && arr.length) ? arr[arr.length - 1] : EMPTY_PT;
  };

  function level(v, hi, lo) {
    if ((hi && v > hi[1]) || (lo && v < lo[1])) return 'critical';
    if ((hi && v > hi[0]) || (lo && v < lo[0])) return 'elevated';
    return 'nominal';
  }

  const statusOf = C.statusOf = (k, p) => {
    if (!p || p.src === 'None') return 'nominal';
    const m = METRICS[k];
    let s = level(p.v, m.hi, m.lo);
    if (m.pair && p.v2 != null) {
      const s2 = level(p.v2, m.hi2);
      if (RANK[s2] > RANK[s]) s = s2;
    }
    return s;
  };

  const worst = C.worst = list => list.reduce((a, b) => RANK[b] > RANK[a] ? b : a, 'nominal');
  const sectionKeys = C.sectionKeys = sec => Object.keys(METRICS).filter(k => METRICS[k].section === sec);

  C.sectionStatus = (u, sec) => worst(sectionKeys(sec).map(k => statusOf(k, latest(u, k))));
  C.overall = u => worst(Object.keys(METRICS).map(k => statusOf(k, latest(u, k))));

  const fmt = C.fmt = (k, p) => (!p || p.src === 'None') ? 'â€”' : (METRICS[k].pair ? `${p.v}/${p.v2}` : p.v.toFixed(METRICS[k].dec));
  const flagged = C.flagged = u => Object.keys(METRICS).map(k => ({ k, p: latest(u, k), s: statusOf(k, latest(u, k)) })).filter(x => x.s !== 'nominal').sort((a, b) => RANK[b.s] - RANK[a.s]);

  C.score = (u, sec) => {
    const keys = sec ? sectionKeys(sec) : Object.keys(METRICS);
    const cost = sec ? { elevated: 14, critical: 38 } : { elevated: 6, critical: 20 };
    return Math.max(12, 100 - keys.reduce((n, k) => n + (cost[statusOf(k, latest(u, k))] || 0), 0));
  };

  const limitText = C.limitText = (k, p) => {
    const m = METRICS[k], s = statusOf(k, p);
    if (s === 'nominal') return '';
    const i = s === 'critical' ? 1 : 0;
    if (m.hi && p.v > m.hi[i]) return `above the ${m.hi[i]} ${m.unit} limit`;
    if (m.lo && p.v < m.lo[i]) return `below the ${m.lo[i]} ${m.unit} limit`;
    return `diastolic above ${m.hi2[i]} mmHg`;
  };

  C.zones = (k, v) => {
    const m = METRICS[k], G = 'nominal', A = 'elevated', R = 'critical';
    let stops, pos, cols;
    if (m.hi && m.lo) {
      const pad = (m.hi[1] - m.hi[0]) * 1.5;
      stops = [m.lo[1] - pad, m.lo[1], m.lo[0], m.hi[0], m.hi[1], m.hi[1] + pad];
      pos = [0, 12, 24, 76, 88, 100]; cols = [R, A, G, A, R];
    } else if (m.hi) {
      const w = m.hi[1] - m.hi[0];
      stops = [m.hi[0] - w * 3, m.hi[0], m.hi[1], m.hi[1] + w * 1.5];
      pos = [0, 60, 80, 100]; cols = [G, A, R];
    } else {
      const w = m.lo[0] - m.lo[1];
      stops = [m.lo[1] - w * 1.5, m.lo[1], m.lo[0], m.lo[0] + w * 3];
      pos = [0, 20, 40, 100]; cols = [R, A, G];
    }
    let at = v <= stops[0] ? 0 : 100;
    for (let i = 0; i < stops.length - 1; i++) if (v >= stops[i] && v <= stops[i + 1]) at = pos[i] + (v - stops[i]) / (stops[i + 1] - stops[i]) * (pos[i + 1] - pos[i]);
    return { at: Math.min(98, Math.max(2, at)), parts: cols.map((c, i) => ({ c, w: pos[i + 1] - pos[i] })) };
  };

  C.ago = t => {
    const m = Math.max(1, Math.round((Date.now() - t) / 60e3));
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    return h < 24 ? h + 'h ago' : Math.round(h / 24) + 'd ago';
  };

  C.notifications = u => {
    const list = flagged(u).map(x => ({
      id: u.id + x.k + x.p.t + x.s, level: x.s, title: C.ALERT_TITLE[x.k],
      body: `${METRICS[x.k].name} ${fmt(x.k, x.p)} ${METRICS[x.k].unit}, ${limitText(x.k, x.p)}`, t: x.p.t
    }));
    for (const n of (u.dbNotifications || [])) {
      list.push({ id: 'db-' + n.id, level: 'elevated', title: n.title, body: n.message, t: n.createdAt ? Date.parse(n.createdAt) : NOW, quiet: Boolean(n.isRead) });
    }
    const dev = (u.devices && u.devices[0]);
    list.push({
      id: u.id + 'sync', level: 'nominal', title: dev ? `${dev.deviceName} (${dev.status})` : 'Wrist biomonitor synced',
      body: dev && dev.lastSyncedAt ? `Last synced: ${new Date(dev.lastSyncedAt).toLocaleTimeString()}` : 'All sensor channels reporting',
      t: dev && dev.lastSyncedAt ? Date.parse(dev.lastSyncedAt) : NOW - 2 * 36e5, quiet: true
    });
    return list.sort((a, b) => b.t - a.t);
  };

  const recs = C.recs = (u, sec) => {
    const L = k => latest(u, k), S = k => statusOf(k, L(k)), f = k => fmt(k, L(k)), out = [];
    if (sec === 'cardio') {
      const s = worst([S('hr'), S('bp')]);
      out.push(s === 'nominal' ? { level: s, title: 'Exercise guidance', body: `Resting heart rate is ${f('hr')} bpm.` } : { level: s, title: 'Exercise guidance', body: `Heart rate ${f('hr')} bpm and pressure ${f('bp')} mmHg are outside the usual band.` });
      out.push({ level: S('spo2'), title: 'Oxygen saturation', body: `SpO2 is ${f('spo2')} %.` });
    } else if (sec === 'bone') {
      out.push({ level: S('density'), title: 'Resistive exercise', body: `Density is ${f('density')} % of baseline.` });
    } else if (sec === 'radiation') {
      out.push({ level: S('dose'), title: 'Radiation mitigation', body: `Daily dose is ${f('dose')} mSv/day.` });
    } else {
      out.push({ level: S('stress'), title: 'Workload', body: `Stress index is ${f('stress')} / 100.` });
    }
    return out;
  };

  C.answer = (q, u, admin) => {
    const f = flagged(u);
    return `Overall status: ${C.OVERALL[C.overall(u)]}, readiness ${C.score(u)} out of 100.\n\n${f.length ? 'Needs attention:\n' + f.map(x => `â€¢ ${METRICS[x.k].name}: ${fmt(x.k, x.p)} ${METRICS[x.k].unit}`).join('\n') : 'All metrics are in range.'}`;
  };

  C.histRows = u => {
    const rows = [];
    for (const k of Object.keys(METRICS)) {
      for (const p of (u.data[k] || [])) {
        rows.push({ t: p.t, sec: METRICS[k].section, name: METRICS[k].name, val: `${fmt(k, p)} ${METRICS[k].unit}`, src: p.src, status: statusOf(k, p), notes: p.notes || '' });
      }
    }
    for (const c of (u.custom || [])) {
      rows.push({ t: c.t, sec: 'custom', name: c.name, val: `${c.v} ${c.unit}`, src: c.src || 'Sensor', status: 'none', notes: c.notes || '' });
    }
    return rows.sort((a, b) => b.t - a.t);
  };

  C.NOW = NOW;
  C.DAY = DAY;
})();