import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '../i18n';
import { QRCodeSVG } from 'qrcode.react';
import { 
  CheckCircle2, Clock, ArrowRight, 
  MapPin, Sparkles, QrCode, Star, Wifi, Battery, Signal
} from 'lucide-react';
import { API_BASE_URL } from '../config';

const CROPS = ["Wheat", "Paddy", "Onion", "Soybean", "Mustard", "Maize"];

const CROP_EMOJI = {
  Wheat: "🌾", Paddy: "🌿", Onion: "🧅",
  Soybean: "🫘", Mustard: "🟡", Maize: "🌽"
};

export default function FarmerBooking({ 
  centres, slots, lang, setLang,
  bookings, myBooking, setMyBooking, 
  notifications, onBookingComplete 
}) {
  const t = translations[lang];

  const [draft, setDraft] = useState({
    centre_id: 'sitapur', crop: 'Wheat', slot_id: 's2',
    farmer_name: '', farmer_phone: '', priority: false
  });

  const [showQR, setShowQR] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ rating: 5, wait: 5, comments: '', submitted: false });

  // Sync crop default when centres reference data is loaded or centre changes
  useEffect(() => {
    const c = centres.find(item => item.id === draft.centre_id);
    if (c && c.default_crop && draft.crop === 'Wheat' && c.default_crop !== 'Wheat') {
      setDraft(prev => ({ ...prev, crop: c.default_crop }));
    }
  }, [centres, draft.centre_id]);

  // Intelligent Load-Balancing
  const currentCentre = centres.find(c => c.id === draft.centre_id);
  const centreWaitingCount = bookings.filter(b => b.centre_id === draft.centre_id && b.status === 'waiting').length;
  const currentLoadRatio = currentCentre ? (centreWaitingCount / currentCentre.slot_capacity) : 0;

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
      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centre_id: draft.centre_id, crop: draft.crop, slot_id: draft.slot_id,
          farmer_name: draft.farmer_name, farmer_phone: draft.farmer_phone,
          priority: draft.priority ? 1 : 0, channel: 'web'
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
      await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: myBooking?.id, rating: feedback.rating,
          wait_satisfaction: feedback.wait, comments: feedback.comments
        })
      });
      setFeedback({ ...feedback, submitted: true });
    } catch (err) {
      console.error('Feedback failed:', err);
    }
  };

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div className="py-8 px-4 flex flex-col items-center justify-center">
      
      {/* Title above phone */}
      <motion.div 
        className="text-center mb-8 max-w-md"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-[#2B2A25] leading-tight">
          {t.appTitle}
        </h1>
        <p className="text-xs text-[#5C584E] mt-1.5 leading-relaxed">
          {lang === 'en' 
            ? 'What a farmer sees on their phone — book a slot, track the live queue, and receive instant updates.' 
            : 'किसान मोबाइल दृश्य — स्लॉट बुक करें, लाइव कतार स्थिति देखें और तत्काल एसएमएस सूचनाएं प्राप्त करें।'}
        </p>
      </motion.div>

      {/* ═══════ REALISTIC SMARTPHONE FRAME ═══════ */}
      <motion.div 
        className="w-full max-w-[380px] relative animate-phone-breathe"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {/* Power button (right side) */}
        <div className="absolute -right-[3px] top-[120px] w-[3px] h-[40px] bg-[#3D3A33] rounded-r-sm" />
        {/* Volume buttons (left side) */}
        <div className="absolute -left-[3px] top-[100px] w-[3px] h-[25px] bg-[#3D3A33] rounded-l-sm" />
        <div className="absolute -left-[3px] top-[135px] w-[3px] h-[25px] bg-[#3D3A33] rounded-l-sm" />

        <div className="bg-[#1E1D19] rounded-[44px] p-[10px] shadow-2xl border border-[#3D3A33]/50">
          <div className="bg-white rounded-[34px] overflow-hidden relative min-h-[680px] flex flex-col">
            
            {/* Dynamic Island / Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[100px] h-[28px] bg-[#1E1D19] rounded-full z-30 flex items-center justify-center gap-2">
              <div className="w-[8px] h-[8px] rounded-full bg-[#2D2C28] border border-[#3D3A33]" />
              <div className="w-[5px] h-[5px] rounded-full bg-[#2D2C28]" />
            </div>

            {/* Status Bar */}
            <div className="pt-1 px-6 flex items-center justify-between text-[10px] font-mono text-[#5C584E] relative z-20">
              <span className="font-semibold">{timeStr}</span>
              <div className="flex items-center gap-1">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <Battery className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* In-Phone Language Toggle */}
            <div className="absolute top-10 right-3 z-20 flex bg-[#FAF6EC]/90 backdrop-blur-sm border border-[#E6DFC9] rounded-full p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setLang && setLang('en')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all duration-200 ${
                  lang === 'en' ? 'bg-[#2B2A25] text-white shadow-sm' : 'text-[#5C584E]'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang && setLang('hi')}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-all duration-200 ${
                  lang === 'hi' ? 'bg-[#2B2A25] text-white shadow-sm' : 'text-[#5C584E]'
                }`}
              >
                हिं
              </button>
            </div>

            {/* Screen Content Wrapper */}
            <div className="p-4 pt-10 flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {myBooking ? (
                  <TrackerView 
                    key="tracker"
                    myBooking={myBooking} centres={centres} slots={slots} bookings={bookings}
                    notifications={notifications} setShowQR={setShowQR} setMyBooking={setMyBooking}
                    feedback={feedback} setFeedback={setFeedback}
                    handleFeedbackSubmit={handleFeedbackSubmit}
                    t={t} lang={lang}
                  />
                ) : (
                  <BookingForm 
                    key="form"
                    draft={draft} setDraft={setDraft}
                    centres={centres} slots={slots} bookings={bookings}
                    currentCentre={currentCentre} alternativeCentre={alternativeCentre}
                    submitting={submitting} handleBookingSubmit={handleBookingSubmit}
                    t={t} lang={lang}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Home Indicator */}
            <div className="pb-2 flex justify-center">
              <div className="w-[100px] h-[4px] bg-[#2B2A25]/20 rounded-full" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* QR Pass Modal */}
      <AnimatePresence>
        {showQR && myBooking && (
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-white rounded-3xl max-w-xs w-full p-6 text-center shadow-2xl border border-[#E6DFC9]"
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
            >
              <div className="w-10 h-10 bg-[#2B2A25] rounded-xl flex items-center justify-center mx-auto mb-3">
                <QrCode className="w-5 h-5 text-[#C68A2E]" />
              </div>
              <h3 className="text-sm font-bold text-[#2B2A25]">Mandi Gate Entry Pass</h3>
              <p className="text-[11px] text-[#5C584E] mt-0.5">Scannable token pass for yard gate entry</p>
              
              <div className="flex justify-center my-4 p-4 bg-[#FAF6EC] rounded-2xl border border-[#E6DFC9] mx-auto w-fit">
                <QRCodeSVG 
                  value={`MANDIFLOW-TOKEN:${myBooking.token};CENTRE:${myBooking.centre_id};FARMER:${myBooking.farmer_name};DATE:${new Date().toISOString().split('T')[0]}`} 
                  size={150} fgColor="#2B2A25" bgColor="#FAF6EC"
                />
              </div>

              <div className="font-mono text-xl font-bold text-[#C1592F]">
                TOKEN #{String(myBooking.token).padStart(3, '0')}
              </div>
              <div className="text-[10px] text-[#5C584E] font-mono mt-1">
                {myBooking.centre_id.toUpperCase()} · {new Date().toLocaleDateString()}
              </div>

              <button
                onClick={() => setShowQR(false)}
                className="mt-4 w-full py-2.5 bg-[#2B2A25] hover:bg-[#1a1915] text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close Pass
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════ TRACKER VIEW (post-booking) ═══════ */
function TrackerView({ myBooking, centres, slots, bookings, notifications, setShowQR, setMyBooking, feedback, setFeedback, handleFeedbackSubmit, t, lang }) {
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
    { label: t.stGraded, desc: myBooking.qty_kg ? `${myBooking.qty_kg}kg · Grade ${myBooking.grade}` : 'Inspection Desk' },
    { label: t.stPayProc, desc: myBooking.payment_amount ? `₹${myBooking.payment_amount?.toLocaleString()}` : 'Aadhaar DBT' },
    { label: t.stPaid, desc: myBooking.payment_utr || 'Bank Reference' }
  ];

  const myNotifications = notifications.filter(n => 
    (myBooking.id && n.booking_id === myBooking.id) || 
    (myBooking.farmer_phone && n.message?.includes(String(myBooking.token).padStart(3, '0')))
  );

  return (
    <motion.div 
      className="space-y-3"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4 }}
    >
      {/* Token Hero Card */}
      <div className="bg-gradient-to-br from-[#2B2A25] to-[#1a1915] text-white rounded-2xl p-5 text-center shadow-lg relative overflow-hidden grain-overlay">
        <span className="text-[10px] font-mono tracking-widest text-[#C68A2E] uppercase font-bold relative z-10">
          {t.yourToken}
        </span>
        <div className="text-5xl font-mono font-bold mt-1.5 text-white tracking-tight relative z-10 animate-count-up">
          #{String(myBooking.token).padStart(3, '0')}
        </div>
        <div className="text-[11px] text-[#C9C4B4] mt-2 relative z-10">
          {centre.name} — {slot.label}
        </div>

        <button
          onClick={() => setShowQR(true)}
          className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono border border-white/15 transition-all cursor-pointer relative z-10 active:scale-95"
        >
          <QrCode className="w-3.5 h-3.5 text-[#C68A2E]" />
          <span>{t.viewQR}</span>
        </button>
      </div>

      {/* 3 Stats Row */}
      <div className="grid grid-cols-3 gap-2 stagger-children">
        <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
          <div className="text-base font-mono font-bold text-[#C1592F]">
            {nowServingBooking ? `#${String(nowServingBooking.token).padStart(3, '0')}` : '—'}
          </div>
          <div className="text-[9px] text-[#5C584E] mt-0.5 font-medium">{t.nowServing}</div>
        </div>
        
        <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
          <div className="text-base font-mono font-bold text-[#2B2A25]">
            {myBooking.status === 'waiting' ? (queuePos > 0 ? queuePos : 1) : (myBooking.status === 'called' ? 'NOW' : 'DONE')}
          </div>
          <div className="text-[9px] text-[#5C584E] mt-0.5 font-medium">{t.queuePos}</div>
        </div>

        <div className="bg-[#FAF6EC] rounded-xl p-2.5 text-center border border-[#E6DFC9]">
          <div className="text-base font-mono font-bold text-[#43613B]">
            {myBooking.status === 'waiting' ? `${estWaitMin}m` : (myBooking.status === 'called' ? '0m' : '—')}
          </div>
          <div className="text-[9px] text-[#5C584E] mt-0.5 font-medium">{t.estWait}</div>
        </div>
      </div>

      {/* Queue Visual Strip */}
      <div className="bg-[#FAF6EC] rounded-xl p-3 border border-[#E6DFC9]">
        <div className="text-[10px] font-bold text-[#5C584E] mb-2">Queue Position:</div>
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {bookings
            .filter(b => b.centre_id === myBooking.centre_id && (b.status === 'waiting' || b.status === 'called'))
            .sort((a, b) => (b.priority - a.priority) || (a.token - b.token))
            .slice(0, 7)
            .map((b) => {
              const isMe = b.token === myBooking.token;
              const isServing = b.status === 'called';
              return (
                <motion.div 
                  key={b.token}
                  whileHover={{ scale: 1.15 }}
                  className={`flex-none w-8 h-8 rounded-full flex items-center justify-center font-mono text-[9px] font-bold border transition-all ${
                    isMe 
                      ? 'bg-[#2B2A25] text-white border-[#2B2A25] ring-2 ring-[#C68A2E] shadow-md' 
                      : (isServing ? 'bg-[#C1592F] text-white border-[#C1592F]' : 'bg-white text-[#5C584E] border-[#E6DFC9]')
                  }`}
                >
                  {b.token}
                </motion.div>
              );
            })}
        </div>
      </div>

      {/* 5-Stage Stepper */}
      <div className="bg-[#FAF6EC] rounded-xl p-3.5 border border-[#E6DFC9]">
        <div className="text-[10px] font-bold text-[#2B2A25] mb-2.5">{t.statusTrack}</div>
        <div className="space-y-2.5">
          {steps.map((step, idx) => {
            const isDone = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            return (
              <div key={idx} className="flex items-start gap-2.5 relative">
                {idx !== steps.length - 1 && (
                  <div className={`absolute left-[9px] top-[18px] w-0.5 h-3.5 transition-colors duration-500 ${isDone ? 'bg-[#43613B]' : 'bg-[#E6DFC9]'}`} />
                )}
                <div className={`w-[18px] h-[18px] rounded-full flex items-center justify-center flex-none font-mono text-[9px] font-bold transition-all duration-300 ${
                  isDone 
                    ? 'bg-[#E1EADD] text-[#43613B]' 
                    : (isCurrent ? 'bg-[#C1592F] text-white ring-2 ring-[#F5E1D5] shadow-sm' : 'bg-white text-[#5C584E] border border-[#E6DFC9]')
                }`}>
                  {isDone ? '✓' : idx + 1}
                </div>
                <div>
                  <div className={`text-[10px] font-bold ${isCurrent ? 'text-[#C1592F]' : 'text-[#2B2A25]'}`}>
                    {step.label}
                  </div>
                  <div className="text-[9px] text-[#5C584E]">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SMS Notifications */}
      <div className="bg-[#FAF6EC] rounded-xl p-3 border border-[#E6DFC9]">
        <div className="text-[10px] font-bold text-[#2B2A25] mb-2">{t.notifications}</div>
        <div className="space-y-1.5">
          {myNotifications.length > 0 ? (
            myNotifications.map((notif, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-2 rounded-lg bg-white border border-[#E6DFC9] text-[10px]"
              >
                <div className="text-[#2B2A25] leading-relaxed">{notif.message}</div>
                <div className="text-[9px] text-[#5C584E] mt-0.5 font-mono uppercase">
                  {notif.channel} · {new Date(notif.sent_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-[10px] text-[#5C584E] text-center py-1">{t.noNotifications}</div>
          )}
        </div>
      </div>

      {/* Feedback Survey */}
      {myBooking.status === 'served' && !feedback.submitted && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#FAF6EC] rounded-xl p-3 border border-[#C68A2E]/30"
        >
          <div className="text-[10px] font-bold text-[#2B2A25] flex items-center gap-1">
            <Star className="w-3 h-3 text-[#C68A2E] fill-[#C68A2E]" />
            <span>Service Rating</span>
          </div>
          <form onSubmit={handleFeedbackSubmit} className="space-y-2 mt-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button" key={s}
                  onClick={() => setFeedback({ ...feedback, rating: s })}
                  className={`w-6 h-6 rounded text-xs font-bold transition-all cursor-pointer ${
                    feedback.rating >= s ? 'bg-[#C68A2E] text-white scale-110' : 'bg-white border border-[#E6DFC9] text-[#5C584E]'
                  }`}
                >★</button>
              ))}
            </div>
            <input
              type="text" placeholder="Your comments..."
              value={feedback.comments}
              onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
              className="w-full text-[10px] p-2 rounded-lg bg-white border border-[#E6DFC9] outline-none focus:border-[#C68A2E] transition-colors"
            />
            <button type="submit" className="w-full py-2 bg-[#2B2A25] text-white text-[10px] font-bold rounded-lg cursor-pointer hover:bg-[#1a1915] transition-colors">
              Submit Feedback
            </button>
          </form>
        </motion.div>
      )}

      {/* Reset Button */}
      <button
        onClick={() => setMyBooking(null)}
        className="w-full py-2.5 rounded-xl border border-[#2B2A25] text-[#2B2A25] font-bold text-[10px] hover:bg-[#2B2A25] hover:text-white transition-all cursor-pointer active:scale-[0.98]"
      >
        {t.bookAnother}
      </button>
    </motion.div>
  );
}

/* ═══════ BOOKING FORM ═══════ */
function BookingForm({ draft, setDraft, centres, slots, bookings, currentCentre, alternativeCentre, submitting, handleBookingSubmit, t, lang }) {
  return (
    <motion.form 
      onSubmit={handleBookingSubmit} 
      className="space-y-3.5"
      initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-left">
        <div className="text-base font-extrabold text-[#2B2A25] tracking-tight">{t.appTitle}</div>
        <div className="text-[10px] text-[#5C584E] mt-0.5">{t.tagline}</div>
      </div>

      {/* 1. Choose Centre */}
      <div>
        <div className="text-[10px] font-bold text-[#5C584E] mb-1.5 uppercase tracking-wider">{t.chooseCentre}</div>
        <div className="space-y-1.5">
          {centres.map((c) => {
            const isSelected = draft.centre_id === c.id;
            const waiting = bookings.filter(b => b.centre_id === c.id && b.status === 'waiting').length;
            const loadRatio = waiting / c.slot_capacity;
            const loadCls = loadRatio > 0.7 ? 'bg-[#F3DEDA] text-[#A63D3D]' : (loadRatio > 0.35 ? 'bg-[#F3E5C6] text-[#8a6018]' : 'bg-[#E1EADD] text-[#43613B]');
            
            return (
              <motion.div
                key={c.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setDraft({ ...draft, centre_id: c.id, crop: c.default_crop || draft.crop })}
                className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#C1592F] bg-[#F5E1D5]/30 shadow-sm'
                    : 'border-[#E6DFC9] bg-white hover:border-[#C1592F]/50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-[11px] font-bold text-[#2B2A25] flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#C1592F]" />
                      {c.name}
                    </div>
                    <div className="text-[10px] text-[#5C584E] mt-0.5 ml-[18px]">{c.place} · {c.default_crop}</div>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${loadCls}`}>
                    {waiting} {lang === 'en' ? 'waiting' : 'प्रतीक्षारत'}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* AI Load suggestion */}
        {alternativeCentre && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 p-2.5 bg-gradient-to-r from-[#F3E5C6] to-[#F3E5C6]/60 rounded-xl border border-[#C68A2E]/30 text-[10px] text-[#6d4c14]"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C68A2E]" />
              <span className="font-bold">{alternativeCentre.name}</span>
              <span>{lang === 'en' ? 'is less busy' : 'पर कम भीड़ है'}</span>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, centre_id: alternativeCentre.id, crop: alternativeCentre.default_crop || draft.crop })}
              className="font-bold underline cursor-pointer text-[#9A431F] mt-0.5 ml-5"
            >
              {t.switchCentre} →
            </button>
          </motion.div>
        )}
      </div>

      {/* 2. Select Crop */}
      <div>
        <div className="text-[10px] font-bold text-[#5C584E] mb-1.5 uppercase tracking-wider">{t.chooseCrop}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {CROPS.map((crop) => (
            <motion.button
              type="button" key={crop}
              whileTap={{ scale: 0.95 }}
              onClick={() => setDraft({ ...draft, crop })}
              className={`py-2 px-2 rounded-xl text-[10px] font-bold border transition-all cursor-pointer text-center ${
                draft.crop === crop
                  ? 'border-[#C1592F] bg-[#C1592F] text-white shadow-md'
                  : 'border-[#E6DFC9] bg-white text-[#2B2A25] hover:border-[#C1592F]/50'
              }`}
            >
              <span className="text-sm block mb-0.5">{CROP_EMOJI[crop]}</span>
              {crop}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 3. Pick Time Slot */}
      <div>
        <div className="text-[10px] font-bold text-[#5C584E] mb-1.5 uppercase tracking-wider">{t.chooseSlot}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {slots.map((s) => {
            const isSelected = draft.slot_id === s.id;
            const bookedInSlot = bookings.filter(b => b.centre_id === draft.centre_id && b.slot_id === s.id && b.status !== 'no-show').length;
            const cap = currentCentre ? currentCentre.slot_capacity : 25;
            const left = Math.max(cap - bookedInSlot, 0);
            const isFull = left === 0;

            return (
              <motion.button
                type="button" key={s.id}
                whileTap={{ scale: isFull ? 1 : 0.97 }}
                disabled={isFull}
                onClick={() => setDraft({ ...draft, slot_id: s.id })}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#C1592F] bg-[#F5E1D5]/50 shadow-sm'
                    : (isFull ? 'bg-[#E6DFC9]/30 border-[#E6DFC9] opacity-40 cursor-not-allowed' : 'border-[#E6DFC9] bg-white hover:border-[#C1592F]/50')
                }`}
              >
                <div className="text-[10px] font-bold text-[#2B2A25]">{s.label}</div>
                <div className="text-[9px] text-[#5C584E] font-mono mt-0.5">
                  {isFull ? t.full : `${left} ${t.seatsLeft}`}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* 4. Farmer Inputs */}
      <div className="space-y-1.5 pt-1">
        <input
          type="text" required
          placeholder={lang === 'en' ? "Farmer Name (e.g. Ramesh Yadav)" : "किसान का नाम"}
          value={draft.farmer_name}
          onChange={(e) => setDraft({ ...draft, farmer_name: e.target.value })}
          className="w-full text-[10px] p-2.5 rounded-xl border border-[#E6DFC9] bg-[#FAF6EC] focus:bg-white focus:border-[#C1592F] outline-none transition-all"
        />
        <input
          type="tel"
          placeholder={lang === 'en' ? "Mobile (e.g. +91 98765 43210)" : "मोबाइल नंबर"}
          value={draft.farmer_phone}
          onChange={(e) => setDraft({ ...draft, farmer_phone: e.target.value })}
          className="w-full text-[10px] p-2.5 rounded-xl border border-[#E6DFC9] bg-[#FAF6EC] focus:bg-white focus:border-[#C1592F] outline-none transition-all"
        />
        <label className="flex items-center gap-2 cursor-pointer pt-0.5">
          <input
            type="checkbox"
            checked={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: e.target.checked })}
            className="accent-[#C1592F] rounded w-3.5 h-3.5"
          />
          <span className="text-[10px] text-[#5C584E]">
            <strong className="text-[#2B2A25]">{t.elderlyPriority}</strong>
          </span>
        </label>
      </div>

      {/* Confirm CTA */}
      <motion.button
        type="submit"
        disabled={submitting || !draft.farmer_name.trim()}
        whileTap={{ scale: 0.97 }}
        className={`w-full py-3 rounded-xl font-bold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 mt-1 ${
          draft.farmer_name.trim() 
            ? 'bg-gradient-to-r from-[#C1592F] to-[#9A431F] hover:from-[#9A431F] hover:to-[#C1592F] text-white shadow-lg shadow-[#C1592F]/20' 
            : 'bg-[#D8D2C2] text-[#5C584E] cursor-not-allowed'
        }`}
      >
        <span>{submitting ? 'Generating Token...' : t.confirmBooking}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </motion.button>
    </motion.form>
  );
}
