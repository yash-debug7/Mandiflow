import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { Monitor, Volume2, Wifi } from 'lucide-react';

export default function KioskDisplay({ centres, lang, bookings }) {
  const t = translations[lang];
  const [kioskCentreId, setKioskCentreId] = useState('sitapur');
  const [tick, setTick] = useState(0);

  // Refresh clock
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const currentCentre = centres.find(c => c.id === kioskCentreId) || centres[0];
  const centreBookings = bookings.filter(b => b.centre_id === kioskCentreId);
  const nowServing = centreBookings.find(b => b.status === 'called');
  const upcoming = centreBookings
    .filter(b => b.status === 'waiting')
    .sort((a, b) => (b.priority - a.priority) || (a.token - b.token))
    .slice(0, 8);

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const waitingCount = centreBookings.filter(b => b.status === 'waiting').length;
  const servedCount = centreBookings.filter(b => b.status === 'served').length;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Centre selector */}
      <motion.div 
        className="flex justify-center gap-2 mb-6 flex-wrap"
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      >
        {centres.map((c) => (
          <button
            key={c.id}
            onClick={() => setKioskCentreId(c.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer ${
              c.id === kioskCentreId 
                ? 'bg-[#2B2A25] text-white border-[#2B2A25] shadow-md' 
                : 'bg-white text-[#5C584E] border-[#E6DFC9] hover:border-[#2B2A25] hover:shadow-sm'
            }`}
          >
            {c.name}
          </button>
        ))}
      </motion.div>

      {/* High-Contrast Yard Display */}
      <motion.div 
        className="bg-gradient-to-b from-[#2B2A25] via-[#1E1D19] to-[#141310] text-white rounded-3xl p-8 sm:p-12 text-center shadow-2xl border border-[#3D3A33] relative overflow-hidden grain-overlay"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Decorative corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#C1592F]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#C68A2E]/5 rounded-full blur-3xl" />

        {/* Top Bar */}
        <div className="relative z-10 flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#C68A2E]">
            <Monitor className="w-4 h-4" />
            <span className="uppercase tracking-widest font-bold">{currentCentre?.name}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[#D9D4C6]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
              <span>LIVE</span>
            </div>
            <span>{dateStr}</span>
          </div>
        </div>

        {/* Clock */}
        <div className="relative z-10 text-xs font-mono text-[#5C584E] tracking-[0.25em] uppercase mb-2">
          {timeStr}
        </div>

        <div className="relative z-10 text-sm sm:text-base font-bold text-[#D9D4C6] tracking-wider uppercase">
          {t.kioskTitle}
        </div>

        {/* Gigantic Token Display */}
        <AnimatePresence mode="wait">
          <motion.div
            key={nowServing?.token || 'none'}
            initial={{ opacity: 0, y: 30, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 150 }}
            className="text-7xl sm:text-9xl md:text-[140px] font-mono font-extrabold my-4 leading-none tracking-tight relative z-10"
            style={{
              background: nowServing 
                ? 'linear-gradient(180deg, #C1592F 0%, #9A431F 100%)' 
                : 'linear-gradient(180deg, #5C584E 0%, #3D3A33 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {nowServing ? `#${String(nowServing.token).padStart(3, '0')}` : '—'}
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 text-base sm:text-lg font-medium text-[#FAF6EC] mt-2">
          {nowServing ? (
            <span>
              {nowServing.farmer_name} · <strong className="text-[#C68A2E]">{nowServing.crop}</strong>
              {nowServing.priority ? ' (★ Priority)' : ''}
            </span>
          ) : (
            <span className="text-[#5C584E]">Waiting for next token dispatch...</span>
          )}
        </div>

        {/* Quick Stats Strip */}
        <div className="relative z-10 flex justify-center gap-6 mt-6 mb-8">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#FAF6EC]">{waitingCount}</div>
            <div className="text-[10px] text-[#5C584E] uppercase tracking-wider mt-0.5">In Queue</div>
          </div>
          <div className="w-px bg-white/10 h-10 self-center" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#43613B]">{servedCount}</div>
            <div className="text-[10px] text-[#5C584E] uppercase tracking-wider mt-0.5">Served</div>
          </div>
          <div className="w-px bg-white/10 h-10 self-center" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#C68A2E]">{currentCentre?.slot_capacity || 25}</div>
            <div className="text-[10px] text-[#5C584E] uppercase tracking-wider mt-0.5">Capacity</div>
          </div>
        </div>

        {/* Upcoming Tokens Strip */}
        <div className="relative z-10 pt-8 border-t border-white/10">
          <div className="text-xs font-mono text-[#D9D4C6] uppercase tracking-wider mb-4">
            {t.kioskUpcoming}
          </div>
          
          <div className="flex justify-center items-center gap-3 flex-wrap stagger-children">
            {upcoming.length > 0 ? (
              upcoming.map((b) => (
                <motion.div
                  key={b.id}
                  whileHover={{ scale: 1.08, y: -2 }}
                  className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-white font-mono text-xl sm:text-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-colors"
                >
                  <span>#{String(b.token).padStart(3, '0')}</span>
                  {b.priority === 1 && <span className="text-[#C68A2E] text-sm">★</span>}
                </motion.div>
              ))
            ) : (
              <div className="text-xs text-[#D9D4C6]/50 font-mono">No other tokens currently in queue</div>
            )}
          </div>
        </div>

        {/* Bottom Ticker */}
        <div className="relative z-10 mt-8 text-[11px] font-mono text-[#5C584E] tracking-wider">
          {t.kioskSub}
        </div>
      </motion.div>
    </div>
  );
}
