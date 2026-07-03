const API_BASE = '/api';

// ---------- État local ----------
let token = localStorage.getItem('taskflow_token');
let refreshToken = localStorage.getItem('taskflow_refresh');
let currentUser = JSON.parse(localStorage.getItem('taskflow_user') || 'null');
let searchDebounce;
let draggedTaskId = null;
let refreshPromise = null;
let eventSource = null;

let allTasks = [];
let activeWorkspaceId = null;
const cachedWs = localStorage.getItem('taskflow_workspace_id');
if (cachedWs && cachedWs !== 'personal') {
  activeWorkspaceId = parseInt(cachedWs, 10) || null;
}
const selected = new Set();
const PAGE_SIZE = 50;
let taskOffset = 0;
let hasMoreTasks = false;

// Gestures Touch State
let touchStartY = 0;
let touchStartX = 0;
let isPulling = false;
const pullThreshold = 80;

// ---------- Elements DOM ----------
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');
const userNameEl = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const taskForm = document.getElementById('task-form');
const taskCardTemplate = document.getElementById('task-card-template');
const subtaskItemTemplate = document.getElementById('subtask-item-template');
const attachmentItemTemplate = document.getElementById('attachment-item-template');
const commentItemTemplate = document.getElementById('comment-item-template');

// Vues et Navigation
const navItems = document.querySelectorAll('.nav-item, .bottom-nav-item');
const menuToggle = document.getElementById('menu-toggle');
const appSidebar = document.getElementById('app-sidebar');
const offlineBanner = document.getElementById('offline-banner');

const REACTION_EMOJIS = ['👍', '❤️', '🎉'];
const searchInput = document.getElementById('search-input');
const filterPriority = document.getElementById('filter-priority');
const filterTag = document.getElementById('filter-tag');
const sortSelect = document.getElementById('sort-select');
const toastContainer = document.getElementById('toast-container');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOk = document.getElementById('confirm-ok');
const confirmCancel = document.getElementById('confirm-cancel');
const bulkBar = document.getElementById('bulk-bar');
const bulkCount = document.getElementById('bulk-count');
const bulkStatus = document.getElementById('bulk-status');
const bulkDelete = document.getElementById('bulk-delete');
const bulkClear = document.getElementById('bulk-clear');
const exportJsonBtn = document.getElementById('export-json');
const exportCsvBtn = document.getElementById('export-csv');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

// Notifications cloche
const notifToggle = document.getElementById('notif-toggle');
const notifBadge = document.getElementById('notif-badge');
const notifPanel = document.getElementById('notif-panel');
const notifList = document.getElementById('notif-list');

// Modale édition
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editTitle = document.getElementById('edit-title');
const editDescription = document.getElementById('edit-description');
const editPriority = document.getElementById('edit-priority');
const editTag = document.getElementById('edit-tag');
const editDueDate = document.getElementById('edit-due-date');
const editCancel = document.getElementById('edit-cancel');
const shareEmail = document.getElementById('share-email');
const shareBtn = document.getElementById('share-btn');
const shareList = document.getElementById('share-list');
const loadMoreBtn = document.getElementById('load-more');

let editingTaskId = null;

// ================= ROUTER CLIENT-SIDE =================
const appRouter = {
  currentView: 'dashboard',
  navigate(view) {
    this.currentView = view;
    
    // Basculer l'affichage des sections
    document.querySelectorAll('.app-view').forEach((el) => {
      el.classList.toggle('active', el.id === `view-${view}`);
    });

    // Mettre à jour l'état actif des menus
    navItems.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Refermer la sidebar sur mobile
    appSidebar.classList.remove('active');
    menuToggle.classList.remove('active');
    menuToggle.setAttribute('aria-expanded', 'false');

    // Charger les données de la vue
    if (view === 'dashboard') {
      loadStats();
      renderBarChart();
    } else if (view === 'board') {
      loadTasks();
    } else if (view === 'calendar') {
      renderCalendar();
    } else if (view === 'shared') {
      loadSharedWithMe();
    } else if (view === 'feed') {
      loadFeed();
    } else if (view === 'profile') {
      renderProfile(currentUser?.id);
    } else if (view === 'members') {
      loadWorkspaceMembers();
    }
  }
};

// Event listeners de navigation
navItems.forEach((item) => {
  item.addEventListener('click', () => {
    if (item.dataset.view) {
      appRouter.navigate(item.dataset.view);
    }
  });
});

// Menu hamburger mobile toggle
menuToggle.addEventListener('click', () => {
  const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', !isExpanded);
  menuToggle.classList.toggle('active');
  appSidebar.classList.toggle('active');
});

// Bouton Quick Add sur Bottom Navigation mobile
const btnQuickAdd = document.getElementById('btn-quick-add');
if (btnQuickAdd) {
  btnQuickAdd.addEventListener('click', () => {
    appRouter.navigate('board');
    setTimeout(() => {
      const inp = document.getElementById('task-title');
      if (inp) inp.focus();
    }, 100);
  });
}

// ================= COMPRESSION CLIENT IMAGE WEBP =================
async function compressImageToWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement('canvas');
      const maxDim = 300; // Dimension maximale pour les avatars
      let w = img.width;
      let h = img.height;

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], 'avatar.webp', { type: 'image/webp' }));
        } else {
          reject(new Error('Erreur de compression.'));
        }
      }, 'image/webp', 0.85);
    };
    img.onerror = (err) => reject(err);
  });
}

// ================= GRAPHISME SAAS DYNAMIQUE (SVG) =================

