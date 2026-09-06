import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { 
  Users, UserPlus, PhoneCall, CheckCircle, XCircle, AlertTriangle, 
  Scale, Banknote, Search, Star, Smartphone, Phone, Sparkles, RefreshCw,
  Printer, Volume2, Radio, Building2, FileText, Check, ShieldCheck, Fingerprint
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AdminConsole({ 
  centres, 
  slots, 
  lang, 
  bookings, 
  soundEnabled = true,
  onCallNext, 
  onUpdateBooking, 
  onStaffBooking 
}) {
  const t = translations[lang] || translations.en;

  const [selectedCentreId, setSelectedCentreId] = useState('sitapur');
  const [filterSearch, setFilterSearch] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState('all'); // 'all', 'waiting', 'called', 'grading', 'paid'
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [gradingModal, setGradingModal] = useState(null); // booking to grade
  const [slipModal, setSlipModal] = useState(null); // printable thermal slip modal

  const [walkInDraft, setWalkInDraft] = useState({
    farmer_name: '',
    farmer_phone: '',
    crop: 'Wheat',
    slot_id: 's2',
    id_type: 'aadhaar',
    id_number: '',
    priority: false
  });

  const [gradeDraft, setGradeDraft] = useState({
    qty_kg: 45.0,
    moisture_pct: 11.5,
    grade: 'A',
    msp_rate: 24.25
  });

  const audioCtxRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const [paBanner, setPaBanner] = useState(null);
  const [toast, setToast] = useState(null);
  const [highlightedBookingId, setHighlightedBookingId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3800);
  };

  const currentCentre = centres.find(c => c.id === selectedCentreId) || centres[0];
  const centreBookings = bookings.filter(b => b.centre_id === selectedCentreId);
  
  const waitingList = centreBookings
    .filter(b => b.status === 'waiting')
    .sort((a, b) => (b.priority - a.priority) || (a.token - b.token));
  
  const nowServing = centreBookings.find(b => b.status === 'called');
  const servedCount = centreBookings.filter(b => b.status === 'served').length;
  const noShowCount = centreBookings.filter(b => b.status === 'no-show').length;
  const avgWaitMin = waitingList.length * 7;

  // Filtered queue table rows
  const queueRows = centreBookings
    .filter(b => {
      if (activeFilterTab === 'waiting') return b.status === 'waiting';
      if (activeFilterTab === 'called') return b.status === 'called';
      if (activeFilterTab === 'grading') return b.status === 'called' || (b.status === 'served' && b.payment_status !== 'paid');
      if (activeFilterTab === 'paid') return b.payment_status === 'paid';
      return b.status !== 'no-show';
    })
    .filter(b => {
      if (!filterSearch) return true;
      const q = filterSearch.toLowerCase();
      return b.farmer_name.toLowerCase().includes(q) || String(b.token).includes(q) || b.crop.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (a.status === 'called') return -1;
      if (b.status === 'called') return 1;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.token - b.token;
    });

  const playMandiChime = () => {
    if (!soundEnabled) return;
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
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

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
      /* silent */
    }
  };

  // Play loudspeaker PA announcement in Hindi & English
  const triggerLoudspeakerPA = (tokenNumber, farmerName, bay = 2) => {
    setPaBanner({ 
      textHi: `📢 टोकन #${tokenNumber} (${farmerName || 'किसान'}): कृपया तुलाई व ग्रेडिंग के लिए बे ${bay} पर पहुंचे` 
    });

    if (!soundEnabled) {
      setTimeout(() => setPaBanner(null), 6000);
      return;
    }

    playMandiChime();
    const announcementEn = `Attention please! Token number ${tokenNumber}, ${farmerName || 'Farmer'}, please proceed to Bay ${bay} for produce inspection and grading.`;
    const announcementHi = `ध्यान दें! टोकन नंबर ${tokenNumber}, ${farmerName || 'किसान भाई'}, कृपया तुलाई और ग्रेडिंग के लिए बे नंबर ${bay} पर पहुंचे।`;
    
    if (window.speechSynthesis && !isSpeakingRef.current) {
      isSpeakingRef.current = true;
      window.speechSynthesis.cancel();
      
      const utterHi = new SpeechSynthesisUtterance(announcementHi);
      utterHi.lang = 'hi-IN';
      utterHi.rate = 0.9;
      
      const utterEn = new SpeechSynthesisUtterance(announcementEn);
      utterEn.lang = 'en-IN';
      utterEn.rate = 0.95;
      
      utterHi.onend = () => {
        window.speechSynthesis.speak(utterEn);
      };
      utterEn.onend = () => {
        isSpeakingRef.current = false;
        setTimeout(() => setPaBanner(null), 6000);
      };
      
      window.speechSynthesis.speak(utterHi);
    } else {
      setTimeout(() => setPaBanner(null), 6000);
    }
  };

  const handleCallNextClick = async (centreId) => {
    if (onCallNext) {
      const calledBooking = await onCallNext(centreId);
      if (calledBooking) {
        setHighlightedBookingId(calledBooking.id);
        setTimeout(() => setHighlightedBookingId(null), 3000);
        showToast(`Token #${calledBooking.token} (${calledBooking.farmer_name}) called to Bay 2`);
        triggerLoudspeakerPA(calledBooking.token, calledBooking.farmer_name, 2);
      }
    }
  };

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInDraft.farmer_name.trim()) return;
    try {
      const phoneOrId = walkInDraft.id_number 
        ? `${walkInDraft.id_type.toUpperCase()}: ${walkInDraft.id_number}` 
        : (walkInDraft.farmer_phone || 'Walk-In No-Phone');

      const res = await fetch(`${API_BASE_URL}/api/admin/staff-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centre_id: selectedCentreId,
          crop: walkInDraft.crop,
          slot_id: walkInDraft.slot_id,
          farmer_name: walkInDraft.farmer_name,
          farmer_phone: phoneOrId,
          priority: walkInDraft.priority ? 1 : 0
        })
      });
      if (res.ok) {
        const newBooking = await res.json();
        setShowWalkInModal(false);
        setWalkInDraft({ 
          farmer_name: '', 
          farmer_phone: '', 
          crop: 'Wheat', 
          slot_id: 's2', 
          id_type: 'aadhaar', 
          id_number: '', 
          priority: false 
        });
        if (onStaffBooking) onStaffBooking();
        showToast(`Token #${newBooking.token} issued for ${newBooking.farmer_name}`);
        
        // Open thermal slip modal immediately for instant print!
        const centreObj = centres.find(c => c.id === selectedCentreId) || { name: 'Sitapur Krishi Mandi' };
        const slotObj = slots.find(s => s.id === newBooking.slot_id) || { label: '9:00 – 11:00 AM' };
        setSlipModal({
          ...newBooking,
          centre_name: centreObj.name,
          slot_label: slotObj.label,
          bay: 'Bay 2 (Shed C)',
          issued_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        });
      }
    } catch (err) {
      console.error('Walk-in booking error:', err);
    }
  };

  const handleGradingSubmit = async (e) => {
    e.preventDefault();
    if (!gradingModal) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/procurement/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: gradingModal.id,
          qty_kg: parseFloat(gradeDraft.qty_kg),
          moisture_pct: parseFloat(gradeDraft.moisture_pct),
          grade: gradeDraft.grade,
          msp_rate: parseFloat(gradeDraft.msp_rate)
        })
      });
      if (res.ok) {
        const gradedToken = gradingModal.token;
        setGradingModal(null);
        if (onUpdateBooking) onUpdateBooking();
        showToast(`Token #${gradedToken} graded & queued for DBT payout`);
      }
    } catch (err) {
      console.error('Grading error:', err);
    }
  };

  const handleDisbursePayment = async (bookingId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/procurement/disburse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId })
      });
      if (res.ok) {
        if (onUpdateBooking) onUpdateBooking();
        showToast(`Direct DBT payout released to farmer account!`);
      }
    } catch (err) {
      console.error('Disburse error:', err);
    }
  };

  const togglePriority = async (booking) => {
    try {
      await fetch(`${API_BASE_URL}/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: booking.priority ? 0 : 1 })
      });
      if (onUpdateBooking) onUpdateBooking();
      showToast(`Priority status toggled for #${booking.token}`);
    } catch (err) {
      console.error('Priority update error:', err);
    }
  };

  const openSlipForBooking = (b) => {
    const centreObj = centres.find(c => c.id === b.centre_id) || { name: 'Krishi Mandi' };
    const slotObj = slots.find(s => s.id === b.slot_id) || { label: 'Slot S2' };
    setSlipModal({
      ...b,
      centre_name: centreObj.name,
      slot_label: slotObj.label,
      bay: 'Bay 2 (Shed C)',
      issued_at: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6"
    >
      {/* Top Header & Centre Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-extrabold text-[#2B2A25]">
              {t.adminTitle}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C68A2E]/20 text-[#8a6018] border border-[#C68A2E]/30 uppercase tracking-wide">
              Official Desk
            </span>
          </div>
          <p className="text-xs text-[#5C584E] mt-1">{t.adminSub}</p>
        </div>

        {/* Action Buttons: Walk-in & PA Test */}
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => triggerLoudspeakerPA(nowServing ? nowServing.token : 42, nowServing ? nowServing.farmer_name : 'Ram Singh', 2)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF6EC] hover:bg-[#E6DFC9] text-[#2B2A25] text-xs font-bold transition shadow-xs cursor-pointer border border-[#E6DFC9]"
          >
            <Volume2 className="w-3.5 h-3.5 text-[#C1592F]" />
            <span>Mandi PA Chime</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowWalkInModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2B2A25] hover:bg-black text-white text-xs font-bold transition shadow-sm cursor-pointer border border-[#5C584E]/40"
          >
            <UserPlus className="w-4 h-4 text-[#C68A2E]" />
            <span>{t.walkInBtn}</span>
          </motion.button>
        </div>
      </div>

      {/* Live PA Announcement Toast Banner */}
      <AnimatePresence>
        {paBanner && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-[#2B2A25] to-[#1E1D19] text-white border border-[#C68A2E]/40 shadow-lg flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#C1592F] flex items-center justify-center flex-none">
                <Radio className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="text-xs">
                <div className="font-mono text-[10px] text-[#C68A2E] font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Mandi PA Loudspeaker Broadcasting Now
                </div>
                <div className="font-medium text-[#FAF6EC] mt-0.5">{paBanner.textHi}</div>
              </div>
            </div>
            <button
              onClick={() => setPaBanner(null)}
              className="text-white/60 hover:text-white text-xs px-2 py-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Centre Selector Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {centres.map((c) => {
          const isSel = c.id === selectedCentreId;
          const count = bookings.filter(b => b.centre_id === c.id && b.status === 'waiting').length;
          return (
            <motion.button
              key={c.id}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedCentreId(c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer whitespace-nowrap shadow-sm ${
                isSel 
                  ? 'bg-[#2B2A25] text-white border-[#2B2A25]' 
                  : 'bg-white text-[#5C584E] border-[#E6DFC9] hover:border-[#2B2A25]'
              }`}
            >
              <span>{c.name}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                isSel ? 'bg-[#C1592F] text-white' : 'bg-[#FAF6EC] text-[#2B2A25]'
              }`}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Main Control Grid: Left Call Card + Right Stats & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Now Serving Live Dispatch Deck */}
        <div className="space-y-4">
          <motion.div 
            className="bg-gradient-to-br from-[#2B2A25] to-[#1E1D19] text-white rounded-3xl p-6 shadow-xl border border-[#5C584E]/30 text-center relative overflow-hidden"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#C1592F]/20 rounded-full blur-2xl pointer-events-none" />
            <div className="text-[11px] font-mono tracking-widest text-[#C68A2E] uppercase font-bold flex items-center justify-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C68A2E] animate-ping" />
              {t.nowServingCard}
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={nowServing ? nowServing.id : 'empty'}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="text-7xl font-mono font-extrabold my-4 tracking-tight text-white bg-gradient-to-r from-[#FAF6EC] via-white to-[#F5E1D5] bg-clip-text text-transparent drop-shadow-md"
              >
                {nowServing ? `#${String(nowServing.token).padStart(3, '0')}` : '—'}
              </motion.div>
            </AnimatePresence>

            <div className="text-xs text-[#D9D4C6] min-h-[1.5rem] font-medium">
              {nowServing ? (
                <span>
                  <strong className="text-white">{nowServing.farmer_name}</strong> · <span className="text-[#C68A2E] font-semibold">{nowServing.crop}</span>
                  {nowServing.priority ? ' (★ Priority)' : ''}
                </span>
              ) : (
                'No token currently at counter'
              )}
            </div>

            {/* Action Buttons for Now Serving */}
            <div className="mt-5 space-y-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleCallNextClick(selectedCentreId)}
                disabled={waitingList.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-[#C1592F] to-[#9A431F] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-[#C1592F]/40"
              >
                <PhoneCall className="w-4 h-4 text-[#FAF6EC]" />
                <span>{t.callNextBtn} & PA Announce</span>
              </motion.button>

              {nowServing && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setGradingModal(nowServing)}
                    className="flex-1 py-2 rounded-xl bg-[#43613B] text-white text-xs font-bold hover:bg-[#344d2d] cursor-pointer flex items-center justify-center gap-1 shadow-sm transition"
                  >
                    <Scale className="w-3.5 h-3.5" />
                    <span>Weigh & Grade</span>
                  </button>
                  <button
                    onClick={() => openSlipForBooking(nowServing)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-[#D9D4C6] text-xs font-bold cursor-pointer flex items-center gap-1 border border-white/10 transition"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Slip</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-[#E6DFC9] text-center shadow-sm">
              <div className="text-2xl font-mono font-bold text-[#2B2A25]">{waitingList.length}</div>
              <div className="text-[11px] text-[#5C584E] font-medium mt-1">{t.waitingInQueue}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E6DFC9] text-center shadow-sm">
              <div className="text-2xl font-mono font-bold text-[#C1592F]">{avgWaitMin} min</div>
              <div className="text-[11px] text-[#5C584E] font-medium mt-1">{t.avgWaitCurrent}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E6DFC9] text-center shadow-sm">
              <div className="text-2xl font-mono font-bold text-[#43613B]">{servedCount}</div>
              <div className="text-[11px] text-[#5C584E] font-medium mt-1">Served Today</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E6DFC9] text-center shadow-sm">
              <div className="text-2xl font-mono font-bold text-[#A63D3D]">{noShowCount}</div>
              <div className="text-[11px] text-[#5C584E] font-medium mt-1">No-Shows</div>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Active Queue Dispatch Table */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#E6DFC9] shadow-sm space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#2B2A25]">{t.todaysQueue}</h2>
              <p className="text-[11px] text-[#5C584E]">Live yard dispatch, grading, thermal slip print & DBT disbursement</p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5C584E] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search token, name, crop..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-[#FAF6EC] border border-[#E6DFC9] outline-none w-full sm:w-52 focus:border-[#2B2A25] transition"
              />
            </div>
          </div>

          {/* Filter Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-[#E6DFC9] pb-2 text-[11px]">
            {[
              { id: 'all', label: 'All Queue' },
              { id: 'waiting', label: `Waiting (${waitingList.length})` },
              { id: 'called', label: `Now Serving (${nowServing ? 1 : 0})` },
              { id: 'grading', label: 'Weighing/Grading' },
              { id: 'paid', label: 'DBT Settled' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                  activeFilterTab === tab.id
                    ? 'bg-[#2B2A25] text-white shadow-xs'
                    : 'text-[#5C584E] hover:bg-[#FAF6EC]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E6DFC9] text-[#5C584E] text-[11px] font-bold uppercase tracking-wider">
                  <th className="pb-3">{t.colToken}</th>
                  <th className="pb-3">{t.colFarmer}</th>
                  <th className="pb-3">{t.colCrop}</th>
                  <th className="pb-3">{t.colChannel}</th>
                  <th className="pb-3 text-center">{t.colPriority}</th>
                  <th className="pb-3">{t.colStatus}</th>
                  <th className="pb-3">{t.colPayment}</th>
                  <th className="pb-3 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DFC9]/60">
                {queueRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#5C584E] text-xs">
                      No active tokens in this view for this centre.
                    </td>
                  </tr>
                ) : (
                  queueRows.map((b) => {
                    const isCalled = b.status === 'called';
                    const isServed = b.status === 'served';
                    const isIVR = b.booking_channel === 'ivr';
                    const isStaff = b.booking_channel === 'staff_assisted';

                    return (
                      <tr 
                        key={b.id} 
                        className={`transition-colors duration-300 ${
                          highlightedBookingId === b.id 
                            ? 'row-called-highlight font-medium' 
                            : (isCalled ? 'bg-[#F5E1D5]/40 font-medium' : 'hover:bg-[#FAF6EC]/60')
                        }`}
                      >
                        <td className="py-3 font-mono font-bold text-[#2B2A25]">
                          <span className={`px-2 py-0.5 rounded-lg border ${
                            isCalled 
                              ? 'bg-[#C1592F] text-white border-[#C1592F]' 
                              : 'bg-[#FAF6EC] text-[#2B2A25] border-[#E6DFC9]'
                          }`}>
                            #{String(b.token).padStart(3, '0')}
                          </span>
                        </td>
                        
                        <td className="py-3 font-medium text-[#2B2A25]">
                          <div>{b.farmer_name}</div>
                          {b.farmer_phone && (
                            <div className="text-[10px] text-[#5C584E] font-mono">{b.farmer_phone}</div>
                          )}
                        </td>

                        <td className="py-3">
                          <span className="font-semibold text-[#2B2A25]">{b.crop}</span>
                          <div className="text-[10px] text-[#5C584E]">{slots.find(s => s.id === b.slot_id)?.label || b.slot_id}</div>
                        </td>

                        <td className="py-3">
                          {isIVR ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3E5C6] text-[#8a6018]">
                              <Phone className="w-2.5 h-2.5" /> IVR
                            </span>
                          ) : isStaff ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF6EC] text-[#5C584E] border border-[#E6DFC9]">
                              Desk
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E1EADD] text-[#43613B]">
                              <Smartphone className="w-2.5 h-2.5" /> App
                            </span>
                          )}
                        </td>

                        <td className="py-3 text-center">
                          <button
                            onClick={() => togglePriority(b)}
                            className={`cursor-pointer transition transform hover:scale-125 ${b.priority ? 'text-[#C68A2E]' : 'text-[#E6DFC9] hover:text-[#5C584E]'}`}
                          >
                            ★
                          </button>
                        </td>

                        <td className="py-3">
                          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isCalled 
                              ? 'bg-[#F5E1D5] text-[#9A431F] border border-[#C1592F]' 
                              : (isServed ? 'bg-[#E1EADD] text-[#43613B]' : 'bg-[#F3E5C6] text-[#8a6018]')
                          }`}>
                            {isCalled ? 'Now Serving' : (isServed ? 'Served' : 'Waiting')}
                          </span>
                        </td>

                        <td className="py-3 font-mono text-[11px]">
                          {b.payment_status === 'paid' ? (
                            <span className="text-[#43613B] font-bold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> PAID
                            </span>
                          ) : b.payment_status === 'processing' ? (
                            <span className="text-[#8a6018] font-bold flex items-center gap-1">
                              <RefreshCw className="w-3 h-3 animate-spin" /> PROCESSING
                            </span>
                          ) : (
                            <span className="text-[#5C584E]">—</span>
                          )}
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Print Slip Icon */}
                            <button
                              title="Print Thermal Pass Slip"
                              onClick={() => openSlipForBooking(b)}
                              className="p-1 rounded-lg text-[#5C584E] hover:text-[#2B2A25] hover:bg-[#FAF6EC] border border-transparent hover:border-[#E6DFC9] cursor-pointer transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* PA Broadcast */}
                            <button
                              title="Broadcast Call on Mandi PA"
                              onClick={() => triggerLoudspeakerPA(b.token, b.farmer_name, 2)}
                              className="p-1 rounded-lg text-[#C1592F] hover:bg-[#FAF6EC] cursor-pointer transition"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>

                            {isCalled && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setGradingModal(b)}
                                  className="px-2.5 py-1 rounded-lg bg-[#43613B] text-white text-[11px] font-bold hover:bg-[#344d2d] cursor-pointer flex items-center gap-1 shadow-sm"
                                >
                                  <Scale className="w-3 h-3" />
                                  <span>{t.actionGrade}</span>
                                </motion.button>
                                <button
                                  onClick={async () => {
                                    await fetch(`${API_BASE_URL}/api/bookings/${b.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'no-show' })
                                    });
                                    if (onUpdateBooking) onUpdateBooking();
                                    showToast(`Token #${b.token} marked as No-Show`, 'warning');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[#A63D3D] hover:bg-[#F3DEDA] text-[11px] font-bold cursor-pointer transition"
                                >
                                  {t.actionNoShow}
                                </button>
                              </>
                            )}

                            {isServed && b.payment_status !== 'paid' && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDisbursePayment(b.id)}
                                className="px-2.5 py-1 rounded-lg bg-[#2B2A25] text-[#FAF6EC] text-[11px] font-bold hover:bg-black cursor-pointer flex items-center gap-1 shadow-sm"
                              >
                                <Banknote className="w-3 h-3 text-[#C68A2E]" />
                                <span>{t.actionDisburse}</span>
                              </motion.button>
                            )}

                            {!isCalled && !isServed && (
                              <button
                                onClick={async () => {
                                  setHighlightedBookingId(b.id);
                                  setTimeout(() => setHighlightedBookingId(null), 3000);
                                  await fetch(`${API_BASE_URL}/api/bookings/${b.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'called' })
                                  });
                                  if (onUpdateBooking) onUpdateBooking();
                                  showToast(`Token #${b.token} (${b.farmer_name}) called to Bay 2`);
                                  triggerLoudspeakerPA(b.token, b.farmer_name, 2);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-white border border-[#E6DFC9] hover:border-[#2B2A25] hover:bg-[#FAF6EC] text-[11px] font-bold text-[#2B2A25] cursor-pointer transition shadow-2xs"
                              >
                                Call
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* MODAL 1: Staff-Assisted Walk-in Booking (with No-Phone & ID support) */}
      <AnimatePresence>
        {showWalkInModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E6DFC9]"
            >
              <h3 className="text-base font-bold text-[#2B2A25] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#C1592F]" />
                <span>Staff Walk-In & Offline Registration</span>
              </h3>
              <p className="text-xs text-[#5C584E] mt-1">
                For farmers arriving at the gate with or without a phone. Staff issues a live token and printed thermal barcode pass.
              </p>

              <form onSubmit={handleWalkInSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">Farmer Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suman Devi"
                    value={walkInDraft.farmer_name}
                    onChange={(e) => setWalkInDraft({ ...walkInDraft, farmer_name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#2B2A25]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">ID Mode</label>
                    <select
                      value={walkInDraft.id_type}
                      onChange={(e) => setWalkInDraft({ ...walkInDraft, id_type: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                    >
                      <option value="aadhaar">Aadhaar (UIDAI)</option>
                      <option value="pm_kisan">PM-KISAN ID</option>
                      <option value="kcc">Kisan Credit Card</option>
                      <option value="phone">Mobile Number</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">ID / Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. XXXX 8821"
                      value={walkInDraft.id_number}
                      onChange={(e) => setWalkInDraft({ ...walkInDraft, id_number: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#2B2A25]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">Crop</label>
                    <select
                      value={walkInDraft.crop}
                      onChange={(e) => setWalkInDraft({ ...walkInDraft, crop: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                    >
                      {["Wheat", "Paddy", "Onion", "Soybean", "Mustard"].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">Slot</label>
                    <select
                      value={walkInDraft.slot_id}
                      onChange={(e) => setWalkInDraft({ ...walkInDraft, slot_id: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                    >
                      {slots.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={walkInDraft.priority}
                    onChange={(e) => setWalkInDraft({ ...walkInDraft, priority: e.target.checked })}
                    className="accent-[#C1592F]"
                  />
                  <span className="text-xs text-[#2B2A25] font-medium">Mark Priority (Elderly / Perishable Produce)</span>
                </label>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWalkInModal(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-[#E6DFC9] text-xs font-bold text-[#5C584E] hover:bg-[#FAF6EC] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-[#2B2A25] text-white text-xs font-bold hover:bg-black cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5 text-[#C68A2E]" />
                    <span>Issue Token Slip</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Produce Inspection & MSP Weighing */}
      <AnimatePresence>
        {gradingModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#E6DFC9]"
            >
              <h3 className="text-base font-bold text-[#2B2A25] flex items-center gap-2">
                <Scale className="w-5 h-5 text-[#43613B]" />
                <span>Produce Weighing & MSP Grading</span>
              </h3>
              <p className="text-xs text-[#5C584E] mt-1">
                Token #{String(gradingModal.token).padStart(3, '0')} · {gradingModal.farmer_name} ({gradingModal.crop})
              </p>

              <form onSubmit={handleGradingSubmit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">Weight (kg / Quintals)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={gradeDraft.qty_kg}
                      onChange={(e) => setGradeDraft({ ...gradeDraft, qty_kg: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#43613B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">Moisture % (Max 12%)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={gradeDraft.moisture_pct}
                      onChange={(e) => setGradeDraft({ ...gradeDraft, moisture_pct: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#43613B]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">Quality Grade</label>
                    <select
                      value={gradeDraft.grade}
                      onChange={(e) => setGradeDraft({ ...gradeDraft, grade: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none bg-white"
                    >
                      <option value="A">Grade A (Premium MSP)</option>
                      <option value="B">Grade B (Standard MSP)</option>
                      <option value="C">Grade C (Sub-standard)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#2B2A25] mb-1">MSP Rate (Rs / kg)</label>
                    <input
                      type="number"
                      step="0.05"
                      required
                      value={gradeDraft.msp_rate}
                      onChange={(e) => setGradeDraft({ ...gradeDraft, msp_rate: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#43613B]"
                    />
                  </div>
                </div>

                <div className="p-3 bg-[#FAF6EC] rounded-xl border border-[#E6DFC9] text-xs">
                  <div className="text-[#5C584E]">Total Calculated Farmer Payout:</div>
                  <div className="text-xl font-mono font-bold text-[#43613B] mt-0.5">
                    Rs {(parseFloat(gradeDraft.qty_kg || 0) * parseFloat(gradeDraft.msp_rate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGradingModal(null)}
                    className="w-1/2 py-2.5 rounded-xl border border-[#E6DFC9] text-xs font-bold text-[#5C584E] hover:bg-[#FAF6EC] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-[#43613B] text-white text-xs font-bold hover:bg-[#344d2d] cursor-pointer shadow-md"
                  >
                    Confirm & Route to DBT
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Printable Thermal Slip Pass */}
      <AnimatePresence>
        {slipModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#E6DFC9] text-center space-y-4"
            >
              <div className="flex justify-between items-center border-b border-[#E6DFC9] pb-3">
                <span className="text-xs font-bold text-[#2B2A25] flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-[#C1592F]" />
                  <span>Thermal Token Slip</span>
                </span>
                <button
                  onClick={() => setSlipModal(null)}
                  className="text-xs font-bold text-[#5C584E] hover:text-black cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Thermal Pass Card */}
              <div className="bg-[#FAFAFA] text-[#111] p-4 rounded-2xl border border-dashed border-[#888] font-mono text-center space-y-2.5">
                <div className="text-[9px] uppercase tracking-widest text-[#666]">
                  Krishi Upaj Mandi Samiti
                </div>
                <div className="text-xs font-extrabold uppercase text-[#000]">
                  {slipModal.centre_name}
                </div>

                <div className="py-2 border-y border-dashed border-[#bbb]">
                  <div className="text-[9px] text-[#666] uppercase">Official Entry Token</div>
                  <div className="text-5xl font-black my-0.5 text-black">
                    #{String(slipModal.token).padStart(3, '0')}
                  </div>
                  {slipModal.priority === 1 && (
                    <div className="text-[9px] font-bold bg-[#eee] px-2 py-0.5 rounded uppercase inline-block">
                      ★ Priority Fast-Track
                    </div>
                  )}
                </div>

                <div className="text-left text-[10px] space-y-1 bg-white p-2.5 rounded-xl border border-[#eee]">
                  <div className="flex justify-between">
                    <span className="text-[#666]">Farmer:</span>
                    <strong className="text-black">{slipModal.farmer_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Produce:</span>
                    <strong className="text-black">{slipModal.crop}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Slot:</span>
                    <span className="text-black">{slipModal.slot_label}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666]">Weighing Bay:</span>
                    <strong className="text-black">{slipModal.bay || 'Bay 2 (Shed C)'}</strong>
                  </div>
                </div>

                {/* Simulated Barcode */}
                <div className="h-8 bg-gradient-to-r from-black via-white to-black flex items-center justify-around opacity-80 rounded p-1">
                  {[...Array(20)].map((_, i) => (
                    <div key={i} className="bg-black h-6" style={{ width: `${(i % 3 === 0 ? 3 : 1.5)}px` }} />
                  ))}
                </div>

                <div className="text-[8px] text-[#555] leading-tight">
                  📢 Listen for loudspeaker audio announcement when your token is called.
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSlipModal(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-[#E6DFC9] text-xs font-bold text-[#5C584E] hover:bg-[#FAF6EC] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-1/2 py-2.5 rounded-xl bg-[#2B2A25] text-white text-xs font-bold hover:bg-black cursor-pointer shadow-md flex items-center justify-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5 text-[#C68A2E]" />
                  <span>Print Slip</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Action Confirmation Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold text-white toast-appear ${
              toast.type === 'warning'
                ? 'bg-[#A63D3D] border-[#A63D3D]/50'
                : 'bg-[#2B2A25] border-[#C68A2E]/50'
            }`}
          >
            {toast.type === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-amber-300 flex-none" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-none" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
