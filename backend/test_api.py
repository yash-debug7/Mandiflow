"""
Comprehensive REST API & Core Engine Test Suite for MandiFlow.
Tests all endpoints: reference data, bookings, queue dispatch,
procurement grading, DBT disburse, IVR simulator, and oversight stats.
"""
import pytest
from fastapi.testclient import TestClient
from main import app

def test_full_api_workflow():
    with TestClient(app) as client:
        # Health check
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        # List centres
        res = client.get("/api/centres")
        assert res.status_code == 200
        centres = res.json()
        assert len(centres) >= 4

        # List slots
        res = client.get("/api/slots")
        assert res.status_code == 200
        slots = res.json()
        assert len(slots) >= 4

        # Create booking
        payload = {
            "centre_id": "sitapur",
            "crop": "Wheat",
            "slot_id": "s2",
            "farmer_name": "Test Farmer Ramesh",
            "farmer_phone": "+919876543210",
            "priority": 1,
            "channel": "web"
        }
        res = client.post("/api/bookings", json=payload)
        assert res.status_code == 200
        booking = res.json()
        assert booking["farmer_name"] == "Test Farmer Ramesh"
        assert booking["status"] == "waiting"

        # Get booking
        res = client.get(f"/api/bookings/{booking['id']}")
        assert res.status_code == 200
        assert res.json()["token"] == booking["token"]

        # Call next token in queue
        res = client.post("/api/queue/sitapur/call-next")
        assert res.status_code == 200
        called = res.json()
        assert called["status"] == "called"

        # Grade produce
        grade_payload = {
            "booking_id": called["id"],
            "qty_kg": 50.0,
            "moisture_pct": 11.5,
            "grade": "A",
            "msp_rate": 24.25
        }
        res = client.post("/api/procurement/grade", json=grade_payload)
        assert res.status_code == 200
        graded = res.json()
        assert graded["status"] == "served"
        assert graded["payment_amount"] == 1212.50

        # Disburse payment
        res = client.post("/api/procurement/disburse", json={"booking_id": called["id"]})
        assert res.status_code == 200
        disbursed = res.json()
        assert disbursed["payment_status"] == "paid"

        # Staff booking
        staff_payload = {
            "centre_id": "karnal",
            "crop": "Wheat",
            "slot_id": "s1",
            "farmer_name": "Walkin Farmer Devi",
            "farmer_phone": "AADHAAR: 9988-1122",
            "priority": 0
        }
        res = client.post("/api/admin/staff-booking", json=staff_payload)
        assert res.status_code == 200
        assert res.json()["booking_channel"] == "staff_assisted"

        # IVR Simulator flow
        r1 = client.post("/api/ivr/simulator/action", json={"step": "welcome"})
        assert r1.status_code == 200
        assert r1.json()["step"] == "language"

        r2 = client.post("/api/ivr/simulator/action", json={"step": "language", "digit": "1"})
        assert r2.status_code == 200
        assert r2.json()["step"] == "menu"

        r3 = client.post("/api/ivr/simulator/action", json={"step": "menu", "digit": "1", "lang": "hi"})
        assert r3.status_code == 200
        assert r3.json()["step"] == "choose_centre"

        r4 = client.post("/api/ivr/simulator/action", json={"step": "choose_centre", "digit": "1", "lang": "hi"})
        assert r4.status_code == 200
        assert r4.json()["step"] == "choose_slot"

        r5 = client.post("/api/ivr/simulator/action", json={"step": "choose_slot", "digit": "2", "lang": "hi", "centre_id": "sitapur"})
        assert r5.status_code == 200
        assert r5.json()["step"] == "completed"

        # Oversight stats & AI recommendations
        res = client.get("/api/oversight/stats")
        assert res.status_code == 200
        assert "total_bookings" in res.json()

        res = client.get("/api/ai/recommendations?current_centre_id=sitapur")
        assert res.status_code == 200
        assert "centres" in res.json()