// 1. Donut Chart - Répartition par statut
function renderDonutChart(stats) {
  const svg = document.getElementById('svg-donut');
  const legend = document.getElementById('donut-legend');
  if (!svg || !legend) return;
  svg.innerHTML = '';
  legend.innerHTML = '';

  const total = stats.a_faire + stats.en_cours + stats.terminee;
  if (total === 0) {
    svg.innerHTML = '<circle cx="100" cy="100" r="60" fill="none" stroke="var(--line)" stroke-width="20"/><text x="100" y="105" text-anchor="middle" font-size="12" fill="var(--ink-soft)">Aucune tâche</text>';
    return;
  }

  const radius = 60;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * radius;

  const data = [
    { label: 'À faire', count: stats.a_faire, color: '#C4732B' },
    { label: 'En cours', count: stats.en_cours, color: '#2563EB' },
    { label: 'Terminée', count: stats.terminee, color: '#6B8F71' }
  ];

  let accumulatedPercent = 0;

  // Background Hole
  const hole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  hole.setAttribute('cx', cx);
  hole.setAttribute('cy', cy);
  hole.setAttribute('r', radius - 12);
  hole.setAttribute('class', 'donut-hole');
  
  data.forEach((item) => {
    if (item.count === 0) return;
    const percent = (item.count / total) * 100;
    const strokeDash = (percent / 100) * circumference;
    const strokeOffset = -(accumulatedPercent / 100) * circumference;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('class', 'donut-segment');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', radius);
    circle.setAttribute('stroke', item.color);
    circle.setAttribute('stroke-dasharray', `${strokeDash} ${circumference - strokeDash}`);
    circle.setAttribute('stroke-dashoffset', strokeOffset);
    
    // Tooltip natif
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${item.label} : ${item.count} (${Math.round(percent)}%)`;
    circle.appendChild(title);
    svg.appendChild(circle);

    // Légende
    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `<span class="legend-color" style="background:${item.color}"></span><span>${item.label} : <strong>${item.count}</strong></span>`;
    legend.appendChild(legendItem);

    accumulatedPercent += percent;
  });

  svg.appendChild(hole);

  // Texte central
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', cx);
  text.setAttribute('y', cy + 5);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '14');
  text.setAttribute('font-weight', 'bold');
  text.setAttribute('fill', 'var(--ink)');
  text.textContent = `${total} Tâches`;
  svg.appendChild(text);
}

// 2. Bar Chart - Tâches terminées les 7 derniers jours
function renderBarChart() {
  const svg = document.getElementById('svg-bars');
  if (!svg) return;
  svg.innerHTML = '';

  const days = [];
  const counts = [];
  const today = new Date();

  // Initialisation des 7 derniers jours
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
    counts.push(0);
  }

  // Comptabilisation
  allTasks.forEach((task) => {
    if (task.status === 'terminee') {
      const taskDate = new Date(task.updated_at || task.created_at);
      const dateStr = taskDate.toDateString();
      days.forEach((day, idx) => {
        if (day.toDateString() === dateStr) {
          counts[idx]++;
        }
      });
    }
  });

  const maxCount = Math.max(...counts, 4);
  const chartHeight = 150;
  const chartWidth = 320;
  const paddingLeft = 30;
  const paddingBottom = 30;
  const barWidth = 24;
  const gap = 12;

  // Lignes de guidage y
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((i * maxCount) / 4);
    const y = paddingBottom + (i * (chartHeight - paddingBottom)) / 4;
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'chart-grid-line');
    line.setAttribute('x1', paddingLeft);
    line.setAttribute('y1', chartHeight - y);
    line.setAttribute('x2', chartWidth);
    line.setAttribute('y2', chartHeight - y);
    svg.appendChild(line);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', paddingLeft - 5);
    txt.setAttribute('y', chartHeight - y + 4);
    txt.setAttribute('text-anchor', 'end');
    txt.setAttribute('font-size', '9');
    txt.setAttribute('fill', 'var(--ink-soft)');
    txt.textContent = val;
    svg.appendChild(txt);
  }

  // Dessin des barres
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  days.forEach((day, idx) => {
    const count = counts[idx];
    const barHeight = (count / maxCount) * (chartHeight - paddingBottom);
    const x = paddingLeft + idx * (barWidth + gap) + 12;
    const y = chartHeight - paddingBottom - barHeight;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'chart-bar');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', barWidth);
    rect.setAttribute('height', barHeight);
    
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    tooltip.textContent = `${day.toLocaleDateString()} : ${count} complétée(s)`;
    rect.appendChild(tooltip);
    svg.appendChild(rect);

    // Labels X
    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('class', 'chart-bar-label');
    txt.setAttribute('x', x + barWidth / 2);
    txt.setAttribute('y', chartHeight - 10);
    txt.textContent = dayNames[day.getDay()];
    svg.appendChild(txt);
  });
}

// Configurateur widgets
const configWidgetsBtn = document.getElementById('config-widgets-btn');
const widgetsTogglePanel = document.getElementById('widgets-toggle-panel');
if (configWidgetsBtn) {
  configWidgetsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    widgetsTogglePanel.classList.toggle('hidden');
  });

  const checkToggle = (id, targetCardId) => {
    const cb = document.getElementById(id);
    const card = document.getElementById(targetCardId);
    if (cb && card) {
      cb.addEventListener('change', () => {
        card.classList.toggle('hidden', !cb.checked);
        localStorage.setItem(`widget_${targetCardId}_visible`, cb.checked);
      });
      // Restaurer état
      const isVisible = localStorage.getItem(`widget_${targetCardId}_visible`) !== 'false';
      cb.checked = isVisible;
      card.classList.toggle('hidden', !isVisible);
    }
  };

  checkToggle('toggle-stat-total', 'widget-total-tasks');
  checkToggle('toggle-stat-completion', 'widget-completion');
  checkToggle('toggle-stat-late', 'widget-late');
  checkToggle('toggle-stat-active', 'widget-active');

  document.addEventListener('click', () => {
    widgetsTogglePanel?.classList.add('hidden');
  });
  widgetsTogglePanel?.addEventListener('click', (e) => e.stopPropagation());
}

// ================= GESTION DU MODE HORS LIGNE =================
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  offlineBanner.classList.toggle('hidden', isOnline);
  document.querySelectorAll('input, select, textarea, button').forEach((el) => {
    if (el.id !== 'theme-toggle' && el.id !== 'logout-btn' && !el.closest('aside')) {
      if (!isOnline && el.tagName !== 'BUTTON') {
        el.setAttribute('disabled', 'true');
      } else {
        el.removeAttribute('disabled');
      }
    }
  });
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

// ================= VALIDATIONS FORMULAIRES TEMPS RÉEL =================
function wireValidation(inputEl, regex, errorEl, emptyMsg, invalidMsg) {
  const validate = () => {
    const val = inputEl.value.trim();
    if (!val) {
      inputEl.classList.add('invalid');
      inputEl.classList.remove('valid');
      errorEl.textContent = emptyMsg;
      return false;
    } else if (regex && !regex.test(val)) {
      inputEl.classList.add('invalid');
      inputEl.classList.remove('valid');
      errorEl.textContent = invalidMsg;
      return false;
    } else {
      inputEl.classList.remove('invalid');
      inputEl.classList.add('valid');
      errorEl.textContent = '';
      return true;
    }
  };

  inputEl.addEventListener('input', validate);
  inputEl.addEventListener('blur', validate);
}

wireValidation(
  document.getElementById('login-email'),
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  document.getElementById('login-email-error'),
  'Veuillez renseigner un email.',
  'Format d\'email incorrect.'
);

wireValidation(
  document.getElementById('register-name'),
  /^[a-zA-Z0-9_\-]{3,30}$/,
  document.getElementById('register-name-error'),
  'Veuillez renseigner un nom d\'utilisateur.',
  'Lettres et chiffres uniquement (3 à 30 caractères).'
);

wireValidation(
  document.getElementById('register-email'),
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  document.getElementById('register-email-error'),
  'L\'email est obligatoire.',
  'Veuillez saisir un email valide.'
);

wireValidation(
  document.getElementById('register-password'),
  /^.{6,}$/,
  document.getElementById('register-password-error'),
  'Le mot de passe est requis.',
  'Le mot de passe doit comporter au moins 6 caractères.'
);

// ================= NOTIFICATIONS EN TEMPS RÉEL (SSE) =================
function initNotifications() {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${API_BASE}/notifications/stream?token=${token}`);

  eventSource.onmessage = (e) => {
    const notif = JSON.parse(e.data);
    showToast(notif.message, 'success');

    // Notification système
    if (Notification.permission === 'granted') {
      new Notification('TaskFlow Pro', {
        body: notif.message,
        icon: 'icons/icon.svg'
      });
    }
    loadNotifications();
  };

  eventSource.onerror = () => {
    // Reconnexion automatique progressive
    setTimeout(initNotifications, 5000);
  };
}

function disconnectNotifications() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

async function loadNotifications() {
  try {
    const list = await apiRequest('/notifications');
    const unread = list.filter((n) => !n.read_status);
    
    if (unread.length > 0) {
      notifBadge.textContent = unread.length;
      notifBadge.classList.remove('hidden');
    } else {
      notifBadge.classList.add('hidden');
    }

    renderNotificationsList(list);
  } catch {
    /* silencieux */
  }
}

function renderNotificationsList(list) {
  notifList.innerHTML = '';
  if (list.length === 0) {
    notifList.innerHTML = '<p class="notif-empty">Aucune notification pour l\'instant. 🎉</p>';
    return;
  }

  list.forEach((n) => {
    const div = document.createElement('div');
    div.className = `notif-item ${n.read_status ? '' : 'unread'}`;
    const dateStr = new Date(n.created_at).toLocaleString('fr-FR');
    
    div.innerHTML = `
      <span class="notif-item-msg"></span>
      <span class="notif-item-time">${dateStr}</span>
    `;
    div.querySelector('.notif-item-msg').textContent = n.message;

    div.addEventListener('click', async () => {
      if (!n.read_status) {
        try {
          await apiRequest(`/notifications/${n.id}/read`, { method: 'PATCH' });
          loadNotifications();
        } catch {}
      }
    });

    notifList.appendChild(div);
  });
}

document.getElementById('notif-mark-all').addEventListener('click', async () => {
  try {
    await apiRequest('/notifications/mark-all-read', { method: 'POST' });
    loadNotifications();
    showToast('Notifications marquées comme lues.');
  } catch (err) {
    showToast(err.message, 'error');
  }
});

notifToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  notifPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (notifPanel && !notifPanel.classList.contains('hidden') &&
      !notifPanel.contains(e.target) && e.target !== notifToggle) {
    notifPanel.classList.add('hidden');
  }
});

// ================= GESTES TACTILES (SWIPE / PULL-TO-REFRESH) =================

// Swipe de colonnes Kanban (uniquement sur mobile)
const kanbanBoard = document.getElementById('kanban-board');
const columns = ['a_faire', 'en_cours', 'terminee'];
let activeColIdx = 0;

function updateMobileColumns() {
  if (window.innerWidth > 768) return;
  const colId = columns[activeColIdx];
  document.querySelectorAll('.board-column').forEach((col) => {
    col.classList.toggle('active', col.dataset.status === colId);
  });
}

if (kanbanBoard) {
  kanbanBoard.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  kanbanBoard.addEventListener('touchend', (e) => {
    if (window.innerWidth > 768) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    // Détection d'un swipe horizontal franc (diffX important, diffY mineur)
    if (Math.abs(diffX) > 80 && Math.abs(diffY) < 40) {
      if (diffX > 0 && activeColIdx > 0) {
        activeColIdx--; // Swipe Droite -> gauche
      } else if (diffX < 0 && activeColIdx < columns.length - 1) {
        activeColIdx++; // Swipe Gauche -> droite
      }
      updateMobileColumns();
    }
  });
}

// Pull to Refresh (Recharger les données en tirant vers le bas)
window.addEventListener('touchstart', (e) => {
  if (window.scrollY === 0) {
    touchStartY = e.touches[0].clientY;
    isPulling = true;
  }
});

