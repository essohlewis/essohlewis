const API_BASE = '/api';

// ---------- Etat local ----------
let token = localStorage.getItem('taskflow_token');
let refreshToken = localStorage.getItem('taskflow_refresh');
let currentUser = JSON.parse(localStorage.getItem('taskflow_user') || 'null');
let searchDebounce;
let draggedTaskId = null;
// Empêche plusieurs rafraîchissements simultanés (single-flight).
let refreshPromise = null;

// Modèle local des tâches actuellement affichées. Le garder en mémoire permet
// des mises à jour "optimistes" : on modifie l'affichage immédiatement, sans
// attendre l'aller-retour réseau ni recharger tout le tableau.
let allTasks = [];
// Ensemble des ids sélectionnés (mode multi-sélection / actions groupées).
const selected = new Set();
// Pagination : on charge les tâches par pages pour éviter de tout tirer d'un coup.
const PAGE_SIZE = 50;
let taskOffset = 0;
let hasMoreTasks = false;

// ---------- Elements ----------
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
const notifToggle = document.getElementById('notif-toggle');
const notifBadge = document.getElementById('notif-badge');
const notifPanel = document.getElementById('notif-panel');
const notifList = document.getElementById('notif-list');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editTitle = document.getElementById('edit-title');
const editDescription = document.getElementById('edit-description');
const editPriority = document.getElementById('edit-priority');
const editTag = document.getElementById('edit-tag');
const editDueDate = document.getElementById('edit-due-date');
const editCancel = document.getElementById('edit-cancel');
const loadMoreBtn = document.getElementById('load-more');
const shareEmail = document.getElementById('share-email');
const shareBtn = document.getElementById('share-btn');
const shareList = document.getElementById('share-list');
const sharedToggle = document.getElementById('shared-toggle');
const sharedModal = document.getElementById('shared-modal');
const sharedList = document.getElementById('shared-list');
const sharedClose = document.getElementById('shared-close');
let editingTaskId = null;

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
    tabBtns.forEach((b) => b.classList.remove('active'));
    authForms.forEach((f) => f.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`${btn.dataset.tab}-form`).classList.add('active');
  });
});

// ================= Helpers API =================
// Rafraîchit le token d'accès à partir du refresh token. Single-flight : si
// plusieurs requêtes échouent en même temps sur un 401, un seul appel /refresh
// est effectué et toutes attendent son résultat.
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
        refreshToken = data.refreshToken; // rotation : nouveau refresh token
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

// Fetch authentifié bas niveau : ajoute le token, gère le rafraîchissement
// transparent sur 401 (une fois), et renvoie la Response brute. Utilisé aussi
// bien pour le JSON que pour les téléchargements binaires (export).
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

// Wrapper JSON par-dessus authFetch.
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
}

// Bascule vers l'écran d'authentification quand la session ne peut plus être
// rafraîchie (refresh token expiré ou révoqué).
function forceLogout() {
  clearSession();
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  showToast('Session expirée, reconnecte-toi.', 'error');
}

logoutBtn.addEventListener('click', async () => {
  // Révoque le refresh token côté serveur (déconnexion propre), sans bloquer l'UI.
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
    } catch { /* déconnexion locale déjà effectuée */ }
  }
});

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userNameEl.textContent = currentUser?.name || '';
  loadTasks();
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
    const created = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify({ title, description, priority, tag, due_date })
    });
    taskForm.reset();
    document.getElementById('task-priority').value = 'moyenne';
    showToast('Tâche ajoutée.');
    // Ajout local immédiat (en tête) plutôt qu'un rechargement complet.
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
  searchDebounce = setTimeout(loadTasks, 300); // debounce : évite une requête à chaque frappe
});
filterPriority.addEventListener('change', loadTasks);
filterTag.addEventListener('change', loadTasks);
sortSelect.addEventListener('change', loadTasks);
loadMoreBtn.addEventListener('click', loadMoreTasks);

