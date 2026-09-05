import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import FarmerBooking from './components/FarmerBooking';
import AdminConsole from './components/AdminConsole';
import KioskDisplay from './components/KioskDisplay';
import OversightDashboard from './components/OversightDashboard';
import IVRKeypadSimulator from './components/IVRKeypadSimulator';
import { translations } from './i18n';

export default function App() {
  const [activeTab, setActiveTab] = useState('farmer');
  const [lang, setLang] = useState('en');
  
  const [centres, setCentres] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [myBooking, setMyBooking] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const socketRef = useRef(null);
  const t = translations[lang];

  // Fetch initial database state
  const loadInitialData = async () => {
    try {
      const [cRes, sRes, bRes, nRes] = await Promise.all([
        fetch('/api/centres'),
        fetch('/api/slots'),
        fetch('/api/bookings'),
        fetch('/api/notifications')
      ]);

      if (cRes.ok) setCentres(await cRes.json());
      if (sRes.ok) setSlots(await sRes.json());
      if (bRes.ok) setBookings(await bRes.json());
      if (nRes.ok) setNotifications(await nRes.json());
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();

    // WebSocket real-time subscription
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/queue`;
    
    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const { event: evtType, data } = msg;

            if (evtType === 'booking_created') {
              setBookings((prev) => [...prev, data]);
            } else if (
              evtType === 'token_called' || 
              evtType === 'produce_graded' || 
              evtType === 'payment_disbursed' || 
              evtType === 'booking_updated'
            ) {
              setBookings((prev) => prev.map((b) => (b.id === data.id ? data : b)));
              setMyBooking((cur) => (cur && cur.id === data.id ? data : cur));
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // Auto-reconnect after 3 seconds
          setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch (e) {
        console.warn('WebSocket connection attempt failed:', e);
      }
    };

    connectWs();

    // Periodic poll as safety fallback for notifications and queue
    const pollInterval = setInterval(async () => {
      try {
        const [bRes, nRes] = await Promise.all([
          fetch('/api/bookings'),
          fetch('/api/notifications')
        ]);
        if (bRes.ok) setBookings(await bRes.json());
        if (nRes.ok) setNotifications(await nRes.json());
      } catch (e) {
        // silent
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const handleCallNext = async (centreId) => {
    try {
      const res = await fetch(`/api/queue/${centreId}/call-next`, {
        method: 'POST'
      });
      if (res.ok) {
        const called = await res.json();
        setBookings((prev) => prev.map((b) => (b.id === called.id ? called : b)));
        if (myBooking && myBooking.id === called.id) {
          setMyBooking(called);
        }
      }
    } catch (err) {
      console.error('Failed to call next token:', err);
    }
  };

  const handleUpdateBooking = async () => {
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) setBookings(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF6EC] text-[#2B2A25]">
      {/* Top Header & Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        wsConnected={wsConnected}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {activeTab === 'farmer' && (
          <FarmerBooking
            centres={centres}
            slots={slots}
            lang={lang}
            bookings={bookings}
            myBooking={myBooking}
            setMyBooking={setMyBooking}
            notifications={notifications}
            onBookingComplete={(b) => setMyBooking(b)}
          />
        )}

        {activeTab === 'admin' && (
          <AdminConsole
            centres={centres}
            slots={slots}
            lang={lang}
            bookings={bookings}
            onCallNext={handleCallNext}
            onUpdateBooking={handleUpdateBooking}
            onStaffBooking={handleUpdateBooking}
          />
        )}

        {activeTab === 'kiosk' && (
          <KioskDisplay
            centres={centres}
            lang={lang}
            bookings={bookings}
          />
        )}

        {activeTab === 'oversight' && (
          <OversightDashboard
            lang={lang}
          />
        )}

        {activeTab === 'ivr' && (
          <IVRKeypadSimulator
            lang={lang}
            onIVRBookingCreated={(b) => {
              setBookings((prev) => [...prev, b]);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E6DFC9] bg-white/70 py-6 mt-12 text-center text-xs text-[#5C584E]">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <div className="font-semibold text-[#2B2A25]">
            MandiFlow · Real-Time Farmer Procurement Slot, Queue & Status Platform
          </div>
          <div>
            Built for Smart India Hackathon 2026 · Problem Statement SIH26032 · Ministry of Consumer Affairs, Food & Public Distribution
          </div>
          <div className="font-mono text-[11px] text-[#A6A295] pt-1">
            Omnichannel Access: Keypad IVR (1800-889-2026) · SMS & WhatsApp Sandbox · Gate Kiosk TV · DBT Portal
          </div>
        </div>
      </footer>
    </div>
  );
}
