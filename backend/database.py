"""
MandiFlow Backend — Database models and initialization.
SQLite via aiosqlite for the shared state that powers
Web, Admin, Kiosk, IVR, SMS, and WhatsApp channels.
"""
import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "mandiflow.db")

CREATE_TABLES = """
CREATE TABLE IF NOT EXISTS centres (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    place TEXT NOT NULL,
    state TEXT NOT NULL,
    default_crop TEXT NOT NULL,
    slot_capacity INTEGER NOT NULL DEFAULT 25
);

CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    end_hour INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token INTEGER NOT NULL,
    centre_id TEXT NOT NULL REFERENCES centres(id),
    crop TEXT NOT NULL,
    slot_id TEXT NOT NULL REFERENCES slots(id),
    farmer_name TEXT NOT NULL,
    farmer_phone TEXT DEFAULT '',
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'waiting',
    booking_channel TEXT NOT NULL DEFAULT 'web',
    qty_kg REAL,
    moisture_pct REAL,
    grade TEXT,
    msp_rate REAL,
    payment_amount REAL,
    payment_status TEXT DEFAULT 'pending',
    payment_utr TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER REFERENCES bookings(id),
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS token_counters (
    centre_id TEXT PRIMARY KEY REFERENCES centres(id),
    current_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER REFERENCES bookings(id),
    rating INTEGER NOT NULL,
    wait_satisfaction INTEGER NOT NULL,
    comments TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

SEED_CENTRES = [
    ("sitapur", "Sitapur Krishi Mandi", "Sitapur", "Uttar Pradesh", "Wheat", 30),
    ("karnal", "Karnal Procurement Centre", "Karnal", "Haryana", "Wheat", 25),
    ("nashik", "Nashik Mandi Yard", "Nashik", "Maharashtra", "Onion", 20),
    ("kota", "Kota Grain Market", "Kota", "Rajasthan", "Soybean", 22),
]

SEED_SLOTS = [
    ("s1", "7:00 – 9:00 AM", 7, 9),
    ("s2", "9:00 – 11:00 AM", 9, 11),
    ("s3", "11:00 AM – 1:00 PM", 11, 13),
    ("s4", "2:00 – 4:00 PM", 14, 16),
]

FARMER_NAMES = [
    "Ramesh Yadav", "Suman Devi", "Aarti Kumari", "Vikram Singh",
    "Prakash Rao", "Geeta Sharma", "Naresh Patel", "Kavita Meena",
    "Om Prakash", "Sunita Bai", "Devendra Kumar", "Lakshmi Reddy",
    "Bhagwan Das", "Shanti Devi",
]


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """Create tables and seed reference data if empty."""
    db = await get_db()
    try:
        await db.executescript(CREATE_TABLES)

        # Seed centres
        row = await db.execute_fetchall("SELECT COUNT(*) as c FROM centres")
        if row[0][0] == 0:
            await db.executemany(
                "INSERT INTO centres (id, name, place, state, default_crop, slot_capacity) VALUES (?,?,?,?,?,?)",
                SEED_CENTRES,
            )
            for cid, *_ in SEED_CENTRES:
                await db.execute(
                    "INSERT OR IGNORE INTO token_counters (centre_id, current_count) VALUES (?, 0)",
                    (cid,),
                )

        # Seed slots
        row = await db.execute_fetchall("SELECT COUNT(*) as c FROM slots")
        if row[0][0] == 0:
            await db.executemany(
                "INSERT INTO slots (id, label, start_hour, end_hour) VALUES (?,?,?,?)",
                SEED_SLOTS,
            )

        # Seed demo bookings for each centre
        row = await db.execute_fetchall("SELECT COUNT(*) as c FROM bookings")
        if row[0][0] == 0:
            import random
            for centre_id, _, _, _, crop, cap in SEED_CENTRES:
                # Past served/no-show bookings
                for i in range(random.randint(6, 9)):
                    token = await _next_token(db, centre_id)
                    st = random.choice(["served", "served", "served", "served", "no-show"])
                    qty = round(random.uniform(20, 80), 1) if st == "served" else None
                    grade = random.choice(["A", "A", "B"]) if st == "served" else None
                    payment = random.choice(["paid", "paid", "processing", "pending"]) if st == "served" else "pending"
                    await db.execute(
                        """INSERT INTO bookings
                        (token, centre_id, crop, slot_id, farmer_name, priority, status, qty_kg, grade, payment_status, booking_channel)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                        (token, centre_id, crop,
                         random.choice(["s1", "s2", "s3", "s4"]),
                         random.choice(FARMER_NAMES),
                         1 if random.random() < 0.15 else 0,
                         st, qty, grade, payment, "web"),
                    )
                # Current waiting + 1 called
                for i in range(4):
                    token = await _next_token(db, centre_id)
                    status = "called" if i == 0 else "waiting"
                    await db.execute(
                        """INSERT INTO bookings
                        (token, centre_id, crop, slot_id, farmer_name, priority, status, payment_status, booking_channel)
                        VALUES (?,?,?,?,?,?,?,?,?)""",
                        (token, centre_id, crop,
                         random.choice(["s1", "s2", "s3", "s4"]),
                         random.choice(FARMER_NAMES),
                         1 if random.random() < 0.2 else 0,
                         status, "pending", "web"),
                    )

        await db.commit()
    finally:
        await db.close()


async def _next_token(db: aiosqlite.Connection, centre_id: str) -> int:
    """Atomically increment and return the next token for a centre."""
    await db.execute(
        "UPDATE token_counters SET current_count = current_count + 1 WHERE centre_id = ?",
        (centre_id,),
    )
    row = await db.execute_fetchall(
        "SELECT current_count FROM token_counters WHERE centre_id = ?",
        (centre_id,),
    )
    return row[0][0]


async def next_token(centre_id: str) -> int:
    db = await get_db()
    try:
        tok = await _next_token(db, centre_id)
        await db.commit()
        return tok
    finally:
        await db.close()
