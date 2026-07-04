"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  ClipboardList, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  Plus, 
  Download, 
  UserPen 
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { tasks, currentWorkspace, setCurrentView, token } = useApp();
  const [stats, setStats] = useState({
    total: 0,
    a_faire: 0,
    en_cours: 0,
    terminee: 0,
    en_retard: 0,
    taux_completion: 0
  });

  useEffect(() => {
    // Calculer les stats localement ou depuis l'API
    if (token) {
      const url = new URL('/api/tasks/stats', window.location.origin);
      if (currentWorkspace.id !== 'personal') {
        url.searchParams.set('workspaceId', String(currentWorkspace.id));
      }
      fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setStats(data);
      })
      .catch(() => {
        // Fallback local
        const total = tasks.filter(t => !t.is_archived).length;
        const a_faire = tasks.filter(t => t.status === 'a_faire' && !t.is_archived).length;
        const en_cours = tasks.filter(t => t.status === 'en_cours' && !t.is_archived).length;
        const terminee = tasks.filter(t => t.status === 'terminee' && !t.is_archived).length;
        const en_retard = tasks.filter(t => {
          if (t.is_archived || t.status === 'terminee' || !t.due_date) return false;
          return new Date(t.due_date) < new Date();
        }).length;
        const taux_completion = total > 0 ? Math.round((terminee / total) * 100) : 0;
        setStats({ total, a_faire, en_cours, terminee, en_retard, taux_completion });
      });
    }
  }, [tasks, currentWorkspace.id, token]);

  const cards = [
    { title: 'Tâches totales', value: stats.total, color: 'bg-blue-500/10 text-blue-500', icon: ClipboardList },
    { title: 'Taux de complétion', value: `${stats.taux_completion}%`, color: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
    { title: 'En retard', value: stats.en_retard, color: 'bg-red-500/10 text-red-500', icon: AlertTriangle },
    { title: 'En cours', value: stats.en_cours, color: 'bg-orange-500/10 text-orange-500', icon: Zap },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-serif text-slate-800 dark:text-slate-100">Tableau de Bord</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Aperçu rapide de vos indicateurs clés de performance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className="card-glass p-5 flex items-center gap-4 transition-transform hover:-translate-y-1 duration-200">
              <div className={`p-3 rounded-xl ${card.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{card.value}</span>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{card.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Donut */}
        <div className="card-glass p-5">
          <h3 className="text-lg font-bold font-serif mb-4 text-slate-850 dark:text-slate-200">Répartition par statut</h3>
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-4">
            <div className="relative w-44 h-44">
              {/* Dynamic SVG Donut */}
              <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                <circle cx="100" cy="100" r="60" className="stroke-slate-100 dark:stroke-slate-800 fill-none" strokeWidth="20" />
                {stats.total > 0 && (() => {
                  let accumulatedPercent = 0;
                  const colors = ['#C4732B', '#2563EB', '#6B8F71'];
                  const segments = [stats.a_faire, stats.en_cours, stats.terminee];
                  const circ = 2 * Math.PI * 60;
                  return segments.map((val, idx) => {
                    if (val === 0) return null;
                    const pct = (val / stats.total) * 100;
                    const strokeDash = (pct / 100) * circ;
                    const strokeOffset = -(accumulatedPercent / 100) * circ;
                    accumulatedPercent += pct;
                    return (
                      <circle
                        key={idx}
                        cx="100"
                        cy="100"
                        r="60"
                        fill="none"
                        stroke={colors[idx]}
                        strokeWidth="20"
                        strokeDasharray={`${strokeDash} ${circ - strokeDash}`}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-500"
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{stats.total}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tâches</span>
              </div>
            </div>

            {/* Legend */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded-full bg-taskAmber block" />
                <span>À faire : <strong>{stats.a_faire}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded-full bg-taskBlue block" />
                <span>En cours : <strong>{stats.en_cours}</strong></span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded-full bg-taskSage block" />
                <span>Terminée : <strong>{stats.terminee}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="card-glass p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold font-serif mb-4 text-slate-850 dark:text-slate-200">Actions rapides</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">Accédez en un clic à vos fonctionnalités courantes.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button 
              onClick={() => setCurrentView('board')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-950/20 text-taskAmber hover:shadow-sm transition-all group"
            >
              <Plus className="mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Nouvelle Tâche</span>
            </button>
            <button 
              onClick={() => setCurrentView('universal')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-950/20 text-taskBlue hover:shadow-sm transition-all group"
            >
              <Zap className="mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Hub Universel</span>
            </button>
            <button 
              onClick={() => setCurrentView('profile')}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-950/20 text-taskSage hover:shadow-sm transition-all group"
            >
              <UserPen className="mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Mon Profil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