window.addEventListener('touchmove', (e) => {
  if (!isPulling) return;
  const currentY = e.touches[0].clientY;
  const pullDistance = currentY - touchStartY;

  if (pullDistance > 0 && window.scrollY === 0) {
    e.preventDefault();
    if (pullDistance > pullThreshold) {
      document.body.style.transform = `translateY(${pullThreshold / 2}px)`;
    } else {
      document.body.style.transform = `translateY(${pullDistance / 2}px)`;
    }
  }
});

window.addEventListener('touchend', async () => {
  if (!isPulling) return;
  isPulling = false;
  const styleTransform = document.body.style.transform;
  document.body.style.transform = '';
  document.body.style.transition = 'transform 0.2s ease-out';

  if (styleTransform) {
    const match = styleTransform.match(/translateY\((\d+)px\)/);
    if (match && parseInt(match[1], 10) >= pullThreshold / 2) {
      showToast('Actualisation des données...');
      if (appRouter.currentView === 'dashboard') {
        await loadStats();
      } else if (appRouter.currentView === 'board') {
        await loadTasks();
      } else if (appRouter.currentView === 'calendar') {
        await renderCalendar();
      } else if (appRouter.currentView === 'shared') {
        await loadSharedWithMe();
      } else if (appRouter.currentView === 'feed') {
        await loadFeed();
      }
    }
  }
  setTimeout(() => {
    document.body.style.transition = '';
  }, 200);
});

// ================= HISTORIQUE AUDIT TÂCHE =================
async function loadTaskHistory(taskId) {
  const auditList = document.getElementById('task-audit-list');
  if (!auditList) return;
  auditList.innerHTML = '<li class="audit-empty-state">Chargement...</li>';

  try {
    const audits = await apiRequest(`/tasks/${taskId}/history`);
    auditList.innerHTML = '';
    
    if (audits.length === 0) {
      auditList.innerHTML = '<li class="audit-empty-state">Aucun historique de modification.</li>';
      return;
    }

    audits.forEach((aud) => {
      const li = document.createElement('li');
      li.className = 'audit-item';
      const time = new Date(aud.created_at).toLocaleString('fr-FR');
      let detailsText = '';

      if (aud.action === 'created') {
        detailsText = 'Tâche initialement créée';
      } else if (aud.action === 'updated') {
        const details = JSON.parse(aud.details || '{}');
        const changes = [];
        for (const [key, val] of Object.entries(details)) {
          changes.push(`${key} (${val.old || 'vide'} ➔ ${val.new || 'vide'})`);
        }
        detailsText = `Champs modifiés : ${changes.join(', ')}`;
      } else {
        detailsText = aud.action;
      }

      li.innerHTML = `<span class="audit-item-time">[${time}]</span> <strong>${escapeHtml(aud.user_name)}</strong> : ${escapeHtml(detailsText)}`;
      auditList.appendChild(li);
    });
  } catch (err) {
    auditList.innerHTML = `<li class="audit-empty-state error">Erreur : ${err.message}</li>`;
  }
}

// ================= THEME =================
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('taskflow_theme', theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(current);
}
applyTheme(localStorage.getItem('taskflow_theme') || 'light');
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-auth').addEventListener('click', toggleTheme);

// ================= TOASTS =================
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// ================= CONFIRM MODAL =================
function askConfirm(message) {
  return new Promise((resolve) => {
    confirmMessage.textContent = message;
    confirmModal.classList.remove('hidden');

    function cleanup(result) {
      confirmModal.classList.add('hidden');
      confirmOk.removeEventListener('click', onOk);
      confirmCancel.removeEventListener('click', onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }

    confirmOk.addEventListener('click', onOk);
    confirmCancel.addEventListener('click', onCancel);
  });
}

// ================= Onglets connexion / inscription =================
tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    tabBtns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    authForms.forEach((f) => f.classList.remove('active'));
    
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
  });
});

// ================= Helpers API =================
function refreshAccessToken() {
  if (!refreshToken) return Promise.resolve(false);
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) return false;
        const data = await res.json();
        token = data.token;
        refreshToken = data.refreshToken;
        localStorage.setItem('taskflow_token', token);
        localStorage.setItem('taskflow_refresh', refreshToken);
        return true;
      } catch {
        return false;
      }
    })().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function authFetch(path, options = {}, retried = false) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (res.status === 401 && !retried && refreshToken && !path.startsWith('/auth/')) {
    const ok = await refreshAccessToken();
    if (ok) return authFetch(path, options, true);
    forceLogout();
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Une erreur est survenue.');
  }
  return res;
}

async function apiRequest(path, options = {}) {
  const res = await authFetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  return res.json().catch(() => ({}));
}

// ================= Inscription =================
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('register-error');
  errorEl.textContent = '';
  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('register-name').value,
        email: document.getElementById('register-email').value,
        password: document.getElementById('register-password').value
      })
    });
    setSession(data.token, data.refreshToken, data.user);
    showToast(`Bienvenue, ${data.user.name} !`);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ================= Connexion =================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      })
    });
    setSession(data.token, data.refreshToken, data.user);
    showToast(`Content de te revoir, ${data.user.name} !`);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ================= Session =================
function setSession(newToken, newRefreshToken, user) {
  token = newToken;
  refreshToken = newRefreshToken;
  currentUser = user;
  localStorage.setItem('taskflow_token', token);
  localStorage.setItem('taskflow_refresh', refreshToken);
  localStorage.setItem('taskflow_user', JSON.stringify(user));
  showApp();
}

function clearSession() {
  token = null;
  refreshToken = null;
  currentUser = null;
  localStorage.removeItem('taskflow_token');
  localStorage.removeItem('taskflow_refresh');
  localStorage.removeItem('taskflow_user');
  disconnectNotifications();
}

function forceLogout() {
  clearSession();
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  showToast('Session expirée, reconnecte-toi.', 'error');
}

logoutBtn.addEventListener('click', async () => {
  const currentRefresh = refreshToken;
  clearSession();
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  loginForm.reset();
  registerForm.reset();
  if (currentRefresh) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefresh })
      });
    } catch { /* silencieux */ }
  }
});

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userNameEl.textContent = currentUser?.name || '';
  
  // Charger les espaces de travail
  loadWorkspaces();
  
  // Remplir l'avatar header
  const userAvatarPlaceholder = document.getElementById('user-avatar-placeholder');
  if (userAvatarPlaceholder) {
    userAvatarPlaceholder.innerHTML = '';
    const imgBadge = avatarBadge(currentUser.id, currentUser.name, true);
    userAvatarPlaceholder.appendChild(imgBadge);
  }

  // Lancer le flux de notifications SSE
  initNotifications();
  loadNotifications();
  
  // Demander permission notifications système
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Redirection sur Dashboard par défaut
  appRouter.navigate('dashboard');
}

// ================= Création de tâche =================
taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const priority = document.getElementById('task-priority').value;
  const tag = document.getElementById('task-tag').value;
  const due_date = document.getElementById('task-due-date').value || null;

  try {
    const body = { title, description, priority, tag, due_date };
    if (activeWorkspaceId) body.workspaceId = activeWorkspaceId;

    const created = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    taskForm.reset();
    document.getElementById('task-priority').value = 'moyenne';
    showToast('Tâche ajoutée.');
    allTasks.unshift(created);
    renderTasks();
    loadStats();
    loadReminders();
    loadTags();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ================= Recherche / filtres / tri =================
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadTasks, 300);
});
filterPriority.addEventListener('change', loadTasks);
filterTag.addEventListener('change', loadTasks);
sortSelect.addEventListener('change', loadTasks);
loadMoreBtn.addEventListener('click', loadMoreTasks);

// ================= Chargement des tâches =================
function taskQueryParams(offset) {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (filterPriority.value) params.set('priority', filterPriority.value);
  if (filterTag.value) params.set('tag', filterTag.value);
  if (sortSelect.value) params.set('sort', sortSelect.value);
  params.set('limit', PAGE_SIZE);
  params.set('offset', offset);
  if (activeWorkspaceId) params.set('workspaceId', activeWorkspaceId);
  return params;
}

