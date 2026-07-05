// ===========================================================
// SAMSON GYM — Script partagé
// ===========================================================

// Numéro WhatsApp du centre (format international, sans "+", pour wa.me)
const SAMSON_WA = '2250757274855';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Horaires d'ouverture (minutes depuis minuit). 0 = dimanche … 6 = samedi.
const OPENING_HOURS = {
  0: { open: 7 * 60 + 30, close: 20 * 60 + 30 }, // dimanche 7h30 – 20h30
  1: { open: 6 * 60 + 30, close: 21 * 60 },       // lundi
  2: { open: 6 * 60 + 30, close: 21 * 60 },
  3: { open: 6 * 60 + 30, close: 21 * 60 },
  4: { open: 6 * 60 + 30, close: 21 * 60 },
  5: { open: 6 * 60 + 30, close: 21 * 60 },
  6: { open: 6 * 60 + 30, close: 21 * 60 },       // samedi
};

// Planning des cours collectifs. jsDay = index Date.getDay().
const CLASS_SCHEDULE = {
  1: { day: 'Lundi',    jsDay: 1, start: '18:30', end: '19:30', coach: 'Coach Sylla',  activity: 'Step ou bâton' },
  2: { day: 'Mardi',    jsDay: 2, start: '18:30', end: '19:30', coach: 'Coach Lova',   activity: 'Cardio-training' },
  3: { day: 'Mercredi', jsDay: 3, start: '18:30', end: '19:30', coach: 'Coach Belem',  activity: 'Zumba, Djembé, Coupé-décalé' },
  4: { day: 'Jeudi',    jsDay: 4, start: '18:30', end: '19:30', coach: 'Coach Michel', activity: 'Spinning (vélo)' },
  5: { day: 'Vendredi', jsDay: 5, start: '18:30', end: '19:30', coach: 'Coach Roméo',  activity: 'Danse coupé-décalé' },
  6: { day: 'Samedi',   jsDay: 6, start: '7:30',  end: '8:30',  coach: 'Coach Dosso',  activity: 'Cardio ou RPM' },
  0: null,
};

