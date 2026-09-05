import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { 
  Users, UserPlus, PhoneCall, CheckCircle, XCircle, AlertTriangle, 
  Scale, Banknote, Search, Star, Smartphone, Phone, Sparkles, RefreshCw
} from 'lucide-react';

export default function AdminConsole({ 
  centres, 
  slots, 
  lang, 
  bookings, 
  onCallNext, 
  onUpdateBooking, 
  onStaffBooking 
}) {
  const t = translations[lang];

  const [selectedCentreId, setSelectedCentreId] = useState('sitapur');
  const [filterSearch, setFilterSearch] = useState('');
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [gradingModal, setGradingModal] = useState(null); // booking to grade

  const [walkInDraft, setWalkInDraft] = useState({
    farmer_name: '',
    farmer_phone: '',
    crop: 'Wheat',
    slot_id: 's2',
    priority: false
  });

  const [gradeDraft, setGradeDraft] = useState({
    qty_kg: 45.0,
    moisture_pct: 11.5,
    grade: 'A',
    msp_rate: 24.25
  });

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
    .filter(b => b.status === 'waiting' || b.status === 'called' || (b.status === 'served' && b.payment_status !== 'paid'))
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

  const handleWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInDraft.farmer_name.trim()) return;
    try {
      const res = await fetch('/api/admin/staff-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centre_id: selectedCentreId,
          crop: walkInDraft.crop,
          slot_id: walkInDraft.slot_id,
          farmer_name: walkInDraft.farmer_name,
          farmer_phone: walkInDraft.farmer_phone,
          priority: walkInDraft.priority ? 1 : 0
        })
      });
      if (res.ok) {
        setShowWalkInModal(false);
        setWalkInDraft({ farmer_name: '', farmer_phone: '', crop: 'Wheat', slot_id: 's2', priority: false });
        if (onStaffBooking) onStaffBooking();
      }
    } catch (err) {
      console.error('Walk-in booking error:', err);
    }
  };

  const handleGradingSubmit = async (e) => {
    e.preventDefault();
    if (!gradingModal) return;
    try {
      const res = await fetch('/api/procurement/grade', {
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
        setGradingModal(null);
        if (onUpdateBooking) onUpdateBooking();
      }
    } catch (err) {
      console.error('Grading error:', err);
    }
  };

  const handleDisbursePayment = async (bookingId) => {
    try {
      const res = await fetch('/api/procurement/disburse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId })
      });
      if (res.ok && onUpdateBooking) onUpdateBooking();
    } catch (err) {
      console.error('Disburse error:', err);
    }
  };

  const togglePriority = async (booking) => {
    try {
      await fetch(`/api/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: booking.priority ? 0 : 1 })
      });
      if (onUpdateBooking) onUpdateBooking();
    } catch (err) {
      console.error('Priority update error:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8"
    >
      {/* Top Header & Centre Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
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

        {/* Staff walk-in booking button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowWalkInModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2B2A25] hover:bg-black text-white text-xs font-bold transition shadow-sm cursor-pointer self-start md:self-auto border border-[#5C584E]/40"
        >
          <UserPlus className="w-4 h-4 text-[#C68A2E]" />
          <span>{t.walkInBtn}</span>
        </motion.button>
      </div>

      {/* Centre Selector Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin">
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
            {/* Background grain glow */}
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

            {/* Call Next CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCallNext(selectedCentreId)}
              disabled={waitingList.length === 0}
              className="mt-6 w-full py-3.5 bg-gradient-to-r from-[#C1592F] to-[#9A431F] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-2xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer border border-[#C1592F]/40"
            >
              <PhoneCall className="w-4 h-4 text-[#FAF6EC]" />
              <span>{t.callNextBtn}</span>
            </motion.button>
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
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-[#E6DFC9] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#2B2A25]">{t.todaysQueue}</h2>
              <p className="text-[11px] text-[#5C584E]">★ marks priority produce / elderly farmer entries</p>
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
                      No active tokens in queue for this centre right now.
                    </td>
                  </tr>
                ) : (
                  queueRows.map((b) => {
                    const isCalled = b.status === 'called';
                    const isServed = b.status === 'served';
                    const isIVR = b.booking_channel === 'ivr';
                    const isStaff = b.booking_channel === 'staff_assisted';

                    return (
                      <tr key={b.id} className={`hover:bg-[#FAF6EC]/60 transition ${isCalled ? 'bg-[#F5E1D5]/40 font-medium' : ''}`}>
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
                                    await fetch(`/api/bookings/${b.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ status: 'no-show' })
                                    });
                                    if (onUpdateBooking) onUpdateBooking();
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
                                  await fetch(`/api/bookings/${b.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'called' })
                                  });
                                  if (onUpdateBooking) onUpdateBooking();
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

      {/* MODAL 1: Staff-Assisted Walk-in Booking */}
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
                <span>Staff-Assisted Walk-In Registration</span>
              </h3>
              <p className="text-xs text-[#5C584E] mt-1">
                For farmers arriving without a smartphone or pre-booking. Staff registers them directly into the live queue.
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

                <div>
                  <label className="block text-xs font-bold text-[#2B2A25] mb-1">Mobile Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={walkInDraft.farmer_phone}
                    onChange={(e) => setWalkInDraft({ ...walkInDraft, farmer_phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] outline-none focus:border-[#2B2A25]"
                  />
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
                    className="w-1/2 py-2.5 rounded-xl bg-[#2B2A25] text-white text-xs font-bold hover:bg-black cursor-pointer shadow-md"
                  >
                    Generate Token
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

    </motion.div>
  );
}
