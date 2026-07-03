const API_BASE = '/api';

// ---------- Etat local ----------
let token = localStorage.getItem('taskflow_token');
let currentUser = JSON.parse(localStorage.getItem('taskflow_user') || 'null');
let searchDebounce;
let draggedTaskId = null;

// Modèle local des tâches actuellement affichées. Le garder en mémoire permet
// des mises à jour "optimistes" : on modifie l'affichage immédiatement, sans
// attendre l'aller-retour réseau ni recharger tout le tableau.
let allTasks = [];
// Ensemble des ids sélectionnés (mode multi-sélection / actions groupées).
const selected = new Set();

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
const searchInput = document.getElementById('search-input');
const filterPriority = document.getElementById('filter-priority');
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
async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Une erreur est survenue.');
  return data;
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
    setSession(data.token, data.user);
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
    setSession(data.token, data.user);
    showToast(`Content de te revoir, ${data.user.name} !`);
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

// ================= Session =================
function setSession(newToken, user) {
  token = newToken;
  currentUser = user;
  localStorage.setItem('taskflow_token', token);
  localStorage.setItem('taskflow_user', JSON.stringify(user));
  showApp();
}

logoutBtn.addEventListener('click', () => {
  token = null;
  currentUser = null;
  localStorage.removeItem('taskflow_token');
  localStorage.removeItem('taskflow_user');
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
  loginForm.reset();
  registerForm.reset();
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
sortSelect.addEventListener('change', loadTasks);

// ================= Chargement des tâches =================
async function loadTasks() {
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (filterPriority.value) params.set('priority', filterPriority.value);
  if (sortSelect.value) params.set('sort', sortSelect.value);

  try {
    allTasks = await apiRequest(`/tasks?${params.toString()}`);
    selected.clear();
    renderTasks();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ================= Statistiques (calculées localement) =================
// Plus besoin d'un appel réseau /stats après chaque action : on dérive les
// compteurs directement du modèle local déjà chargé. Instantané, et le cache
// serveur reste disponible pour l'affichage initial d'autres sessions.
function updateStats() {
  const total = allTasks.length;
  const terminee = allTasks.filter((t) => t.status === 'terminee').length;
  const late = allTasks.filter(isOverdue).length;
  const completion = total > 0 ? Math.round((terminee / total) * 100) : 0;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-completion').textContent = `${completion}%`;
  document.getElementById('stat-late').textContent = late;
  document.getElementById('progress-fill').style.width = `${completion}%`;
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

  updateStats();
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
  tagEl.textContent = task.tag || '';

  const dueEl = node.querySelector('.task-due');
  dueEl.textContent = task.due_date
    ? `Échéance : ${new Date(task.due_date).toLocaleDateString('fr-FR')}`
    : '';

  const statusSelect = node.querySelector('.task-status-select');
  statusSelect.value = task.status;
  statusSelect.addEventListener('change', () => updateTaskStatus(task.id, statusSelect.value));

  node.querySelector('.task-delete').addEventListener('click', async () => {
    const ok = await askConfirm('Supprimer définitivement cette tâche ?');
    if (!ok) return;
    try {
      await apiRequest(`/tasks/${task.id}`, { method: 'DELETE' });
      showToast('Tâche supprimée.');
      allTasks = allTasks.filter((t) => t.id !== task.id);
      selected.delete(task.id);
      renderTasks();
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

  return card;
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
