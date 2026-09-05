import React, { useState, useEffect } from 'react';
import { translations } from '../i18n';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CheckCircle2, Clock, AlertCircle, ArrowRight, Smartphone, 
  MapPin, ShieldAlert, Sparkles, QrCode, MessageSquare, Send, Star 
} from 'lucide-react';

const CROPS = ["Wheat", "Paddy", "Onion", "Soybean", "Mustard", "Maize"];

export default function FarmerBooking({ 
  centres, 
  slots, 
  lang, 
  bookings, 
  myBooking, 
  setMyBooking, 
  notifications,
  onBookingComplete 
}) {
  const t = translations[lang];

  const [draft, setDraft] = useState({
    centre_id: 'sitapur',
    crop: 'Wheat',
    slot_id: 's2',
    farmer_name: '',
    farmer_phone: '',
    priority: false
  });

  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 5, wait: 5, comments: '', submitted: false });

  // Intelligent Load-Balancing Recommendation
  const currentCentre = centres.find(c => c.id === draft.centre_id);
  const centreWaitingCount = bookings.filter(b => b.centre_id === draft.centre_id && b.status === 'waiting').length;
  const currentLoadRatio = currentCentre ? (centreWaitingCount / currentCentre.slot_capacity) : 0;

  // Find if another centre is much less busy
  const alternativeCentre = centres.find(c => {
    if (c.id === draft.centre_id) return false;
    const w = bookings.filter(b => b.centre_id === c.id && b.status === 'waiting').length;
    return (w / c.slot_capacity) < (currentLoadRatio - 0.25);
  });

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!draft.farmer_name.trim()) {
      alert(lang === 'en' ? 'Please enter farmer name' : 'कृपया किसान का नाम दर्ज करें');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centre_id: draft.centre_id,
          crop: draft.crop,
          slot_id: draft.slot_id,
          farmer_name: draft.farmer_name,
          farmer_phone: draft.farmer_phone,
          priority: draft.priority ? 1 : 0,
          channel: 'web'
        })
      });
      if (res.ok) {
        const created = await res.json();
        setMyBooking(created);
        if (onBookingComplete) onBookingComplete(created);
      }
    } catch (err) {
      console.error('Booking failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: myBooking?.id,
          rating: feedback.rating,
          wait_satisfaction: feedback.wait,
          comments: feedback.comments
        })
      });
      setFeedback({ ...feedback, submitted: true });
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  };

  return (
    <div className="py-6 px-4 flex flex-col items-center">
      {/* Section Subtitle */}
      <div className="text-center mb-6 max-w-md">
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#2B2A25]">
          {t.appTitle}
        </h1>
        <p className="text-xs text-[#5C584E] mt-1">
          {lang === 'en' 
            ? 'Mobile-first farmer portal — book procurement slots, track live tokens, and get automated SMS alerts.' 
            : 'किसान मोबाइल सेवा — स्लॉट बुक करें, लाइव टोकन ट्रैक करें और स्वचालित एसएमएस सूचनाएं प्राप्त करें।'}
        </p>
      </div>

      {/* Realistic Smartphone Chassis Frame */}
      <div className="w-full max-w-[400px] bg-white rounded-[44px] border-[10px] border-[#2B2A25] shadow-2xl overflow-hidden relative min-h-[660px] flex flex-col">
        {/* Top Speaker / Dynamic Island Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-[#2B2A25] rounded-b-2xl z-20 flex items-center justify-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1A1916]"></div>
          <div className="w-8 h-1 bg-[#1A1916] rounded-full"></div>
        </div>

        {/* Screen Content Wrapper */}
        <div className="p-4 pt-7 flex-1 overflow-y-auto">
          {myBooking ? (
            /* ================= LIVE TRACKER VIEW ================= */
            (() => {
              const centre = centres.find(c => c.id === myBooking.centre_id) || { name: myBooking.centre_id, place: '' };
              const slot = slots.find(s => s.id === myBooking.slot_id) || { label: myBooking.slot_id };
              
              const waitingList = bookings
                .filter(b => b.centre_id === myBooking.centre_id && b.status === 'waiting')
                .sort((a, b) => (b.priority - a.priority) || (a.token - b.token));
              
              const queuePos = waitingList.findIndex(b => b.token === myBooking.token) + 1;
              const estWaitMin = queuePos > 0 ? queuePos * 7 : 0;
              const nowServingBooking = bookings.find(b => b.centre_id === myBooking.centre_id && b.status === 'called');

              let activeStepIndex = 0;
              if (myBooking.status === 'waiting') activeStepIndex = 0;
              else if (myBooking.status === 'called') activeStepIndex = 1;
              else if (myBooking.status === 'served') {
                if (myBooking.payment_status === 'paid') activeStepIndex = 4;
                else if (myBooking.payment_status === 'processing') activeStepIndex = 3;
                else activeStepIndex = 2;
              }

              const steps = [
                { label: t.stBooked, desc: `${slot.label}` },
                { label: t.stArrived, desc: centre.name },
                { label: t.stGraded, desc: myBooking.qty_kg ? `${myBooking.qty_kg}kg · Grade ${myBooking.grade}` : 'Inspection Counter' },
                { label: t.stPayProc, desc: myBooking.payment_amount ? `Rs ${myBooking.payment_amount?.toLocaleString()}` : 'Aadhaar DBT Direct' },
                { label: t.stPaid, desc: myBooking.payment_utr || 'Bank Reference' }
              ];

              const myNotifications = notifications.filter(n => 
                (myBooking.id && n.booking_id === myBooking.id) || 
                (myBooking.farmer_phone && n.message?.includes(String(myBooking.token).padStart(3, '0')))
              );

              return (
                <div className="space-y-3.5">
                  {/* Token Hero Card */}
                  <div className="bg-[#2B2A25] text-[#FAF6EC] rounded-2xl p-4 shadow-md relative overflow-hidden border border-[#5C584E]/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono tracking-widest text-[#C68A2E] uppercase font-bold">
                          {t.yourToken}
                        </span>
                        <div className="text-5xl font-mono font-bold mt-0.5 tracking-tight text-white">
                          #{String(myBooking.token).padStart(3, '0')}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowQR(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono border border-white/20 transition cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-[#C68A2E]" />
                        <span>Pass</span>
                      </button>
                    </div>

                    <div className="mt-3 pt-3 border-t border-white/10 flex justify-between items-center text-[11px] text-[#D9D4C6]">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#C1592F]" />
                        <span className="font-semibold truncate max-w-[170px]">{centre.name}</span>
                      </div>
                      <div className="font-mono text-[#C68A2E]">{slot.label}</div>
                    </div>
                  </div>

                  {/* Live Stat Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
                      <div className="text-xl font-mono font-bold text-[#C1592F]">
                        {nowServingBooking ? `#${String(nowServingBooking.token).padStart(3, '0')}` : '—'}
                      </div>
                      <div className="text-[10px] text-[#5C584E] font-medium mt-0.5">{t.nowServing}</div>
                    </div>
                    
                    <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
                      <div className="text-xl font-mono font-bold text-[#2B2A25]">
                        {myBooking.status === 'waiting' ? (queuePos > 0 ? queuePos : 1) : (myBooking.status === 'called' ? 'NOW' : 'DONE')}
                      </div>
                      <div className="text-[10px] text-[#5C584E] font-medium mt-0.5">{t.queuePos}</div>
                    </div>

                    <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
                      <div className="text-xl font-mono font-bold text-[#43613B]">
                        {myBooking.status === 'waiting' ? `${estWaitMin}m` : (myBooking.status === 'called' ? '0m' : '—')}
                      </div>
                      <div className="text-[10px] text-[#5C584E] font-medium mt-0.5">{t.estWait}</div>
                    </div>
                  </div>

                  {/* Queue Visual Strip */}
                  <div className="bg-[#FAF6EC] rounded-xl p-3 border border-[#E6DFC9]">
                    <div className="text-[11px] font-bold text-[#5C584E] mb-1.5">Queue Progression:</div>
                    <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                      {bookings
                        .filter(b => b.centre_id === myBooking.centre_id && (b.status === 'waiting' || b.status === 'called'))
                        .sort((a, b) => (b.priority - a.priority) || (a.token - b.token))
                        .slice(0, 7)
                        .map((b) => {
                          const isMe = b.token === myBooking.token;
                          const isServing = b.status === 'called';
                          return (
                            <div 
                              key={b.token}
                              className={`flex-none w-8 h-8 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border ${
                                isMe 
                                  ? 'bg-[#2B2A25] text-white border-[#2B2A25] ring-2 ring-[#C68A2E]' 
                                  : (isServing ? 'bg-[#C1592F] text-white border-[#C1592F]' : 'bg-white text-[#5C584E] border-[#E6DFC9]')
                              }`}
                            >
                              #{b.token}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* 5-Stage Stepper */}
                  <div className="bg-[#FAF6EC] rounded-xl p-3.5 border border-[#E6DFC9]">
                    <h3 className="text-xs font-bold text-[#2B2A25] mb-2.5">{t.statusTrack}</h3>
                    <div className="space-y-3">
                      {steps.map((step, idx) => {
                        const isDone = idx < activeStepIndex;
                        const isCurrent = idx === activeStepIndex;
                        return (
                          <div key={idx} className="flex items-start gap-2.5 relative">
                            {idx !== steps.length - 1 && (
                              <div className={`absolute left-2.5 top-5 w-0.5 h-4 ${isDone ? 'bg-[#43613B]' : 'bg-[#E6DFC9]'}`} />
                            )}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none font-mono text-[10px] font-bold ${
                              isDone 
                                ? 'bg-[#E1EADD] text-[#43613B]' 
                                : (isCurrent ? 'bg-[#C1592F] text-white ring-2 ring-[#F5E1D5]' : 'bg-white text-[#5C584E] border border-[#E6DFC9]')
                            }`}>
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <div>
                              <div className={`text-[11px] font-bold ${isCurrent ? 'text-[#C1592F]' : 'text-[#2B2A25]'}`}>
                                {step.label}
                              </div>
                              <div className="text-[10px] text-[#5C584E]">{step.desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* SMS / WhatsApp Drawer */}
                  <div className="bg-[#FAF6EC] rounded-xl p-3.5 border border-[#E6DFC9]">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[11px] font-bold text-[#2B2A25] flex items-center gap-1">
                        <Smartphone className="w-3 h-3 text-[#C1592F]" />
                        <span>SMS & WhatsApp Logs</span>
                      </h3>
                      <span className="text-[9px] font-mono text-[#5C584E] bg-white px-1.5 py-0.5 rounded border border-[#E6DFC9]">
                        LIVE
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {myNotifications.length > 0 ? (
                        myNotifications.map((notif, i) => (
                          <div key={i} className="p-2 rounded-lg bg-white border border-[#E6DFC9] text-[11px]">
                            <div className="text-[#2B2A25]">{notif.message}</div>
                            <div className="text-[9px] text-[#5C584E] mt-0.5 font-mono">
                              {notif.channel?.toUpperCase()} · {new Date(notif.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-[#5C584E] text-center py-1">
                          {t.noNotifications}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grievance Micro-Survey */}
                  {myBooking.status === 'served' && !feedback.submitted && (
                    <div className="bg-[#FAF6EC] rounded-xl p-3 border border-[#C68A2E]/40">
                      <div className="text-[11px] font-bold text-[#2B2A25] flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-[#C68A2E] fill-[#C68A2E]" />
                        <span>Service Rating Survey</span>
                      </div>
                      <form onSubmit={handleFeedbackSubmit} className="space-y-2 mt-2">
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              type="button"
                              key={s}
                              onClick={() => setFeedback({ ...feedback, rating: s })}
                              className={`w-6 h-6 rounded text-[10px] font-bold ${
                                feedback.rating >= s ? 'bg-[#C68A2E] text-white' : 'bg-white border border-[#E6DFC9] text-[#5C584E]'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          placeholder="Comments..."
                          value={feedback.comments}
                          onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
                          className="w-full text-[11px] p-2 rounded-lg bg-white border border-[#E6DFC9] outline-none"
                        />
                        <button
                          type="submit"
                          className="w-full py-1.5 bg-[#2B2A25] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                        >
                          Submit
                        </button>
                      </form>
                    </div>
                  )}

                  {/* Reset Button */}
                  <button
                    onClick={() => setMyBooking(null)}
                    className="w-full py-2.5 rounded-xl border border-[#2B2A25] text-[#2B2A25] font-bold text-xs hover:bg-[#2B2A25] hover:text-white transition cursor-pointer"
                  >
                    {t.bookAnother}
                  </button>
                </div>
              );
            })()
          ) : (
            /* ================= BOOKING FORM (PHONE MOCKUP) ================= */
            <form onSubmit={handleBookingSubmit} className="space-y-4">
              <div className="text-left mb-2">
                <div className="text-base font-extrabold text-[#2B2A25]">{t.appTitle}</div>
                <div className="text-xs text-[#5C584E]">{t.tagline}</div>
              </div>

              {/* 1. Centre Select */}
              <div>
                <label className="block text-[11px] font-bold text-[#5C584E] mb-1.5">
                  {t.chooseCentre}
                </label>
                <div className="space-y-1.5">
                  {centres.map((c) => {
                    const isSelected = draft.centre_id === c.id;
                    const waiting = bookings.filter(b => b.centre_id === c.id && b.status === 'waiting').length;
                    const loadRatio = waiting / c.slot_capacity;
                    const loadCls = loadRatio > 0.7 ? 'bg-[#F3DEDA] text-[#A63D3D]' : (loadRatio > 0.35 ? 'bg-[#F3E5C6] text-[#8a6018]' : 'bg-[#E1EADD] text-[#43613B]');
                    
                    return (
                      <div
                        key={c.id}
                        onClick={() => setDraft({ ...draft, centre_id: c.id })}
                        className={`p-2.5 rounded-xl border-1.5 transition cursor-pointer ${
                          isSelected
                            ? 'border-[#C1592F] bg-[#F5E1D5]/40 shadow-xs'
                            : 'border-[#E6DFC9] bg-[#FAF6EC] hover:border-[#C1592F]/50'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-xs font-bold text-[#2B2A25]">{c.name}</div>
                            <div className="text-[10px] text-[#5C584E]">{c.place} · {c.default_crop}</div>
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${loadCls}`}>
                            {waiting} {lang === 'en' ? 'waiting' : 'प्रतीक्षारत'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* AI Load suggestion */}
                {alternativeCentre && (
                  <div className="mt-2 p-2 bg-[#F3E5C6] rounded-lg border border-[#C68A2E]/40 text-[11px] text-[#6d4c14]">
                    <span className="font-bold">💡 {alternativeCentre.name}</span> {lang === 'en' ? 'is less busy.' : 'पर कम भीड़ है।'}
                    <button
                      type="button"
                      onClick={() => setDraft({ ...draft, centre_id: alternativeCentre.id })}
                      className="block font-bold underline cursor-pointer text-[#9A431F] mt-0.5"
                    >
                      {t.switchCentre} →
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Crop Select */}
              <div>
                <label className="block text-[11px] font-bold text-[#5C584E] mb-1.5">
                  {t.chooseCrop}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CROPS.map((crop) => (
                    <button
                      type="button"
                      key={crop}
                      onClick={() => setDraft({ ...draft, crop })}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                        draft.crop === crop
                          ? 'border-[#C1592F] bg-[#C1592F] text-white shadow-xs'
                          : 'border-[#E6DFC9] bg-[#FAF6EC] text-[#2B2A25] hover:border-[#C1592F]'
                      }`}
                    >
                      {crop}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Slot Select */}
              <div>
                <label className="block text-[11px] font-bold text-[#5C584E] mb-1.5">
                  {t.chooseSlot}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {slots.map((s) => {
                    const isSelected = draft.slot_id === s.id;
                    const bookedInSlot = bookings.filter(b => b.centre_id === draft.centre_id && b.slot_id === s.id && b.status !== 'no-show').length;
                    const cap = currentCentre ? currentCentre.slot_capacity : 25;
                    const left = Math.max(cap - bookedInSlot, 0);
                    const isFull = left === 0;

                    return (
                      <button
                        type="button"
                        key={s.id}
                        disabled={isFull}
                        onClick={() => setDraft({ ...draft, slot_id: s.id })}
                        className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                          isSelected
                            ? 'border-[#C1592F] bg-[#F5E1D5] shadow-xs'
                            : (isFull ? 'bg-[#E6DFC9]/40 border-[#E6DFC9] opacity-40 cursor-not-allowed' : 'border-[#E6DFC9] bg-[#FAF6EC] hover:border-[#C1592F]')
                        }`}
                      >
                        <div className="text-xs font-bold text-[#2B2A25]">{s.label}</div>
                        <div className="text-[9px] text-[#5C584E] font-mono mt-0.5">
                          {isFull ? t.full : `${left} ${t.seatsLeft}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Farmer Inputs */}
              <div className="space-y-2 pt-1">
                <div>
                  <input
                    type="text"
                    required
                    placeholder="Farmer Name (e.g. Ramesh Yadav)"
                    value={draft.farmer_name}
                    onChange={(e) => setDraft({ ...draft, farmer_name: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] bg-[#FAF6EC] focus:bg-white focus:border-[#C1592F] outline-none"
                  />
                </div>

                <div>
                  <input
                    type="tel"
                    placeholder="Mobile Number (e.g. +91 98765 43210)"
                    value={draft.farmer_phone}
                    onChange={(e) => setDraft({ ...draft, farmer_phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-[#E6DFC9] bg-[#FAF6EC] focus:bg-white focus:border-[#C1592F] outline-none"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.checked })}
                    className="accent-[#C1592F] rounded"
                  />
                  <span className="text-[11px] text-[#5C584E]">
                    <strong className="text-[#2B2A25]">{t.elderlyPriority}</strong>
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#C1592F] hover:bg-[#9A431F] text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 mt-2"
              >
                <span>{submitting ? 'Generating Token...' : t.confirmBooking}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* QR Pass Modal */}
      {showQR && myBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-5 text-center shadow-2xl border border-[#E6DFC9]">
            <h3 className="text-sm font-bold text-[#2B2A25]">Mandi Gate Entry Pass</h3>
            <p className="text-[11px] text-[#5C584E] mt-0.5">Scannable token pass for yard gate entry</p>
            
            <div className="flex justify-center my-4 p-3 bg-[#FAF6EC] rounded-xl border border-[#E6DFC9] inline-block mx-auto">
              <QRCodeSVG 
                value={`MANDIFLOW-TOKEN:${myBooking.token};CENTRE:${myBooking.centre_id};FARMER:${myBooking.farmer_name};DATE:${new Date().toISOString().split('T')[0]}`} 
                size={140}
                fgColor="#2B2A25"
                bgColor="#FAF6EC"
              />
            </div>

            <div className="font-mono text-lg font-bold text-[#C1592F]">
              TOKEN #{String(myBooking.token).padStart(3, '0')}
            </div>

            <button
              onClick={() => setShowQR(false)}
              className="mt-4 w-full py-2 bg-[#2B2A25] text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
