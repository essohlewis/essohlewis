"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Sparkles, 
  Check, 
  Terminal, 
  Layers, 
  Palette, 
  BookOpen, 
  GraduationCap, 
  FileText, 
  Briefcase, 
  Network, 
  Cpu, 
  Puzzle, 
  Flame, 
  Plus, 
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';

type ModuleItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: any;
  color: string;
  badge?: string;
};

const AVAILABLE_MODULES: ModuleItem[] = [
  { id: 'projects', name: 'Gestion de Projets & Equipes', description: 'Kanban, Gantt, Calendriers et tableaux partagés.', category: 'Productivité', icon: TrendingUp, color: 'text-emerald-500 bg-emerald-500/10' },
  { id: 'dev', name: 'Outils Développeurs', description: 'Editeur de code, Terminal web, UML, REST & CRUD Gen, Sandbox SQL.', category: 'Ingénierie', icon: Terminal, color: 'text-blue-500 bg-blue-500/10', badge: 'Avancé' },
  { id: 'design', name: 'Outils Designers', description: 'Thèmes Tailwind, palettes de couleurs, export Figma, icones.', category: 'Créatif', icon: Palette, color: 'text-indigo-500 bg-indigo-500/10' },
  { id: 'architecture', name: 'Outils Architectes', description: 'Plan de chantiers, bibliothèque de matériaux, calculs.', category: 'Industrie', icon: Layers, color: 'text-amber-500 bg-amber-500/10' },
  { id: 'students', name: 'Espace Étudiants', description: 'Prise de notes Markdown, Flashcards, Quiz IA et révisions.', category: 'Académique', icon: BookOpen, color: 'text-violet-500 bg-violet-500/10' },
  { id: 'teachers', name: 'Espace Enseignants', description: 'Concepteur de cours, corrections assistées, supports IA.', category: 'Académique', icon: GraduationCap, color: 'text-pink-500 bg-pink-500/10' },
  { id: 'jobs', name: 'Recherche d\'Emploi', description: 'Création de CV, lettre de motivation et suivi de candidatures.', category: 'Carrière', icon: FileText, color: 'text-cyan-500 bg-cyan-500/10' },
  { id: 'business', name: 'Entreprises & Freelance', description: 'Factures professionnelles, CRM commercial, Business Plan, Contrats.', category: 'Finances', icon: Briefcase, color: 'text-rose-500 bg-rose-500/10', badge: 'SaaS' },
  { id: 'communication', name: 'Communication & Cloud', description: 'Chat collaboratif, visioconférence et espace Cloud.', category: 'Collaboration', icon: Network, color: 'text-teal-500 bg-teal-500/10' },
  { id: 'automation', name: 'Automatisation', description: 'Workflow builder visuel pour chaînes d\'actions automatiques.', category: 'Productivité', icon: Cpu, color: 'text-purple-500 bg-purple-500/10', badge: 'Bêta' },
  { id: 'apidocs', name: 'API Ouverte', description: 'Documentation Swagger interactive pour développeurs tiers.', category: 'Ingénierie', icon: Puzzle, color: 'text-slate-500 bg-slate-500/10' },
];

const PRESETS = [
  {
    name: 'Développeur Full Stack',
    desc: 'Optimisé pour le code, la DB et les APIs.',
    icon: Terminal,
    modules: ['projects', 'dev', 'communication', 'apidocs'],
    color: 'from-blue-500 to-indigo-600'
  },
  {
    name: 'Étudiant & Académique',
    desc: 'Optimisé pour les cours, révisions et flashcards.',
    icon: BookOpen,
    modules: ['projects', 'students', 'communication'],
    color: 'from-violet-500 to-fuchsia-600'
  },
  {
    name: 'Entrepreneur & Freelance',
    desc: 'Optimisé pour le CRM, les factures et business plan.',
    icon: Briefcase,
    modules: ['projects', 'business', 'communication', 'automation', 'apidocs'],
    color: 'from-rose-500 to-orange-600'
  },
  {
    name: 'Designer UI/UX',
    desc: 'Optimisé pour les chartes graphiques et Figma.',
    icon: Palette,
    modules: ['projects', 'design', 'communication'],
    color: 'from-pink-500 to-rose-600'
  },
  {
    name: 'Architecte Logiciel / BTP',
    desc: 'Optimisé pour les plans, calculs de surfaces.',
    icon: Layers,
    modules: ['projects', 'architecture', 'communication'],
    color: 'from-amber-500 to-yellow-600'
  },
  {
    name: 'Enseignant & Formateur',
    desc: 'Optimisé pour bâtir des cours et évaluer.',
    icon: GraduationCap,
    modules: ['projects', 'teachers', 'students', 'communication'],
    color: 'from-emerald-500 to-teal-600'
  }
];

