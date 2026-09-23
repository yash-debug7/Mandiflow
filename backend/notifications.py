"""
MandiFlow Notifications Engine — Omnichannel SMS & WhatsApp
Supports Twilio SMS and Twilio WhatsApp Sandbox, plus in-memory / DB logs
so every status change is visible in the Farmer App notification drawer.
"""
import os
import logging
from typing import Optional
from dotenv import load_dotenv
from database import get_db

load_dotenv()

logger = logging.getLogger("mandiflow.notifications")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
TWILIO_WHATSAPP_NUMBER = os.getenv("TWILIO_WHATSAPP_NUMBER", "whatsapp:+14155238886")

_twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client
        _twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        logger.info("Twilio client initialized successfully.")
    except Exception as e:
        logger.warning(f"Twilio initialization skipped: {e}")


async def log_notification_to_db(booking_id: Optional[int], channel: str, message: str):
    """Save notification record to SQLite for in-app drawer rendering and return created dict."""
    try:
        db = await get_db()
        cursor = await db.execute(
            "INSERT INTO notifications (booking_id, channel, message) VALUES (?, ?, ?)",
            (booking_id, channel, message)
        )
        await db.commit()
        notif_id = cursor.lastrowid
        rows = await db.execute_fetchall("SELECT * FROM notifications WHERE id=?", (notif_id,))
        await db.close()
        if rows:
            return dict(rows[0])
    except Exception as e:
        logger.error(f"Failed to log notification to DB: {e}")
    return None


async def send_sms(phone: str, message: str, booking_id: Optional[int] = None) -> dict:
    """Send SMS via Twilio if configured, always log to DB."""
    result = {"channel": "sms", "phone": phone, "sent": False, "simulated": True}
    if _twilio_client and TWILIO_PHONE_NUMBER and phone:
        try:
            msg = _twilio_client.messages.create(
                body=message,
                from_=TWILIO_PHONE_NUMBER,
                to=phone
            )
            result["sent"] = True
            result["simulated"] = False
            result["sid"] = msg.sid
        except Exception as e:
            logger.error(f"Twilio SMS send error: {e}")
            result["error"] = str(e)
    
    notif_record = await log_notification_to_db(booking_id, "sms", message)
    result["notif_record"] = notif_record
    return result


async def send_whatsapp(phone: str, message: str, booking_id: Optional[int] = None) -> dict:
    """Send WhatsApp update via Twilio WhatsApp Sandbox if configured."""
    result = {"channel": "whatsapp", "phone": phone, "sent": False, "simulated": True}
    if _twilio_client and TWILIO_WHATSAPP_NUMBER and phone:
        try:
            target = phone if phone.startswith("whatsapp:") else f"whatsapp:{phone}"
            msg = _twilio_client.messages.create(
                body=message,
                from_=TWILIO_WHATSAPP_NUMBER,
                to=target
            )
            result["sent"] = True
            result["simulated"] = False
            result["sid"] = msg.sid
        except Exception as e:
            logger.error(f"Twilio WhatsApp send error: {e}")
            result["error"] = str(e)

    notif_record = await log_notification_to_db(booking_id, "whatsapp", message)
    result["notif_record"] = notif_record
    return result


async def dispatch_omnichannel(phone: str, message: str, booking_id: Optional[int] = None) -> dict:
    """Send across both SMS and WhatsApp channels simultaneously."""
    sms_res = await send_sms(phone, message, booking_id)
    wa_res = await send_whatsapp(phone, message, booking_id)
    return {"sms": sms_res, "whatsapp": wa_res}
