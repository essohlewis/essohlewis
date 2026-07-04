"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Trash2, RotateCcw, AlertCircle } from 'lucide-react';

export const ArchiveView: React.FC = () => {
  const { token, currentWorkspace, refreshTasks } = useApp();
  const [archivedTasks, setArchivedTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadArchives = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = new URL('/api/tasks/archived/list', window.location.origin);
      if (currentWorkspace.id !== 'personal') {
        url.searchParams.set('workspaceId', String(currentWorkspace.id));
      }
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArchivedTasks(data);
      }
    } catch (err) {
      console.error('Failed to load archived tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, [token, currentWorkspace.id]);

  const handleRestore = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
        refreshTasks();
      }
    } catch (err) {
      console.error('Failed to restore task:', err);
    }
  };

  const handleDeletePermanent = async (id: number) => {
    if (!confirm('Supprimer définitivement cette tâche ? Cette action est irréversible.')) return;
    if (!token) return;
    try {
      const res = await fetch(`/api/tasks/${id}?permanent=true`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setArchivedTasks(prev => prev.filter(t => t.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete task permanently:', err);
    }
  };

  const handleEmptyTrash = async () => {
    if (archivedTasks.length === 0) return;
    if (!confirm('Supprimer définitivement TOUTES les tâches de la corbeille ? Action irréversible.')) return;
    if (!token) return;
    try {
      // Supprimer en boucle
      for (const t of archivedTasks) {
        await fetch(`/api/tasks/${t.id}?permanent=true`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setArchivedTasks([]);
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <span>Tâches archivées</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Consultez, restaurez ou supprimez définitivement vos tâches archivées.
          </p>
        </div>
        {archivedTasks.length > 0 && (
          <button 
            onClick={handleEmptyTrash}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-sm transition-colors shrink-0"
          >
            <Trash2 size={14} />
            <span>Vider la corbeille</span>
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-450 py-8">Chargement de la corbeille...</p>
      ) : archivedTasks.length === 0 ? (
        <div className="card-glass p-12 text-center text-slate-400 dark:text-slate-500">
          <Trash2 size={40} className="mx-auto mb-3 opacity-40 text-slate-500" />
          <p className="font-semibold text-sm">La corbeille est vide</p>
          <p className="text-xs mt-1">Les tâches que vous supprimez apparaîtront ici.</p>
        </div>
      ) : (
        <div className="card-glass overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {archivedTasks.map((t) => (
              <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/30 dark:hover:bg-slate-900/30 transition-colors">
                <div className="min-w-0 pr-4">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{t.title}</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{t.description || 'Sans description'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={() => handleRestore(t.id)}
                    className="p-2 text-slate-450 hover:text-taskSage dark:hover:text-green-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors"
                    title="Restaurer"
                  >
                    <RotateCcw size={15} />
                  </button>
                  <button 
                    onClick={() => handleDeletePermanent(t.id)}
                    className="p-2 text-slate-450 hover:text-taskRose dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg transition-colors"
                    title="Supprimer définitivement"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
