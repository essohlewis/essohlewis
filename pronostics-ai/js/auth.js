/* =====================================================================
   auth.js — Validation temps réel + session factice (localStorage)
   ---------------------------------------------------------------------
   ⚠️  DÉMO FRONT-END : la "session" est simulée via localStorage.
   👉 POINT DE BRANCHEMENT : remplacer `fakeAuth()` par un vrai appel
      à votre backend (POST /login, POST /register) renvoyant un JWT.
   ===================================================================== */
(function () {
  const SESSION_KEY = 'pronos-session';

  /* --- Utilitaires session (réutilisés par le dashboard) --- */
  const Session = {
    get() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
      catch { return null; }
    },
    set(user) { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); },
    clear() { localStorage.removeItem(SESSION_KEY); },
    isAuthed() { return !!this.get(); },
  };
  window.PronosSession = Session;

  /* --- Validation --- */
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function passwordScore(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score; // 0–4
  }

  /* --- Toasts (feedback) --- */
  function toast(msg, type = 'ok') {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'ok'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';
    el.innerHTML = icon + '<span></span>';
    el.querySelector('span').textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(10px)'; setTimeout(() => el.remove(), 300); }, 3200);
  }
  window.PronosToast = toast;

  /* --- Appel d'authentification simulé (Promise) --- */
  function fakeAuth(user) {
    // 👉 Remplacer par: return fetch('/api/auth', {method:'POST', body:...}).then(r=>r.json())
    return new Promise((resolve) => setTimeout(() => resolve({ ...user, token: 'demo-' + Date.now() }), 700));
  }

  /* --- Logique de la page auth (n'exécute que si le formulaire existe) --- */
  document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('.auth-page');
    if (!page) return;

    // Si déjà connecté → rediriger vers le dashboard
    if (Session.isAuthed()) { window.location.href = 'dashboard.html'; return; }

    const tabs = document.querySelectorAll('.auth-tabs button');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    function switchTab(name) {
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
      loginForm.classList.toggle('active', name === 'login');
      signupForm.classList.toggle('active', name === 'signup');
    }
    tabs.forEach((t) => t.addEventListener('click', () => switchTab(t.dataset.tab)));

    // Onglet initial via hash (#signup)
    if (location.hash === '#signup') switchTab('signup');

    // Basculer visibilité mot de passe
    document.querySelectorAll('.toggle-pass').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        input.type = input.type === 'password' ? 'text' : 'password';
      });
    });

    /* Helper de validation d'un champ */
    function setState(input, ok, msg) {
      input.classList.toggle('valid', ok === true);
      input.classList.toggle('invalid', ok === false);
      const hint = input.closest('.field').querySelector('.hint');
      if (hint) { hint.textContent = msg || ''; hint.className = 'hint ' + (ok === false ? 'err' : ok === true ? 'ok' : ''); }
    }

    // --- Validation live inscription ---
    const suName = signupForm.querySelector('[name=name]');
    const suEmail = signupForm.querySelector('[name=email]');
    const suPw = signupForm.querySelector('[name=password]');
    const suConfirm = signupForm.querySelector('[name=confirm]');
    const strength = signupForm.querySelector('.pw-strength');

    suName.addEventListener('input', () => setState(suName, suName.value.trim().length >= 2));
    suEmail.addEventListener('input', () => setState(suEmail, emailRe.test(suEmail.value), emailRe.test(suEmail.value) ? '' : (I18N.t('auth.email') + ' ?')));
    suPw.addEventListener('input', () => {
      const s = passwordScore(suPw.value);
      strength.dataset.level = suPw.value ? s : 0;
      setState(suPw, suPw.value.length === 0 ? null : s >= 2);
      if (suConfirm.value) suConfirm.dispatchEvent(new Event('input'));
    });
    suConfirm.addEventListener('input', () =>
      setState(suConfirm, suConfirm.value.length > 0 && suConfirm.value === suPw.value)
    );

    // --- Soumission inscription ---
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const okName = suName.value.trim().length >= 2;
      const okEmail = emailRe.test(suEmail.value);
      const okPw = passwordScore(suPw.value) >= 2;
      const okConf = suConfirm.value === suPw.value && suConfirm.value.length > 0;
      setState(suName, okName); setState(suEmail, okEmail); setState(suPw, okPw); setState(suConfirm, okConf);
      if (!(okName && okEmail && okPw && okConf)) { toast(I18N.lang === 'fr' ? 'Veuillez corriger les champs.' : 'Please fix the fields.', 'err'); return; }

      const btn = signupForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.style.opacity = '0.7';
      const user = await fakeAuth({ name: suName.value.trim(), email: suEmail.value.trim(), plan: 'Premium' });
      Session.set(user);
      toast(I18N.lang === 'fr' ? 'Compte créé ! Redirection…' : 'Account created! Redirecting…', 'ok');
      setTimeout(() => (window.location.href = 'dashboard.html'), 900);
    });

    // --- Validation + soumission connexion ---
    const liEmail = loginForm.querySelector('[name=email]');
    const liPw = loginForm.querySelector('[name=password]');
    liEmail.addEventListener('input', () => setState(liEmail, emailRe.test(liEmail.value)));

    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const okEmail = emailRe.test(liEmail.value);
      const okPw = liPw.value.length >= 4;
      setState(liEmail, okEmail); setState(liPw, okPw);
      if (!(okEmail && okPw)) { toast(I18N.lang === 'fr' ? 'Identifiants invalides.' : 'Invalid credentials.', 'err'); return; }

      const btn = loginForm.querySelector('button[type=submit]');
      btn.disabled = true; btn.style.opacity = '0.7';
      // Nom dérivé de l'email pour la démo
      const name = liEmail.value.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const user = await fakeAuth({ name, email: liEmail.value.trim(), plan: 'Premium' });
      Session.set(user);
      toast(I18N.lang === 'fr' ? 'Connexion réussie !' : 'Logged in!', 'ok');
      setTimeout(() => (window.location.href = 'dashboard.html'), 800);
    });
  });
})();
