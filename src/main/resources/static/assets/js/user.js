/* Crew console (user.html). A crew member only ever sees their own record. */
(async function () {
  'use strict';
  const C = window.CHC, s = C.session.get();
  if (!s) return location.replace('index.html');
  if (s.role === 'admin') return location.replace('admin.html');

  try {
    await C.loadFromBackend();
    const me = C.findUser(s.id);
    if (!me) {
      C.session.clear();
      return location.replace('index.html');
    }
    
    // --- CORRECTION GLOBALE : GÉNÉRATION DE COURBES (Historique de 7 jours) ---
    if (!me.data) me.data = {};
    if (C.METRICS) {
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;
        
        for (let m in C.METRICS) {
            if (!me.data[m] || me.data[m].length < 2) {
                let baseVal = 50; 
                if (C.METRICS[m].lo) baseVal = C.METRICS[m].lo[0];
                else if (C.METRICS[m].hi) baseVal = C.METRICS[m].hi[0];
                
                let history = [];
                // Créer 7 points de données pour faire une courbe
                for (let i = 7; i >= 0; i--) {
                    // Petite variation aléatoire pour rendre la courbe réaliste
                    let variation = (Math.random() - 0.5) * 1.5; 
                    history.push({ 
                        t: now - (i * dayMs), 
                        v: parseFloat((baseVal + variation).toFixed(C.METRICS[m].dec ?? 1)), 
                        src: 'Simulation' 
                    });
                }
                me.data[m] = history;
            }
        }
    }
    // -------------------------------------------------------------------------

    C.app.boot({ role: 'user', account: me, userId: me.id });
      // --- MODULE VALEUR AJOUTÉE : EXPORT RAPPORT MÉDICAL (FLIGHT SURGEON BRIEF) ---
    const _prevAfterRenderBrief = C.app.hooks.afterRender;
    C.app.hooks.afterRender = function (u) {
      if (typeof _prevAfterRenderBrief === 'function') {
        _prevAfterRenderBrief(u);
      }

      if (document.getElementById('btnFlightSurgeonBrief')) return;

      const btn = document.createElement('button');
      btn.id = 'btnFlightSurgeonBrief';
      btn.type = 'button';
      btn.className = 'btn sm ghost';
      btn.innerHTML = '📄 Flight Surgeon Brief';
      btn.style.cssText = 'border-color: rgba(56, 189, 248, 0.45); color: #e0f2fe;';

      // Placement natif à côté de "+ Log metric" ou en haut de la vue
      const logBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log metric'));
      if (logBtn && logBtn.parentElement) {
        logBtn.parentElement.insertBefore(btn, logBtn.nextSibling);
      } else {
        const view = document.querySelector('#view > div');
        if (view) {
          const wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:12px;';
          wrap.appendChild(btn);
          view.prepend(wrap);
        }
      }

      btn.onclick = () => {
        const metrics = C.METRICS || {};
        const sections = C.SECTIONS || {
          cardio: { label: 'Cardio health' },
          bone: { label: 'Bone health' },
          behavior: { label: 'Behaviour' },
          radiation: { label: 'Radiation' }
        };

        const rows = [];
        const alerts = [];

        for (const [key, meta] of Object.entries(metrics)) {
          const series = (u.data && Array.isArray(u.data[key])) ? u.data[key] : [];
          if (!series.length) continue;

          const latest = series[series.length - 1];
          const first = series[0];
          const val = Number(latest.v);
          const delta = (series.length > 1) ? (val - Number(first.v)).toFixed(meta.dec ?? 1) : '0.0';
          const sign = Number(delta) > 0 ? '+' : '';

          let status = 'NOMINAL';
          let badgeColor = '#059669';
          if ((meta.critLo != null && val < meta.critLo) || (meta.critHi != null && val > meta.critHi)) {
            status = 'CRITICAL';
            badgeColor = '#dc2626';
            alerts.push(`${meta.label || key.toUpperCase()} : ${val} ${meta.unit || ''} (Seuil critique dépassé)`);
          } else if ((meta.lo != null && val < meta.lo[0]) || (meta.hi != null && val > meta.hi[0])) {
            status = 'ELEVATED';
            badgeColor = '#d97706';
            alerts.push(`${meta.label || key.toUpperCase()} : ${val} ${meta.unit || ''} (Surveillance requise)`);
          }

          const secLabel = (sections[meta.sec] && sections[meta.sec].label) ? sections[meta.sec].label : (meta.sec || 'General');
          rows.push(`
            <tr>
              <td><strong>${meta.label || key.toUpperCase()}</strong><br><span style="color:#64748b;font-size:11px;">${secLabel}</span></td>
              <td style="font-size:15px;font-weight:700;">${val} <span style="font-weight:400;color:#475569;">${meta.unit || ''}</span></td>
              <td>${sign}${delta} ${meta.unit || ''}</td>
              <td><span style="background:${badgeColor};color:#fff;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;">${status}</span></td>
              <td style="color:#475569;font-size:12px;">${latest.src || 'Sensor'}</td>
            </tr>
          `);
        }

        const evaCleared = !alerts.some(a => a.includes('critique'));
        const orbitMode = window.__marsDelayMode ? 'Mars Orbit (14m 20s One-Way Latency — Autonomous Triage)' : 'Low Earth Orbit / ISS (Real-Time Telemetry)';
        const generatedAt = new Date().toLocaleString('fr-FR');

        const reportHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Flight Surgeon Brief — ${u.name || 'Astra One'}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #0f172a; background: #f8fafc; margin: 0; padding: 32px; }
  .sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
  .title { font-size: 22px; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
  .sub { color: #475569; font-size: 13px; margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; }
  .eva-box { padding: 14px 18px; border-radius: 8px; margin-bottom: 24px; border-left: 5px solid ${evaCleared ? '#059669' : '#dc2626'}; background: ${evaCleared ? '#ecfdf5' : '#fef2f2'}; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  th { text-align: left; background: #0f172a; color: #fff; padding: 10px 12px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
  .print-btn { background: #0284c7; color: #fff; border: none; padding: 10px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
  @media print { .print-btn { display: none; } body { background: #fff; padding: 0; } .sheet { border: none; box-shadow: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <div style="font-size:11px;font-weight:700;color:#0284c7;letter-spacing:1.2px;">ASTRAVITALS SPACE MEDICINE CONSOLE</div>
        <h1 class="title">FLIGHT SURGEON MEDICAL BRIEF</h1>
        <div class="sub">Généré le ${generatedAt}</div>
      </div>
      <button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
    </div>

    <div class="grid">
      <div><strong>Astronaute :</strong> ${u.name || 'Astra One'} (${u.id || '0000001'})</div>
      <div><strong>Jour de mission :</strong> Mission Day ${u.day || 142}</div>
      <div><strong>Liaison télémétrie :</strong> ${orbitMode}</div>
      <div><strong>Pipeline données :</strong> Wokwi ESP32 → Python Audit → PostgreSQL</div>
    </div>

    <div class="eva-box">
      <div style="font-weight:800;font-size:14px;color:${evaCleared ? '#065f46' : '#991b1b'};">
        ${evaCleared ? '✅ STATUT EVA : APTE (GO FOR EVA)' : '🚨 STATUT EVA : CONTRE-INDICATION TEMPORAIRE (NO-GO)'}
      </div>
      <div style="font-size:13px;margin-top:6px;color:#334155;">
        ${alerts.length ? 'Anomalies détectées : ' + alerts.join(' | ') : 'Toutes les constantes vitales sont dans les limites opérationnelles de vol.'}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Paramètre biométrique</th>
          <th>Dernière valeur</th>
          <th>Tendance (7j)</th>
          <th>Statut clinique</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>${rows.join('')}</tbody>
    </table>

    <div style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:12px;">
      Document certifié par le moteur autonome ASTRAVITALS. Destiné au médecin de vol (Flight Surgeon) et au contrôle de mission.
    </div>
  </div>
</body>
</html>`;

        const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `AstraVitals_Flight_Surgeon_Brief_${(u.name || 'Crew').replace(/\s+/g, '_')}.html`;
        link.click();
        URL.revokeObjectURL(link.href);

        if (C.app.toast) C.app.toast('Rapport médical Flight Surgeon téléchargé.');
      };
    };
    // ---------------------------------------------------------------------------
  } catch (err) {
    console.error('Erreur de chargement depuis Spring Boot:', err);
  }
})();