/* ---------- Helpers ---------- */
function waLink(message) {
  return `https://wa.me/${SAMSON_WA}?text=${encodeURIComponent(message)}`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function isOpenNow(now = new Date()) {
  const hours = OPENING_HOURS[now.getDay()];
  if (!hours) return { open: false };
  const minutes = now.getHours() * 60 + now.getMinutes();
  const open = minutes >= hours.open && minutes < hours.close;
  return { open, close: hours.close, opensIn: hours.open - minutes };
}

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Accessibilité : lien d'évitement + landmark ---------- */
  const firstSection = document.querySelector('body > section, main');
  if (firstSection && !document.querySelector('.skip-link')) {
    if (!firstSection.id) firstSection.id = 'contenu';
    firstSection.setAttribute('tabindex', '-1');
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = `#${firstSection.id}`;
    skip.textContent = 'Aller au contenu';
    document.body.insertBefore(skip, document.body.firstChild);
  }

  /* ---------- Menu mobile ---------- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    links.id = links.id || 'menu-principal';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', links.id);
    const setOpen = (open) => {
      toggle.classList.toggle('open', open);
      links.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setOpen(!toggle.classList.contains('open')));
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- Lien actif selon la page ---------- */
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === current) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  /* ---------- Badge « Ouvert maintenant » (injecté dans le header) ---------- */
  const nav = document.querySelector('.site-header .nav');
  const themeToggleBtn = document.querySelector('[data-theme-toggle]');
  if (nav && themeToggleBtn) {
    const pill = document.createElement('span');
    pill.className = 'status-pill';
    pill.setAttribute('role', 'status');
    const renderPill = () => {
      const { open, opensIn } = isOpenNow();
      pill.classList.toggle('is-open', open);
      pill.classList.toggle('is-closed', !open);
      if (open) {
        pill.innerHTML = '<span class="dot"></span> Ouvert';
      } else if (opensIn > 0 && opensIn <= 90) {
        pill.innerHTML = `<span class="dot"></span> Ouvre dans ${opensIn} min`;
      } else {
        pill.innerHTML = '<span class="dot"></span> Fermé';
      }
    };
    renderPill();
    setInterval(renderPill, 60 * 1000);
    nav.insertBefore(pill, themeToggleBtn);
  }

  /* ---------- Header : ombre au scroll ---------- */
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Reveal au scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger > *');
  if (prefersReducedMotion) {
    revealEls.forEach(el => el.classList.add('in'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---------- Compteurs animés (stats) ---------- */
  const counters = document.querySelectorAll('[data-count]');
  const setFinal = (el) => { el.textContent = el.dataset.count + (el.dataset.suffix || ''); };
  if (counters.length && prefersReducedMotion) {
    counters.forEach(setFinal);
  } else if (counters.length && 'IntersectionObserver' in window) {
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const suffix = el.dataset.suffix || '';
        let current = 0;
        const step = Math.max(1, Math.ceil(target / 60));
        const tick = () => {
          current += step;
          if (current >= target) {
            el.textContent = target + suffix;
          } else {
            el.textContent = current + suffix;
            requestAnimationFrame(tick);
          }
        };
        tick();
        countIO.unobserve(el);
      });
    }, { threshold: 0.5 });
    counters.forEach(el => countIO.observe(el));
  } else {
    counters.forEach(setFinal);
  }

  /* ---------- Toggle tarifs : séance / abonnement ---------- */
  const pricingToggle = document.querySelectorAll('[data-pricing-toggle]');
  const pricingPanels = document.querySelectorAll('[data-pricing-panel]');
  if (pricingToggle.length) {
    pricingToggle.forEach(btn => {
      btn.addEventListener('click', () => {
        pricingToggle.forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active');
        btn.setAttribute('aria-pressed', 'true');
        const mode = btn.dataset.pricingToggle;
        pricingPanels.forEach(p => {
          p.style.display = (p.dataset.pricingPanel === mode) ? 'grid' : 'none';
        });
      });
    });
  }

  /* ---------- Filtre planning par jour (page cours) ---------- */
  const dayFilters = document.querySelectorAll('[data-day-filter]');
  const dayCards = document.querySelectorAll('[data-day]');
  if (dayFilters.length) {
    dayFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        dayFilters.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const day = btn.dataset.dayFilter;
        dayCards.forEach(card => {
          card.style.display = (day === 'all' || card.dataset.day === day) ? '' : 'none';
        });
      });
    });
  }

  /* ---------- Accordéon (FAQ / équipements détails) ---------- */
  document.querySelectorAll('[data-accordion-trigger]').forEach(trigger => {
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('aria-expanded', 'false');
    const activate = () => {
      const item = trigger.closest('[data-accordion-item]');
      const wasOpen = item.classList.contains('is-open');
      item.parentElement.querySelectorAll('[data-accordion-item]').forEach(i => {
        i.classList.remove('is-open');
        const t = i.querySelector('[data-accordion-trigger]');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    };
    trigger.addEventListener('click', activate);
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); }
    });
  });

  /* ---------- Mode clair / sombre ---------- */
  const themeBtn = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  const syncThemeIcon = () => {
    if (!themeBtn) return;
    themeBtn.textContent = root.getAttribute('data-theme') === 'light' ? '☀️' : '🌙';
  };
  syncThemeIcon();
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const isLight = root.getAttribute('data-theme') === 'light';
      if (isLight) {
        root.removeAttribute('data-theme');
        localStorage.setItem('samson-theme', 'dark');
      } else {
        root.setAttribute('data-theme', 'light');
        localStorage.setItem('samson-theme', 'light');
      }
      syncThemeIcon();
    });
  }

  /* ---------- Cours de ce soir (widget dynamique) ---------- */
  const tonightWidget = document.querySelector('[data-tonight-widget]');
  if (tonightWidget) {
    const todayIdx = new Date().getDay();
    let entry = CLASS_SCHEDULE[todayIdx];
    let label = "Aujourd'hui";
    if (!entry) { entry = CLASS_SCHEDULE[1]; label = 'Prochain cours · Lundi'; }
    const time = `${entry.start} – ${entry.end}`;
    tonightWidget.innerHTML = `
      <div class="tonight-label">${label}</div>
      <div class="tonight-main">${entry.activity}</div>
      <div class="tonight-sub">${entry.coach} · ${time}</div>
      <a class="tonight-cta" href="${waLink(`Bonjour Samson Gym, je souhaite participer au cours « ${entry.activity} » (${entry.coach}, ${time}). Est-ce possible ?`)}" target="_blank" rel="noopener">Réserver sur WhatsApp →</a>
    `;
  }

  /* ---------- Cartes cours : « Réserver » + « Ajouter au calendrier » ---------- */
  document.querySelectorAll('.day-card[data-day]').forEach(card => {
    const dayName = card.querySelector('.day-name')?.textContent.trim();
    const time = card.querySelector('.time')?.textContent.trim();
    const coach = card.querySelector('.coach-name')?.textContent.trim();
    const activity = card.querySelector('.activity')?.textContent.trim();
    const body = card.querySelector('.body');
    if (!dayName || !time || !coach || !body) return;

    const schedule = Object.values(CLASS_SCHEDULE).find(s => s && s.day === dayName);
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const book = document.createElement('a');
    book.className = 'mini-btn mini-btn-gold';
    book.target = '_blank';
    book.rel = 'noopener';
    book.href = waLink(`Bonjour Samson Gym, je souhaite participer au cours de ${dayName} (${coach}, ${time}). Est-ce possible ?`);
    book.textContent = 'Réserver';
    actions.appendChild(book);

    if (schedule) {
      const cal = document.createElement('button');
      cal.type = 'button';
      cal.className = 'mini-btn mini-btn-ghost';
      cal.textContent = 'Ajouter au calendrier';
      cal.addEventListener('click', () => downloadICS(schedule, activity));
      actions.appendChild(cal);
    }
    body.appendChild(actions);
  });

  /* ---------- Quiz : trouvez votre coach ---------- */
  const quizButtons = document.querySelectorAll('[data-quiz-goal]');
  const quizResult = document.querySelector('[data-quiz-result]');
  if (quizButtons.length && quizResult) {
    const recommendations = {
      force:    CLASS_SCHEDULE[1],
      cardio:   CLASS_SCHEDULE[2],
      ambiance: CLASS_SCHEDULE[3],
      velo:     CLASS_SCHEDULE[4],
      danse:    CLASS_SCHEDULE[5],
      matin:    CLASS_SCHEDULE[6],
    };
    quizButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        quizButtons.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const rec = recommendations[btn.dataset.quizGoal];
        if (!rec) return;
        const time = `${rec.day} ${rec.start}`;
        quizResult.style.display = 'flex';
        quizResult.innerHTML = `
          <div class="quiz-result-inner">
            <div class="eyebrow" style="margin-bottom:8px;">Notre recommandation</div>
            <div class="quiz-coach">${rec.coach}</div>
            <div class="quiz-activity">${rec.activity} — ${time}</div>
            <a class="quiz-cta" href="${waLink(`Bonjour Samson Gym, le quiz me recommande « ${rec.activity} » avec ${rec.coach} (${time}). Je souhaite m'inscrire.`)}" target="_blank" rel="noopener">Réserver ce cours sur WhatsApp →</a>
          </div>
        `;
      });
    });
  }

  /* ---------- Carrousel témoignages ---------- */
  const track = document.querySelector('[data-testimonial-track]');
  if (track) {
    const slides = track.querySelectorAll('[data-testimonial-slide]');
    const dotsWrap = document.querySelector('[data-testimonial-dots]');
    let idx = 0;
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'testi-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Témoignage ${i + 1}`);
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });
    const dots = dotsWrap.querySelectorAll('.testi-dot');
    function goTo(i) {
      idx = i;
      track.style.transform = `translateX(-${idx * 100}%)`;
      dots.forEach((d, di) => d.classList.toggle('is-active', di === idx));
    }
    let auto;
    const startAuto = () => { if (!prefersReducedMotion) auto = setInterval(() => goTo((idx + 1) % slides.length), 5500); };
    const stopAuto = () => clearInterval(auto);
    startAuto();
    const wrap = track.closest('[data-testimonial-wrap]');
    wrap.addEventListener('mouseenter', stopAuto);
    wrap.addEventListener('mouseleave', startAuto);
  }

  /* ---------- Formulaire contact → WhatsApp (sans backend) ---------- */
  const form = document.getElementById('contact-form');
  const successMsg = document.getElementById('success-msg');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.querySelector('#name')?.value.trim() || '';
      const phone = form.querySelector('#phone')?.value.trim() || '';
      const subject = form.querySelector('#subject')?.value.trim() || '';
      const message = form.querySelector('#message')?.value.trim() || '';
      const text =
        `Bonjour Samson Gym,\n` +
        `Nom : ${name}\n` +
        `Téléphone : ${phone}\n` +
        `Sujet : ${subject}\n` +
        (message ? `Message : ${message}\n` : '') +
        `\n(Envoyé depuis le site)`;
      window.open(waLink(text), '_blank', 'noopener');
      if (successMsg) successMsg.style.display = 'block';
      form.reset();
    });
  }

  /* ---------- Enregistrement du Service Worker (PWA) ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* silencieux */ });
    });
  }

});

