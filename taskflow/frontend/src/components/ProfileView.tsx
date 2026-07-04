"use client";

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, Mail, Shield, Users, Plus, Loader2, ArrowRight } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { currentUser, currentTenant, token, refreshTenants } = useApp();
  
  // Organization members state
  const [members, setMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');

  const fetchMembers = async () => {
    if (!token || !currentTenant) return;
    try {
      const res = await fetch(`/api/tenants/${currentTenant.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error("Failed to fetch organization members:", err);
    }
  };

  useEffect(() => {
    if (currentTenant) {
      fetchMembers();
    } else {
      setMembers([]);
    }
  }, [currentTenant]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || inviteLoading || !currentTenant) return;

    setInviteLoading(true);
    setInviteMessage('');

    try {
      const res = await fetch(`/api/tenants/${currentTenant.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de création de l'invitation.");

      setInviteMessage(`✅ Utilisateur invité avec succès !`);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setInviteMessage(`❌ ${err.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const myRoleInTenant = currentTenant ? members.find(m => m.id === currentUser?.id)?.role : null;
  const canInvite = myRoleInTenant === 'owner' || myRoleInTenant === 'admin';

  return (
    <div className="space-y-8 animate-fade-in">
      {/* View Header */}
      <div>
        <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <User className="text-taskAmber" />
          Mon Profil & Compte
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Gérez vos détails personnels et vos accès d'organisation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Card (Left - 1 Col) */}
        <div className="card-glass p-6 space-y-6 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-orange-400 to-taskAmber text-white flex items-center justify-center font-bold text-2xl uppercase shadow-md shadow-orange-500/10 shrink-0">
            {currentUser?.name.slice(0, 2) || 'TF'}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-850 dark:text-slate-100">{currentUser?.name}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{currentUser?.email}</p>
          </div>

          <div className="w-full space-y-3 pt-4 border-t border-slate-100 dark:border-slate-850 text-left">
            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-450">
              <Shield size={14} className="text-taskAmber" />
              <span className="font-semibold">Rôle global :</span>
              <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-655 dark:text-slate-350">
                {currentUser?.role || 'Utilisateur'}
              </span>
            </div>
            <div className="flex items-center gap-2.5 text-xs text-slate-500 dark:text-slate-450">
              <Mail size={14} className="text-taskAmber" />
              <span className="font-semibold">Statut compte :</span>
              <span className="text-green-500 font-bold">Actif</span>
            </div>
          </div>
        </div>

        {/* Tenant details and invitation (Right - 2 Cols) */}
        <div className="lg:col-span-2 space-y-8">
          {currentTenant ? (
            <>
              {/* Organization Info & Members list */}
              <div className="card-glass p-6 space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-850">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-taskAmber flex items-center justify-center">
                      <Users size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-850 dark:text-slate-150">Membres de l'organisation : {currentTenant.name}</h3>
                      <p className="text-[10px] text-slate-450">Slug: {currentTenant.slug} | Plan: {currentTenant.plan}</p>
                    </div>
                  </div>
                </div>

                {/* Members list */}
                <div className="space-y-3">
                  {members.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 rounded-xl text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold uppercase shrink-0">
                          {m.name.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-850 dark:text-slate-200 truncate">{m.name}</p>
                          <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate">{m.email}</p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        m.role === 'owner' 
                          ? 'bg-rose-500/10 text-rose-500' 
                          : m.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                      }`}>
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite Member form */}
              {canInvite && (
                <div className="card-glass p-6">
                  <h3 className="text-sm font-bold text-slate-850 dark:text-slate-150 mb-3">Inviter un collaborateur</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-4 leading-normal">
                    Entrez l'adresse e-mail d'un utilisateur existant de la plateforme pour l'ajouter à votre organisation et collaborer en temps réel.
                  </p>

                  <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="email@collaborateur.com"
                      className="flex-1 text-xs px-3.5 py-2.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100"
                    />
                    
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as any)}
                      className="text-xs px-3 py-2 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-taskAmber dark:text-slate-100 shrink-0"
                    >
                      <option value="member">Membre</option>
                      <option value="admin">Administrateur</option>
                    </select>

                    <button
                      type="submit"
                      disabled={inviteLoading || !inviteEmail.trim()}
                      className="px-4 py-2.5 bg-gradient-to-tr from-orange-400 to-taskAmber text-white text-xs font-semibold rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : null}
                      <span>Inviter</span>
                      <ArrowRight size={13} />
                    </button>
                  </form>

                  {inviteMessage && (
                    <div className={`p-2 rounded-lg text-[10px] font-semibold text-center mt-3 ${
                      inviteMessage.startsWith('❌') 
                        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                        : 'bg-green-500/10 text-green-500 border border-green-500/20'
                    }`}>
                      {inviteMessage}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="card-glass p-8 text-center text-slate-450 dark:text-slate-550 border-dashed border border-slate-200 dark:border-slate-850">
              <Users size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Compte Personnel</h3>
              <p className="text-xs mt-0.5">
                Vous utilisez actuellement votre compte personnel. Pour collaborer avec des équipes, créez une organisation via le bouton "+" en haut à gauche dans la barre latérale.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
