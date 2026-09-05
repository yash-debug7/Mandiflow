"""
MandiFlow Backend — Main FastAPI application.
Serves REST API, WebSocket queue sync, and Twilio IVR webhooks.
"""
import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import get_db, init_db, next_token
from ivr import router as ivr_router
from notifications import dispatch_omnichannel, send_sms, send_whatsapp

# ── Connected WebSocket clients ──
ws_clients: set[WebSocket] = set()


async def broadcast(event: str, data: dict):
    """Push a JSON event to every connected WebSocket client."""
    payload = json.dumps({"event": event, "data": data})
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    ws_clients.difference_update(dead)


# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="MandiFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ivr_router)


# ═══════════════════════════════════════
#  PYDANTIC MODELS
# ═══════════════════════════════════════

class BookingCreate(BaseModel):
    centre_id: str
    crop: str
    slot_id: str
    farmer_name: str
    farmer_phone: str = ""
    priority: int = 0
    channel: str = "web"


class BookingUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[int] = None
    qty_kg: Optional[float] = None
    moisture_pct: Optional[float] = None
    grade: Optional[str] = None
    msp_rate: Optional[float] = None
    payment_amount: Optional[float] = None
    payment_status: Optional[str] = None
    payment_utr: Optional[str] = None


class StaffBookingCreate(BaseModel):
    """Admin staff-assisted walk-in registration."""
    centre_id: str
    crop: str
    slot_id: str
    farmer_name: str
    farmer_phone: str = ""
    priority: int = 0


class ProcurementGradeRequest(BaseModel):
    booking_id: int
    qty_kg: float
    moisture_pct: float = 12.0
    grade: str = "A"
    msp_rate: float = 24.25 # Rs per kg (e.g. Wheat MSP ~Rs 2425/quintal)


class PaymentDisburseRequest(BaseModel):
    booking_id: int
    utr_number: Optional[str] = None


class FeedbackCreate(BaseModel):
    booking_id: Optional[int] = None
    rating: int = 5
    wait_satisfaction: int = 5
    comments: Optional[str] = None


# ═══════════════════════════════════════
#  REFERENCE DATA
# ═══════════════════════════════════════

@app.get("/api/centres")
async def list_centres():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM centres")
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.get("/api/slots")
async def list_slots():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM slots")
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ═══════════════════════════════════════
#  BOOKINGS
# ═══════════════════════════════════════