export const ModuleCenter: React.FC = () => {
  const { activeModules, updateActiveModules, profileType, updateProfileType } = useApp();
  const [tab, setTab] = useState<'modules' | 'marketplace'>('modules');
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  const [installedPlugins, setInstalledPlugins] = useState<string[]>([]);
  const [installingPlugin, setInstallingPlugin] = useState<string | null>(null);

  const toggleModule = async (moduleId: string) => {
    let updated;
    if (activeModules.includes(moduleId)) {
      updated = activeModules.filter(m => m !== moduleId);
    } else {
      updated = [...activeModules, moduleId];
    }
    await updateActiveModules(updated);
  };

  const applyPreset = async (presetName: string, modules: string[]) => {
    setLoadingPreset(presetName);
    try {
      await updateProfileType(presetName);
      await updateActiveModules(modules);
    } finally {
      setLoadingPreset(null);
    }
  };

  const simulateInstall = (pluginId: string) => {
    setInstallingPlugin(pluginId);
    setTimeout(() => {
      setInstalledPlugins(prev => [...prev, pluginId]);
      setInstallingPlugin(null);
    }, 1500);
  };

  const simulateUninstall = (pluginId: string) => {
    setInstalledPlugins(prev => prev.filter(p => p !== pluginId));
  };

  const marketplaceItems = [
    { id: 'p1', name: 'Plugin Jira Sync', desc: 'Synchronise automatiquement vos tickets Jira avec Kanban.', rating: '4.8', creator: 'DevTeam', type: 'Extension' },
    { id: 'p2', name: 'Thème Cyberpunk Dark', desc: 'Un thème sombre vibrant avec effets néon cyberpunk.', rating: '4.9', creator: 'NeonDesign', type: 'Thème' },
    { id: 'p3', name: 'Modèle SaaS Startup', desc: 'Un modèle de business plan et CRM prêt à l\'usage.', rating: '4.7', creator: 'SaaSHero', type: 'Modèle' },
    { id: 'p4', name: 'Générateur API Rust', desc: 'Extension pour générer des backends d\'API REST en Rust actix.', rating: '4.6', creator: 'Rustacean', type: 'Extension' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* View Header */}
      <div>
        <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Puzzle className="text-taskAmber" />
          Centre de Modules & Configuration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Activez les modules dont vous avez besoin pour configurer une plateforme sur mesure.
        </p>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('modules')}
          className={`px-6 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'modules'
              ? 'bg-white dark:bg-slate-800 text-taskAmber shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Configuration des Modules
        </button>
        <button
          onClick={() => setTab('marketplace')}
          className={`px-6 py-2 text-xs font-semibold rounded-lg transition-all ${
            tab === 'marketplace'
              ? 'bg-white dark:bg-slate-800 text-taskAmber shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350'
          }`}
        >
          Marketplace d'Extensions
        </button>
      </div>

      {tab === 'modules' ? (
        <div className="space-y-8">
          {/* Presets / Profiles Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Award size={16} className="text-taskAmber" />
              Profils Prédéfinis (Actif: {profileType})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRESETS.map((p) => {
                const Icon = p.icon;
                const isCurrent = profileType === p.name;
                return (
                  <div
                    key={p.name}
                    className={`card-glass p-5 border relative overflow-hidden transition-all duration-200 ${
                      isCurrent 
                        ? 'border-taskAmber/50 ring-1 ring-taskAmber/30 bg-orange-500/5' 
                        : 'hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-tr ${p.color} text-white shrink-0 shadow-sm`}>
                        <Icon size={20} />
                      </div>
                      <div className="space-y-1 pr-6">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">{p.name}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-550 leading-relaxed font-medium">
                          {p.desc}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold">
                        {p.modules.length} Modules
                      </span>
                      <button
                        onClick={() => applyPreset(p.name, p.modules)}
                        disabled={loadingPreset !== null}
                        className={`text-[10px] px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          isCurrent 
                            ? 'bg-taskAmber text-white cursor-default' 
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {isCurrent ? (
                          <>
                            <Check size={12} />
                            <span>Profil Appliqué</span>
                          </>
                        ) : (
                          <>
                            {loadingPreset === p.name ? (
                              <span className="w-3 h-3 border-2 border-slate-550 border-t-transparent rounded-full animate-spin"></span>
                            ) : null}
                            <span>Appliquer</span>
                            <ArrowRight size={12} />
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Module Toggle Grid */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Layers size={16} className="text-taskAmber" />
              Sélection Manuelle des Modules
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_MODULES.map((m) => {
                const Icon = m.icon;
                const isActive = activeModules.includes(m.id);
                return (
                  <div
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    className={`card-glass p-4 border flex justify-between items-start cursor-pointer hover:-translate-y-0.5 transition-all duration-200 ${
                      isActive 
                        ? 'border-taskAmber/30 bg-orange-500/5' 
                        : 'hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${m.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100 truncate">{m.name}</h4>
                          {m.badge ? (
                            <span className="text-[8px] font-bold px-1 bg-orange-500 text-white rounded shrink-0 scale-90 uppercase">
                              {m.badge}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal pr-4">
                          {m.description}
                        </p>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                      isActive 
                        ? 'bg-taskAmber border-taskAmber text-white' 
                        : 'border-slate-300 dark:border-slate-800'
                    }`}>
                      {isActive ? <Check size={12} /> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Marketplace View */
        <div className="space-y-6">
          <div className="p-4 bg-orange-500/5 border border-taskAmber/20 rounded-2xl flex items-start gap-4">
            <div className="p-3 bg-orange-500/10 text-taskAmber rounded-xl">
              <Sparkles className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Extension ouverte de la plateforme</h4>
              <p className="text-[10px] text-slate-450 dark:text-slate-550 mt-0.5 leading-relaxed font-medium">
                Découvrez des thèmes uniques, des modèles prédéfinis de tableaux, et des intégrations créées par la communauté pour enrichir vos espaces de travail collaboratifs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {marketplaceItems.map((item) => {
              const isInstalled = installedPlugins.includes(item.id);
              const isInstalling = installingPlugin === item.id;
              return (
                <div key={item.id} className="card-glass p-5 border hover:border-slate-300 dark:hover:border-slate-700 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-amber-500 font-bold">★ {item.rating}</span>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-850 dark:text-slate-100">{item.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 dark:text-slate-550 font-medium">Par {item.creator}</span>
                    {isInstalled ? (
                      <button
                        onClick={() => simulateUninstall(item.id)}
                        className="text-[10px] font-bold text-rose-500 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 cursor-pointer transition-all"
                      >
                        Désinstaller
                      </button>
                    ) : (
                      <button
                        onClick={() => simulateInstall(item.id)}
                        disabled={isInstalling || installingPlugin !== null}
                        className="text-[10px] font-bold bg-gradient-to-tr from-orange-400 to-taskAmber text-white px-3 py-1.5 rounded-lg hover:shadow-md hover:shadow-orange-500/10 active:scale-95 cursor-pointer transition-all disabled:opacity-50"
                      >
                        {isInstalling ? 'Installation...' : 'Installer'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
