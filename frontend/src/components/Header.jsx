import React, { useState } from 'react';
import { translations } from '../i18n';
import { Phone, Users, Monitor, BarChart3, Smartphone, Building2, Volume2, VolumeX } from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  lang, 
  setLang, 
  wsConnected,
  soundEnabled = true,
  setSoundEnabled
}) {
  const t = translations[lang] || translations.en;
  const [hoveredTab, setHoveredTab] = useState(null);

  const navItems = [
    { id: 'farmer', label: t.navFarmer, icon: Smartphone },
    { id: 'admin', label: t.navAdmin, icon: Users },
    { id: 'csc', label: t.navCsc || 'No-Phone Sahayak', icon: Building2, badge: 'No-Phone' },
    { id: 'kiosk', label: t.navKiosk, icon: Monitor },
    { id: 'oversight', label: t.navOversight, icon: BarChart3 },
    { id: 'ivr', label: t.navIVR, icon: Phone, badge: 'IVR' },
  ];

  return (
    <header className="border-b border-[#E6DFC9]/80 bg-[#FAF6EC]/85 backdrop-blur-xl sticky top-0 z-40 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Brand Logo & SIH Identity */}
          <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-[#2B2A25] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300 flex-none relative overflow-hidden">
                <svg width="28" height="28" viewBox="0 0 34 34" fill="none" className="relative z-10">
                  <path d="M9 22c2-6 3-10 8-13 5 3 6 7 8 13" stroke="#C1592F" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                  <circle cx="17" cy="9" r="2.5" fill="#C68A2E"/>
                </svg>
                <div className="absolute inset-0 shimmer-bg rounded-xl" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-display font-extrabold text-[#2B2A25] tracking-tight">
                    MandiFlow
                  </span>
                  <span className="hidden sm:inline-flex text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-[#F5E1D5] to-[#F3E5C6] text-[#9A431F] px-2 py-0.5 rounded-full border border-[#C1592F]/15 shadow-sm">
                    SIH26032
                  </span>
                </div>
                <div className="text-[11px] text-[#5C584E] font-medium hidden sm:block leading-tight">
                  {t.sihBadge}
                </div>
              </div>
            </div>

            {/* Mobile Lang + Live Dot + Mute */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex items-center gap-1.5 px-2.5 py-1 glass-card rounded-full text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-500'}`}></span>
                <span className="text-[#5C584E]">{wsConnected ? 'LIVE' : 'SYNC'}</span>
              </div>
              <button
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#2B2A25] text-white border border-[#2B2A25] cursor-pointer hover:bg-[#1a1915] transition-colors active:scale-95"
              >
                {lang === 'en' ? 'हिं' : 'EN'}
              </button>
              {setSoundEnabled && (
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Mute All Sound" : "Unmute All Sound"}
                  className={`p-1.5 rounded-full border transition-all active:scale-95 cursor-pointer ${
                    soundEnabled 
                      ? 'glass-card text-[#43613B] border-[#E6DFC9]' 
                      : 'bg-[#F3DEDA] text-[#A63D3D] border-[#A63D3D]/30'
                  }`}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-0.5 bg-white/80 backdrop-blur-sm p-1 rounded-full border border-[#E6DFC9] shadow-sm overflow-x-auto max-w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isHovered = hoveredTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  onMouseEnter={() => setHoveredTab(item.id)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#2B2A25] text-white shadow-md'
                      : `text-[#5C584E] ${isHovered ? 'text-[#2B2A25] bg-[#FAF6EC]' : ''}`
                  }`}
                  style={{ transform: isActive ? 'scale(1)' : (isHovered ? 'scale(1.02)' : 'scale(1)') }}
                >
                  <Icon className={`w-3.5 h-3.5 transition-colors duration-200 ${isActive ? 'text-[#C68A2E]' : 'text-[#5C584E]'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] px-1.5 py-px rounded-full font-mono ${
                      isActive ? 'bg-[#C1592F] text-white' : 'bg-[#F3E5C6] text-[#8a6018]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Right Utilities */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Live Socket status indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 glass-card rounded-full text-[11px] font-mono text-[#5C584E]">
              <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${wsConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-500'}`}></span>
              <span>{wsConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
            </div>

            {/* Bilingual Switcher */}
            <div className="flex items-center glass-card rounded-full p-0.5">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 ${
                  lang === 'en' ? 'bg-[#2B2A25] text-white shadow-sm' : 'text-[#5C584E] hover:text-[#2B2A25]'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all duration-200 ${
                  lang === 'hi' ? 'bg-[#2B2A25] text-white shadow-sm' : 'text-[#5C584E] hover:text-[#2B2A25]'
                }`}
              >
                हिंदी
              </button>
            </div>

            {/* Mute / Sound toggle directly to the right of Hindi */}
            {setSoundEnabled && (
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute All PA Audio & Chimes" : "Unmute All PA Audio & Chimes"}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold cursor-pointer transition-all duration-200 border active:scale-95 shadow-2xs ${
                  soundEnabled 
                    ? 'glass-card text-[#43613B] border-[#E6DFC9] hover:bg-white hover:border-[#43613B]/40' 
                    : 'bg-[#F3DEDA] text-[#A63D3D] border-[#A63D3D]/40 hover:bg-[#ebd0cb]'
                }`}
              >
                {soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-[#43613B]" />
                    <span className="text-[10px] font-bold">MUTE</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-[#A63D3D]" />
                    <span className="text-[10px] font-bold">MUTED</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
