"use client";

import React, { useState } from 'react';
import { AppProvider, useApp } from '../context/AppContext';
import { Sidebar } from '../components/Sidebar';
import { DashboardView } from '../components/DashboardView';
import { ArchiveView } from '../components/ArchiveView';
import { BoardView } from '../components/BoardView';
import { CalendarView } from '../components/CalendarView';
import { UniversalHub } from '../components/UniversalHub';
import { ProfileView } from '../components/ProfileView';
import { 
  KeyRound, 
  Mail, 
  User, 
  Lock, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

function AppContent() {
  const { token, login, currentView } = useApp();
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  
  // Auth Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = authTab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = authTab === 'login' 
        ? { email, password }
        : { name, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Une erreur est survenue.');
      }

      login(data.token, data.refreshToken, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors duration-300">
        <div className="card-glass max-w-md w-full p-8 space-y-6">
          {/* Logo / Brand Header */}
          <div className="flex flex-col items-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-400 to-taskAmber flex items-center justify-center text-white text-xl font-bold shadow-md shadow-orange-500/10">
              ◆
            </div>
            <h2 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100">TaskFlow Pro</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">Votre assistant numérique intelligent tout-en-un</p>
          </div>

          {/* Form Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl">
            <button
              onClick={() => { setAuthTab('login'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authTab === 'login' 
                  ? 'bg-white dark:bg-slate-800 text-taskAmber shadow-sm' 
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => { setAuthTab('register'); setError(''); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                authTab === 'register' 
                  ? 'bg-white dark:bg-slate-800 text-taskAmber shadow-sm' 
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Auth Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authTab === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nom d'utilisateur</label>
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full text-sm pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Adresse email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full text-sm pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm pl-10 pr-4 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-semibold bg-rose-500/10 p-2.5 rounded-lg text-center" role="alert">
                ⚠️ {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-tr from-orange-400 to-taskAmber text-white font-semibold text-sm rounded-xl hover:shadow-md hover:shadow-orange-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{authTab === 'login' ? 'Se connecter' : 'Créer un compte'}</span>
              <ArrowRight size={15} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated State Layout
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 min-w-0">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'archive' && <ArchiveView />}
        {currentView === 'board' && <BoardView />}
        {currentView === 'calendar' && <CalendarView />}
        {currentView === 'universal' && <UniversalHub />}
        {currentView === 'profile' && <ProfileView />}
        {!['dashboard', 'archive', 'board', 'calendar', 'universal', 'profile'].includes(currentView) && (
          <div className="card-glass p-8 text-center text-slate-450 dark:text-slate-550">
            <Sparkles size={40} className="mx-auto mb-3 text-taskAmber opacity-70 animate-pulse" />
            <h3 className="text-lg font-bold font-serif text-slate-800 dark:text-slate-200">Module en cours de migration</h3>
            <p className="text-xs mt-1">Le module "{currentView}" est en train d'être porté sur la nouvelle interface Next.js.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
