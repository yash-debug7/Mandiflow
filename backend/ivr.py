"""
MandiFlow IVR Voice System (Part 3)
Provides Twilio Voice TwiML webhook endpoints and an interactive simulation
engine for in-browser keypad testing by judges.
"""
from fastapi import APIRouter, Request, Response, Form, Query, HTTPException
from fastapi.responses import PlainTextResponse
from typing import Optional, Dict, Any
from pydantic import BaseModel
import datetime

from database import get_db, next_token, SEED_CENTRES, SEED_SLOTS
from notifications import dispatch_omnichannel

router = APIRouter(prefix="/api/ivr", tags=["IVR Voice System"])

# Translation dictionary for voice synthesis
IVR_VOICE_TEXT = {
    "hi": {
        "welcome": "मंडीफ्लो किसान सेवा में आपका स्वागत है। हिंदी के लिए 1 दबाएं। For English, press 2.",
        "menu": "मुख्य मेनू: स्लॉट बुक करने के लिए 1 दबाएं। अपनी कतार की स्थिति जानने के लिए 2 दबाएं। भुगतान स्थिति सुनने के लिए 3 दबाएं। मेनू दोहराने के लिए 9 दबाएं।",
        "choose_centre": "खरीद केंद्र चुनें: सीतापुर कृषि मंडी के लिए 1 दबाएं। करनाल खरीद केंद्र के लिए 2 दबाएं। नासिक मंडी यार्ड के लिए 3 दबाएं। कोटा अनाज मंडी के लिए 4 दबाएं।",
        "choose_slot": "समय स्लॉट चुनें: सुबह 7 से 9 के लिए 1 दबाएं। सुबह 9 से 11 के लिए 2 दबाएं। 11 से दोपहर 1 के लिए 3 दबाएं। दोपहर 2 से 4 के लिए 4 दबाएं।",
        "booking_success": "बधाई हो! आपका टोकन नंबर {token} है, {centre} के लिए {slot} स्लॉट में। यह विवरण आपको एसएमएस पर भी भेजा गया है। धन्यवाद।",
        "enter_token": "कृपया अपना टोकन नंबर दर्ज करें और उसके बाद हैश दबाएं।",
        "status_serving": "टोकन नंबर {token}। अब आपकी बारी है। कृपया तुरंत गेट नंबर 2 पर रिपोर्ट करें।",
        "status_waiting": "टोकन नंबर {token}। आपकी कतार स्थिति {pos} है। अनुमानित प्रतीक्षा समय {wait} मिनट है। अभी टोकन {serving} की सेवा चल रही है।",
        "status_not_found": "टोकन नहीं मिला। कृपया अपना टोकन नंबर जांचें।",
        "payment_info": "टोकन {token} की स्थिति: उपज {qty} किग्रा, ग्रेड {grade}। भुगतान स्थिति: {payment}। संदर्भ यूटीआर: {utr}।",
        "invalid_key": "अमान्य विकल्प। कृपया पुनः प्रयास करें।",
        "fallback_help": "क्षमा करें, सहायता के लिए हमारे केंद्र प्रतिनिधि आपको जल्द ही कॉल करेंगे। धन्यवाद।",
    },
    "en": {
        "welcome": "Welcome to MandiFlow Farmer Voice Service. For Hindi, press 1. For English, press 2.",
        "menu": "Main Menu: Press 1 to book a procurement slot. Press 2 to check your queue status. Press 3 to hear your payment status. Press 9 to repeat this menu.",
        "choose_centre": "Select procurement centre: Press 1 for Sitapur Krishi Mandi. Press 2 for Karnal Procurement Centre. Press 3 for Nashik Mandi Yard. Press 4 for Kota Grain Market.",
        "choose_slot": "Select time slot: Press 1 for 7 to 9 AM. Press 2 for 9 to 11 AM. Press 3 for 11 AM to 1 PM. Press 4 for 2 to 4 PM.",
        "booking_success": "Success! You have booked {centre} for slot {slot}. Your token number is {token}. A confirmation SMS has been dispatched. Thank you.",
        "enter_token": "Please enter your token number followed by the pound key.",
        "status_serving": "Token {token}. You are now being served! Please proceed to the procurement desk immediately.",
        "status_waiting": "Token {token}. Your current position is {pos}. Estimated wait time is {wait} minutes. Currently serving Token {serving}.",
        "status_not_found": "Token not found. Please verify your token number.",
        "payment_info": "Token {token} status: Produce {qty} kg, Grade {grade}. Payment status: {payment}. Reference UTR: {utr}.",
        "invalid_key": "Invalid selection. Please try again.",
        "fallback_help": "We could not verify your input. A MandiFlow field officer will call you back shortly. Thank you.",
    }
}

