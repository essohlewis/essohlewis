/* =====================================================================
   notifications.js — Centre de notifications + push PWA
   ---------------------------------------------------------------------
   - Centre in-app (cloche + panneau déroulant), persistant en localStorage.
   - Notifications système via l'API Notification (avec permission).
   - Alimenté par les événements live (buts, résolutions) et les paris.
   👉 Pour de vraies notifications push serveur : brancher la Push API +
      un service de messagerie (ex. Web Push / FCM) dans le service worker.
   ===================================================================== */
(function () {
  const KEY = 'pronos-notifs';
  const MAX = 30;

  const Notifs = {
    list() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } },
    _save(l) { localStorage.setItem(KEY, JSON.stringify(l.slice(0, MAX))); },

    push(title, body, type = 'info') {
      const l = this.list();
      l.unshift({ id: 'n' + Date.now() + Math.random().toString(16).slice(2, 6), title, body, type, ts: Date.now(), read: false });
      this._save(l);
      this._renderBadge();
      this._renderPanel();
      // Notification système si autorisée et onglet non focus
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        try { new Notification(title, { body, icon: 'assets/icon.svg', badge: 'assets/icon.svg' }); } catch (e) {}
      }
    },

    markAllRead() { const l = this.list().map((n) => ({ ...n, read: true })); this._save(l); this._renderBadge(); this._renderPanel(); },
    clearAll() { this._save([]); this._renderBadge(); this._renderPanel(); },
    unread() { return this.list().filter((n) => !n.read).length; },

    requestPermission() {
      if (!('Notification' in window)) return Promise.resolve('unsupported');
      return Notification.requestPermission();
    },

    /* --- Rendu --- */
    _renderBadge() {
      const badge = document.querySelector('[data-notif-badge]');
      if (!badge) return;
      const n = this.unread();
      badge.textContent = n > 9 ? '9+' : n;
      badge.style.display = n ? 'grid' : 'none';
    },

    _icon(type) {
      const map = {
        goal: '⚽', bet: '🎟️', won: '✅', lost: '❌', live: '🔴', info: '🔔', badge: '🏅',
      };
      return map[type] || '🔔';
    },

    _renderPanel() {
      const panel = document.querySelector('[data-notif-list]');
      if (!panel) return;
      const l = this.list();
      const fr = I18N.lang === 'fr';
      if (!l.length) {
        panel.innerHTML = `<div class="notif-empty">${fr ? 'Aucune notification pour le moment.' : 'No notifications yet.'}</div>`;
        return;
      }
      panel.innerHTML = l.map((n) => `
        <div class="notif-item ${n.read ? '' : 'unread'}">
          <span class="notif-ico">${this._icon(n.type)}</span>
          <div class="notif-body"><b>${n.title}</b><span>${n.body}</span><time>${timeAgo(n.ts, fr)}</time></div>
        </div>`).join('');
    },

    init() {
      const bell = document.querySelector('[data-notif-bell]');
      const dropdown = document.querySelector('[data-notif-dropdown]');
      if (bell && dropdown) {
        bell.addEventListener('click', (e) => {
          e.stopPropagation();
          const open = dropdown.classList.toggle('open');
          if (open) this.markAllRead();
        });
        document.addEventListener('click', (e) => { if (!dropdown.contains(e.target)) dropdown.classList.remove('open'); });
        const clearBtn = dropdown.querySelector('[data-notif-clear]');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearAll());
      }
      this._renderBadge();
      this._renderPanel();

      // Notification de bienvenue une seule fois par session
      if (!sessionStorage.getItem('pronos-welcomed')) {
        sessionStorage.setItem('pronos-welcomed', '1');
        const fr = I18N.lang === 'fr';
        setTimeout(() => this.push(
          fr ? 'Pronostics du jour disponibles' : "Today's picks are ready",
          fr ? "L'IA a généré de nouveaux pronostics." : 'The AI generated new predictions.', 'info'), 1200);
      }

      document.addEventListener('langchange', () => this._renderPanel());
    },
  };

  function timeAgo(ts, fr) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return fr ? "à l'instant" : 'just now';
    const m = Math.floor(s / 60); if (m < 60) return m + (fr ? ' min' : 'm');
    const h = Math.floor(m / 60); if (h < 24) return h + 'h';
    return Math.floor(h / 24) + 'j';
  }

  window.PronosNotifications = Notifs;
})();