@app.post("/api/bookings")
async def create_booking(b: BookingCreate):
    db = await get_db()
    try:
        token = await next_token(b.centre_id)
        await db.execute(
            """INSERT INTO bookings
            (token, centre_id, crop, slot_id, farmer_name, farmer_phone, priority, status, payment_status, booking_channel)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (token, b.centre_id, b.crop, b.slot_id, b.farmer_name,
             b.farmer_phone, b.priority, "waiting", "pending", b.channel),
        )
        await db.commit()

        booking = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE centre_id=? AND token=? ORDER BY id DESC LIMIT 1",
            (b.centre_id, token),
        )
        result = dict(booking[0])
        await broadcast("booking_created", result)
        return result
    finally:
        await db.close()


@app.get("/api/bookings")
async def list_bookings(
    centre_id: Optional[str] = None,
    status: Optional[str] = None,
):
    db = await get_db()
    try:
        query = "SELECT * FROM bookings WHERE 1=1"
        params = []
        if centre_id:
            query += " AND centre_id=?"
            params.append(centre_id)
        if status:
            query += " AND status=?"
            params.append(status)
        query += " ORDER BY id ASC"
        rows = await db.execute_fetchall(query, params)
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.get("/api/bookings/{booking_id}")
async def get_booking(booking_id: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE id=?", (booking_id,)
        )
        if not rows:
            raise HTTPException(404, "Booking not found")
        return dict(rows[0])
    finally:
        await db.close()


@app.get("/api/bookings/token/{centre_id}/{token}")
async def get_booking_by_token(centre_id: str, token: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE centre_id=? AND token=? ORDER BY id DESC LIMIT 1",
            (centre_id, token),
        )
        if not rows:
            raise HTTPException(404, "Booking not found")
        return dict(rows[0])
    finally:
        await db.close()


@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: int, update: BookingUpdate):
    db = await get_db()
    try:
        sets = []
        params = []
        for field, value in update.model_dump(exclude_none=True).items():
            sets.append(f"{field}=?")
            params.append(value)
        if not sets:
            raise HTTPException(400, "No fields to update")
        sets.append("updated_at=?")
        params.append(datetime.utcnow().isoformat())
        params.append(booking_id)
        await db.execute(
            f"UPDATE bookings SET {', '.join(sets)} WHERE id=?", params
        )
        await db.commit()
        rows = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE id=?", (booking_id,)
        )
        if not rows:
            raise HTTPException(404, "Booking not found")
        result = dict(rows[0])
        await broadcast("booking_updated", result)
        return result
    finally:
        await db.close()


# ── Queue operations ──

class PAAnnouncementRequest(BaseModel):
    token: int
    farmer_name: str
    bay_number: int = 2
    language: str = "both"

@app.post("/api/queue/{centre_id}/call-next")
async def call_next(centre_id: str):
    """Call the next token in the waiting queue (priority first, then FIFO)."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """SELECT * FROM bookings
            WHERE centre_id=? AND status='waiting'
            ORDER BY priority DESC, token ASC
            LIMIT 1""",
            (centre_id,),
        )
        if not rows:
            raise HTTPException(404, "No one waiting")
        booking = dict(rows[0])
        await db.execute(
            "UPDATE bookings SET status='called', updated_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), booking["id"]),
        )
        await db.commit()
        booking["status"] = "called"
        await broadcast("token_called", booking)
        
        # Also broadcast live Mandi PA Loudspeaker announcement for no-phone farmers
        bay_num = 2 if centre_id in ("sitapur", "karnal") else 1
        pa_payload = {
            "centre_id": centre_id,
            "token": booking["token"],
            "farmer_name": booking["farmer_name"],
            "bay_number": bay_num,
            "msg_hi": f"ध्यान दें! टोकन नंबर {booking['token']}, किसान {booking['farmer_name']}, कृपया तौल शेड {bay_num} पर तुरंत पहुंचे।",
            "msg_en": f"Attention! Token number {booking['token']}, Farmer {booking['farmer_name']}, please report to Weighing Bay {bay_num} immediately.",
            "timestamp": datetime.utcnow().isoformat()
        }
        await broadcast("pa_announcement", pa_payload)

        # Omnichannel notification to phone if available
        if booking.get("farmer_phone"):
            msg = f"MandiFlow ALERT: Token #{booking['token']:03d}, your turn is now! Please proceed to Weighing Bay {bay_num} immediately."
            await dispatch_omnichannel(booking["farmer_phone"], msg, booking["id"])

        return booking
    finally:
        await db.close()


@app.post("/api/queue/{centre_id}/pa-announce")
async def pa_announce(centre_id: str, req: PAAnnouncementRequest):
    """Trigger Mandi Yard PA Loudspeaker Audio Announcement explicitly."""
    pa_payload = {
        "centre_id": centre_id,
        "token": req.token,
        "farmer_name": req.farmer_name,
        "bay_number": req.bay_number,
        "msg_hi": f"ध्यान दें! टोकन नंबर {req.token}, किसान {req.farmer_name}, कृपया तौल शेड {req.bay_number} पर पहुंचे।",
        "msg_en": f"Attention! Token number {req.token}, Farmer {req.farmer_name}, please proceed to Weighing Bay {req.bay_number}.",
        "timestamp": datetime.utcnow().isoformat()
    }
    await broadcast("pa_announcement", pa_payload)
    return {"status": "announced", "payload": pa_payload}


@app.get("/api/queue/{centre_id}/now-serving")
async def now_serving(centre_id: str):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE centre_id=? AND status='called' ORDER BY updated_at DESC LIMIT 1",
            (centre_id,),
        )
        if not rows:
            return None
        return dict(rows[0])
    finally:
        await db.close()


@app.get("/api/queue/{centre_id}/waiting")
async def waiting_list(centre_id: str):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """SELECT * FROM bookings
            WHERE centre_id=? AND status='waiting'
            ORDER BY priority DESC, token ASC""",
            (centre_id,),
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


@app.get("/api/queue/{centre_id}/stats")
async def queue_stats(centre_id: str):
    """Quick stats: waiting count, served today, avg service time."""
    db = await get_db()
    try:
        SERVICE_MIN = 7
        waiting = await db.execute_fetchall(
            "SELECT COUNT(*) as c FROM bookings WHERE centre_id=? AND status='waiting'",
            (centre_id,),
        )
        served = await db.execute_fetchall(
            "SELECT COUNT(*) as c FROM bookings WHERE centre_id=? AND status='served'",
            (centre_id,),
        )
        noshow = await db.execute_fetchall(
            "SELECT COUNT(*) as c FROM bookings WHERE centre_id=? AND status='no-show'",
            (centre_id,),
        )
        total = await db.execute_fetchall(
            "SELECT COUNT(*) as c FROM bookings WHERE centre_id=?",
            (centre_id,),
        )
        waiting_count = waiting[0][0]
        return {
            "waiting": waiting_count,
            "served": served[0][0],
            "noshow": noshow[0][0],
            "total": total[0][0],
            "avg_wait_min": waiting_count * SERVICE_MIN,
        }
    finally:
        await db.close()


# ── Oversight / aggregate stats ──

@app.get("/api/oversight/stats")
async def oversight_stats():
    db = await get_db()
    try:
        SERVICE_MIN = 7
        total = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings")
        served = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings WHERE status='served'")
        noshow = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings WHERE status='no-show'")
        paid = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings WHERE status='served' AND payment_status='paid'")
        waiting = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings WHERE status='waiting'")

        total_v = total[0][0]
        served_v = served[0][0]
        noshow_v = noshow[0][0]
        paid_v = paid[0][0]
        waiting_v = waiting[0][0]

        # Per-centre breakdown
        centres = await db.execute_fetchall("SELECT * FROM centres")
        centre_stats = []
        for c in centres:
            cd = dict(c)
            w = await db.execute_fetchall(
                "SELECT COUNT(*) as ct FROM bookings WHERE centre_id=? AND status='waiting'",
                (cd["id"],),
            )
            t = await db.execute_fetchall(
                "SELECT COUNT(*) as ct FROM bookings WHERE centre_id=?",
                (cd["id"],),
            )
            cd["waiting"] = w[0][0]
            cd["total_bookings"] = t[0][0]
            centre_stats.append(cd)

        return {
            "total_bookings": total_v,
            "served": served_v,
            "noshow": noshow_v,
            "noshow_pct": round(noshow_v / total_v * 100) if total_v else 0,
            "paid": paid_v,
            "paid_pct": round(paid_v / served_v * 100) if served_v else 0,
            "waiting": waiting_v,
            "avg_wait_min": max(round(waiting_v * SERVICE_MIN / max(len(centre_stats), 1) / 2), 0),
            "centres": centre_stats,
        }
    finally:
        await db.close()


# ── Slot capacity check ──

@app.get("/api/capacity/{centre_id}/{slot_id}")
async def slot_capacity(centre_id: str, slot_id: str):
    db = await get_db()
    try:
        cap_row = await db.execute_fetchall(
            "SELECT slot_capacity FROM centres WHERE id=?", (centre_id,)
        )
        if not cap_row:
            raise HTTPException(404, "Centre not found")
        cap = cap_row[0][0]
        used_row = await db.execute_fetchall(
            "SELECT COUNT(*) as c FROM bookings WHERE centre_id=? AND slot_id=? AND status != 'no-show'",
            (centre_id, slot_id),
        )
        used = used_row[0][0]
        return {"capacity": cap, "used": used, "available": max(cap - used, 0)}
    finally:
        await db.close()


# ═══════════════════════════════════════
#  STAFF-ASSISTED WALK-IN BOOKING
# ═══════════════════════════════════════

@app.post("/api/admin/staff-booking")
async def staff_booking(sb: StaffBookingCreate):
    """Register walk-in farmers on the spot from the procurement desk."""
    db = await get_db()
    try:
        tok = await next_token(sb.centre_id)
        await db.execute(
            """INSERT INTO bookings
            (token, centre_id, crop, slot_id, farmer_name, farmer_phone, priority, status, payment_status, booking_channel)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'waiting', 'pending', 'staff_assisted')""",
            (tok, sb.centre_id, sb.crop, sb.slot_id, sb.farmer_name, sb.farmer_phone, sb.priority)
        )
        await db.commit()

        row = await db.execute_fetchall(
            "SELECT * FROM bookings WHERE centre_id=? AND token=? ORDER BY id DESC LIMIT 1",
            (sb.centre_id, tok)
        )
        booking = dict(row[0])
        await broadcast("booking_created", booking)

        if sb.farmer_phone:
            msg = f"MandiFlow: Walk-in registered! Token #{tok:03d} for {sb.centre_id.title()} Mandi, Slot {sb.slot_id.upper()}. Gate pass active."
            await dispatch_omnichannel(sb.farmer_phone, msg, booking["id"])

        return booking
    finally:
        await db.close()


# ═══════════════════════════════════════
#  PROCUREMENT GRADING & MSP DISBURSEMENT
# ═══════════════════════════════════════

@app.post("/api/procurement/grade")
async def grade_produce(req: ProcurementGradeRequest):
    """Weigh produce, inspect moisture %, assign grade, and calculate MSP payout."""
    total_payout = round(req.qty_kg * req.msp_rate, 2)
    db = await get_db()
    try:
        await db.execute(
            """UPDATE bookings
            SET qty_kg=?, moisture_pct=?, grade=?, msp_rate=?, payment_amount=?, status='served', payment_status='pending', updated_at=?
            WHERE id=?""",
            (req.qty_kg, req.moisture_pct, req.grade, req.msp_rate, total_payout, datetime.utcnow().isoformat(), req.booking_id)
        )
        await db.commit()

        row = await db.execute_fetchall("SELECT * FROM bookings WHERE id=?", (req.booking_id,))
        if not row:
            raise HTTPException(404, "Booking not found")
        booking = dict(row[0])
        await broadcast("produce_graded", booking)

        if booking.get("farmer_phone"):
            msg = (f"MandiFlow: Produce accepted! {req.qty_kg:.1f}kg at Rs {req.msp_rate}/kg. "
                   f"Grade {req.grade} (Moisture {req.moisture_pct}%). Total payout: Rs {total_payout:,.2f}. DBT pending.")
            await dispatch_omnichannel(booking["farmer_phone"], msg, req.booking_id)

        return booking
    finally:
        await db.close()


@app.post("/api/procurement/disburse")
async def disburse_payment(req: PaymentDisburseRequest):
    """Trigger DBT payment settlement, generating bank UTR."""
    import random
    utr = req.utr_number or f"DBT{datetime.utcnow().strftime('%Y%m%d')}{random.randint(10000, 99999)}"
    db = await get_db()
    try:
        await db.execute(
            """UPDATE bookings
            SET payment_status='paid', payment_utr=?, updated_at=?
            WHERE id=?""",
            (utr, datetime.utcnow().isoformat(), req.booking_id)
        )
        await db.commit()

        row = await db.execute_fetchall("SELECT * FROM bookings WHERE id=?", (req.booking_id,))
        if not row:
            raise HTTPException(404, "Booking not found")
        booking = dict(row[0])
        await broadcast("payment_disbursed", booking)

        if booking.get("farmer_phone"):
            payout = booking.get("payment_amount") or 0
            msg = (f"MandiFlow: DBT Payment of Rs {payout:,.2f} credited to your Aadhaar-linked account. "
                   f"Bank UTR: {utr}. Thank you for selling via MSP!")
            await dispatch_omnichannel(booking["farmer_phone"], msg, req.booking_id)

        return booking
    finally:
        await db.close()


# ═══════════════════════════════════════
#  NOTIFICATIONS LOG
# ═══════════════════════════════════════

@app.get("/api/notifications")
async def list_notifications(limit: int = 50):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT * FROM notifications ORDER BY id DESC LIMIT ?", (limit,)
        )
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ═══════════════════════════════════════
#  FARMER FEEDBACK / GRIEVANCE SURVEY
# ═══════════════════════════════════════

@app.post("/api/feedback")
async def submit_feedback(fb: FeedbackCreate):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO feedback (booking_id, rating, wait_satisfaction, comments) VALUES (?, ?, ?, ?)",
            (fb.booking_id, fb.rating, fb.wait_satisfaction, fb.comments)
        )
        await db.commit()
        return {"status": "success", "message": "Feedback submitted successfully"}
    finally:
        await db.close()


@app.get("/api/feedback")
async def get_feedback():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT * FROM feedback ORDER BY id DESC LIMIT 20")
        avg_row = await db.execute_fetchall("SELECT AVG(rating) as r, AVG(wait_satisfaction) as w, COUNT(*) as c FROM feedback")
        stats = dict(avg_row[0]) if avg_row else {"r": 4.8, "w": 4.6, "c": 0}
        return {
            "average_rating": round(stats.get("r") or 4.8, 1),
            "wait_satisfaction": round(stats.get("w") or 4.6, 1),
            "total_reviews": stats.get("c") or 0,
            "reviews": [dict(r) for r in rows]
        }
    finally:
        await db.close()


# ═══════════════════════════════════════
#  AI DYNAMIC WAIT-TIME & LOAD BALANCING
# ═══════════════════════════════════════

@app.get("/api/ai/recommendations")
async def ai_recommendations(current_centre_id: Optional[str] = None):
    """
    AI dynamic wait-time calculator and centre load-balancing recommendation engine.
    Identifies congested centres and suggests alternative yards with lower wait times.
    """
    db = await get_db()
    try:
        centres = await db.execute_fetchall("SELECT * FROM centres")
        c_list = []
        for c in centres:
            cd = dict(c)
            w_rows = await db.execute_fetchall(
                "SELECT COUNT(*) as ct, SUM(priority) as pri FROM bookings WHERE centre_id=? AND status='waiting'",
                (cd["id"],)
            )
            waiting_count = w_rows[0][0] or 0
            priority_count = w_rows[0][1] or 0
            
            # AI formula: base 6 mins per regular token, 9 mins for priority produce inspection
            dynamic_wait = (waiting_count * 6) + (priority_count * 3)
            load_pct = round((waiting_count / cd["slot_capacity"]) * 100, 1)
            
            cd["waiting"] = waiting_count
            cd["priority_waiting"] = priority_count
            cd["estimated_wait_min"] = dynamic_wait
            cd["congestion_level"] = "high" if load_pct > 70 else ("moderate" if load_pct > 35 else "low")
            cd["load_percentage"] = load_pct
            c_list.append(cd)

        recommendation = None
        if current_centre_id:
            cur = next((c for c in c_list if c["id"] == current_centre_id), None)
            if cur and cur["congestion_level"] == "high":
                best_alt = min((c for c in c_list if c["id"] != current_centre_id), key=lambda x: x["waiting"], default=None)
                if best_alt and (cur["waiting"] - best_alt["waiting"]) >= 3:
                    time_saved = cur["estimated_wait_min"] - best_alt["estimated_wait_min"]
                    recommendation = {
                        "suggested_centre_id": best_alt["id"],
                        "suggested_centre_name": best_alt["name"],
                        "time_saved_minutes": time_saved,
                        "message_en": f"💡 {best_alt['name']} is less busy today. Switching can save you ~{time_saved} minutes.",
                        "message_hi": f"💡 {best_alt['name']} आज कम व्यस्त है। यहाँ जाने से ~{time_saved} मिनट बचेंगे।"
                    }

        return {
            "centres": c_list,
            "recommendation": recommendation,
            "weather_advisory": {
                "alert": "Clear skies forecast across Northern Mandis. Ideal crop transportation conditions.",
                "advisory_code": "GREEN"
            }
        }
    finally:
        await db.close()


# ═══════════════════════════════════════
#  WEBSOCKET
# ═══════════════════════════════════════

@app.websocket("/ws/queue")
async def websocket_queue(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    try:
        while True:
            await ws.receive_text()  # keep alive
    except WebSocketDisconnect:
        ws_clients.discard(ws)


# ═══════════════════════════════════════
#  HEALTH
# ═══════════════════════════════════════

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "MandiFlow API", "version": "1.0.0"}


# ═══════════════════════════════════════
#  MOUNT BUILT FRONTEND (SINGLE-PORT SERVING)
# ═══════════════════════════════════════
import os
from fastapi.staticfiles import StaticFiles

DIST_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
