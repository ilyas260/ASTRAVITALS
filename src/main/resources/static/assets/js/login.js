(function () {
  'use strict';
  const C = window.CHC;

  const existing = C.session.get();
  if (existing && existing.id) {
    return location.replace(existing.role === 'admin' ? 'admin.html' : 'user.html');
  }

  const bg = document.getElementById('bg');
  if (bg && C.scene) {
    C.scene.init(bg);
    C.scene.set({ tint: '#38BDF8', word: 'MERIDIAN' });
  }

  const form = document.getElementById('loginForm') || document.querySelector('form');
  const errEl = document.getElementById('loginErr') || document.querySelector('.err, .error, [role="alert"]');

  // Support des boutons de démo rapides (REG-0000001, ADM-0000001, etc.)
  document.querySelectorAll('[data-reg], [data-id], .demo-pill, .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.reg || btn.dataset.id || btn.textContent.replace(/^(Crew|Admin):\s*/i, '').trim();
      const inputs = form ? form.querySelectorAll('input') : document.querySelectorAll('input');
      if (inputs[0]) inputs[0].value = val;
      if (inputs[1] && !inputs[1].value) inputs[1].value = 'demo-pass';
    });
  });

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (errEl) errEl.textContent = '';

      const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"])');
      const idInput = document.getElementById('loginId') || document.getElementById('reg') || inputs[0];
      const passInput = document.getElementById('loginPass') || document.getElementById('password') || inputs[1];

      const credentials = {
        id: idInput ? idInput.value.trim() : '',
        password: passInput ? passInput.value : ''
      };

      if (!credentials.id) {
        if (errEl) errEl.textContent = 'Please enter your ID or registration number.';
        return;
      }

      try {
        const session = await C.api.login(credentials);
        location.replace(session.role === 'admin' ? 'admin.html' : 'user.html');
      } catch (err) {
        if (errEl) errEl.textContent = 'Invalid credentials or server unreachable.';
        console.error('Login error:', err);
      }
    });
  }
})();