// ================= Chargement des tâches =================
// Construit les paramètres de requête communs (filtres/tri) pour une page donnée.
function taskQueryParams(offset) {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (filterPriority.value) params.set('priority', filterPriority.value);
  if (filterTag.value) params.set('tag', filterTag.value);
  if (sortSelect.value) params.set('sort', sortSelect.value);
  params.set('limit', PAGE_SIZE);
  params.set('offset', offset);
  return params;
}

// (Re)charge la première page : remplace la liste locale.
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

// Charge la page suivante et l'ajoute à la liste (bouton « Charger plus »).
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

// ================= Tags (couleurs + filtre) =================
// Couleur déterministe dérivée du texte du tag : même tag => même teinte,
// lisible en clair comme en sombre.
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
    const tags = await apiRequest('/tasks/tags');
    const current = filterTag.value;
    filterTag.innerHTML = '<option value="">Tous les tags</option>';
    tags.forEach(({ tag, count }) => {
      const opt = document.createElement('option');
      opt.value = tag;
      opt.textContent = `${tag} (${count})`;
      filterTag.appendChild(opt);
    });
    // Conserve la sélection courante si le tag existe toujours.
    filterTag.value = tags.some((t) => t.tag === current) ? current : '';
  } catch {
    /* silencieux */
  }
}

// ================= Rappels d'échéance =================
// Source d'autorité : l'endpoint /reminders (non filtré). On l'appelle après
// les opérations qui peuvent changer les échéances/statuts.
async function loadReminders() {
  try {
    const data = await apiRequest('/tasks/reminders?days=3');
    renderReminders(data);
  } catch {
    /* silencieux : les rappels sont secondaires */
  }
}

function renderReminders({ total, overdue, soon }) {
  if (total > 0) {
    notifBadge.textContent = total;
    notifBadge.classList.remove('hidden');
  } else {
    notifBadge.classList.add('hidden');
  }

  notifList.innerHTML = '';
  if (total === 0) {
    const empty = document.createElement('p');
    empty.className = 'notif-empty';
    empty.textContent = 'Aucune échéance imminente. 🎉';
    notifList.appendChild(empty);
    return;
  }

  const section = (label, items, cls) => {
    if (items.length === 0) return;
    const h = document.createElement('div');
    h.className = `notif-group ${cls}`;
    h.textContent = `${label} (${items.length})`;
    notifList.appendChild(h);
    items.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'notif-item';
      const date = new Date(t.due_date).toLocaleDateString('fr-FR');
      row.innerHTML = `<span class="notif-title"></span><span class="notif-date">${date}</span>`;
      row.querySelector('.notif-title').textContent = t.title;
      notifList.appendChild(row);
    });
  };

  section('En retard', overdue, 'overdue');
  section('Bientôt', soon, 'soon');
}

notifToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  notifPanel.classList.toggle('hidden');
});
// Fermer le panneau au clic à l'extérieur.
document.addEventListener('click', (e) => {
  if (!notifPanel.classList.contains('hidden') &&
      !notifPanel.contains(e.target) && e.target !== notifToggle) {
    notifPanel.classList.add('hidden');
  }
});

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
  editModal.classList.remove('hidden');
  editTitle.focus();
}

// ---- Partage de la tâche en cours d'édition ----
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

// ---- Vue « Partagées avec moi » ----
async function openSharedWithMe() {
  sharedList.innerHTML = '<p class="notif-empty">Chargement…</p>';
  sharedModal.classList.remove('hidden');
  try {
    const tasks = await apiRequest('/tasks/shared');
    sharedList.innerHTML = '';
    if (tasks.length === 0) {
      sharedList.innerHTML = '<p class="notif-empty">Aucune tâche partagée avec toi.</p>';
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
      sharedList.appendChild(row);
    });
  } catch (err) {
    sharedList.innerHTML = `<p class="notif-empty">${err.message}</p>`;
  }
}

