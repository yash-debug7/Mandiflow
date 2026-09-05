import React from 'react';
import { translations } from '../i18n';
import { Phone, Users, Monitor, BarChart3, Smartphone, Radio } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, lang, setLang, wsConnected }) {
  const t = translations[lang];

  const navItems = [
    { id: 'farmer', label: t.navFarmer, icon: Smartphone },
    { id: 'admin', label: t.navAdmin, icon: Users },
    { id: 'kiosk', label: t.navKiosk, icon: Monitor },
    { id: 'oversight', label: t.navOversight, icon: BarChart3 },
    { id: 'ivr', label: t.navIVR, icon: Phone, badge: 'Keypad Demo' },
  ];

  return (
    <header className="border-b border-[#E6DFC9] bg-[#FAF6EC]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand Logo & SIH Identity */}
          <div className="flex items-center gap-3.5 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2B2A25] flex items-center justify-center shadow-md flex-none">
                <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
                  <path d="M9 22c2-6 3-10 8-13 5 3 6 7 8 13" stroke="#C1592F" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                  <circle cx="17" cy="9" r="2.5" fill="#C68A2E"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-display font-extrabold text-[#2B2A25] tracking-tight">
                    MandiFlow
                  </span>
                  <span className="hidden sm:inline-block text-[11px] font-mono font-bold uppercase tracking-wider bg-[#F5E1D5] text-[#9A431F] px-2 py-0.5 rounded-full border border-[#C1592F]/20">
                    SIH26032
                  </span>
                </div>
                <div className="text-[12px] text-[#5C584E] font-medium hidden sm:block">
                  {t.sihBadge}
                </div>
              </div>
            </div>

            {/* Mobile Lang + Live Dot */}
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#E6DFC9] rounded-full text-[11px] font-mono">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-500'}`}></span>
                <span>{wsConnected ? 'LIVE' : 'SYNC'}</span>
              </div>
              <button
                onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
                className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#2B2A25] text-white border border-[#2B2A25]"
              >
                {lang === 'en' ? 'हिं' : 'EN'}
              </button>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center gap-1 bg-white p-1 rounded-full border border-[#E6DFC9] shadow-sm overflow-x-auto max-w-full">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#2B2A25] text-white shadow-sm'
                      : 'text-[#5C584E] hover:text-[#2B2A25] hover:bg-[#FAF6EC]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#C68A2E]' : 'text-[#5C584E]'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
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
          <div className="hidden md:flex items-center gap-3">
            {/* Live Socket status indicator */}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E6DFC9] rounded-full text-xs font-mono text-[#5C584E]">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-600 live-dot' : 'bg-amber-500'}`}></span>
              <span>{wsConnected ? 'LIVE SYNC' : 'OFFLINE'}</span>
            </div>

            {/* Bilingual Switcher */}
            <div className="flex items-center bg-white border border-[#E6DFC9] rounded-full p-0.5">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                  lang === 'en' ? 'bg-[#2B2A25] text-white' : 'text-[#5C584E] hover:text-[#2B2A25]'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                  lang === 'hi' ? 'bg-[#2B2A25] text-white' : 'text-[#5C584E] hover:text-[#2B2A25]'
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