async function loadTasks() {
  taskOffset = 0;
  try {
    const batch = await apiRequest(`/tasks?${taskQueryParams(0).toString()}`);
    allTasks = batch;
    hasMoreTasks = batch.length === PAGE_SIZE;
    selected.clear();
    renderTasks();
    updateLoadMore();
    loadStats();
    loadReminders();
    loadTags();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMoreTasks() {
  try {
    const batch = await apiRequest(`/tasks?${taskQueryParams(taskOffset + PAGE_SIZE).toString()}`);
    taskOffset += PAGE_SIZE;
    allTasks = allTasks.concat(batch);
    hasMoreTasks = batch.length === PAGE_SIZE;
    renderTasks();
    updateLoadMore();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function updateLoadMore() {
  loadMoreBtn.classList.toggle('hidden', !hasMoreTasks);
}

// ================= Tags (couleurs) =================
function tagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) % 360;
  return `hsl(${hash}, 55%, 45%)`;
}

function applyTagColor(el, tag) {
  if (!tag) return;
  const color = tagColor(tag);
  el.style.color = color;
  el.style.borderColor = color;
}

async function loadTags() {
  try {
    const tags = await apiRequest(`/tasks/tags${activeWorkspaceId ? `?workspaceId=${activeWorkspaceId}` : ''}`);
    const current = filterTag.value;
    filterTag.innerHTML = '<option value="">Tous les tags</option>';
    tags.forEach(({ tag, count }) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = `${tag} (${count})`;
      filterTag.appendChild(opt);
    });
    filterTag.value = tags.some((t) => t.tag === current) ? current : '';
  } catch {
    /* silencieux */
  }
}

// ================= Rappels d'échéance =================
async function loadReminders() {
  try {
    const data = await apiRequest('/tasks/reminders?days=3');
    renderReminders(data);
  } catch {
    /* silencieux */
  }
}

function renderReminders({ total, overdue, soon }) {
  const notifBadge = document.getElementById('notif-badge');
  if (total > 0) {
    notifBadge.textContent = total;
    notifBadge.classList.remove('hidden');
  } else {
    notifBadge.classList.add('hidden');
  }
  // L'affichage des rappels est intégré à l'affichage central des notifications
}

// ================= Édition d'une tâche =================
function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function openEdit(task) {
  editingTaskId = task.id;
  editTitle.value = task.title || '';
  editDescription.value = task.description || '';
  editPriority.value = task.priority || 'moyenne';
  editTag.value = task.tag || '';
  editDueDate.value = toDateInput(task.due_date);
  shareEmail.value = '';
  
  loadShares(task.id);
  loadTaskHistory(task.id); // Charger l'audit trail
  
  editModal.classList.remove('hidden');
  editTitle.focus();
}

async function loadShares(taskId) {
  shareList.innerHTML = '';
  try {
    const shares = await apiRequest(`/tasks/${taskId}/shares`);
    shares.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'share-item';
      const who = document.createElement('span');
      who.textContent = `${s.name} (${s.email})`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'share-remove';
      rm.textContent = '✕';
      rm.addEventListener('click', async () => {
        try {
          await apiRequest(`/tasks/${taskId}/shares/${s.user_id}`, { method: 'DELETE' });
          loadShares(taskId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      li.append(who, rm);
      shareList.appendChild(li);
    });
  } catch {
    /* silencieux */
  }
}

shareBtn.addEventListener('click', async () => {
  const email = shareEmail.value.trim();
  if (!email || !editingTaskId) return;
  try {
    await apiRequest(`/tasks/${editingTaskId}/shares`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
    shareEmail.value = '';
    showToast('Tâche partagée.');
    loadShares(editingTaskId);
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// ---- Liste partagées avec moi ----
async function loadSharedWithMe() {
  const sharedListEl = document.getElementById('shared-list');
  if (!sharedListEl) return;
  sharedListEl.innerHTML = '<p class="notif-empty">Chargement…</p>';
  try {
    const tasks = await apiRequest('/tasks/shared');
    sharedListEl.innerHTML = '';
    if (tasks.length === 0) {
      sharedListEl.innerHTML = '<p class="notif-empty">Aucune tâche partagée avec toi.</p>';
      return;
    }
    const STATUS_LABELS = { a_faire: 'À faire', en_cours: 'En cours', terminee: 'Terminée' };
    tasks.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'shared-item';
      const title = document.createElement('div');
      title.className = 'shared-title';
      title.textContent = t.title;
      const meta = document.createElement('div');
      meta.className = 'shared-meta';
      meta.textContent = `${STATUS_LABELS[t.status] || t.status} · par ${t.owner_name}`;
      row.append(title, meta);
      if (t.description) {
        const desc = document.createElement('div');
        desc.className = 'shared-desc';
        desc.textContent = t.description;
        row.appendChild(desc);
      }
      sharedListEl.appendChild(row);
    });
  } catch (err) {
    sharedListEl.innerHTML = `<p class="notif-empty">${err.message}</p>`;
  }
}

function closeEdit() {
  editModal.classList.add('hidden');
  editingTaskId = null;
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = allTasks.find((t) => t.id === editingTaskId);
  if (!task) return closeEdit();

  const payload = {
    title: editTitle.value.trim(),
    description: editDescription.value.trim() || null,
    priority: editPriority.value,
    tag: editTag.value.trim() || null,
    due_date: editDueDate.value || null
  };

  try {
    const updated = await apiRequest(`/tasks/${editingTaskId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    Object.assign(task, updated);
    closeEdit();
    showToast('Tâche mise à jour.');
    renderTasks();
    loadStats();
    loadReminders();
    loadTags();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

editCancel.addEventListener('click', closeEdit);
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEdit();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.classList.contains('hidden')) closeEdit();
});

// ================= Statistiques (API) =================
async function loadStats() {
  try {
    const stats = await apiRequest(`/tasks/stats${activeWorkspaceId ? `?workspaceId=${activeWorkspaceId}` : ''}`);
    
    // Remplir statistiques globales
    const elTotal = document.getElementById('stat-total');
    if (elTotal) elTotal.textContent = stats.total;
    const elCompletion = document.getElementById('stat-completion');
    if (elCompletion) elCompletion.textContent = `${stats.taux_completion}%`;
    const elLateBoard = document.getElementById('stat-late-board');
    if (elLateBoard) elLateBoard.textContent = stats.en_retard;
    const elProgress = document.getElementById('progress-fill');
    if (elProgress) elProgress.style.width = `${stats.taux_completion}%`;

    // Vues Dashboard widgets
    const dashTotal = document.getElementById('dash-total');
    if (dashTotal) dashTotal.textContent = stats.total;
    const dashCompletion = document.getElementById('dash-completion');
    if (dashCompletion) dashCompletion.textContent = `${stats.taux_completion}%`;
    const dashLate = document.getElementById('dash-late');
    if (dashLate) dashLate.textContent = stats.en_retard;
    const dashActive = document.getElementById('dash-active');
    if (dashActive) dashActive.textContent = stats.en_cours;

    // Rendre le Donut chart du dashboard
    renderDonutChart(stats);
  } catch {
    /* silencieux */
  }
}

// ================= Rendu des colonnes Kanban =================
function renderTasks() {
  const colStatus = { a_faire: [], en_cours: [], terminee: [] };
  allTasks.forEach((t) => colStatus[t.status]?.push(t));

  Object.keys(colStatus).forEach((status) => {
    const list = document.getElementById(`list-${status}`);
    const count = document.getElementById(`count-${status}`);
    if (!list || !count) return;

    list.innerHTML = '';
    count.textContent = colStatus[status].length;

    if (colStatus[status].length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Aucune tâche ici.';
      list.appendChild(empty);
    } else {
      colStatus[status].forEach((task) => list.appendChild(buildTaskCard(task)));
    }
  });

  updateMobileColumns();
  updateBulkBar();
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'terminee') return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

function buildTaskCard(task) {
  const node = taskCardTemplate.content.cloneNode(true);
  const card = node.querySelector('.task-card');
  card.dataset.taskId = task.id;

  if (isOverdue(task)) card.classList.add('overdue');
  if (selected.has(task.id)) card.classList.add('selected');

  const checkbox = node.querySelector('.task-select');
  checkbox.checked = selected.has(task.id);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) selected.add(task.id);
    else selected.delete(task.id);
    card.classList.toggle('selected', checkbox.checked);
    updateBulkBar();
  });

  node.querySelector('.priority-dot').classList.add(task.priority);
  node.querySelector('.task-title').textContent = task.title;

  const descEl = node.querySelector('.task-description');
  if (task.description) {
    descEl.textContent = task.description;
  } else {
    descEl.remove();
  }

  const tagEl = node.querySelector('.task-tag');
  if (task.tag) {
    tagEl.textContent = task.tag;
    applyTagColor(tagEl, task.tag);
  } else {
    tagEl.textContent = '';
  }

  const dueEl = node.querySelector('.task-due');
  dueEl.textContent = task.due_date
    ? `Échéance : ${new Date(task.due_date).toLocaleDateString('fr-FR')}`
    : '';

  const statusSelect = node.querySelector('.task-status-select');
  statusSelect.value = task.status;
  statusSelect.addEventListener('change', () => updateTaskStatus(task.id, statusSelect.value));

  node.querySelector('.task-edit').addEventListener('click', () => openEdit(task));

  node.querySelector('.task-delete').addEventListener('click', async () => {
    const ok = await askConfirm('Supprimer définitivement cette tâche ?');
    if (!ok) return;
    try {
      await apiRequest(`/tasks/${task.id}`, { method: 'DELETE' });
      showToast('Tâche supprimée.');
      allTasks = allTasks.filter((t) => t.id !== task.id);
      selected.delete(task.id);
      renderTasks();
      loadStats();
      loadReminders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  card.addEventListener('dragstart', () => {
    draggedTaskId = task.id;
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedTaskId = null;
  });

  wireSubtasks(node, task);
  wireAttachments(node, task);
  wireReactions(node, task);
  wireComments(node, task);

  return card;
}

// ================= Utilitaires sociaux =================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderMentions(text) {
  return escapeHtml(text).replace(/(^|\s)@([a-zA-Z0-9_\-]+)/gu, '$1<span class="mention">@$2</span>');
}

function avatarUrl(userId) {
  return `${API_BASE}/users/${userId}/avatar`;
}

function avatarBadge(userId, name, hasAvatar) {
  const span = document.createElement('span');
  span.className = 'avatar';
  if (hasAvatar) {
    const img = document.createElement('img');
    img.src = avatarUrl(userId);
    img.alt = name || '';
    img.onerror = () => {
      img.remove();
      span.textContent = (name || '?').charAt(0).toUpperCase();
    };
    span.appendChild(img);
  } else {
    span.textContent = (name || '?').charAt(0).toUpperCase();
  }
  return span;
}

// ================= Réactions =================
function wireReactions(node, task) {
  const wrap = node.querySelector('.reactions');
  task.reactions = task.reactions || [];
  task.my_reactions = task.my_reactions || [];

  function render() {
    wrap.innerHTML = '';
    REACTION_EMOJIS.forEach((emoji) => {
      const found = task.reactions.find((r) => r.emoji === emoji);
      const count = found ? found.count : 0;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'reaction-btn';
      if (task.my_reactions.includes(emoji)) btn.classList.add('mine');
      btn.innerHTML = `${emoji}<span class="reaction-count">${count || ''}</span>`;
      btn.addEventListener('click', async () => {
        try {
          const summary = await apiRequest(`/tasks/${task.id}/reactions`, {
            method: 'POST',
            body: JSON.stringify({ emoji })
          });
          task.reactions = summary.counts;
          task.my_reactions = summary.mine;
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      wrap.appendChild(btn);
    });
  }
  render();
}

// ================= Commentaires =================
function wireComments(node, task) {
  task.comments_count = task.comments_count || 0;

  const wrap = node.querySelector('.comments');
  const toggleBtn = wrap.querySelector('.comments-toggle');
  const caret = wrap.querySelector('.comments-caret');
  const countEl = wrap.querySelector('.comments-count');
  const body = wrap.querySelector('.comments-body');
  const listEl = wrap.querySelector('.comments-list');
  const form = wrap.querySelector('.comment-form');
  const input = wrap.querySelector('.comment-input');
  let loaded = false;

  function renderCount() {
    countEl.textContent = task.comments_count > 0 ? task.comments_count : '';
  }
  renderCount();

  function addRow(c) {
    const item = commentItemTemplate.content.cloneNode(true);
    const li = item.querySelector('.comment-item');
    const author = item.querySelector('.comment-author');
    author.textContent = c.user_name;
    author.classList.add('clickable-user');
    author.addEventListener('click', () => openUserProfile(c.user_id));
    item.querySelector('.comment-body').innerHTML = renderMentions(c.body);

    const del = item.querySelector('.comment-delete');
    if (c.user_id === currentUser?.id || task.user_id === currentUser?.id) {
      del.addEventListener('click', async () => {
        try {
          await apiRequest(`/tasks/${task.id}/comments/${c.id}`, { method: 'DELETE' });
          li.remove();
          task.comments_count = Math.max(0, task.comments_count - 1);
          renderCount();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } else {
      del.remove();
    }
    listEl.appendChild(li);
  }

  async function loadComments() {
    try {
      const items = await apiRequest(`/tasks/${task.id}/comments`);
      listEl.innerHTML = '';
      items.forEach(addRow);
      loaded = true;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  toggleBtn.addEventListener('click', async () => {
    const willOpen = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willOpen);
    caret.textContent = willOpen ? '▾' : '▸';
    if (willOpen && !loaded) await loadComments();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    try {
      const created = await apiRequest(`/tasks/${task.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body: value })
      });
      input.value = '';
      if (loaded) addRow(created);
      task.comments_count += 1;
      renderCount();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ================= Pièces jointes =================
function wireAttachments(node, task) {
  task.attachments_count = task.attachments_count || 0;

  const wrap = node.querySelector('.attachments');
  const toggleBtn = wrap.querySelector('.attachments-toggle');
  const caret = wrap.querySelector('.attachments-caret');
  const countEl = wrap.querySelector('.attachments-count');
  const body = wrap.querySelector('.attachments-body');
  const listEl = wrap.querySelector('.attachments-list');
  const input = wrap.querySelector('.attachment-input');
  let loaded = false;

  function renderCount() {
    countEl.textContent = task.attachments_count > 0 ? task.attachments_count : '';
  }
  renderCount();

  function addRow(att) {
    const item = attachmentItemTemplate.content.cloneNode(true);
    const li = item.querySelector('.attachment-item');
    const dl = item.querySelector('.attachment-download');
    dl.textContent = att.original_name;
    item.querySelector('.attachment-size').textContent = formatSize(att.size);

    dl.addEventListener('click', async () => {
      try {
        const res = await authFetch(`/tasks/${task.id}/attachments/${att.id}/download`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.original_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    item.querySelector('.attachment-delete').addEventListener('click', async () => {
      try {
        await apiRequest(`/tasks/${task.id}/attachments/${att.id}`, { method: 'DELETE' });
        li.remove();
        task.attachments_count = Math.max(0, task.attachments_count - 1);
        renderCount();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    listEl.appendChild(li);
  }

  async function loadAttachments() {
    try {
      const items = await apiRequest(`/tasks/${task.id}/attachments`);
      listEl.innerHTML = '';
      items.forEach(addRow);
      loaded = true;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  toggleBtn.addEventListener('click', async () => {
    const willOpen = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willOpen);
    caret.textContent = willOpen ? '▾' : '▸';
    if (willOpen && !loaded) await loadAttachments();
  });

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await authFetch(`/tasks/${task.id}/attachments`, { method: 'POST', body: fd });
      const created = await res.json();
      if (loaded) addRow(created);
      task.attachments_count += 1;
      renderCount();
      showToast('Fichier ajouté.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      input.value = '';
    }
  });
}

// ================= Sous-tâches =================
function wireSubtasks(node, task) {
  task.subtasks_total = task.subtasks_total || 0;
  task.subtasks_done = task.subtasks_done || 0;

  const wrap = node.querySelector('.subtasks');
  const toggleBtn = wrap.querySelector('.subtasks-toggle');
  const caret = wrap.querySelector('.subtasks-caret');
  const progressEl = wrap.querySelector('.subtasks-progress');
  const body = wrap.querySelector('.subtasks-body');
  const listEl = wrap.querySelector('.subtasks-list');
  const form = wrap.querySelector('.subtask-form');
  const input = wrap.querySelector('.subtask-input');
  let loaded = false;

  function renderProgress() {
    if (task.subtasks_total > 0) {
      progressEl.textContent = `${task.subtasks_done}/${task.subtasks_total}`;
      progressEl.classList.toggle('complete', task.subtasks_done === task.subtasks_total);
    } else {
      progressEl.textContent = '';
      progressEl.classList.remove('complete');
    }
  }
  renderProgress();

  function addSubtaskRow(sub) {
    const item = subtaskItemTemplate.content.cloneNode(true);
    const li = item.querySelector('.subtask-item');
    const check = item.querySelector('.subtask-check');
    check.checked = !!sub.done;
    li.classList.toggle('done', !!sub.done);
    item.querySelector('.subtask-title').textContent = sub.title;

    check.addEventListener('change', async () => {
      const desired = check.checked;
      li.classList.toggle('done', desired);
      task.subtasks_done += desired ? 1 : -1;
      renderProgress();
      try {
        await apiRequest(`/tasks/${task.id}/subtasks/${sub.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ done: desired })
        });
        sub.done = desired ? 1 : 0;
      } catch (err) {
        check.checked = !desired;
        li.classList.toggle('done', !desired);
        task.subtasks_done += desired ? -1 : 1;
        renderProgress();
        showToast(err.message, 'error');
      }
    });

    item.querySelector('.subtask-delete').addEventListener('click', async () => {
      try {
        await apiRequest(`/tasks/${task.id}/subtasks/${sub.id}`, { method: 'DELETE' });
        li.remove();
        task.subtasks_total -= 1;
        if (sub.done) task.subtasks_done -= 1;
        renderProgress();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    listEl.appendChild(li);
  }

  async function loadSubtasks() {
    try {
      const subs = await apiRequest(`/tasks/${task.id}/subtasks`);
      listEl.innerHTML = '';
      subs.forEach(addSubtaskRow);
      loaded = true;
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  toggleBtn.addEventListener('click', async () => {
    const willOpen = body.classList.contains('hidden');
    body.classList.toggle('hidden', !willOpen);
    caret.textContent = willOpen ? '▾' : '▸';
    if (willOpen && !loaded) await loadSubtasks();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    try {
      const created = await apiRequest(`/tasks/${task.id}/subtasks`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });
      input.value = '';
      addSubtaskRow(created);
      task.subtasks_total += 1;
      renderProgress();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// Mise à jour optimiste statut
async function updateTaskStatus(taskId, status) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task || task.status === status) return;

  const previousStatus = task.status;
  task.status = status;
  renderTasks();

  try {
    await apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    loadStats();
    loadReminders();
  } catch (err) {
    task.status = previousStatus;
    renderTasks();
    showToast(err.message, 'error');
  }
}

// ================= Actions groupées (bulk) =================
function updateBulkBar() {
  if (selected.size === 0) {
    bulkBar.classList.add('hidden');
    return;
  }
  bulkBar.classList.remove('hidden');
  bulkCount.textContent = selected.size;
}

async function runBulk(action, value) {
  const ids = [...selected];
  if (ids.length === 0) return;

  try {
    await apiRequest('/tasks/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ ids, action, value })
    });

    if (action === 'delete') {
      allTasks = allTasks.filter((t) => !selected.has(t.id));
      showToast(`${ids.length} tâche(s) supprimée(s).`);
    } else if (action === 'status') {
      allTasks.forEach((t) => { if (selected.has(t.id)) t.status = value; });
      showToast(`${ids.length} tâche(s) déplacée(s).`);
    }
    selected.clear();
    renderTasks();
    loadStats();
    loadReminders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

bulkStatus.addEventListener('change', () => {
  if (bulkStatus.value) {
    runBulk('status', bulkStatus.value);
    bulkStatus.value = '';
  }
});

bulkDelete.addEventListener('click', async () => {
  const ok = await askConfirm(`Supprimer ${selected.size} tâche(s) sélectionnée(s) ?`);
  if (ok) runBulk('delete');
});

bulkClear.addEventListener('click', () => {
  selected.clear();
  renderTasks();
});

// ================= Export / Import =================
async function exportTasksData(format) {
  try {
    const res = await authFetch(`/tasks/export?format=${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow_${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Export ${format.toUpperCase()} téléchargé.`);
  } catch (err) {
    showToast(err.message, 'error');
  }
}
exportJsonBtn.addEventListener('click', () => exportTasksData('json'));
exportCsvBtn.addEventListener('click', () => exportTasksData('csv'));

importBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const tasks = Array.isArray(parsed) ? parsed : parsed.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Fichier JSON invalide (aucune tâche trouvée).');
    }
    const result = await apiRequest('/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ tasks })
    });
    showToast(`${result.imported} tâche(s) importée(s).`);
    loadTasks();
  } catch (err) {
    const msg = err instanceof SyntaxError ? 'Fichier JSON illisible.' : err.message;
    showToast(msg, 'error');
  } finally {
    importFile.value = '';
  }
});

// Drag and drop events
document.querySelectorAll('.task-list').forEach((list) => {
  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    list.classList.add('drag-over');
  });
  list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
  list.addEventListener('drop', (e) => {
    e.preventDefault();
    list.classList.remove('drag-over');
    const newStatus = list.closest('.board-column').dataset.status;
    if (draggedTaskId) updateTaskStatus(draggedTaskId, newStatus);
  });
});

// ================= Profil =================
const profileModal = document.getElementById('profile-modal');
const profileClose = document.getElementById('profile-close');
const publicProfileContent = document.getElementById('public-profile-content');

function closeProfile() { profileModal.classList.add('hidden'); }

async function renderProfile(userId) {
  const profileViewContent = document.getElementById('profile-content');
  if (!profileViewContent) return;
  profileViewContent.innerHTML = '<p class="notif-empty">Chargement…</p>';

  try {
    const p = await apiRequest(`/users/${userId}`);
    
    // Header & stats
    const html = `
      <div class="profile-modal-body">
        <div class="profile-header-view">
          <div class="avatar-large" id="profile-avatar-badge-target"></div>
          <div class="profile-details">
            <h2>${escapeHtml(p.name)}</h2>
            <div class="profile-counters">
              <span><strong>${p.completed}</strong> terminées</span>
              <span><strong>${p.followers}</strong> abonnés</span>
              <span><strong>${p.following}</strong> abonnements</span>
            </div>
          </div>
        </div>
        
        <div class="profile-bio-text">
          <strong>Bio :</strong> <p>${escapeHtml(p.bio || 'Aucune bio pour l\'instant.')}</p>
        </div>
        
        <div id="profile-action-area"></div>
      </div>
    `;
    profileViewContent.innerHTML = html;

    // Remplir l'avatar
    const badgeTarget = document.getElementById('profile-avatar-badge-target');
    if (badgeTarget) {
      badgeTarget.appendChild(avatarBadge(p.id, p.name, p.has_avatar));
    }

    const actionArea = document.getElementById('profile-action-area');
    if (p.is_me) {
      // Formulaire modif
      const formEl = document.createElement('form');
      formEl.className = 'edit-form profile-edit';
      formEl.innerHTML = `
        <div class="input-group">
          <label for="profile-name-input">Nom d'affichage</label>
          <input type="text" id="profile-name-input" maxlength="100" required>
        </div>
        <div class="input-group">
          <label for="profile-bio-input">Biographie (Max 500 caract.)</label>
          <textarea id="profile-bio-input" rows="3" maxlength="500"></textarea>
        </div>
        <div class="avatar-upload-wrap">
          <label for="profile-avatar-input">📷 Changer d'avatar</label>
          <input type="file" id="profile-avatar-input" accept="image/*" style="display:none;">
          <span id="avatar-file-name" style="font-size:12px;color:var(--ink-soft);"></span>
        </div>
        <button type="submit" class="btn-primary">Mettre à jour le profil</button>
      `;
      formEl.querySelector('#profile-name-input').value = p.name;
      formEl.querySelector('#profile-bio-input').value = p.bio || '';
      
      const fileInput = formEl.querySelector('#profile-avatar-input');
      const fileNameEl = formEl.querySelector('#avatar-file-name');
      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
          fileNameEl.textContent = fileInput.files[0].name;
        }
      });

      formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await apiRequest('/users/me', {
            method: 'PUT',
            body: JSON.stringify({
              name: formEl.querySelector('#profile-name-input').value.trim(),
              bio: formEl.querySelector('#profile-bio-input').value.trim() || null
            })
          });
          
          let file = fileInput.files[0];
          if (file) {
            // COMPRESSION WebP client-side !
            try {
              const compressed = await compressImageToWebp(file);
              file = compressed;
            } catch (cErr) {
              console.error('Erreur compression image, upload standard fallback :', cErr);
            }

            const fd = new FormData();
            fd.append('avatar', file);
            await authFetch('/users/me/avatar', { method: 'POST', body: fd });
          }
          
          showToast('Profil enregistré.');
          
          // Mettre à jour l'en-tête utilisateur global
          currentUser.name = formEl.querySelector('#profile-name-input').value.trim();
          localStorage.setItem('taskflow_user', JSON.stringify(currentUser));
          userNameEl.textContent = currentUser.name;
          
          renderProfile(userId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      actionArea.appendChild(formEl);
    } else {
      // Suivre / Ne plus suivre
      const btn = document.createElement('button');
      btn.className = p.is_following ? 'btn-ghost' : 'btn-primary';
      btn.textContent = p.is_following ? 'Ne plus suivre' : 'Suivre';
      btn.addEventListener('click', async () => {
        try {
          await apiRequest(`/users/${p.id}/follow`, { method: p.is_following ? 'DELETE' : 'POST' });
          renderProfile(userId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      actionArea.appendChild(btn);
    }
  } catch (err) {
    profileViewContent.innerHTML = `<p class="notif-empty">${err.message}</p>`;
  }
}

// Ouvrir profil public d'un collaborateur (dans modale dédiée)
async function openUserProfile(userId) {
  publicProfileContent.innerHTML = '<p class="notif-empty">Chargement…</p>';
  profileModal.classList.remove('hidden');
  try {
    const p = await apiRequest(`/users/${userId}`);
    publicProfileContent.innerHTML = `
      <div class="profile-modal-body">
        <div class="profile-header-view">
          <div class="avatar-large" id="public-avatar-badge-target"></div>
          <div class="profile-details">
            <h2>${escapeHtml(p.name)}</h2>
            <div class="profile-counters">
              <span><strong>${p.completed}</strong> terminées</span>
              <span><strong>${p.followers}</strong> abonnés</span>
              <span><strong>${p.following}</strong> abonnements</span>
            </div>
          </div>
        </div>
        
        <div class="profile-bio-text">
          <strong>Bio :</strong> <p>${escapeHtml(p.bio || 'Aucune bio rédigée.')}</p>
        </div>
        
        <div id="public-action-btn-area"></div>
      </div>
    `;
    
    document.getElementById('public-avatar-badge-target').appendChild(avatarBadge(p.id, p.name, p.has_avatar));
    
    const btnArea = document.getElementById('public-action-btn-area');
    if (!p.is_me) {
      const btn = document.createElement('button');
      btn.className = p.is_following ? 'btn-ghost' : 'btn-primary';
      btn.textContent = p.is_following ? 'Ne plus suivre' : 'Suivre';
      btn.addEventListener('click', async () => {
        try {
          await apiRequest(`/users/${p.id}/follow`, { method: p.is_following ? 'DELETE' : 'POST' });
          openUserProfile(userId);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      btnArea.appendChild(btn);
    }
  } catch (err) {
    publicProfileContent.innerHTML = `<p class="notif-empty">${err.message}</p>`;
  }
}

if (profileClose) profileClose.addEventListener('click', closeProfile);
if (profileModal) {
  profileModal.addEventListener('click', (e) => {
    if (e.target === profileModal) closeProfile();
  });
}

// ================= Fil d'actualité =================
async function loadFeed() {
  const feedListEl = document.getElementById('feed-list');
  if (!feedListEl) return;
  feedListEl.innerHTML = '<p class="notif-empty">Chargement…</p>';

  try {
    const items = await apiRequest('/users/feed');
    feedListEl.innerHTML = '';
    
    if (items.length === 0) {
      feedListEl.innerHTML = '<p class="notif-empty">Aucune actualité pour l\'instant. Suivez d\'autres utilisateurs.</p>';
      return;
    }

    items.forEach((a) => {
      const row = document.createElement('div');
      row.className = 'feed-item';
      
      const badge = avatarBadge(a.user_id, a.user_name, a.has_avatar);
      const text = document.createElement('div');
      text.className = 'feed-text';
      
      const who = document.createElement('span');
      who.className = 'clickable-user';
      who.textContent = a.user_name;
      who.addEventListener('click', () => openUserProfile(a.user_id));
      
      text.append(who, document.createTextNode(' ' + activityText(a)));
      
      const time = document.createElement('div');
      time.className = 'feed-time';
      time.textContent = new Date(a.created_at).toLocaleString('fr-FR');
      
      const col = document.createElement('div');
      col.appendChild(text);
      col.appendChild(time);
      row.append(badge, col);
      
      feedListEl.appendChild(row);
    });
  } catch (err) {
    feedListEl.innerHTML = `<p class="notif-empty">${err.message}</p>`;
  }
}

function activityText(a) {
  if (a.type === 'completed') return `a terminé « ${a.task_title || 'une tâche'} »`;
  if (a.type === 'created') return `a créé « ${a.task_title || 'une tâche'} »`;
  if (a.type === 'commented') return `a commenté « ${a.task_title || 'une tâche'} »`;
  return a.type;
}

// ================= INSTALLATION DE LA PWA (PROMPT) =================
let deferredPrompt = null;
const pwaBanner = document.getElementById('pwa-install-banner');
const pwaBtnInstall = document.getElementById('pwa-btn-install');
const pwaBtnDismiss = document.getElementById('pwa-btn-dismiss');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // Afficher la bannière si l'utilisateur ne l'a pas déjà refusée
  if (localStorage.getItem('pwa_dismissed') !== 'true') {
    pwaBanner.classList.remove('hidden');
  }
});

if (pwaBtnInstall) {
  pwaBtnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    pwaBanner.classList.add('hidden');
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      showToast('Merci d\'avoir installé TaskFlow Pro ! 🎉');
    }
    deferredPrompt = null;
  });
}

if (pwaBtnDismiss) {
  pwaBtnDismiss.addEventListener('click', () => {
    pwaBanner.classList.add('hidden');
    localStorage.setItem('pwa_dismissed', 'true');
  });
}

// ================= VUE CALENDRIER MENSUEL LOGIQUE =================
let calendarCurrentDate = new Date();
let calendarSelectedDate = new Date();

function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const gridEl = document.getElementById('calendar-grid');
  if (!monthYearEl || !gridEl) return;

  gridEl.innerHTML = '';

  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();

  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];
  monthYearEl.textContent = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  // Jours du mois précédent pour combler
  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNum = prevTotalDays - i;
    const cellDate = new Date(year, month - 1, dayNum);
    gridEl.appendChild(createCalendarDayCell(cellDate, true));
  }

  // Jours du mois en cours
  for (let i = 1; i <= totalDays; i++) {
    const cellDate = new Date(year, month, i);
    gridEl.appendChild(createCalendarDayCell(cellDate, false));
  }

  // Jours du mois suivant pour combler
  const totalCellsCreated = startOffset + totalDays;
  const remainingCells = 42 - totalCellsCreated;
  for (let i = 1; i <= remainingCells; i++) {
    const cellDate = new Date(year, month + 1, i);
    gridEl.appendChild(createCalendarDayCell(cellDate, true));
  }

  renderCalendarMobileDetails();
}

function createCalendarDayCell(date, isOutside) {
  const cell = document.createElement('div');
  cell.className = 'calendar-day';
  if (isOutside) cell.classList.add('outside');

  const dateStr = date.toISOString().slice(0, 10);
  const todayStr = new Date().toISOString().slice(0, 10);
  const selectedStr = calendarSelectedDate.toISOString().slice(0, 10);

  if (dateStr === todayStr) cell.classList.add('today');
  if (dateStr === selectedStr) cell.classList.add('selected');

  cell.dataset.date = dateStr;

  const header = document.createElement('div');
  header.className = 'day-header';

  const numSpan = document.createElement('span');
  numSpan.className = 'day-number';
  numSpan.textContent = date.getDate();
  header.appendChild(numSpan);

  if (!isOutside && navigator.onLine) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn-day-add';
    addBtn.textContent = '＋';
    addBtn.title = 'Ajouter une tâche à cette date';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      appRouter.navigate('board');
      setTimeout(() => {
        const dueInp = document.getElementById('task-due-date');
        const titleInp = document.getElementById('task-title');
        if (dueInp) dueInp.value = dateStr;
        if (titleInp) titleInp.focus();
      }, 100);
    });
    header.appendChild(addBtn);
  }
  cell.appendChild(header);

  // Filtrer les tâches correspondantes
  const dayTasks = allTasks.filter((t) => {
    if (!t.due_date) return false;
    const dStr = new Date(t.due_date).toISOString().slice(0, 10);
    return dStr === dateStr;
  });

  const eventsWrap = document.createElement('div');
  eventsWrap.className = 'calendar-events-wrap';

  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'day-dots';

  dayTasks.forEach((task) => {
    // Événement texte pour écran large
    const ev = document.createElement('div');
    ev.className = `calendar-event ${task.status === 'terminee' ? 'terminee' : task.priority}`;
    ev.textContent = task.title;
    ev.title = task.title;
    ev.addEventListener('click', (e) => {
      e.stopPropagation();
      openEdit(task);
    });
    eventsWrap.appendChild(ev);

    // Indicateur dot pour mobile
    const dot = document.createElement('span');
    dot.className = `day-dot ${task.status === 'terminee' ? 'terminee' : task.priority}`;
    dotsWrap.appendChild(dot);
  });

  cell.appendChild(eventsWrap);
  cell.appendChild(dotsWrap);

  cell.addEventListener('click', () => {
    document.querySelectorAll('.calendar-day').forEach((c) => c.classList.remove('selected'));
    cell.classList.add('selected');
    calendarSelectedDate = new Date(date);
    renderCalendarMobileDetails();
  });

  return cell;
}

function renderCalendarMobileDetails() {
  const labelEl = document.getElementById('calendar-selected-date-label');
  const listEl = document.getElementById('calendar-selected-tasks-list');
  const detailsPanel = document.getElementById('calendar-mobile-details');
  if (!labelEl || !listEl || !detailsPanel) return;

  const selectedStr = calendarSelectedDate.toISOString().slice(0, 10);
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  labelEl.textContent = `Tâches du ${calendarSelectedDate.toLocaleDateString('fr-FR', options)}`;

  const dayTasks = allTasks.filter((t) => {
    if (!t.due_date) return false;
    const dStr = new Date(t.due_date).toISOString().slice(0, 10);
    return dStr === selectedStr;
  });

  listEl.innerHTML = '';
  detailsPanel.classList.remove('hidden');

  if (dayTasks.length === 0) {
    listEl.innerHTML = '<p class="notif-empty" style="font-size:12px;text-align:left;margin:10px 0;">Aucune échéance ce jour. 🎉</p>';
    return;
  }

  dayTasks.forEach((task) => {
    const card = document.createElement('div');
    card.className = 'mobile-task-detail-card';

    const left = document.createElement('div');
    left.className = 'mobile-task-detail-left';

    const dot = document.createElement('span');
    dot.className = `priority-dot ${task.priority}`;
    if (task.status === 'terminee') dot.className = 'priority-dot terminee';

    const title = document.createElement('span');
    title.className = 'mobile-task-detail-title';
    title.textContent = task.title;

    left.append(dot, title);
    card.appendChild(left);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-icon-circle';
    editBtn.textContent = '✎';
    editBtn.title = 'Modifier la tâche';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEdit(task);
    });
    card.appendChild(editBtn);

    card.addEventListener('click', () => {
      openEdit(task);
    });

    listEl.appendChild(card);
  });
}

// Branchements événements calendrier
const calPrevBtn = document.getElementById('calendar-prev-btn');
const calNextBtn = document.getElementById('calendar-next-btn');
const calTodayBtn = document.getElementById('calendar-today-btn');
const calMobileAddBtn = document.getElementById('calendar-mobile-add-btn');

if (calPrevBtn) {
  calPrevBtn.addEventListener('click', () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
    renderCalendar();
  });
}
if (calNextBtn) {
  calNextBtn.addEventListener('click', () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
    renderCalendar();
  });
}
if (calTodayBtn) {
  calTodayBtn.addEventListener('click', () => {
    calendarCurrentDate = new Date();
    calendarSelectedDate = new Date();
    renderCalendar();
  });
}
if (calMobileAddBtn) {
  calMobileAddBtn.addEventListener('click', () => {
    const selectedStr = calendarSelectedDate.toISOString().slice(0, 10);
    appRouter.navigate('board');
    setTimeout(() => {
      const dueInp = document.getElementById('task-due-date');
      const titleInp = document.getElementById('task-title');
      if (dueInp) dueInp.value = selectedStr;
      if (titleInp) titleInp.focus();
    }, 100);
  });
}

// Swipe horizontal calendrier mobile
const calGrid = document.getElementById('calendar-grid');
if (calGrid) {
  calGrid.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  calGrid.addEventListener('touchend', (e) => {
    if (window.innerWidth > 768) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > 80 && Math.abs(diffY) < 40) {
      if (diffX > 0) {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
      } else {
        calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
      }
      renderCalendar();
    }
  });
}

// ================= ESPACES DE TRAVAIL & MEMBRES LOGIQUE =================

async function loadWorkspaces() {
  const selector = document.getElementById('workspace-selector');
  if (!selector) return;

  try {
    const workspaces = await apiRequest('/workspaces');
    selector.innerHTML = `
      <option value="personal">🔒 Tâches personnelles</option>
    `;

    workspaces.forEach((w) => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = `💼 ${w.name}`;
      selector.appendChild(opt);
    });

    const optCreate = document.createElement('option');
    optCreate.value = 'create';
    optCreate.textContent = '➕ Créer un espace...';
    selector.appendChild(optCreate);

    if (activeWorkspaceId) {
      selector.value = activeWorkspaceId;
      const teamTab = document.getElementById('nav-item-members');
      if (teamTab) teamTab.classList.remove('hidden');
    } else {
      selector.value = 'personal';
      const teamTab = document.getElementById('nav-item-members');
      if (teamTab) teamTab.classList.add('hidden');
    }
  } catch {
    /* Silencieux en mode hors-ligne */
  }
}

const wsSelector = document.getElementById('workspace-selector');
if (wsSelector) {
  wsSelector.addEventListener('change', async (e) => {
    const val = e.target.value;
    if (val === 'create') {
      wsSelector.value = activeWorkspaceId || 'personal';
      openWorkspaceModal();
    } else if (val === 'personal') {
      activeWorkspaceId = null;
      localStorage.removeItem('taskflow_workspace_id');
      const teamTab = document.getElementById('nav-item-members');
      if (teamTab) teamTab.classList.add('hidden');
      if (appRouter.currentView === 'members') {
        appRouter.navigate('dashboard');
      }
      loadTasks();
    } else {
      activeWorkspaceId = parseInt(val, 10);
      localStorage.setItem('taskflow_workspace_id', activeWorkspaceId);
      const teamTab = document.getElementById('nav-item-members');
      if (teamTab) teamTab.classList.remove('hidden');
      loadTasks();
    }
  });
}

const wsModal = document.getElementById('workspace-modal');
const wsForm = document.getElementById('workspace-form');
const wsCancel = document.getElementById('workspace-cancel');
const wsNameInput = document.getElementById('workspace-name-input');

function openWorkspaceModal() {
  if (wsModal) {
    wsModal.classList.remove('hidden');
    if (wsNameInput) wsNameInput.focus();
  }
}

function closeWorkspaceModal() {
  if (wsModal) {
    wsModal.classList.add('hidden');
    if (wsForm) wsForm.reset();
  }
}

if (wsCancel) {
  wsCancel.addEventListener('click', closeWorkspaceModal);
}

if (wsForm) {
  wsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = wsNameInput.value;
    try {
      const created = await apiRequest('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name })
      });
      closeWorkspaceModal();
      showToast(`Espace de travail "${created.name}" créé.`);
      activeWorkspaceId = created.id;
      localStorage.setItem('taskflow_workspace_id', created.id);
      await loadWorkspaces();
      loadTasks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadWorkspaceMembers() {
  const listEl = document.getElementById('workspace-members-list');
  const titleEl = document.getElementById('workspace-members-title');
  if (!listEl) return;

  if (!activeWorkspaceId) {
    listEl.innerHTML = '<p class="notif-empty">Sélectionnez un espace de travail collaboratif pour voir ses membres.</p>';
    return;
  }

  listEl.innerHTML = '<p class="notif-empty">Chargement des membres...</p>';

  try {
    const selector = document.getElementById('workspace-selector');
    const activeOpt = selector?.options[selector.selectedIndex];
    if (activeOpt && titleEl) {
      titleEl.textContent = `Membres de ${activeOpt.textContent.replace('💼 ', '')}`;
    }

    const members = await apiRequest(`/workspaces/${activeWorkspaceId}/members`);
    listEl.innerHTML = '';

    members.forEach((m) => {
      const card = document.createElement('div');
      card.className = 'member-item-card';

      const left = document.createElement('div');
      left.className = 'member-item-left';

      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = m.name.substring(0, 2).toUpperCase();
      if (m.has_avatar) {
        avatar.style.backgroundImage = `url('/api/users/${m.id}/avatar')`;
        avatar.style.backgroundSize = 'cover';
        avatar.textContent = '';
      }

      const info = document.createElement('div');
      info.className = 'member-info';
      const name = document.createElement('span');
      name.className = 'member-name';
      name.textContent = m.name;
      const email = document.createElement('span');
      email.className = 'member-email';
      email.textContent = m.email;

      info.append(name, email);
      left.append(avatar, info);
      card.appendChild(left);

      const right = document.createElement('div');
      right.className = 'member-item-right';

      const badge = document.createElement('span');
      badge.className = `member-role-badge ${m.role}`;
      badge.textContent = m.role;
      right.appendChild(badge);

      const isSelf = m.id === currentUser?.id;
      const canDelete = !isSelf && (m.role !== 'owner');

      if (canDelete || isSelf) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-remove-member';
        delBtn.textContent = '✖';
        delBtn.title = isSelf ? 'Quitter l\'espace' : 'Retirer';
        delBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          const confirmMsg = isSelf 
            ? 'Voulez-vous vraiment quitter cet espace ?' 
            : `Voulez-vous retirer ${m.name} de cet espace ?`;
          
          if (await askConfirm(confirmMsg)) {
            try {
              await apiRequest(`/workspaces/${activeWorkspaceId}/members/${m.id}`, {
                method: 'DELETE'
              });
              showToast(isSelf ? 'Vous avez quitté l\'espace.' : `${m.name} a été retiré.`);
              if (isSelf) {
                activeWorkspaceId = null;
                localStorage.removeItem('taskflow_workspace_id');
                await loadWorkspaces();
                appRouter.navigate('dashboard');
                loadTasks();
              } else {
                loadWorkspaceMembers();
              }
            } catch (err) {
              showToast(err.message, 'error');
            }
          }
        });
        right.appendChild(delBtn);
      }

      card.appendChild(right);
      listEl.appendChild(card);
    });
  } catch (err) {
    listEl.innerHTML = `<p class="notif-empty error">Erreur : ${err.message}</p>`;
  }
}

const inviteForm = document.getElementById('workspace-invite-form');
if (inviteForm) {
  inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = document.getElementById('invite-email');
    const email = emailInput?.value;
    if (!email || !activeWorkspaceId) return;

    try {
      await apiRequest(`/workspaces/${activeWorkspaceId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      showToast('Collaborateur ajouté à l\'espace !');
      if (emailInput) emailInput.value = '';
      loadWorkspaceMembers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}



// Enregistrement du Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker enregistré avec succès :', reg.scope))
      .catch((err) => console.error('Échec d\'enregistrement du Service Worker :', err));
  });
}

// ================= Démarrage initial =================
if (token && currentUser) {
  showApp();
}