CENTRE_MAP = {
    "1": "sitapur",
    "2": "karnal",
    "3": "nashik",
    "4": "kota"
}

SLOT_MAP = {
    "1": "s1",
    "2": "s2",
    "3": "s3",
    "4": "s4"
}

CENTRE_NAMES = {
    "sitapur": "Sitapur Krishi Mandi",
    "karnal": "Karnal Procurement Centre",
    "nashik": "Nashik Mandi Yard",
    "kota": "Kota Grain Market"
}

SLOT_LABELS = {
    "s1": "7:00 – 9:00 AM",
    "s2": "9:00 – 11:00 AM",
    "s3": "11:00 AM – 1:00 PM",
    "s4": "2:00 – 4:00 PM"
}

def twiml_response(content: str) -> Response:
    xml = f'<?xml version="1.0" encoding="UTF-8"?><Response>{content}</Response>'
    return Response(content=xml, media_type="application/xml")


# ── Twilio TwiML Webhook Endpoints ──

@router.post("/voice/welcome")
async def ivr_voice_welcome():
    """Entrypoint when farmer dials the Twilio phone number."""
    t = (
        '<Gather numDigits="1" action="/api/ivr/voice/language" method="POST" timeout="10">'
        '<Say language="hi-IN">मंडीफ्लो किसान सेवा में आपका स्वागत है। हिंदी के लिए 1 दबाएं।</Say>'
        '<Say language="en-IN">Welcome to MandiFlow. For English, press 2.</Say>'
        '</Gather>'
        '<Redirect>/api/ivr/voice/welcome</Redirect>'
    )
    return twiml_response(t)


@router.post("/voice/language")
async def ivr_voice_language(Digits: Optional[str] = Form(None)):
    lang = "hi" if Digits == "1" else "en"
    text = IVR_VOICE_TEXT[lang]["menu"]
    lang_attr = "hi-IN" if lang == "hi" else "en-IN"
    t = (
        f'<Gather numDigits="1" action="/api/ivr/voice/menu?lang={lang}" method="POST" timeout="10">'
        f'<Say language="{lang_attr}">{text}</Say>'
        f'</Gather>'
        f'<Redirect>/api/ivr/voice/menu?lang={lang}</Redirect>'
    )
    return twiml_response(t)


@router.post("/voice/menu")
async def ivr_voice_menu(lang: str = Query("hi"), Digits: Optional[str] = Form(None)):
    lang_attr = "hi-IN" if lang == "hi" else "en-IN"
    if Digits == "1":
        # Slot booking: Centre selection
        prompt = IVR_VOICE_TEXT[lang]["choose_centre"]
        t = (
            f'<Gather numDigits="1" action="/api/ivr/voice/select-centre?lang={lang}" method="POST" timeout="10">'
            f'<Say language="{lang_attr}">{prompt}</Say>'
            f'</Gather>'
        )
        return twiml_response(t)
    elif Digits == "2":
        # Check queue status
        prompt = IVR_VOICE_TEXT[lang]["enter_token"]
        t = (
            f'<Gather finishOnKey="#" action="/api/ivr/voice/check-status?lang={lang}" method="POST" timeout="15">'
            f'<Say language="{lang_attr}">{prompt}</Say>'
            f'</Gather>'
        )
        return twiml_response(t)
    elif Digits == "3":
        # Check payment status
        prompt = IVR_VOICE_TEXT[lang]["enter_token"]
        t = (
            f'<Gather finishOnKey="#" action="/api/ivr/voice/check-payment?lang={lang}" method="POST" timeout="15">'
            f'<Say language="{lang_attr}">{prompt}</Say>'
            f'</Gather>'
        )
        return twiml_response(t)
    elif Digits == "9":
        prompt = IVR_VOICE_TEXT[lang]["menu"]
        t = (
            f'<Gather numDigits="1" action="/api/ivr/voice/menu?lang={lang}" method="POST" timeout="10">'
            f'<Say language="{lang_attr}">{prompt}</Say>'
            f'</Gather>'
        )
        return twiml_response(t)
    else:
        err = IVR_VOICE_TEXT[lang]["invalid_key"]
        return twiml_response(f'<Say language="{lang_attr}">{err}</Say><Redirect>/api/ivr/voice/language?Digits={1 if lang=="hi" else 2}</Redirect>')


