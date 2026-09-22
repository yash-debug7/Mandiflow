"""
Unit and integration tests for MandiFlow backend API.
Tests cover:
- Reference endpoints (centres, slots)
- Booking creation and input validation
- Queue operations (call-next, now-serving, waiting list)
- Procurement grading and payment disbursement
- Slot capacity calculation
- Oversight stats & feedback
"""
import pytest
from fastapi.testclient import TestClient
import os
import sys

# Ensure backend directory is in python path
sys.path.insert(0, os.path.dirname(__file__))

from main import app, lifespan

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_list_centres_and_slots(client):
    centres_res = client.get("/api/centres")
    assert centres_res.status_code == 200
    centres = centres_res.json()
    assert len(centres) >= 4
    assert any(c["id"] == "sitapur" for c in centres)

    slots_res = client.get("/api/slots")
    assert slots_res.status_code == 200
    slots = slots_res.json()
    assert len(slots) >= 4


def test_create_booking_success_and_validation(client):
    # Test valid booking
    payload = {
        "centre_id": "sitapur",
        "crop": "Wheat",
        "slot_id": "s2",
        "farmer_name": "Test Farmer Ramesh",
        "farmer_phone": "+919876543210",
        "priority": 1
    }
    res = client.post("/api/bookings", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["farmer_name"] == "Test Farmer Ramesh"
    assert data["token"] > 0
    assert data["status"] == "waiting"

    # Test invalid farmer_name (empty/whitespace)
    invalid_payload = {**payload, "farmer_name": "   "}
    res_err = client.post("/api/bookings", json=invalid_payload)
    assert res_err.status_code == 422

    # Test invalid centre_id
    invalid_centre = {**payload, "centre_id": "non_existent_centre"}
    res_centre_err = client.post("/api/bookings", json=invalid_centre)
    assert res_centre_err.status_code == 400


def test_full_farmer_procurement_and_dbt_flow(client):
    # 1. Farmer Registration & Slot Booking
    booking_res = client.post("/api/bookings", json={
        "centre_id": "karnal",
        "crop": "Wheat",
        "slot_id": "s1",
        "farmer_name": "Karnal Flow Farmer",
        "farmer_phone": "+919988776655",
        "priority": 1
    })
    assert booking_res.status_code == 200
    booking = booking_res.json()
    booking_id = booking["id"]
    token = booking["token"]

    # 2. Queue Position / Call Next
    call_res = client.post("/api/queue/karnal/call-next")
    assert call_res.status_code == 200
    called = call_res.json()
    assert called["status"] == "called"

    # Verify now-serving
    ns_res = client.get("/api/queue/karnal/now-serving")
    assert ns_res.status_code == 200
    assert ns_res.json()["id"] == called["id"]

    # 3. Procurement Grading
    grade_res = client.post("/api/procurement/grade", json={
        "booking_id": booking_id,
        "qty_kg": 50.0,
        "moisture_pct": 11.0,
        "grade": "A",
        "msp_rate": 24.25
    })
    assert grade_res.status_code == 200
    graded = grade_res.json()
    assert graded["status"] == "served"
    assert graded["payment_amount"] == 1212.5
    assert graded["payment_status"] == "pending"

    # 4. Payment Disbursement (DBT)
    disburse_res = client.post("/api/procurement/disburse", json={
        "booking_id": booking_id
    })
    assert disburse_res.status_code == 200
    paid = disburse_res.json()
    assert paid["payment_status"] == "paid"
    assert paid["payment_utr"].startswith("DBT")


def test_slot_capacity(client):
    res = client.get("/api/capacity/sitapur/s2")
    assert res.status_code == 200
    data = res.json()
    assert "capacity" in data
    assert "used" in data
    assert "available" in data


def test_oversight_and_feedback(client):
    stats_res = client.get("/api/oversight/stats")
    assert stats_res.status_code == 200
    assert "total_bookings" in stats_res.json()

    fb_res = client.post("/api/feedback", json={
        "rating": 5,
        "wait_satisfaction": 5,
        "comments": "Excellent seamless process!"
    })
    assert fb_res.status_code == 200