/* ---------- Génération de fichier .ics (ajout au calendrier) ---------- */
function downloadICS(schedule, activity) {
  const [sh, sm] = schedule.start.split(':').map(Number);
  const [eh, em] = schedule.end.split(':').map(Number);

  // Prochaine occurrence du jour concerné.
  const now = new Date();
  const target = new Date(now);
  const diff = (schedule.jsDay - now.getDay() + 7) % 7;
  target.setDate(now.getDate() + diff);
  target.setHours(sh, sm, 0, 0);
  if (diff === 0 && target < now) target.setDate(target.getDate() + 7);

  const end = new Date(target);
  end.setHours(eh, em, 0, 0);

  const fmt = (d) =>
    `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
  const fmtUTC = (d) =>
    `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;

  const uid = `samson-${schedule.jsDay}-${Date.now()}@samsongym.ci`;
  const title = `Samson Gym — ${activity || schedule.activity}`;
  const desc = `${schedule.coach} · ${schedule.start}–${schedule.end}. Cours collectif au Centre Sportif Samson Gym, Angré 22e, Abidjan.`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Samson Gym//Planning//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtUTC(new Date())}`,
    `DTSTART:${fmt(target)}`,
    `DTEND:${fmt(end)}`,
    'RRULE:FREQ=WEEKLY',
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    'LOCATION:Samson Gym, Angré 22e, Abidjan',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `samson-${schedule.day.toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
