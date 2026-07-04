"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Layers, 
  ClipboardList, 
  Calendar, 
  Share2, 
  Activity, 
  User, 
  Trash2, 
  Users, 
  LogOut, 
  Sun, 
  Moon,
  Laptop
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { 
    currentUser, 
    currentWorkspace, 
    setWorkspace, 
    currentView, 
    setCurrentView, 
    theme, 
    toggleTheme, 
    logout,
    currentTenant,
    tenants,
    setTenant,
    refreshTenants
  } = useApp();

  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    if (currentUser) {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${localStorage.getItem('taskflow_token')}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }
      fetch('/api/workspaces', { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => setWorkspaces(data))
      .catch(() => {});
    }
  }, [currentUser, currentTenant]);

  const navItems = [
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'universal', label: 'Hub universel', icon: Layers },
    { view: 'board', label: 'Mes Tâches', icon: ClipboardList },
    { view: 'calendar', label: 'Calendrier', icon: Calendar },
    { view: 'shared', label: 'Partagées', icon: Share2 },
    { view: 'feed', label: 'Activité', icon: Activity },
    { view: 'profile', label: 'Mon Profil', icon: User },
    { view: 'archive', label: 'Archives', icon: Trash2 },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col fixed top-0 bottom-0 left-0 z-40 transition-colors duration-300">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <span className="text-taskAmber text-2xl font-bold font-serif">◆</span>
        <span className="text-xl font-bold font-serif text-slate-800 dark:text-slate-100">TaskFlow</span>
      </div>

      {/* Organization (Tenant) Selector */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Organisation</label>
        <div className="flex gap-1.5 items-center">
          <select 
            value={currentTenant ? currentTenant.id : 'personal'} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'personal') {
                setTenant(null);
              } else {
                const selectedTenant = tenants.find(t => t.id === parseInt(val));
                if (selectedTenant) setTenant(selectedTenant);
              }
            }}
            className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-sm py-1.5 px-2 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-taskAmber"
          >
            <option value="personal">👤 Compte Personnel</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>🏢 {t.name}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              const name = prompt("Nom de votre nouvelle organisation :");
              if (!name || !name.trim()) return;
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              if (!slug) return;
              fetch('/api/tenants', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${localStorage.getItem('taskflow_token')}`
                },
                body: JSON.stringify({ name, slug })
              })
              .then(res => {
                if (res.ok) {
                  return res.json();
                } else {
                  return res.json().then(d => { throw new Error(d.message || "Erreur de création"); });
                }
              })
              .then(newTenant => {
                refreshTenants();
                setTenant(newTenant);
              })
              .catch(err => alert(err.message));
            }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-semibold flex items-center justify-center min-w-[28px]"
            title="Créer une organisation"
          >
            +
          </button>
        </div>
      </div>

      {/* Workspace Selector */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Espace actif</label>
        <div className="flex gap-1.5 items-center">
          <select 
            value={currentWorkspace.id} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'personal') {
                setWorkspace({ id: 'personal', name: 'Tâches personnelles' });
              } else {
                const selectedWs = workspaces.find(w => w.id === parseInt(val));
                if (selectedWs) setWorkspace({ id: selectedWs.id, name: selectedWs.name });
              }
            }}
            className="flex-1 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-sm py-1.5 px-2.5 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-taskAmber"
          >
            <option value="personal">🔒 Tâches personnelles</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>🏢 {ws.name}</option>
            ))}
          </select>
          <button 
            onClick={() => {
              const name = prompt("Nom du nouvel espace de travail :");
              if (!name || !name.trim()) return;
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${localStorage.getItem('taskflow_token')}`
              };
              if (currentTenant) {
                headers['X-Tenant-Id'] = String(currentTenant.id);
                headers['X-Tenant-Slug'] = currentTenant.slug;
              }
              fetch('/api/workspaces', {
                method: 'POST',
                headers,
                body: JSON.stringify({ name })
              })
              .then(res => {
                if (res.ok) {
                  return res.json();
                } else {
                  return res.json().then(d => { throw new Error(d.message || "Erreur de création"); });
                }
              })
              .then(newWs => {
                // Refresh workspaces list
                const headersGet: Record<string, string> = {
                  Authorization: `Bearer ${localStorage.getItem('taskflow_token')}`
                };
                if (currentTenant) {
                  headersGet['X-Tenant-Id'] = String(currentTenant.id);
                  headersGet['X-Tenant-Slug'] = currentTenant.slug;
                }
                return fetch('/api/workspaces', { headers: headersGet });
              })
              .then(res => res.ok ? res.json() : [])
              .then(data => {
                setWorkspaces(data);
                // Set active to the last created workspace
                if (data.length > 0) {
                  const last = data[data.length - 1];
                  setWorkspace({ id: last.id, name: last.name });
                }
              })
              .catch(err => alert(err.message));
            }}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-500 dark:text-slate-400 rounded-lg text-xs font-semibold flex items-center justify-center min-w-[28px]"
            title="Créer un espace"
          >
            +
          </button>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive 
                  ? 'bg-orange-50 dark:bg-orange-950/30 text-taskAmber' 
                  : 'text-slate-550 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-850 dark:hover:text-slate-205'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-taskAmber' : 'text-slate-400 dark:text-slate-500'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle & User Info Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <button 
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800/40"
        >
          <span className="flex items-center gap-2">
            {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
            <span>Thème {theme === 'dark' ? 'Sombre' : 'Clair'}</span>
          </span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">◐</span>
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-400 to-taskAmber text-white flex items-center justify-center font-semibold text-sm shrink-0 uppercase">
              {currentUser?.name.slice(0, 2) || 'TF'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{currentUser?.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{currentUser?.email}</p>
            </div>
          </div>

          <button 
            onClick={logout}
            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors"
            title="Déconnexion"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};

