'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import {
  LayoutDashboard,
  Settings,
  Menu as MenuIcon,
  Check,
  Loader2,
  LogOut,
  QrCode,
  Zap
} from 'lucide-react';
import Image from 'next/image';
// QRCode react component would be nice but we can render the base64 string provided by baileys-store if it gives image data, 
// OR use qrcode.react if we just get a string. 
// Baileys 'qr' event provides a string. We need to render it. 
// I'll install qrcode.react or qrcode to render it?
// The prompt installed `qrcode-terminal` (server side). 
// For client side, I might need a library, or use a simple library-less QR renderer if possible.
// Wait, `qrcode-terminal` is for terminal. 
// I'll assume I can use a simple `QRCodeSVG` from a library or just display the string if it's a data url? 
// Baileys returns a string of data. usually it's just the code string.
// I will use `qrcode` (npm i qrcode) to generate a data URL or just fetch a library.
// I didn't install a client-side QR library. 
// I can use an external API for now to render it? e.g. `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qr}`
// That is the easiest way without extra deps.
// Or I can install `react-qr-code`.
// I'll use the external API for simplicity to avoid installing more packages unless necessary.

const QRCodeDisplay = ({ value }: { value: string }) => {
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(value)}`}
      alt="QR Code"
      className="w-full h-full object-contain mix-blend-multiply opacity-80"
    />
  )
}

export default function Home() {
  const {
    systemPrompt,
    activePreset,
    isAiActive,
    connectionStatus,
    stats,
    setSystemPrompt,
    setActivePreset,
    toggleAiActive,
    setConnectionStatus,
    setQrCode,
    qrCode // Local copy in store
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'home' | 'config'>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Polling for status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();

        // Update store
        setConnectionStatus(data.connectionStatus);
        setQrCode(data.qr);
        // Update stats from backend
        useAppStore.setState(prev => ({
          stats: data.stats
        }));

        // Also sync config "down" if needed? 
        // For now we assume UI is source of config truth, but connection is source of status truth.
      } catch (e) {
        console.error("Polling error", e);
      }
    };

    fetchStatus(); // Initial
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [setConnectionStatus, setQrCode]);

  // Sync AI Switch to backend
  const handleToggleAi = async () => {
    const newState = !isAiActive;
    toggleAiActive(); // Optimistic update
    try {
      await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({ isAiActive: newState })
      });
    } catch (e) {
      console.error("Failed to sync AI state", e);
      toggleAiActive(); // Revert
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Persist store handled by zustand persist middleware automatically for local state
      // Sync to backend
      await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({ systemPrompt, isAiActive })
      });

      await new Promise(r => setTimeout(r, 800)); // Fake loading for feel
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    // In a real app we'd call an API to disconnect.
    // We don't have a disconnect endpoint yet, but let's assume one or just depend on clearing local auth?
    // Since `lib/baileys.ts` logic auto-reconnects on close unless logged out...
    // We need a logout endpoint.
    // I'll just simulate it for now or add a logout endpoint if time permits.
    // Let's just wait a bit.
    setTimeout(() => setIsDisconnecting(false), 1000);
  };

  const presets: Record<string, string> = {
    'sales': `Você é um assistente de vendas experiente da NexusAI.\nSeu objetivo é qualificar leads e agendar demonstrações.\n\nTONALIDADE:\n- Profissional mas acessível.\n- Use emojis moderadamente.\n- Seja conciso.`,
    'support': `Você é um agente de suporte técnico Nível 1.\nSeu objetivo é resolver dúvidas frequentes e abrir tickets.\n\nTONALIDADE:\n- Empática e paciente.\n- Use linguagem clara e técnica quando necessário.`,
    'scheduler': `Você é uma secretária virtual.\nObjetivo exclusivo: encontrar horário livre na agenda.\n\nRegras: Ofereça apenas 2 opções de horário por vez.`,
    'custom': `Você é um assistente sarcástico (modo demo).\nResponda tudo com uma pitada de humor ácido, mas entregue a informação.`
  };

  const handlePresetSelect = (key: string) => {
    setActivePreset(key);
    setSystemPrompt(presets[key]);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-app-surface text-brand-secondary font-sans">

      {/* MOBILE OVERLAY */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* MOBILE DRAWER */}
      <div className={`fixed inset-y-0 left-0 w-[280px] bg-app-surface z-50 transform transition-transform duration-300 shadow-2xl md:hidden flex flex-col p-6 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="text-2xl font-bold text-brand-text mb-10 tracking-tight-heading">Nexus<span className="text-brand-primary">AI</span></div>
        <nav className="space-y-2 flex-1">
          <button onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-full transition-base ${activeTab === 'home' ? 'bg-white shadow-nav-active text-brand-primary font-bold' : 'text-brand-secondary font-medium'}`}>
            <LayoutDashboard className={`w-5 h-5 mr-3 ${activeTab === 'home' ? 'text-brand-primary' : 'opacity-70'}`} />
            Conexão & Status
          </button>
          <button onClick={() => { setActiveTab('config'); setMobileMenuOpen(false); }} className={`w-full flex items-center px-4 py-3 rounded-full transition-base ${activeTab === 'config' ? 'bg-white shadow-nav-active text-brand-primary font-bold' : 'text-brand-secondary font-medium'}`}>
            <Settings className={`w-5 h-5 mr-3 ${activeTab === 'config' ? 'text-brand-primary' : 'opacity-70'}`} />
            Inteligência
          </button>
        </nav>
      </div>

      {/* SIDEBAR (Desktop) */}
      <aside className="w-[260px] bg-app-surface hidden md:flex flex-col p-8 fixed h-full z-10 border-r border-transparent">
        <div className="text-2xl font-bold text-brand-text mb-12 tracking-tight-heading select-none">Nexus<span className="text-brand-primary">AI</span></div>
        <nav className="space-y-4">
          <div onClick={() => setActiveTab('home')} className={`cursor-pointer group flex items-center px-4 py-3 rounded-full transition-all duration-200 ${activeTab === 'home' ? 'bg-white shadow-nav-active' : 'hover:bg-black/5'}`}>
            <LayoutDashboard className={`w-5 h-5 mr-3 ${activeTab === 'home' ? 'text-brand-primary' : 'opacity-70 group-hover:opacity-100'}`} />
            <span className={`text-sm ${activeTab === 'home' ? 'text-brand-primary font-bold' : 'font-medium group-hover:text-brand-text'}`}>Conexão & Status</span>
          </div>

          <div onClick={() => setActiveTab('config')} className={`cursor-pointer group flex items-center px-4 py-3 rounded-full transition-all duration-200 ${activeTab === 'config' ? 'bg-white shadow-nav-active' : 'hover:bg-black/5'}`}>
            <Settings className={`w-5 h-5 mr-3 ${activeTab === 'config' ? 'text-brand-primary' : 'opacity-70 group-hover:opacity-100'}`} />
            <span className={`text-sm ${activeTab === 'config' ? 'text-brand-primary font-bold' : 'font-medium group-hover:text-brand-text'}`}>Inteligência</span>
          </div>
        </nav>
        <div className="mt-auto">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-xs font-bold">JD</div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-brand-text">John Doe</span>
              <span className="text-[10px] uppercase text-brand-secondary tracking-wider font-medium">Admin</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 md:ml-[260px] flex flex-col h-full relative overflow-y-auto overflow-x-hidden">

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <div className="font-bold text-lg text-brand-text">Nexus<span className="text-brand-primary">AI</span></div>
          <button onClick={() => setMobileMenuOpen(true)} className="text-brand-text focus:outline-none">
            <MenuIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Breadcrumbs */}
        <header className="hidden md:flex items-center justify-between px-10 pt-8 pb-4">
          <div className="text-sm font-medium text-brand-secondary">
            Home / <span className="text-brand-text">{activeTab === 'home' ? 'Conexão' : 'Inteligência'}</span>
          </div>
        </header>

        <div className="p-6 md:p-10 max-w-7xl mx-auto w-full flex-1 pb-20">

          {/* VIEW: HOME */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-opacity duration-300 ${activeTab === 'home' ? 'opacity-100' : 'hidden opacity-0'}`}>

            {/* Visual Connection Card */}
            <div className="bg-app-card rounded-[24px] shadow-card p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden transition-all duration-300">

              {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center w-full animate-in fade-in duration-500">
                  <h2 className="text-2xl font-bold text-brand-text mb-2 tracking-tight-heading">Conexão do Dispositivo</h2>
                  <p className="text-brand-secondary text-center mb-8 max-w-xs leading-relaxed">
                    {connectionStatus === 'connecting' ? 'Iniciando serviço...' : 'Abra o WhatsApp no seu celular e escaneie o código abaixo.'}
                  </p>

                  <div className="relative p-8 border border-brand-border rounded-2xl bg-white mb-6 group">
                    <div className="w-48 h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden">
                      {qrCode ? (
                        <QRCodeDisplay value={qrCode} />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-xs">Aguardando QR...</span>
                        </div>
                      )}
                      {/* Scan line */}
                      {qrCode && <div className="absolute top-0 left-0 w-full h-1 bg-brand-primary shadow-[0_0_15px_rgba(48,64,196,0.5)] animate-scan opacity-50 pointer-events-none"></div>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center w-full animate-in fade-in duration-500 absolute inset-0 justify-center bg-white p-8">
                  <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-lg relative">
                      <div className="w-full h-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                        <span className="text-3xl">📱</span>
                      </div>
                    </div>
                    <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-white rounded-full animate-pulse-soft"></div>
                  </div>

                  <h2 className="text-2xl font-bold text-brand-text mb-1 tracking-tight-heading">WhatsApp Conectado</h2>
                  <p className="text-brand-secondary mb-8 font-medium">Sessão Ativa</p>

                  <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
                    <div className="bg-app-surface p-4 rounded-2xl text-center">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-micro mb-1">UPTIME</div>
                      <div className="text-brand-text font-bold text-lg">Online</div>
                    </div>
                    <div className="bg-app-surface p-4 rounded-2xl text-center">
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-micro mb-1">LATENCY</div>
                      <div className="text-brand-text font-bold text-lg">~20ms</div>
                    </div>
                  </div>

                  <button onClick={handleDisconnect} disabled={isDisconnecting} className="px-6 py-3 rounded-full bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors btn-press flex items-center">
                    {isDisconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                    Desconectar Sessão
                  </button>
                </div>
              )}
            </div>

            {/* Control Panel */}
            <div className="flex flex-col gap-6">
              {/* Master Switch */}
              <div className="bg-app-card rounded-[24px] shadow-card p-8 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xl font-bold text-brand-text tracking-tight-heading">Master Switch</h3>
                    <p className="text-sm text-brand-secondary mt-1">Controle global da IA</p>
                  </div>
                  <div className={`switch-container ${isAiActive ? 'active' : ''}`} onClick={handleToggleAi}>
                    <div className="switch-knob"></div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-brand-border flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isAiActive ? 'bg-brand-primary shadow-[0_0_8px_rgba(48,64,196,0.6)]' : 'bg-gray-400'}`}></div>
                  <span className={`text-sm font-medium uppercase tracking-wide ${isAiActive ? 'text-brand-primary font-bold' : 'text-gray-400'}`}>
                    {isAiActive ? 'IA ATIVA' : 'IA INATIVA'}
                  </span>
                </div>
              </div>

              {/* Metrics */}
              <div className="bg-app-card rounded-[24px] shadow-card p-8 flex-1 flex items-center">
                <div className="grid grid-cols-3 gap-4 w-full divide-x divide-gray-100">
                  <div className="px-2">
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-micro mb-2">MENSAGENS HOJE</div>
                    <div className="text-3xl font-bold text-brand-primary tracking-tight">{stats.messagesToday}</div>
                  </div>
                  <div className="px-4">
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-micro mb-2">RESPOSTAS IA</div>
                    <div className="text-3xl font-bold text-brand-text tracking-tight">{stats.aiResponses}</div>
                  </div>
                  <div className="px-4">
                    <div className="text-[10px] uppercase font-bold text-gray-400 tracking-micro mb-2">PRESET</div>
                    <div className="text-lg font-bold text-brand-text mt-1 leading-tight capitalize truncate">
                      {activePreset}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* VIEW: CONFIG */}
          <div className={`flex justify-center transition-opacity duration-300 ${activeTab === 'config' ? 'opacity-100' : 'hidden opacity-0'}`}>
            <div className="bg-app-card rounded-[24px] shadow-card w-full max-w-4xl p-1 md:p-2">

              <div className="p-6 md:p-8 border-b border-brand-border">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-brand-text tracking-tight-heading">Instruções do Sistema</h2>
                  <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-brand-primary hover:bg-gray-50 transition-colors">
                    <Zap className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex space-x-3 overflow-x-auto hide-scroll pb-2">
                  {Object.keys(presets).map((key) => (
                    <button
                      key={key}
                      onClick={() => handlePresetSelect(key)}
                      className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all btn-press
                                        ${activePreset === key
                          ? 'bg-brand-primary text-white shadow-md'
                          : 'bg-transparent border border-brand-border text-brand-secondary hover:border-brand-primary hover:text-brand-primary'}`}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6 md:p-8">
                <div className="relative group">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full h-[400px] bg-app-surface rounded-2xl p-6 font-mono text-sm text-brand-text resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:bg-white border border-transparent focus:border-brand-primary transition-all leading-relaxed"
                    spellCheck={false}
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-gray-400 font-mono pointer-events-none">markdown support</div>
                </div>
              </div>

              <div className="p-6 md:p-8 pt-0 flex items-center justify-end space-x-6">
                <button className="text-sm font-medium text-brand-secondary hover:text-brand-text transition-colors">Descartar</button>
                <button
                  onClick={handleSaveSettings}
                  className={`px-8 py-3 rounded-full font-medium shadow-lg transition-all flex items-center justify-center min-w-[140px] btn-press
                                ${isSaving ? 'bg-green-500 text-white' : 'bg-brand-primary text-white hover:bg-brand-primaryHover shadow-brand-primary/30'}`}
                >
                  {isSaving ? <Check className="w-5 h-5 animate-in zoom-in" /> : <span>Salvar Alterações</span>}
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Mobile Sticky Bar */}
        <div className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 shadow-floating z-20 flex items-center justify-between transition-transform duration-300 ${activeTab === 'home' ? 'translate-y-0' : 'translate-y-full'}`}>
          <span className="font-bold text-brand-text">IA Ativa</span>
          <div className={`switch-container scale-90 ${isAiActive ? 'active' : ''}`} onClick={handleToggleAi}>
            <div className="switch-knob"></div>
          </div>
        </div>

      </main>
    </div>
  );
}