sharedToggle.addEventListener('click', openSharedWithMe);
sharedClose.addEventListener('click', () => sharedModal.classList.add('hidden'));
sharedModal.addEventListener('click', (e) => {
  if (e.target === sharedModal) sharedModal.classList.add('hidden');
});

function closeEdit() {
  editModal.classList.add('hidden');
  editingTaskId = null;
}

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const task = allTasks.find((t) => t.id === editingTaskId);
  if (!task) return closeEdit();

  // Les champs vides sont envoyés à null pour réellement les effacer côté serveur
  // (description, tag, échéance).
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
    // On fusionne pour conserver les champs locaux (avancement des sous-tâches).
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
  if (e.target === editModal) closeEdit(); // clic sur le fond
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.classList.contains('hidden')) closeEdit();
});

// ================= Statistiques =================
// Source d'autorité : l'endpoint /stats (mis en cache côté serveur, invalidé à
// chaque écriture). Nécessaire car, avec la pagination, le modèle local ne
// contient qu'une partie des tâches — un calcul local serait faux.
async function loadStats() {
  try {
    const stats = await apiRequest('/tasks/stats');
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-completion').textContent = `${stats.taux_completion}%`;
    document.getElementById('stat-late').textContent = stats.en_retard;
    document.getElementById('progress-fill').style.width = `${stats.taux_completion}%`;
  } catch {
    /* silencieux */
  }
}

// ================= Rendu du tableau =================
function renderTasks() {
  const columns = { a_faire: [], en_cours: [], terminee: [] };
  allTasks.forEach((t) => columns[t.status]?.push(t));

  Object.keys(columns).forEach((status) => {
    const list = document.getElementById(`list-${status}`);
    const count = document.getElementById(`count-${status}`);
    list.innerHTML = '';
    count.textContent = columns[status].length;

    if (columns[status].length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Aucune tâche ici.';
      list.appendChild(empty);
    } else {
      columns[status].forEach((task) => list.appendChild(buildTaskCard(task)));
    }
  });

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

  // Case de sélection (actions groupées)
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

  // Glisser-déposer
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

  return card;
}

// ================= Pièces jointes =================
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

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

// ================= Sous-tâches (checklist) =================
// La checklist est chargée à la demande (au premier dépliage) pour ne pas
// alourdir le rendu initial du tableau. L'avancement (X/Y) provient déjà de
// l'agrégat renvoyé par GET /api/tasks, donc affiché sans requête réseau.
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

    // Bascule "fait" optimiste : on met à jour l'affichage et le compteur
    // immédiatement, puis on synchronise ; annulation en cas d'échec.
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

// Mise à jour optimiste du statut : on modifie le modèle local et l'affichage
// immédiatement, puis on synchronise avec le serveur. En cas d'échec, on annule.
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
    loadReminders(); // une tâche terminée sort des rappels
  } catch (err) {
    task.status = previousStatus; // rollback
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
async function downloadExport(format) {
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

exportJsonBtn.addEventListener('click', () => downloadExport('json'));
exportCsvBtn.addEventListener('click', () => downloadExport('csv'));

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async () => {
  const file = importFile.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    // Accepte aussi bien un tableau brut qu'un export { tasks: [...] }.
    const tasks = Array.isArray(parsed) ? parsed : parsed.tasks;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Fichier JSON invalide (aucune tâche trouvée).');
    }
    const result = await apiRequest('/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ tasks })
    });
    const skipped = result.skipped ? `, ${result.skipped} ignorée(s)` : '';
    showToast(`${result.imported} tâche(s) importée(s)${skipped}.`);
    loadTasks();
  } catch (err) {
    const msg = err instanceof SyntaxError ? 'Fichier JSON illisible.' : err.message;
    showToast(msg, 'error');
  } finally {
    importFile.value = ''; // permet de réimporter le même fichier
  }
});

// ================= Zones de dépôt (colonnes) =================
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

// ================= Démarrage =================
if (token && currentUser) {
  showApp();
}
