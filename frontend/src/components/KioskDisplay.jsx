import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { Monitor, Volume2, VolumeX, Radio, Sparkles, Building2 } from 'lucide-react';

export default function KioskDisplay({ 
  centres, 
  lang, 
  bookings, 
  soundEnabled: propSoundEnabled, 
  setSoundEnabled: propSetSoundEnabled 
}) {
  const t = translations[lang] || translations.en;
  const [kioskCentreId, setKioskCentreId] = useState('sitapur');
  const [tick, setTick] = useState(0);
  const [localSoundEnabled, setLocalSoundEnabled] = useState(true);
  
  const soundEnabled = propSoundEnabled !== undefined ? propSoundEnabled : localSoundEnabled;
  const setSoundEnabled = propSetSoundEnabled || setLocalSoundEnabled;

  const [lastAnnouncedToken, setLastAnnouncedToken] = useState(null);
  const [paAnnouncementText, setPaAnnouncementText] = useState('');

  const audioCtxRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    // When muting, immediately cancel any in-progress speech
    if (!soundEnabled && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [soundEnabled]);

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

  const playMandiChime = () => {
    if (!soundEnabledRef.current) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(880.0, now + 0.3);
      gain2.gain.setValueAtTime(0.24, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 0.9);
    } catch (e) { /* silent */ }
  };

  const announceToken = (token, name, bay = 2) => {
    const hiText = `ध्यान दें! टोकन नंबर ${token}, किसान ${name}, कृपया तौल शेड ${bay} पर पहुंचे।`;
    const enText = `Attention! Token number ${token}, Farmer ${name}, please report to Weighing Bay ${bay}.`;
    setPaAnnouncementText(`${hiText} · ${enText}`);

    if (soundEnabledRef.current) {
      playMandiChime();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          // Re-check mute state right before speaking (user might have muted during the delay)
          if (!soundEnabledRef.current) return;
          const uHi = new SpeechSynthesisUtterance(hiText);
          uHi.lang = 'hi-IN';
          uHi.rate = 0.9;
          const uEn = new SpeechSynthesisUtterance(enText);
          uEn.lang = 'en-IN';
          uEn.rate = 0.95;
          window.speechSynthesis.speak(uHi);
          window.speechSynthesis.speak(uEn);
        }, 700);
      }
    }
  };

  // Auto announce when now serving changes
  useEffect(() => {
    if (nowServing && nowServing.token !== lastAnnouncedToken) {
      setLastAnnouncedToken(nowServing.token);
      announceToken(nowServing.token, nowServing.farmer_name, 2);
    }
  }, [nowServing?.token]);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-4">
      {/* Top Controls: Centre selector & Sound Toggle */}
      <motion.div 
        className="flex items-center justify-between gap-3 flex-wrap"
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => announceToken(nowServing ? nowServing.token : 42, nowServing ? nowServing.farmer_name : 'Ram Singh', 2)}
            className="px-3 py-1.5 rounded-xl bg-[#FAF6EC] hover:bg-[#E6DFC9] border border-[#E6DFC9] text-[#2B2A25] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-2xs"
          >
            <Radio className="w-3.5 h-3.5 text-[#C1592F]" />
            <span>PA Re-Announce</span>
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6EC] border border-[#E6DFC9] text-[#2B2A25] text-xs font-mono flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#43613B]" /> : <VolumeX className="w-3.5 h-3.5 text-[#A63D3D]" />}
            <span>{soundEnabled ? 'PA AUDIO ON' : 'PA MUTED'}</span>
          </button>
        </div>
      </motion.div>

      {/* High-Contrast Yard Display */}
      <motion.div 
        className="bg-gradient-to-b from-[#2B2A25] via-[#1E1D19] to-[#141310] text-white rounded-3xl p-8 sm:p-12 text-center shadow-2xl border border-[#3D3A33] relative overflow-hidden grain-overlay"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#C1592F]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-40 h-40 bg-[#C68A2E]/5 rounded-full blur-3xl" />

        {/* Top Bar */}
        <div className="relative z-10 flex justify-between items-center mb-4">
          <div className="flex items-center gap-2 text-[11px] font-mono text-[#C68A2E]">
            <Monitor className="w-4 h-4" />
            <span className="uppercase tracking-widest font-bold">{currentCentre?.name}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono text-[#D9D4C6]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 live-dot" />
              <span>LIVE YARD TV</span>
            </div>
            <span>{dateStr}</span>
          </div>
        </div>

        {/* Clock */}
        <div className="relative z-10 text-xs font-mono text-[#8C887B] tracking-[0.25em] uppercase mb-2">
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
              <span className="text-[#9EE86F] ml-2">→ Report to Bay 2</span>
              {nowServing.priority ? ' (★ Priority)' : ''}
            </span>
          ) : (
            <span className="text-[#8C887B]">Waiting for next token dispatch...</span>
          )}
        </div>

        {/* Live PA Broadcast Ticker inside Kiosk */}
        {paAnnouncementText && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 my-4 py-2 px-4 rounded-xl bg-white/5 border border-white/10 font-mono text-[11px] text-[#9EE86F] flex items-center justify-center gap-2"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#C68A2E] animate-bounce" />
            <span>📢 PA Broadcast: {paAnnouncementText}</span>
          </motion.div>
        )}

        {/* Quick Stats Strip */}
        <div className="relative z-10 flex justify-center gap-6 mt-6 mb-8">
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#FAF6EC]">{waitingCount}</div>
            <div className="text-[10px] text-[#8C887B] uppercase tracking-wider mt-0.5">In Queue</div>
          </div>
          <div className="w-px bg-white/10 h-10 self-center" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#9EE86F]">{servedCount}</div>
            <div className="text-[10px] text-[#8C887B] uppercase tracking-wider mt-0.5">Served Today</div>
          </div>
          <div className="w-px bg-white/10 h-10 self-center" />
          <div className="text-center">
            <div className="text-2xl font-mono font-bold text-[#C68A2E]">{currentCentre?.slot_capacity || 25}</div>
            <div className="text-[10px] text-[#8C887B] uppercase tracking-wider mt-0.5">Bay Capacity</div>
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
        <div className="relative z-10 mt-8 text-[11px] font-mono text-[#8C887B] tracking-wider">
          {t.kioskSub} · Zero-phone farmers please listen for loudspeaker audio call
        </div>
      </motion.div>
    </div>
  );
}
