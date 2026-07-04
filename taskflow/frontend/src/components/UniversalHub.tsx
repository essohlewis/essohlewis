"use client";

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Sparkles, Send, Bot, User, ClipboardList, Loader2, ArrowRight } from 'lucide-react';

export const UniversalHub: React.FC = () => {
  const { currentWorkspace, currentTenant, token, refreshTasks } = useApp();
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    { role: 'assistant', content: "Bonjour ! Je suis Antigravity, votre assistant intelligent. Comment puis-je vous aider aujourd'hui ? Je peux vous aider à rédiger des tâches, concevoir un plan d'étude ou optimiser votre flux de travail." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Project Generator state
  const [projectIdea, setProjectIdea] = useState('');
  const [generatorLoading, setGeneratorLoading] = useState(false);
  const [generatorMessage, setGeneratorMessage] = useState('');

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessage,
          history: chatHistory
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur de communication avec l'IA.");

      setChatHistory(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `⚠️ Une erreur est survenue : ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectIdea.trim() || generatorLoading) return;

    setGeneratorLoading(true);
    setGeneratorMessage('');

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      if (currentTenant) {
        headers['X-Tenant-Id'] = String(currentTenant.id);
        headers['X-Tenant-Slug'] = currentTenant.slug;
      }

      const res = await fetch('/api/ai/generate-tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectDescription: projectIdea.trim(),
          workspaceId: currentWorkspace.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur lors de la génération des tâches.");

      setGeneratorMessage(`✅ ${data.message}`);
      setProjectIdea('');
      // Refresh tasks in global context
      refreshTasks();
    } catch (err: any) {
      setGeneratorMessage(`❌ ${err.message}`);
    } finally {
      setGeneratorLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* View Header */}
      <div>
        <h1 className="text-2xl font-bold font-serif text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="text-taskAmber animate-pulse" />
          Hub Universel & Intelligence Artificielle
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Générez des projets entiers et discutez en temps réel avec votre assistant intelligent ({currentTenant ? `Organisation: ${currentTenant.name}` : "Compte Personnel"}).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chat Interface (Left - 2 Cols) */}
        <div className="lg:col-span-2 card-glass p-6 flex flex-col h-[600px]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-taskAmber flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150">Assistant IA Antigravity</h3>
                <span className="text-[10px] text-green-500 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping"></span> En ligne (Gemini)
                </span>
              </div>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
            {chatHistory.map((msg, index) => {
              const isUser = msg.role === 'user';
              return (
                <div key={index} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-taskAmber flex items-center justify-center shrink-0">
                      <Bot size={15} />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                    isUser 
                      ? 'bg-gradient-to-tr from-orange-400 to-taskAmber text-white rounded-tr-none' 
                      : 'bg-slate-100 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-800/40'
                  }`}>
                    {/* Render Markdown or plaintext nicely */}
                    <div className="whitespace-pre-line font-medium">{msg.content}</div>
                  </div>
                  {isUser && (
                    <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center shrink-0 font-bold text-xs uppercase">
                      U
                    </div>
                  )}
                </div>
              );
            })}
            {chatLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 text-taskAmber flex items-center justify-center shrink-0 animate-bounce">
                  <Bot size={15} />
                </div>
                <div className="bg-slate-100 dark:bg-slate-900/60 rounded-2xl rounded-tl-none p-3 border border-slate-200/50 dark:border-slate-800/40 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin text-taskAmber" />
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Antigravity réfléchit...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendChat} className="pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 shrink-0">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Posez une question sur vos projets ou demandez de l'aide..."
              className="flex-1 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-taskAmber"
            />
            <button
              type="submit"
              disabled={chatLoading || !chatInput.trim()}
              className="p-2.5 bg-gradient-to-tr from-orange-400 to-taskAmber text-white rounded-xl hover:shadow-md hover:shadow-orange-500/10 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Task Planner Sidebar (Right - 1 Col) */}
        <div className="space-y-6">
          <div className="card-glass p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-taskAmber flex items-center justify-center">
                <ClipboardList size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-150">Générateur de projet IA</h3>
            </div>
            
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-4 leading-relaxed font-medium">
              Décrivez votre projet (ex: "Créer un site web de portfolio pour un photographe" ou "Préparer un examen d'algorithmique") et l'IA créera automatiquement une liste de tâches ciblées dans cet espace.
            </p>

            <form onSubmit={handleGenerateTasks} className="space-y-4">
              <div>
                <textarea
                  value={projectIdea}
                  onChange={e => setProjectIdea(e.target.value)}
                  placeholder="Décrivez votre idée de projet..."
                  rows={4}
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-taskAmber resize-none"
                />
              </div>

              {generatorMessage && (
                <div className={`p-2.5 rounded-lg text-[10px] font-semibold text-center ${
                  generatorMessage.startsWith('❌') 
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
                    : 'bg-green-500/10 text-green-500 border border-green-500/20'
                }`}>
                  {generatorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={generatorLoading || !projectIdea.trim()}
                className="w-full py-2 bg-gradient-to-tr from-orange-400 to-taskAmber text-white text-xs font-semibold rounded-xl hover:shadow-md hover:shadow-orange-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generatorLoading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Génération en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Générer les tâches</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="card-glass p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">💡 Suggestions de prompts</h4>
            <div className="space-y-2">
              {[
                "Comment organiser un déménagement d'entreprise ?",
                "Crée-moi un plan pour lancer un produit SaaS en 5 étapes",
                "Quelles sont les meilleures pratiques pour sécuriser une API Node.js ?"
              ].map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => setChatInput(s)}
                  className="w-full text-left p-2 bg-slate-50 dark:bg-slate-900/30 hover:bg-orange-500/5 hover:text-taskAmber rounded-lg text-[10px] text-slate-400 dark:text-slate-500 transition-colors border border-slate-200/40 dark:border-slate-800/30 truncate block"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