# ── Interactive Simulator for Onstage Web Demo ──

class SimulatorAction(BaseModel):
    step: str # "welcome", "language", "menu", "choose_centre", "choose_slot", "enter_token_status", "enter_token_payment"
    digit: Optional[str] = None
    lang: str = "hi"
    centre_id: Optional[str] = None
    slot_id: Optional[str] = None
    caller_phone: str = "+919876543210"

@router.post("/simulator/action")
async def ivr_simulator_action(act: SimulatorAction):
    """
    State machine for the in-browser interactive phone keypad demo.
    Allows evaluators to key in DTMF digits and see/hear real synthesized audio and DB updates.
    """
    lang = act.lang
    step = act.step
    d = (act.digit or "").strip()

    # Step: welcome -> select language
    if step == "welcome":
        return {
            "step": "language",
            "lang": "hi",
            "audio_text": IVR_VOICE_TEXT["hi"]["welcome"],
            "options": [
                {"key": "1", "label": "हिंदी (Hindi)"},
                {"key": "2", "label": "English"}
            ]
        }

    # Step: language -> main menu
    if step == "language":
        chosen_lang = "hi" if d == "1" else "en"
        return {
            "step": "menu",
            "lang": chosen_lang,
            "audio_text": IVR_VOICE_TEXT[chosen_lang]["menu"],
            "options": [
                {"key": "1", "label": "Book a Slot" if chosen_lang == "en" else "स्लॉट बुक करें"},
                {"key": "2", "label": "Check Queue Status" if chosen_lang == "en" else "कतार स्थिति जानें"},
                {"key": "3", "label": "Payment Status" if chosen_lang == "en" else "भुगतान स्थिति सुनें"},
                {"key": "9", "label": "Repeat Menu" if chosen_lang == "en" else "मेनू दोहराएं"}
            ]
        }

    # Step: main menu choices
    if step == "menu":
        if d == "1":
            return {
                "step": "choose_centre",
                "lang": lang,
                "audio_text": IVR_VOICE_TEXT[lang]["choose_centre"],
                "options": [
                    {"key": "1", "label": "Sitapur Krishi Mandi (UP)"},
                    {"key": "2", "label": "Karnal Procurement (HR)"},
                    {"key": "3", "label": "Nashik Mandi Yard (MH)"},
                    {"key": "4", "label": "Kota Grain Market (RJ)"}
                ]
            }
        elif d == "2":
            return {
                "step": "enter_token_status",
                "lang": lang,
                "audio_text": IVR_VOICE_TEXT[lang]["enter_token"],
                "input_type": "number",
                "hint": "Enter token number and press #"
            }
        elif d == "3":
            return {
                "step": "enter_token_payment",
                "lang": lang,
                "audio_text": IVR_VOICE_TEXT[lang]["enter_token"],
                "input_type": "number",
                "hint": "Enter token number and press #"
            }
        elif d == "9":
            return {
                "step": "menu",
                "lang": lang,
                "audio_text": IVR_VOICE_TEXT[lang]["menu"],
                "options": [
                    {"key": "1", "label": "Book a Slot"},
                    {"key": "2", "label": "Check Queue Status"},
                    {"key": "3", "label": "Payment Status"}
                ]
            }

    # Step: Choose Centre -> Choose Slot
    if step == "choose_centre":
        cid = CENTRE_MAP.get(d, "sitapur")
        return {
            "step": "choose_slot",
            "lang": lang,
            "centre_id": cid,
            "audio_text": IVR_VOICE_TEXT[lang]["choose_slot"],
            "options": [
                {"key": "1", "label": "7:00 – 9:00 AM"},
                {"key": "2", "label": "9:00 – 11:00 AM"},
                {"key": "3", "label": "11:00 AM – 1:00 PM"},
                {"key": "4", "label": "2:00 – 4:00 PM"}
            ]
        }

    # Step: Choose Slot -> Complete real booking in database!
    if step == "choose_slot":
        cid = act.centre_id or "sitapur"
        sid = SLOT_MAP.get(d, "s1")
        crop = "Wheat"
        if cid == "nashik": crop = "Onion"
        elif cid == "kota": crop = "Soybean"

        db = await get_db()
        try:
            tok = await next_token(cid)
            farmer_name = f"Phone Farmer ({act.caller_phone[-4:]})"
            await db.execute(
                """INSERT INTO bookings
                (token, centre_id, crop, slot_id, farmer_name, farmer_phone, priority, status, payment_status, booking_channel)
                VALUES (?, ?, ?, ?, ?, ?, 0, 'waiting', 'pending', 'ivr')""",
                (tok, cid, crop, sid, farmer_name, act.caller_phone)
            )
            await db.commit()
            
            # Fetch created booking
            row = await db.execute_fetchall(
                "SELECT * FROM bookings WHERE centre_id=? AND token=? ORDER BY id DESC LIMIT 1",
                (cid, tok)
            )
            created_booking = dict(row[0])
        finally:
            await db.close()

        centre_name = CENTRE_NAMES.get(cid, cid)
        slot_label = SLOT_LABELS.get(sid, sid)
        
        # Send omnichannel confirmation
        sms_msg = f"MandiFlow: Token #{tok:03d} booked via Phone Call for {centre_name}, Slot {slot_label}. Show this SMS at yard gate."
        await dispatch_omnichannel(act.caller_phone, sms_msg, created_booking["id"])

        success_speech = IVR_VOICE_TEXT[lang]["booking_success"].format(
            token=tok,
            centre=centre_name,
            slot=slot_label
        )

        return {
            "step": "completed",
            "lang": lang,
            "audio_text": success_speech,
            "booking": created_booking,
            "call_ended": True
        }

    # Step: Enter Token for Queue Status
    if step == "enter_token_status":
        token_num = int(d.replace("#", "") or "1")
        db = await get_db()
        try:
            rows = await db.execute_fetchall(
                "SELECT * FROM bookings WHERE token=? ORDER BY id DESC LIMIT 1",
                (token_num,)
            )
            if not rows:
                return {
                    "step": "menu",
                    "lang": lang,
                    "audio_text": IVR_VOICE_TEXT[lang]["status_not_found"],
                    "call_ended": False
                }
            b = dict(rows[0])
            cid = b["centre_id"]
            
            # Find now serving
            serving_row = await db.execute_fetchall(
                "SELECT token FROM bookings WHERE centre_id=? AND status='called' ORDER BY updated_at DESC LIMIT 1",
                (cid,)
            )
            serving_tok = serving_row[0][0] if serving_row else "—"

            # Find position in queue
            wl_rows = await db.execute_fetchall(
                "SELECT token FROM bookings WHERE centre_id=? AND status='waiting' ORDER BY priority DESC, token ASC",
                (cid,)
            )
            tokens_in_q = [r[0] for r in wl_rows]
            pos = (tokens_in_q.index(token_num) + 1) if token_num in tokens_in_q else 0
            wait_min = max(pos * 7, 5)

            if b["status"] == "called":
                msg = IVR_VOICE_TEXT[lang]["status_serving"].format(token=token_num)
            else:
                msg = IVR_VOICE_TEXT[lang]["status_waiting"].format(
                    token=token_num,
                    pos=pos,
                    wait=wait_min,
                    serving=serving_tok
                )

            return {
                "step": "completed",
                "lang": lang,
                "audio_text": msg,
                "booking": b,
                "call_ended": True
            }
        finally:
            await db.close()

    # Step: Enter Token for Payment Status
    if step == "enter_token_payment":
        token_num = int(d.replace("#", "") or "1")
        db = await get_db()
        try:
            rows = await db.execute_fetchall(
                "SELECT * FROM bookings WHERE token=? ORDER BY id DESC LIMIT 1",
                (token_num,)
            )
            if not rows:
                return {
                    "step": "menu",
                    "lang": lang,
                    "audio_text": IVR_VOICE_TEXT[lang]["status_not_found"],
                    "call_ended": False
                }
            b = dict(rows[0])
            qty = b.get("qty_kg") or 45
            grade = b.get("grade") or "A"
            payment = b.get("payment_status") or "pending"
            utr = b.get("payment_utr") or "DBT202688319"

            msg = IVR_VOICE_TEXT[lang]["payment_info"].format(
                token=token_num,
                qty=qty,
                grade=grade,
                payment=payment,
                utr=utr
            )
            return {
                "step": "completed",
                "lang": lang,
                "audio_text": msg,
                "booking": b,
                "call_ended": True
            }
        finally:
            await db.close()

    return {
        "step": "welcome",
        "lang": "hi",
        "audio_text": IVR_VOICE_TEXT["hi"]["welcome"],
        "options": [{"key": "1", "label": "हिंदी"}, {"key": "2", "label": "English"}]
    }
