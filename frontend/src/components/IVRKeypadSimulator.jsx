import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { 
  Phone, PhoneCall, PhoneOff, Volume2, VolumeX, CheckCircle, 
  Sparkles, Zap, Hash, Delete
} from 'lucide-react';
import { API_BASE_URL } from '../config';

// Standard DTMF Dual-Tone Frequencies (Hz)
const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

export default function IVRKeypadSimulator({ 
  lang, 
  onIVRBookingCreated,
  soundEnabled: propSoundEnabled,
  setSoundEnabled: propSetSoundEnabled
}) {
  const t = translations[lang];

  const [callActive, setCallActive] = useState(false);
  const [currentStep, setCurrentStep] = useState('welcome');
  const [ivrLang, setIvrLang] = useState('hi');
  const [centreId, setCentreId] = useState('sitapur');
  const [lcdText, setLcdText] = useState('DIAL TO START');
  const [audioPrompt, setAudioPrompt] = useState('');
  const [localSoundEnabled, setLocalSoundEnabled] = useState(true);

  const soundEnabled = propSoundEnabled !== undefined ? propSoundEnabled : localSoundEnabled;
  const setSoundEnabled = propSetSoundEnabled || setLocalSoundEnabled;

  const [lastCreatedBooking, setLastCreatedBooking] = useState(null);
  const [activeOptions, setActiveOptions] = useState([]);
  const [pressedKey, setPressedKey] = useState(null);
  
  // Digit buffer for multi-digit token entry
  const [digitBuffer, setDigitBuffer] = useState('');
  const [isTokenEntryMode, setIsTokenEntryMode] = useState(false);
  
  const audioCtxRef = useRef(null);

  const playDTMF = (digit) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const freqs = DTMF_FREQS[digit];
      if (!freqs) return;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.frequency.value = freqs[0];
      osc2.frequency.value = freqs[1];
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.16);
      osc2.stop(ctx.currentTime + 0.16);
    } catch (e) { /* silent */ }
  };

  const speakPrompt = (text, languageCode) => {
    if (!soundEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageCode === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startCall = async () => {
    setCallActive(true);
    setLastCreatedBooking(null);
    setDigitBuffer('');
    setIsTokenEntryMode(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ivr/simulator/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'welcome', digit: null, lang: 'hi' })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentStep(data.step);
        setLcdText(data.audio_text);
        setAudioPrompt(data.audio_text);
        setActiveOptions(data.options || []);
        speakPrompt(data.audio_text, 'hi');
      }
    } catch (err) {
      console.error('Failed to start IVR call:', err);
    }
  };

  const endCall = () => {
    setCallActive(false);
    setCurrentStep('welcome');
    setLcdText('CALL DISCONNECTED');
    setActiveOptions([]);
    setDigitBuffer('');
    setIsTokenEntryMode(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const sendDigitToBackend = async (digit) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/ivr/simulator/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: currentStep, digit, lang: ivrLang, centre_id: centreId })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentStep(data.step);
        if (data.lang) setIvrLang(data.lang);
        if (data.centre_id) setCentreId(data.centre_id);
        setLcdText(data.audio_text);
        setAudioPrompt(data.audio_text);
        setActiveOptions(data.options || []);
        speakPrompt(data.audio_text, data.lang || ivrLang);
        
        // Check if next step requires token number entry
        if (data.step === 'enter_token_status' || data.step === 'enter_token_payment') {
          setIsTokenEntryMode(true);
          setDigitBuffer('');
        } else {
          setIsTokenEntryMode(false);
          setDigitBuffer('');
        }
        
        if (data.booking) {
          setLastCreatedBooking(data.booking);
          if (onIVRBookingCreated) onIVRBookingCreated(data.booking);
        }
        if (data.call_ended) {
          setTimeout(() => {
            setCallActive(false);
            setIsTokenEntryMode(false);
            setDigitBuffer('');
          }, 7000);
        }
      }
    } catch (err) {
      console.error('IVR digit error:', err);
    }
  };

  const handleKeyPress = async (digit) => {
    playDTMF(digit);
    setPressedKey(digit);
    setTimeout(() => setPressedKey(null), 150);
    if (!callActive) return;

    // If we're in token entry mode, accumulate digits until # is pressed
    if (isTokenEntryMode) {
      if (digit === '#') {
        // Submit the accumulated digits
        const tokenDigits = digitBuffer;
        if (tokenDigits.length > 0) {
          setLcdText(`Submitting Token #${tokenDigits}...`);
          await sendDigitToBackend(tokenDigits);
        } else {
          setLcdText('Please enter token number first, then press #');
        }
        return;
      }
      if (digit === '*') {
        // Clear buffer
        setDigitBuffer('');
        setLcdText('Buffer cleared. Enter token number, then press #');
        return;
      }
      // Accumulate digit
      const newBuf = digitBuffer + digit;
      setDigitBuffer(newBuf);
      setLcdText(`Entering Token: ${newBuf}_\nPress # to confirm`);
      return;
    }

    // Normal single-digit menu navigation
    await sendDigitToBackend(digit);
  };

  // Keyboard listener for physical keyboard entry
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (!callActive) return;
      const k = e.key;
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'].includes(k)) {
        handleKeyPress(k);
      } else if (k === 'Enter') {
        handleKeyPress('#');
      } else if (k === 'Backspace') {
        handleKeyPress('*');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callActive, isTokenEntryMode, digitBuffer, currentStep, ivrLang, centreId]);

  const keypadKeys = [
    { k: '1', s: '' }, { k: '2', s: 'ABC' }, { k: '3', s: 'DEF' },
    { k: '4', s: 'GHI' }, { k: '5', s: 'JKL' }, { k: '6', s: 'MNO' },
    { k: '7', s: 'PQRS' }, { k: '8', s: 'TUV' }, { k: '9', s: 'WXYZ' },
    { k: '*', s: '' }, { k: '0', s: '+' }, { k: '#', s: '' },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Section Headline */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-[#C1592F] to-[#9A431F] text-white px-2.5 py-0.5 rounded-full shadow-sm">
            Headline Differentiator
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#E1EADD] text-[#43613B] px-2.5 py-0.5 rounded-full">
            No Phone? No Problem.
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#2B2A25] leading-tight">
          {t.ivrTitle}
        </h1>
        <p className="text-xs sm:text-sm text-[#5C584E] mt-1">
          {t.ivrSub}
        </p>
      </motion.div>

      {/* Toll-Free Banner */}
      <motion.div 
        className="bg-gradient-to-r from-[#2B2A25] via-[#1E1D19] to-[#2B2A25] text-white p-6 rounded-3xl border border-[#3D3A33] flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl relative overflow-hidden grain-overlay"
        initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#C1592F]/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C1592F] to-[#9A431F] flex items-center justify-center flex-none text-white shadow-lg">
            <Phone className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-[#C68A2E] font-bold uppercase tracking-widest">
              {t.tollFreeNumber}
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-bold text-white mt-0.5 tracking-tight">
              1800-889-2026
            </div>
            <div className="text-[10px] text-[#D9D4C6] mt-0.5">
              Zero-data · Telephone network · SMS confirmation · Works on ANY phone
            </div>
          </div>
        </div>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="relative z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/8 hover:bg-white/15 text-xs text-[#D9D4C6] font-mono border border-white/10 cursor-pointer transition-all active:scale-95"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4 text-[#C68A2E]" /> : <VolumeX className="w-4 h-4 text-[#A63D3D]" />}
          <span>{soundEnabled ? 'AUDIO ON' : 'AUDIO OFF'}</span>
        </button>
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left: Keypad Simulator */}
        <motion.div 
          className="lg:col-span-5 flex justify-center items-start"
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="w-full max-w-[290px] h-fit self-start bg-gradient-to-b from-[#1E1D19] to-[#141310] rounded-[36px] p-4 shadow-2xl border border-[#3D3A33]/70 relative">
            
            {/* Earpiece Speaker Grille */}
            <div className="w-12 h-1 bg-[#3D3A33] rounded-full mx-auto mb-3 shadow-inner" />

            {/* LCD Screen */}
            <div className="bg-[#1a2612] text-[#9EE86F] p-3 rounded-2xl border border-[#253219] shadow-inner font-mono text-[10px] min-h-[110px] flex flex-col justify-between relative overflow-hidden">
              {/* Scanline effect */}
              <div className="absolute inset-0 pointer-events-none" 
                style={{ 
                  background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)',
                  zIndex: 1
                }} 
              />
              
              <div className="flex justify-between items-center text-[9px] text-[#5C8A3F] border-b border-[#2E4020] pb-1 relative z-10">
                <span>{callActive ? '● LINE 1 ACTIVE' : '○ READY'}</span>
                <span>{ivrLang.toUpperCase()}</span>
              </div>
              
              <AnimatePresence mode="wait">
                <motion.div 
                  key={lcdText}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="my-1.5 leading-tight text-[10px] break-words relative z-10 whitespace-pre-line"
                >
                  {lcdText}
                </motion.div>
              </AnimatePresence>

              {/* Token entry indicator */}
              {isTokenEntryMode && (
                <div className="text-[8px] text-[#C68A2E] pt-0.5 relative z-10 flex items-center gap-1">
                  <Hash className="w-2.5 h-2.5" />
                  <span>TOKEN INPUT — Enter digits + #</span>
                </div>
              )}

              <div className="text-[8px] text-[#5C8A3F] pt-1 border-t border-[#2E4020] flex justify-between relative z-10">
                <span>MandiFlow v1.0</span>
                <span>{callActive ? '●REC' : 'IDLE'}</span>
              </div>
            </div>

            {/* Options Hint (Clickable shortcuts) */}
            <AnimatePresence>
              {activeOptions.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="my-2.5 px-2 py-1 bg-white/5 rounded-xl border border-white/8 text-[9px] text-[#D9D4C6] space-y-1 font-mono overflow-hidden"
                >
                  {activeOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleKeyPress(opt.key)}
                      className="w-full flex items-center justify-between px-1.5 py-0.5 rounded hover:bg-white/10 active:bg-white/20 transition cursor-pointer text-left"
                    >
                      <span className="text-[#C68A2E] font-bold bg-[#C68A2E]/20 px-1 py-0.2 rounded text-[8px]">[{opt.key}]</span>
                      <span className="text-right text-[#FAF6EC] text-[9px] font-medium">{opt.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Call Controls */}
            <div className="grid grid-cols-2 gap-2 my-2.5">
              <motion.button
                onClick={startCall}
                disabled={callActive}
                whileTap={{ scale: 0.95 }}
                className="py-2.5 rounded-xl bg-gradient-to-b from-[#4a7340] to-[#344d2d] hover:from-[#5a8350] hover:to-[#3d5936] disabled:opacity-25 disabled:cursor-not-allowed text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-md border border-[#5C8A3F]/30"
              >
                <PhoneCall className="w-3 h-3" />
                <span>{t.startCall}</span>
              </motion.button>

              <motion.button
                onClick={endCall}
                disabled={!callActive}
                whileTap={{ scale: 0.95 }}
                className="py-2.5 rounded-xl bg-gradient-to-b from-[#b34040] to-[#852f2f] hover:from-[#c04545] hover:to-[#963434] disabled:opacity-25 disabled:cursor-not-allowed text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer shadow-md border border-[#c05050]/30"
              >
                <PhoneOff className="w-3 h-3" />
                <span>{t.endCall}</span>
              </motion.button>
            </div>

            {/* Dial Keypad */}
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {keypadKeys.map(({ k, s }) => (
                <motion.button
                  key={k}
                  onClick={() => handleKeyPress(k)}
                  whileTap={{ scale: 0.92 }}
                  className={`h-[42px] rounded-xl border transition-all flex flex-col items-center justify-center cursor-pointer ${
                    pressedKey === k 
                      ? 'bg-[#C1592F] border-[#C1592F] text-white shadow-md shadow-[#C1592F]/20' 
                      : 'bg-[#2B2A25] hover:bg-[#383730] border-[#3D3A33] text-white shadow-xs'
                  }`}
                >
                  <span className="font-mono text-sm font-bold leading-none text-[#FAF6EC]">{k}</span>
                  {s && <span className="text-[7px] text-[#A6A295] font-mono leading-none tracking-wider mt-0.5">{s}</span>}
                </motion.button>
              ))}
            </div>

            {/* Microphone Pinhole */}
            <div className="w-1.5 h-1.5 bg-[#3D3A33] rounded-full mx-auto mt-2.5 shadow-inner" />

            {/* Booking Created Banner */}
            <AnimatePresence>
              {lastCreatedBooking && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-2.5 p-2.5 bg-gradient-to-r from-[#E1EADD] to-[#d4e3cd] rounded-xl border border-[#43613B]/30 text-center text-[10px] text-[#2B2A25]"
                >
                  <div className="font-bold text-[#43613B] flex items-center justify-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Token Created via IVR!</span>
                  </div>
                  <div className="font-mono text-sm font-bold text-[#2B2A25] mt-0.5">
                    #{String(lastCreatedBooking.token).padStart(3, '0')}
                  </div>
                  <div className="text-[8px] text-[#5C584E] mt-0.5">
                    Live in Admin Queue & Gate Kiosk
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>

        {/* Right: Call-Flow + Proof */}
        <motion.div 
          className="lg:col-span-7 space-y-6"
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E6DFC9] shadow-sm">
            <h2 className="text-base font-bold text-[#2B2A25] mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#C68A2E]" />
              {t.callFlowSteps}
            </h2>
            <p className="text-xs text-[#5C584E] mb-5">
              Complete DTMF voice decision tree — language, centre, booking, queue lookup, and staff fallback.
            </p>

            <div className="space-y-3 stagger-children">
              {[
                { num: 1, color: '#C1592F', h: t.step1H, d: t.step1D },
                { num: 2, color: '#2B2A25', h: t.step2H, d: t.step2D },
                { num: 3, color: '#2B2A25', h: t.step3H, d: t.step3D },
                { num: 4, color: '#43613B', h: t.step4H, d: t.step4D },
                { num: 5, color: '#C68A2E', h: t.step5H, d: t.step5D },
              ].map((step) => (
                <div key={step.num} className="p-3.5 rounded-2xl bg-[#FAF6EC] border border-[#E6DFC9] flex items-start gap-3 hover:border-[#C1592F]/30 transition-colors">
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold flex-none text-white shadow-sm"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.num}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-[#2B2A25]">{step.h}</div>
                    <div className="text-[10px] text-[#5C584E] mt-0.5 leading-relaxed">{step.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How to use guide */}
          <div className="bg-white rounded-3xl p-6 border border-[#E6DFC9] shadow-sm">
            <h3 className="text-[11px] font-bold text-[#2B2A25] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#C1592F]" />
              Quick Demo Guide for Evaluators
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px]">
              <div className="p-3 rounded-xl bg-[#FAF6EC] border border-[#E6DFC9]">
                <div className="font-bold text-[#C1592F] mb-1">📞 Book a Slot (Full Flow)</div>
                <div className="text-[#5C584E] leading-relaxed">
                  Click <strong>Dial Call</strong> → Press <strong>1</strong> (Hindi) or <strong>2</strong> (English) → Press <strong>1</strong> (Book Slot) → Press <strong>1-4</strong> (Centre) → Press <strong>1-4</strong> (Time Slot) → <strong>Token Created!</strong>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6EC] border border-[#E6DFC9]">
                <div className="font-bold text-[#43613B] mb-1">🔍 Check Queue Status</div>
                <div className="text-[#5C584E] leading-relaxed">
                  At menu → Press <strong>2</strong> → Type token number digits (e.g. <strong>1</strong>, <strong>5</strong>) → Press <strong>#</strong> to look up position and wait time.
                </div>
              </div>
            </div>
          </div>

          {/* Proof Point */}
          <div className="bg-gradient-to-r from-[#FAF6EC] to-[#F3E5C6]/50 p-5 rounded-3xl border border-[#C68A2E]/25 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C68A2E]/10 flex items-center justify-center flex-none">
                <Sparkles className="w-4 h-4 text-[#C68A2E]" />
              </div>
              <div>
                <h3 className="text-[11px] font-bold text-[#2B2A25] uppercase tracking-wider">
                  Shared Backend Proof for Evaluators
                </h3>
                <p className="text-[10px] text-[#5C584E] mt-1 leading-relaxed">
                  An IVR phone call booking directly hits the FastAPI endpoint, issues a token via SQLite atomic transaction, and fires a WebSocket event — the <strong>Admin Queue</strong> and <strong>Gate Kiosk TV</strong> update in real-time without reload.
                </p>
              </div>
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
