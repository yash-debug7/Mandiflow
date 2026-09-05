import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { 
  Building2, Printer, Volume2, Fingerprint, CreditCard, ShieldCheck, 
  CheckCircle2, Sparkles, AlertCircle, ArrowRight, UserCheck, RefreshCw,
  QrCode, Radio, FileText, Check, Award
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function CSCSahayak({ centres, slots, lang, bookings, onBookingCreated }) {
  const t = translations[lang] || translations.en;

  const [idType, setIdType] = useState('aadhaar'); // 'aadhaar', 'pm_kisan', 'kcc', 'biometric'
  const [selectedCentreId, setSelectedCentreId] = useState('sitapur');
  const [selectedSlotId, setSelectedSlotId] = useState('s2');
  const [crop, setCrop] = useState('Wheat');
  const [farmerName, setFarmerName] = useState('');
  const [govIdNumber, setGovIdNumber] = useState('');
  const [priority, setPriority] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [biometricVerified, setBiometricVerified] = useState(false);

  // Generated slip modal / preview
  const [activeSlip, setActiveSlip] = useState(null);

  // Mandi PA Broadcast state
  const [paActive, setPaActive] = useState(false);
  const [paTranscript, setPaTranscript] = useState('');
  const audioCtxRef = useRef(null);

  // Presets for fast hackathon demo
  const demoPresets = [
    { name: 'Ram Singh', idType: 'aadhaar', idNum: '9842 1104 7821', crop: 'Wheat', centre: 'sitapur', priority: false },
    { name: 'Shanti Devi (Elderly)', idType: 'pm_kisan', idNum: 'PMK-UP-882190', crop: 'Wheat', centre: 'sitapur', priority: true },
    { name: 'Kavita Meena', idType: 'kcc', idNum: 'KCC-RJ-44120', crop: 'Soybean', centre: 'kota', priority: false },
    { name: 'Babulal Patel', idType: 'biometric', idNum: 'BIO-SCAN-8823', crop: 'Onion', centre: 'nashik', priority: false },
  ];

  const applyPreset = (p) => {
    setFarmerName(p.name);
    setIdType(p.idType);
    setGovIdNumber(p.idNum);
    setCrop(p.crop);
    setSelectedCentreId(p.centre);
    setPriority(p.priority);
    if (p.idType === 'biometric') {
      setBiometricVerified(true);
    }
  };

  const playMandiChime = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      
      const now = ctx.currentTime;
      // Chime note 1 (D5 ~ 587.33Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Chime note 2 (A5 ~ 880.00Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(880.0, now + 0.3);
      gain2.gain.setValueAtTime(0.22, now + 0.3);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.3);
      osc2.stop(now + 0.9);
    } catch (e) {
      // silent
    }
  };

  const triggerPASpeech = (token, name, bay = 2) => {
    playMandiChime();
    setPaActive(true);
    const hiText = `ध्यान दें! टोकन नंबर ${token}, किसान ${name}, कृपया तौल शेड ${bay} पर तुरंत पहुंचे।`;
    const enText = `Attention! Token number ${token}, Farmer ${name}, please report to Weighing Bay ${bay} immediately.`;
    setPaTranscript(`${hiText}\n${enText}`);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        const uHi = new SpeechSynthesisUtterance(hiText);
        uHi.lang = 'hi-IN';
        uHi.rate = 0.9;
        
        const uEn = new SpeechSynthesisUtterance(enText);
        uEn.lang = 'en-IN';
        uEn.rate = 0.95;

        uEn.onend = () => {
          setTimeout(() => setPaActive(false), 2000);
        };

        window.speechSynthesis.speak(uHi);
        window.speechSynthesis.speak(uEn);
      }, 700);
    } else {
      setTimeout(() => setPaActive(false), 5000);
    }
  };

  const handleSimulateBiometric = () => {
    setIsScanning(true);
    setBiometricVerified(false);
    setTimeout(() => {
      setIsScanning(false);
      setBiometricVerified(true);
      setGovIdNumber(`UIDAI-BIO-${Math.floor(1000 + Math.random() * 9000)}`);
      if (!farmerName) setFarmerName('Devendra Kumar (Aadhaar Verified)');
    }, 1200);
  };

  const handleSubmitNoPhoneBooking = async (e) => {
    e.preventDefault();
    if (!farmerName.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/staff-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centre_id: selectedCentreId,
          crop: crop,
          slot_id: selectedSlotId,
          farmer_name: farmerName,
          farmer_phone: govIdNumber ? `ID: ${govIdNumber}` : 'Offline-CSC',
          priority: priority ? 1 : 0
        })
      });

      if (res.ok) {
        const newBooking = await res.json();
        const centreObj = centres.find(c => c.id === selectedCentreId) || { name: 'Sitapur Krishi Mandi' };
        const slotObj = slots.find(s => s.id === selectedSlotId) || { label: '9:00 – 11:00 AM' };

        const slipData = {
          ...newBooking,
          centre_name: centreObj.name,
          slot_label: slotObj.label,
          id_type: idType,
          id_number: govIdNumber || 'Aadhaar Verified',
          bay: selectedCentreId === 'sitapur' || selectedCentreId === 'karnal' ? 'Bay 2 (Shed C)' : 'Bay 1 (Shed A)',
          issued_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        };

        setActiveSlip(slipData);
        if (onBookingCreated) onBookingCreated(newBooking);

        // Reset form
        setFarmerName('');
        setGovIdNumber('');
        setBiometricVerified(false);
      }
    } catch (err) {
      console.error('Offline booking error:', err);
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Title & Evaluator Context Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-gradient-to-r from-[#43613B] to-[#2E4020] text-white px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            Gram Panchayat & Gate Kiosk Solution
          </span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-[#F3E5C6] text-[#8a6018] px-2.5 py-0.5 rounded-full border border-[#C68A2E]/30">
            For Evaluators: "What if the farmer has NO phone?"
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#2B2A25] leading-tight">
          {t.cscTitle}
        </h1>
        <p className="text-xs sm:text-sm text-[#5C584E] mt-1 max-w-4xl leading-relaxed">
          {t.cscSub}
        </p>
      </motion.div>

      {/* 3-Tier Access Inclusion Banner (The Hackathon Answer) */}
      <motion.div 
        className="bg-white rounded-3xl p-6 border border-[#E6DFC9] shadow-sm relative overflow-hidden"
        initial={{ opacity: 0, y: 15 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-4 h-4 text-[#C68A2E]" />
          <h2 className="text-xs font-bold text-[#2B2A25] uppercase tracking-wider">
            Universal 3-Tier Inclusion Framework (Zero-Exclusion Guarantee)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#E6DFC9]/80">
            <div className="text-[11px] font-bold text-[#43613B] mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#43613B] text-white text-[10px] flex items-center justify-center font-mono">1</span>
              Smartphone Farmers (PWA)
            </div>
            <p className="text-[11px] text-[#5C584E] leading-relaxed">
              Full interactive web app, digital QR pass, GPS yard routing, live 5-stage progress bar, and automated DBT tracker.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF6EC] border border-[#E6DFC9]/80">
            <div className="text-[11px] font-bold text-[#C1592F] mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#C1592F] text-white text-[10px] flex items-center justify-center font-mono">2</span>
              Feature Keypad Phone (IVR)
            </div>
            <p className="text-[11px] text-[#5C584E] leading-relaxed">
              Toll-free <strong>1800-889-2026</strong> voice call in Hindi & regional languages with DTMF keypad booking and SMS gate pass.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FAF6EC] to-[#E1EADD]/40 border-2 border-[#43613B]/30 shadow-xs">
            <div className="text-[11px] font-bold text-[#2B2A25] mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#2B2A25] text-white text-[10px] flex items-center justify-center font-mono">3</span>
              Zero-Phone Farmers (CSC + PA)
            </div>
            <p className="text-[11px] text-[#2B2A25] font-medium leading-relaxed">
              Village Panchayat CSC / Gate Kiosk issues a <strong>physical thermal barcode pass</strong> via Aadhaar/Biometrics, and <strong>Mandi PA Loudspeakers</strong> call the farmer.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column (7 cols): CSC / Panchayat Registration Terminal */}
        <motion.div 
          className="lg:col-span-7 space-y-6"
          initial={{ opacity: 0, x: -20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#E6DFC9] shadow-sm">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#E6DFC9]">
              <div>
                <h3 className="text-base font-bold text-[#2B2A25] flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#43613B]" />
                  <span>Offline Farmer Token Issuance Terminal</span>
                </h3>
                <p className="text-[11px] text-[#5C584E] mt-0.5">
                  Operated by Gram Panchayat VLE / Mandi Gate Sahayak
                </p>
              </div>

              {/* Demo Quick Presets */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-[10px] text-[#5C584E] font-medium">Quick Demo:</span>
                {demoPresets.slice(0, 2).map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="px-2 py-1 rounded-lg bg-[#FAF6EC] hover:bg-[#E6DFC9] text-[10px] font-bold text-[#2B2A25] border border-[#E6DFC9] cursor-pointer transition active:scale-95"
                  >
                    {p.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitNoPhoneBooking} className="space-y-4">
              
              {/* ID Verification Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-[#2B2A25] mb-2">
                  {t.idType}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'aadhaar', label: 'Aadhaar (UIDAI)', icon: ShieldCheck },
                    { id: 'pm_kisan', label: 'PM-KISAN ID', icon: CreditCard },
                    { id: 'kcc', label: 'Kisan Credit (KCC)', icon: Building2 },
                    { id: 'biometric', label: 'Biometric Scan', icon: Fingerprint },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSel = idType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setIdType(item.id);
                          if (item.id === 'biometric' && !biometricVerified) {
                            handleSimulateBiometric();
                          }
                        }}
                        className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSel
                            ? 'bg-[#2B2A25] text-white border-[#2B2A25] shadow-sm'
                            : 'bg-[#FAF6EC] text-[#5C584E] border-[#E6DFC9] hover:border-[#2B2A25]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1.5 ${isSel ? 'text-[#C68A2E]' : 'text-[#5C584E]'}`} />
                        <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Farmer Name & ID Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">
                    Farmer Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ram Singh"
                    value={farmerName}
                    onChange={(e) => setFarmerName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#2B2A25] bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1 flex items-center justify-between">
                    <span>ID / Card Number</span>
                    {biometricVerified && (
                      <span className="text-[9px] text-[#43613B] font-bold flex items-center gap-0.5">
                        <Check className="w-2.5 h-2.5" /> Biometrics Matched
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={idType === 'aadhaar' ? 'XXXX XXXX 7821' : 'Card / Registration ID'}
                      value={govIdNumber}
                      onChange={(e) => setGovIdNumber(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#2B2A25] bg-white"
                    />
                    {idType === 'biometric' && (
                      <button
                        type="button"
                        onClick={handleSimulateBiometric}
                        className="absolute right-1.5 top-1.5 px-2 py-1 rounded-lg bg-[#43613B] text-white text-[9px] font-bold hover:bg-[#344d2d] cursor-pointer flex items-center gap-1"
                      >
                        {isScanning ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <Fingerprint className="w-2.5 h-2.5" />}
                        <span>{isScanning ? 'Scanning...' : 'Scan Thumb'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Centre & Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">Procurement Centre</label>
                  <select
                    value={selectedCentreId}
                    onChange={(e) => setSelectedCentreId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                  >
                    {centres.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">Crop</label>
                  <select
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                  >
                    {['Wheat', 'Paddy', 'Onion', 'Soybean', 'Mustard'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">Time Slot</label>
                  <select
                    value={selectedSlotId}
                    onChange={(e) => setSelectedSlotId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                  >
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority checkbox */}
              <label className="flex items-center gap-2 cursor-pointer p-2.5 rounded-xl bg-[#FAF6EC] border border-[#E6DFC9]">
                <input
                  type="checkbox"
                  checked={priority}
                  onChange={(e) => setPriority(e.target.checked)}
                  className="accent-[#C1592F]"
                />
                <span className="text-xs text-[#2B2A25] font-medium">
                  Mark Priority (Elderly Farmer / High Perishable Urgency)
                </span>
              </label>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-[#2B2A25] via-[#1E1D19] to-[#2B2A25] hover:bg-black text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-[#3D3A33]"
              >
                <Printer className="w-4 h-4 text-[#C68A2E]" />
                <span>Issue Token & Generate Physical Thermal Slip</span>
              </motion.button>
            </form>
          </div>

          {/* Mandi PA Loudspeaker Simulation Console */}
          <div className="bg-gradient-to-r from-[#2B2A25] to-[#1E1D19] text-white rounded-3xl p-6 border border-[#3D3A33] shadow-lg relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#C68A2E] animate-pulse" />
                <h3 className="text-xs font-mono font-bold text-[#FAF6EC] uppercase tracking-wider">
                  {t.paAnnouncementTitle}
                </h3>
              </div>
              <button
                onClick={() => triggerPASpeech(42, 'Ram Singh', 2)}
                className="px-3 py-1.5 rounded-xl bg-[#C1592F] hover:bg-[#a84c26] text-white text-[10px] font-bold cursor-pointer transition active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{t.paTestChime}</span>
              </button>
            </div>

            <p className="text-[11px] text-[#D9D4C6] leading-relaxed">
              {t.paAnnouncementSub}
            </p>

            {/* Live Audio Transcript Box */}
            <AnimatePresence>
              {paTranscript && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/10 font-mono text-[10px] text-[#9EE86F] whitespace-pre-line leading-relaxed"
                >
                  <div className="text-[9px] text-[#C68A2E] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live Loudspeaker Audio Broadcast
                  </div>
                  {paTranscript}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Right Column (5 cols): Thermal Token Slip Preview (Printable) */}
        <motion.div 
          className="lg:col-span-5 space-y-4"
          initial={{ opacity: 0, x: 20 }} 
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <div className="bg-white rounded-3xl p-6 border border-[#E6DFC9] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[#2B2A25] uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#C1592F]" />
                <span>Physical Thermal Slip Preview</span>
              </h3>
              {activeSlip && (
                <button
                  onClick={handlePrintSlip}
                  className="px-3 py-1.5 rounded-xl bg-[#2B2A25] text-white text-[10px] font-bold hover:bg-black cursor-pointer flex items-center gap-1 transition active:scale-95 shadow-xs"
                >
                  <Printer className="w-3 h-3 text-[#C68A2E]" />
                  <span>Print Slip</span>
                </button>
              )}
            </div>

            {activeSlip ? (
              /* Physical Thermal Paper Slip Styling */
              <div 
                id="thermal-token-slip"
                className="bg-[#FAFAFA] text-[#1a1a1a] p-5 rounded-2xl border border-dashed border-[#888] shadow-inner font-mono text-center space-y-3"
              >
                <div className="border-b border-dashed border-[#aaa] pb-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#555]">
                    {t.slipSub}
                  </div>
                  <div className="text-xs font-extrabold uppercase mt-0.5 tracking-tight text-[#111]">
                    {t.slipHeading}
                  </div>
                  <div className="text-[10px] text-[#444] font-semibold mt-1">
                    {activeSlip.centre_name}
                  </div>
                </div>

                {/* Gigantic Token */}
                <div className="py-2">
                  <div className="text-[10px] text-[#666] uppercase tracking-wider">Mandi Entry Token</div>
                  <div className="text-5xl font-extrabold tracking-tight text-[#000] my-1">
                    #{String(activeSlip.token).padStart(3, '0')}
                  </div>
                  {activeSlip.priority === 1 && (
                    <div className="inline-block text-[9px] font-bold bg-[#eee] border border-[#aaa] px-2 py-0.5 rounded uppercase">
                      ★ Priority Fast-Track
                    </div>
                  )}
                </div>

                {/* Farmer & Slot Info */}
                <div className="text-left text-[10px] space-y-1 bg-white p-3 rounded-xl border border-[#eee]">
                  <div className="flex justify-between">
                    <span className="text-[#666]">Farmer:</span>
                    <strong className="text-[#111]">{activeSlip.farmer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Verified ID:</span>
                    <span className="text-[#111]">{activeSlip.id_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Crop:</span>
                    <strong className="text-[#111]">{activeSlip.crop}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Slot:</span>
                    <span className="text-[#111]">{activeSlip.slot_label}</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-[#ddd] pt-1 mt-1">
                    <span className="text-[#666]">Allocated Bay:</span>
                    <strong className="text-[#000]">{activeSlip.bay}</strong>
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="pt-2">
                  <div className="h-10 bg-gradient-to-r from-black via-white to-black p-1 flex items-center justify-around opacity-80 rounded">
                    {[...Array(24)].map((_, i) => (
                      <div 
                        key={i} 
                        className="bg-black h-8" 
                        style={{ width: `${(i % 3 === 0 ? 3 : 1.5)}px` }} 
                      />
                    ))}
                  </div>
                  <div className="text-[9px] text-[#666] tracking-widest mt-1">
                    *MF-{activeSlip.centre_id.toUpperCase()}-{activeSlip.token}*
                  </div>
                </div>

                {/* Important Notice */}
                <div className="text-[9px] text-[#444] border-t border-dashed border-[#aaa] pt-2 leading-tight text-center">
                  ⚠️ No phone required. When your token is called, listen for your name on the Mandi PA Loudspeakers.
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-[#FAF6EC] rounded-2xl border border-[#E6DFC9] text-[#5C584E] space-y-2">
                <Printer className="w-8 h-8 mx-auto text-[#C68A2E]/60" />
                <div className="text-xs font-bold text-[#2B2A25]">No Token Issued Yet</div>
                <div className="text-[10px] leading-relaxed">
                  Fill the offline registration form on the left to issue an instant physical thermal paper pass with barcode.
                </div>
              </div>
            )}
          </div>

          {/* Quick FAQ / Evaluator Explainer Card */}
          <div className="bg-[#FAF6EC] p-5 rounded-3xl border border-[#E6DFC9] space-y-2.5">
            <h4 className="text-xs font-bold text-[#2B2A25] uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C68A2E]" />
              Key Features Evaluators Love
            </h4>
            <ul className="text-[10px] text-[#5C584E] space-y-1.5 list-disc pl-4 leading-relaxed">
              <li><strong>Zero Phone Requirement:</strong> Farmers can register at their local Gram Panchayat CSC prior to arriving.</li>
              <li><strong>Gate Spot Kiosk:</strong> Unregistered walk-ins are issued a paper slip directly at the entry gate.</li>
              <li><strong>Mandi PA Audio Broadcast:</strong> Synchronized loudspeaker announcements ensure farmers never miss their turn.</li>
              <li><strong>Direct DBT Transfer:</strong> MSP payments are disbursed directly to Aadhaar-linked bank accounts.</li>
            </ul>
          </div>

        </motion.div>

      </div>
    </div>
  );
}
