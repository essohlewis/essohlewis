"use client";

import React from 'react';
import { useApp } from '../context/AppContext';
import { Calendar as CalIcon, AlertCircle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export const CalendarView: React.FC = () => {
  const { tasks, setCurrentView } = useApp();

  const activeTasks = tasks.filter(t => !t.is_archived);

  // Grouping logic
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const today = new Date(now);
  
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay())); // End of current week (Sunday)
  endOfWeek.setHours(23, 59, 59, 999);

  const overdue: typeof tasks = [];
  const dueToday: typeof tasks = [];
  const dueThisWeek: typeof tasks = [];
  const dueLater: typeof tasks = [];
  const noDate: typeof tasks = [];

  activeTasks.forEach(t => {
    if (!t.due_date) {
      noDate.push(t);
      return;
    }

    const dueDate = new Date(t.due_date);
    dueDate.setHours(0, 0, 0, 0);

    if (t.status === 'terminee') {
      dueLater.push(t); // Don't show completed tasks in overdue/today
      return;
    }

    if (dueDate < today) {
      overdue.push(t);
    } else if (dueDate.getTime() === today.getTime()) {
      dueToday.push(t);
    } else if (dueDate <= endOfWeek) {
      dueThisWeek.push(t);
    } else {
      dueLater.push(t);
    }
  });

  const sections = [
    { title: '🔴 En retard', list: overdue, color: 'text-rose-500 bg-rose-500/10' },
    { title: '🟠 Aujourd\'hui', list: dueToday, color: 'text-orange-500 bg-orange-500/10' },
    { title: '🟡 Cette semaine', list: dueThisWeek, color: 'text-amber-500 bg-amber-500/10' },
    { title: '🔵 Plus tard / Terminées', list: dueLater, color: 'text-sky-500 bg-sky-500/10' },
    { title: '⚪ Sans date limite', list: noDate, color: 'text-slate-400 bg-slate-100 dark:bg-slate-800' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* View Header */}
      <div>
        <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <CalIcon className="text-taskAmber" />
          Calendrier & Échéancier
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Suivez vos livrables chronologiquement pour ne rater aucune date limite.
        </p>
      </div>

      {/* Agenda Sections */}
      <div className="space-y-6">
        {sections.map((section, sIdx) => {
          if (section.list.length === 0) return null;
          return (
            <div key={sIdx} className="card-glass p-5 space-y-3">
              {/* Section Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200/50 dark:border-slate-850">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${section.color}`}>
                  {section.title}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">({section.list.length} tâches)</span>
              </div>

              {/* Tasks Agenda List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-850">
                {section.list.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => setCurrentView('board')}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/20 px-2 rounded-lg cursor-pointer transition-colors duration-150 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {t.status === 'terminee' ? (
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      ) : t.status === 'en_cours' ? (
                        <Clock size={16} className="text-orange-400 shrink-0" />
                      ) : (
                        <AlertCircle size={16} className="text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${
                          t.status === 'terminee' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-850 dark:text-slate-200'
                        }`}>
                          {t.title}
                        </p>
                        {t.description && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {t.due_date && (
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(t.due_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                      )}
                      <ChevronRight size={14} className="text-slate-350 dark:text-slate-650 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {activeTasks.length === 0 && (
          <div className="card-glass p-8 text-center text-slate-450 dark:text-slate-550 border-dashed border border-slate-200 dark:border-slate-850">
            <CalIcon size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Aucune tâche planifiée</h3>
            <p className="text-xs mt-0.5">Créez des tâches avec des dates limites dans l'onglet "Mes Tâches" pour les voir ici.</p>
          </div>
        )}
      </div>
    </div>
  );
};
