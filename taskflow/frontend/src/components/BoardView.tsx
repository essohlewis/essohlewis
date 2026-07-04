"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ClipboardList, 
  Calendar as CalIcon, 
  AlertTriangle, 
  ArrowLeft, 
  ArrowRight, 
  Archive,
  Plus,
  Tag,
  Loader2,
  Trash2
} from 'lucide-react';

export const BoardView: React.FC = () => {
  const { tasks, setTasks, currentWorkspace, currentTenant, token, refreshTasks } = useApp();

  // Create task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'basse' | 'moyenne' | 'haute'>('moyenne');
  const [tag, setTag] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }

      const body = {
        title: title.trim(),
        description: description.trim(),
        priority,
        tag: tag.trim() || null,
        due_date: dueDate || null,
        workspaceId: currentWorkspace.id !== 'personal' ? currentWorkspace.id : null
      };

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de création de la tâche.");

      // Reset form
      setTitle('');
      setDescription('');
      setPriority('moyenne');
      setTag('');
      setDueDate('');
      setShowAddForm(false);

      // Refresh tasks
      refreshTasks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId: number, newStatus: 'a_faire' | 'en_cours' | 'terminee') => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }

      // Optimistic update
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        // Rollback on error
        refreshTasks();
        const data = await res.json();
        throw new Error(data.message || "Erreur de mise à jour.");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleArchiveTask = async (taskId: number) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }

      // Optimistic update
      setTasks(prev => prev.filter(t => t.id !== taskId));

      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ is_archived: true })
      });

      if (!res.ok) {
        refreshTasks();
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de l'archivage.");
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    { id: 'a_faire', title: 'À faire', bg: 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800' },
    { id: 'en_cours', title: 'En cours', bg: 'bg-orange-50/20 dark:bg-orange-950/10 border-orange-200/40 dark:border-orange-900/20' },
    { id: 'terminee', title: 'Terminées', bg: 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/40 dark:border-emerald-900/20' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="text-taskAmber" />
            Tableau de Tâches (Kanban)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Visualisez et gérez l'avancement de vos tâches dans <span className="font-bold">{currentWorkspace.name}</span>.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-gradient-to-tr from-orange-400 to-taskAmber text-white text-xs font-semibold rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus size={15} />
          Nouvelle tâche
        </button>
      </div>

      {/* Task Creation Form (Modal/Drawer style block) */}
      {showAddForm && (
        <div className="card-glass p-6 max-w-xl mx-auto border border-orange-500/10 shadow-lg shadow-orange-500/5 animate-slide-in">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150 mb-4">Créer une nouvelle tâche</h3>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Titre de la tâche</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Rédiger le cahier des charges..."
                className="w-full text-xs px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Détails de l'action à mener..."
                rows={3}
                className="w-full text-xs px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Priorité</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100"
                >
                  <option value="basse">🟢 Basse</option>
                  <option value="moyenne">🟡 Moyenne</option>
                  <option value="haute">🔴 Haute</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tag / Étiquette</label>
                <input
                  type="text"
                  value={tag}
                  onChange={e => setTag(e.target.value)}
                  placeholder="Design, Tech, Marketing..."
                  className="w-full text-xs px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Date limite</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full text-xs px-3.5 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-semibold bg-rose-500/10 p-2 text-center rounded-lg">
                ⚠️ {error}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-55/10 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-tr from-orange-400 to-taskAmber text-white text-xs font-semibold rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                Créer la tâche
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {columns.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id && !t.is_archived);
          return (
            <div key={col.id} className={`rounded-2xl border p-4 flex flex-col min-h-[500px] ${col.bg}`}>
              {/* Column Header */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-250/20 dark:border-slate-800/30">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">{col.title}</span>
                <span className="px-2 py-0.5 bg-slate-200/50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {colTasks.length === 0 ? (
                  <div className="h-28 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                    Aucune tâche ici
                  </div>
                ) : (
                  colTasks.map(t => {
                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== 'terminee';
                    return (
                      <div 
                        key={t.id} 
                        className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/60 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col justify-between gap-3 relative group"
                      >
                        {/* Title & Actions */}
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250 leading-snug">{t.title}</h4>
                            
                            {/* Archive button for completed tasks */}
                            {t.status === 'terminee' && (
                              <button
                                onClick={() => handleArchiveTask(t.id)}
                                className="text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                title="Archiver la tâche"
                              >
                                <Archive size={13} />
                              </button>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-normal line-clamp-2">
                              {t.description}
                            </p>
                          )}
                        </div>

                        {/* Badges & Navigation Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/40 mt-auto gap-2">
                          <div className="flex flex-wrap gap-1.5 items-center">
                            {/* Priority Badge */}
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              t.priority === 'haute' 
                                ? 'bg-rose-500/10 text-rose-500' 
                                : t.priority === 'moyenne'
                                  ? 'bg-amber-500/10 text-amber-500'
                                  : 'bg-emerald-500/10 text-emerald-500'
                            }`}>
                              {t.priority}
                            </span>

                            {/* Tag Badge */}
                            {t.tag && (
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-450 px-1.5 py-0.5 rounded-full text-[9px] font-semibold flex items-center gap-1">
                                <Tag size={8} />
                                {t.tag}
                              </span>
                            )}

                            {/* Due Date */}
                            {t.due_date && (
                              <span className={`text-[9px] font-semibold flex items-center gap-1 ${
                                isOverdue ? 'text-rose-500 animate-pulse' : 'text-slate-400'
                              }`}>
                                <CalIcon size={9} />
                                {new Date(t.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                {isOverdue && <AlertTriangle size={8} />}
                              </span>
                            )}
                          </div>

                          {/* Quick Navigation Buttons between statuses */}
                          <div className="flex gap-1 shrink-0">
                            {col.id !== 'a_faire' && (
                              <button
                                onClick={() => handleUpdateStatus(t.id, col.id === 'terminee' ? 'en_cours' : 'a_faire')}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                                title="Déplacer à gauche"
                              >
                                <ArrowLeft size={11} />
                              </button>
                            )}

                            {col.id !== 'terminee' && (
                              <button
                                onClick={() => handleUpdateStatus(t.id, col.id === 'a_faire' ? 'en_cours' : 'terminee')}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-750 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                                title="Déplacer à droite"
                              >
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
