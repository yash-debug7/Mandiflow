import React, { useState } from 'react';
import { translations } from '../i18n';
import { Monitor, Volume2, ArrowRight } from 'lucide-react';

export default function KioskDisplay({ centres, lang, bookings }) {
  const t = translations[lang];
  const [kioskCentreId, setKioskCentreId] = useState('sitapur');

  const currentCentre = centres.find(c => c.id === kioskCentreId) || centres[0];
  const centreBookings = bookings.filter(b => b.centre_id === kioskCentreId);
  const nowServing = centreBookings.find(b => b.status === 'called');
  const upcoming = centreBookings
    .filter(b => b.status === 'waiting')
    .sort((a, b) => (b.priority - a.priority) || (a.token - b.token))
    .slice(0, 6);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Centre selector */}
      <div className="flex justify-center gap-2 mb-6 flex-wrap">
        {centres.map((c) => (
          <button
            key={c.id}
            onClick={() => setKioskCentreId(c.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              c.id === kioskCentreId 
                ? 'bg-[#2B2A25] text-white border-[#2B2A25] shadow-sm' 
                : 'bg-white text-[#5C584E] border-[#E6DFC9] hover:border-[#2B2A25]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* High-Contrast Yard Display */}
      <div className="bg-[#2B2A25] text-white rounded-3xl p-8 sm:p-14 text-center shadow-2xl border-4 border-[#3D3A33] relative overflow-hidden">
        <div className="text-xs sm:text-sm font-mono tracking-widest text-[#C68A2E] uppercase font-bold">
          {currentCentre?.name} · {currentCentre?.place}
        </div>

        <div className="text-sm sm:text-base font-bold text-[#D9D4C6] mt-4 tracking-wider uppercase">
          {t.kioskTitle}
        </div>

        {/* Gigantic Token Display */}
        <div className="text-7xl sm:text-9xl md:text-[140px] font-mono font-extrabold text-[#C1592F] my-4 leading-none tracking-tight">
          {nowServing ? `#${String(nowServing.token).padStart(3, '0')}` : '—'}
        </div>

        <div className="text-base sm:text-xl font-medium text-[#FAF6EC] mt-2">
          {nowServing ? (
            <span>
              {nowServing.farmer_name} · <strong className="text-[#C68A2E]">{nowServing.crop}</strong>
              {nowServing.priority ? ' (★ Priority Express)' : ''}
            </span>
          ) : (
            'Waiting for next token dispatch...'
          )}
        </div>

        <div className="inline-block mt-4 px-6 py-2 rounded-full bg-[#FAF6EC]/10 text-xs sm:text-sm text-[#D9D4C6] border border-white/10 font-mono">
          {t.kioskSub}
        </div>

        {/* Upcoming Tokens Horizontal Strip */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="text-xs font-mono text-[#D9D4C6] uppercase tracking-wider mb-4">
            {t.kioskUpcoming}
          </div>
          
          <div className="flex justify-center items-center gap-3 flex-wrap">
            {upcoming.length > 0 ? (
              upcoming.map((b) => (
                <div
                  key={b.id}
                  className="px-5 py-3 rounded-2xl bg-white/5 border border-white/15 text-white font-mono text-xl sm:text-2xl font-bold flex items-center gap-2"
                >
                  <span>#{String(b.token).padStart(3, '0')}</span>
                  {b.priority && <span className="text-[#C68A2E] text-sm">★</span>}
                </div>
              ))
            ) : (
              <div className="text-xs text-[#D9D4C6]/60 font-mono">No other tokens currently in queue</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
