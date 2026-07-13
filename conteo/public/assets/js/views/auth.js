/**
 * CONTEO — Écran d'authentification (parent).
 * Inscription (téléphone + OTP), connexion. Consentement parental explicite
 * à l'inscription (COPPA/RGPD).
 */

import { el, mount, toast } from '../utils/dom.js';
import { api } from '../core/api.js';
import { db } from '../core/db.js';
import { state } from '../core/store.js';
import { navigate } from '../core/router.js';

export function renderAuth() {
  let mode = 'login'; // 'login' | 'register' | 'otp'
  let pendingPhone = '';

  const container = el('div', { class: 'parent' });
  mount(container);
  render();

  function render() {
    const box = el('div', { style: 'padding:24px;max-width:420px;margin:0 auto;width:100%' });
    box.append(el('div', { style: 'text-align:center;font-size:40px', text: '🦁📖' }));
    box.append(el('h1', { style: 'text-align:center;color:var(--c-earth)', text: 'CONTEO' }));
    box.append(el('p', { class: 'hint', style: 'text-align:center', text: 'Contes africains pour les 2–7 ans' }));

    if (mode === 'login') renderLogin(box);
    else if (mode === 'register') renderRegister(box);
    else renderOtp(box);

    container.replaceChildren(box);
  }

  function field(label, input) { return el('div', { class: 'field' }, [el('label', { text: label }), input]); }

  function renderLogin(box) {
    const phone = el('input', { class: 'input', type: 'tel', placeholder: '+225 07 00 00 00 00' });
    const pass = el('input', { class: 'input', type: 'password', placeholder: 'Mot de passe' });
    box.append(field('Téléphone', phone), field('Mot de passe', pass));
    box.append(el('button', { class: 'btn block', text: 'Se connecter', onClick: async () => {
      try {
        const res = await api.post('/auth/login', { phone: norm(phone.value), password: pass.value });
        await onAuth(res);
      } catch (e) {
        if (e.errors?.phone) { pendingPhone = norm(phone.value); mode = 'register'; render(); toast('Numéro non vérifié.'); }
        else toast(e.message || 'Connexion impossible');
      }
    } }));
    box.append(el('button', { class: 'btn ghost block', text: 'Créer un compte', onClick: () => { mode = 'register'; render(); } }));
  }

  function renderRegister(box) {
    const name = el('input', { class: 'input', placeholder: 'Votre nom' });
    const phone = el('input', { class: 'input', type: 'tel', value: pendingPhone, placeholder: '+225 07 00 00 00 00' });
    const pass = el('input', { class: 'input', type: 'password', placeholder: 'Mot de passe (6+ caractères)' });
    const consent = el('input', { type: 'checkbox', id: 'consent', style: 'width:auto' });

    box.append(field('Nom', name), field('Téléphone', phone), field('Mot de passe', pass));
    box.append(el('label', { style: 'display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 0' }, [
      consent, el('span', { text: 'Je suis le parent/tuteur et je consens à la création de profils pour mes enfants. Aucune donnée sensible n\'est collectée.' }),
    ]));
    box.append(el('button', { class: 'btn block', text: 'Créer le compte', onClick: async () => {
      if (!consent.checked) return toast('Le consentement parental est requis.');
      try {
        await api.post('/auth/register', { phone: norm(phone.value), password: pass.value, display_name: name.value.trim() });
        pendingPhone = norm(phone.value);
        mode = 'otp'; render();
        toast('Code envoyé par SMS');
      } catch (e) { toast(e.message || 'Inscription impossible'); }
    } }));
    box.append(el('button', { class: 'btn ghost block', text: 'J\'ai déjà un compte', onClick: () => { mode = 'login'; render(); } }));
  }

  function renderOtp(box) {
    box.append(el('p', { text: `Entrez le code reçu au ${pendingPhone}` }));
    const code = el('input', { class: 'input', inputmode: 'numeric', maxlength: '6', placeholder: '••••••' });
    box.append(field('Code de vérification', code));
    box.append(el('button', { class: 'btn block', text: 'Vérifier', onClick: async () => {
      try {
        const res = await api.post('/auth/verify-otp', { phone: pendingPhone, code: code.value.trim() });
        await onAuth(res);
      } catch (e) { toast(e.message || 'Code invalide'); }
    } }));
  }

  async function onAuth(res) {
    state.token = res.token;
    state.user = res.user;
    await db.set('token', res.token);
    await db.set('user', res.user);
    toast('Bienvenue !');
    navigate('/parent/profils');
  }
}

function norm(v) {
  v = (v || '').replace(/[\s\-().]/g, '');
  if (v && !v.startsWith('+')) {
    // Défaut Côte d'Ivoire si numéro local.
    v = v.startsWith('225') ? '+' + v : '+225' + v.replace(/^0/, '');
  }
  return v;
}
