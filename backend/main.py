from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import sqlite3
import hashlib
import hmac
import jwt
import os
import secrets
from datetime import datetime, timedelta

app = FastAPI(title="TradDesk API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.getenv("JWT_SECRET", "tradesk_default_secret_change_me")
DB_PATH = os.getenv("DB_PATH", "tradesk.db")
bearer_scheme = HTTPBearer()

# ─── DATABASE ─────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                password   TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Master items list: built from purchases
            CREATE TABLE IF NOT EXISTS items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT NOT NULL,
                unit       TEXT NOT NULL DEFAULT 'units',
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(user_id, name)
            );

            -- Purchases: buying raw goods
            CREATE TABLE IF NOT EXISTS purchases (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                item_id    INTEGER REFERENCES items(id),
                date       TEXT NOT NULL,
                supplier   TEXT NOT NULL,
                item       TEXT NOT NULL,
                qty        REAL NOT NULL,
                unit       TEXT NOT NULL DEFAULT 'units',
                unit_cost  REAL NOT NULL,
                total      REAL NOT NULL,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Customers: with contact details
            CREATE TABLE IF NOT EXISTS customers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                name       TEXT NOT NULL,
                phone      TEXT,
                address    TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Sales: selling items with partial payment support
            CREATE TABLE IF NOT EXISTS sales (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id        INTEGER NOT NULL REFERENCES users(id),
                customer_id    INTEGER REFERENCES customers(id),
                date           TEXT NOT NULL,
                customer_name  TEXT NOT NULL,
                customer_phone TEXT,
                customer_addr  TEXT,
                item           TEXT NOT NULL,
                qty            REAL NOT NULL,
                unit           TEXT NOT NULL DEFAULT 'units',
                unit_price     REAL NOT NULL,
                total          REAL NOT NULL,
                paid_amount    REAL NOT NULL DEFAULT 0,
                due_amount     REAL NOT NULL DEFAULT 0,
                payment_status TEXT NOT NULL DEFAULT 'unpaid',
                notes          TEXT,
                created_at     TEXT DEFAULT (datetime('now'))
            );

            -- Payment history for partial payments
            CREATE TABLE IF NOT EXISTS payments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id    INTEGER NOT NULL REFERENCES sales(id),
                user_id    INTEGER NOT NULL REFERENCES users(id),
                amount     REAL NOT NULL,
                date       TEXT NOT NULL,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
            CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
            CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
            CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
        """)
        db.commit()

init_db()

# ─── PASSWORD & JWT ───────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{hashed.hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(':')
        new_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(new_hash.hex(), hashed)
    except:
        return False

def create_token(user_id: int, email: str, name: str) -> str:
    payload = {
        "id": user_id, "email": email, "name": name,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        return jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── PYDANTIC MODELS ──────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PurchaseCreate(BaseModel):
    date: str
    supplier: str
    item: str              # Item name
    qty: float
    unit: str = "units"
    unit_cost: float
    notes: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None

class SaleCreate(BaseModel):
    date: str
    customer_name: str
    customer_phone: Optional[str] = None
    customer_addr: Optional[str] = None
    item: str              # Must be an item that exists in purchases
    qty: float
    unit: str = "units"
    unit_price: float
    paid_amount: float = 0  # How much customer paid now
    notes: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: float
    date: str
    notes: Optional[str] = None

# ─── AUTH ─────────────────────────────────────────────────────
@app.post("/api/auth/register", status_code=201)
def register(data: RegisterRequest):
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    with get_db() as db:
        if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(status_code=409, detail="Email already registered")
        cursor = db.execute(
            "INSERT INTO users (name,email,password) VALUES (?,?,?)",
            (data.name, data.email, hash_password(data.password))
        )
        db.commit()
        token = create_token(cursor.lastrowid, data.email, data.name)
        return {"token": token, "user": {"id": cursor.lastrowid, "name": data.name, "email": data.email}}

@app.post("/api/auth/login")
def login(data: LoginRequest):
    with get_db() as db:
        user = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not user or not verify_password(data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        token = create_token(user["id"], user["email"], user["name"])
        return {"token": token, "user": {"id": user["id"], "name": user["name"], "email": user["email"]}}

@app.get("/api/auth/me")
def get_me(current_user=Depends(get_current_user)):
    with get_db() as db:
        user = db.execute("SELECT id,name,email,created_at FROM users WHERE id=?", (current_user["id"],)).fetchone()
        return dict(user)

# ─── ITEMS (Master list) ──────────────────────────────────────
@app.get("/api/items")
def list_items(current_user=Depends(get_current_user)):
    """
    Returns all unique items the user has purchased.
    These are the only items allowed to be sold.
    """
    uid = current_user["id"]
    with get_db() as db:
        # Get items with available stock (purchased qty - sold qty)
        rows = db.execute("""
            SELECT
                i.id,
                i.name,
                i.unit,
                COALESCE(p.total_qty, 0) as purchased_qty,
                COALESCE(s.total_qty, 0) as sold_qty,
                COALESCE(p.total_qty, 0) - COALESCE(s.total_qty, 0) as available_qty,
                COALESCE(p.avg_cost, 0) as avg_cost
            FROM items i
            LEFT JOIN (
                SELECT item, SUM(qty) as total_qty, AVG(unit_cost) as avg_cost
                FROM purchases WHERE user_id=? GROUP BY item
            ) p ON p.item = i.name
            LEFT JOIN (
                SELECT item, SUM(qty) as total_qty
                FROM sales WHERE user_id=? GROUP BY item
            ) s ON s.item = i.name
            WHERE i.user_id=?
            ORDER BY i.name
        """, (uid, uid, uid)).fetchall()
        return [dict(r) for r in rows]

# ─── PURCHASES ────────────────────────────────────────────────
@app.get("/api/purchases")
def list_purchases(from_date: Optional[str]=None, to_date: Optional[str]=None, current_user=Depends(get_current_user)):
    query = "SELECT * FROM purchases WHERE user_id=?"
    params = [current_user["id"]]
    if from_date: query += " AND date>=?"; params.append(from_date)
    if to_date:   query += " AND date<=?"; params.append(to_date)
    with get_db() as db:
        return [dict(r) for r in db.execute(query + " ORDER BY date DESC", params).fetchall()]

@app.post("/api/purchases", status_code=201)
def create_purchase(data: PurchaseCreate, current_user=Depends(get_current_user)):
    uid = current_user["id"]
    total = data.qty * data.unit_cost
    with get_db() as db:
        # Auto-create item in master list if it doesn't exist
        existing_item = db.execute(
            "SELECT id FROM items WHERE user_id=? AND name=?", (uid, data.item)
        ).fetchone()

        if existing_item:
            item_id = existing_item["id"]
        else:
            cursor = db.execute(
                "INSERT INTO items (user_id, name, unit) VALUES (?,?,?)",
                (uid, data.item, data.unit)
            )
            item_id = cursor.lastrowid

        cursor = db.execute(
            "INSERT INTO purchases (user_id,item_id,date,supplier,item,qty,unit,unit_cost,total,notes) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (uid, item_id, data.date, data.supplier, data.item, data.qty, data.unit, data.unit_cost, total, data.notes)
        )
        db.commit()
        return dict(db.execute("SELECT * FROM purchases WHERE id=?", (cursor.lastrowid,)).fetchone())

@app.delete("/api/purchases/{purchase_id}")
def delete_purchase(purchase_id: int, current_user=Depends(get_current_user)):
    with get_db() as db:
        r = db.execute("DELETE FROM purchases WHERE id=? AND user_id=?", (purchase_id, current_user["id"]))
        db.commit()
        if not r.rowcount: raise HTTPException(404, "Not found")
        return {"success": True}

# ─── CUSTOMERS ────────────────────────────────────────────────
@app.get("/api/customers")
def list_customers(current_user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM customers WHERE user_id=? ORDER BY name", (current_user["id"],)
        ).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/customers", status_code=201)
def create_customer(data: CustomerCreate, current_user=Depends(get_current_user)):
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO customers (user_id,name,phone,address) VALUES (?,?,?,?)",
            (current_user["id"], data.name, data.phone, data.address)
        )
        db.commit()
        return dict(db.execute("SELECT * FROM customers WHERE id=?", (cursor.lastrowid,)).fetchone())

# ─── SALES ────────────────────────────────────────────────────
@app.get("/api/sales")
def list_sales(current_user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM sales WHERE user_id=? ORDER BY date DESC", (current_user["id"],)
        ).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/sales", status_code=201)
def create_sale(data: SaleCreate, current_user=Depends(get_current_user)):
    uid = current_user["id"]

    with get_db() as db:
        # Check item exists in purchases
        item_exists = db.execute(
            "SELECT id FROM items WHERE user_id=? AND name=?", (uid, data.item)
        ).fetchone()
        if not item_exists:
            raise HTTPException(400, f"Item '{data.item}' not found in your purchases")

        # Check available stock
        purchased = db.execute(
            "SELECT COALESCE(SUM(qty),0) as qty FROM purchases WHERE user_id=? AND item=?",
            (uid, data.item)
        ).fetchone()["qty"]

        sold = db.execute(
            "SELECT COALESCE(SUM(qty),0) as qty FROM sales WHERE user_id=? AND item=?",
            (uid, data.item)
        ).fetchone()["qty"]

        available = purchased - sold
        if data.qty > available:
            raise HTTPException(400, f"Not enough stock. Available: {available} {data.unit}")

        total = data.qty * data.unit_price
        paid = min(data.paid_amount, total)   # Can't pay more than total
        due = total - paid

        # Set payment status
        if paid == 0:
            status = "unpaid"
        elif paid >= total:
            status = "paid"
        else:
            status = "partial"

        cursor = db.execute(
            """INSERT INTO sales
               (user_id,date,customer_name,customer_phone,customer_addr,
                item,qty,unit,unit_price,total,paid_amount,due_amount,payment_status,notes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid, data.date, data.customer_name, data.customer_phone,
             data.customer_addr, data.item, data.qty, data.unit,
             data.unit_price, total, paid, due, status, data.notes)
        )

        # Record initial payment if any
        if paid > 0:
            db.execute(
                "INSERT INTO payments (sale_id,user_id,amount,date,notes) VALUES (?,?,?,?,?)",
                (cursor.lastrowid, uid, paid, data.date, "Initial payment")
            )

        db.commit()
        return dict(db.execute("SELECT * FROM sales WHERE id=?", (cursor.lastrowid,)).fetchone())

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int, current_user=Depends(get_current_user)):
    with get_db() as db:
        r = db.execute("DELETE FROM sales WHERE id=? AND user_id=?", (sale_id, current_user["id"]))
        db.commit()
        if not r.rowcount: raise HTTPException(404, "Not found")
        return {"success": True}

# ─── PAYMENTS (Partial payment recording) ─────────────────────
@app.get("/api/sales/{sale_id}/payments")
def get_payments(sale_id: int, current_user=Depends(get_current_user)):
    """Get all payments made for a sale."""
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM payments WHERE sale_id=? AND user_id=? ORDER BY date",
            (sale_id, current_user["id"])
        ).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/sales/{sale_id}/payments", status_code=201)
def add_payment(sale_id: int, data: PaymentCreate, current_user=Depends(get_current_user)):
    """Record an additional payment for a sale (clears due amount)."""
    uid = current_user["id"]
    with get_db() as db:
        sale = db.execute(
            "SELECT * FROM sales WHERE id=? AND user_id=?", (sale_id, uid)
        ).fetchone()
        if not sale:
            raise HTTPException(404, "Sale not found")

        if sale["due_amount"] <= 0:
            raise HTTPException(400, "This sale is already fully paid")

        # Don't allow overpayment
        payment = min(data.amount, sale["due_amount"])
        new_paid = sale["paid_amount"] + payment
        new_due = sale["total"] - new_paid

        # Update payment status
        if new_due <= 0:
            new_status = "paid"
        else:
            new_status = "partial"

        db.execute(
            "UPDATE sales SET paid_amount=?, due_amount=?, payment_status=? WHERE id=?",
            (new_paid, max(0, new_due), new_status, sale_id)
        )
        db.execute(
            "INSERT INTO payments (sale_id,user_id,amount,date,notes) VALUES (?,?,?,?,?)",
            (sale_id, uid, payment, data.date, data.notes)
        )
        db.commit()

        return dict(db.execute("SELECT * FROM sales WHERE id=?", (sale_id,)).fetchone())

# ─── ANALYTICS ────────────────────────────────────────────────
@app.get("/api/analytics/summary")
def get_summary(current_user=Depends(get_current_user)):
    uid = current_user["id"]
    with get_db() as db:
        total_purchases = db.execute("SELECT COALESCE(SUM(total),0) as v FROM purchases WHERE user_id=?", (uid,)).fetchone()["v"]
        total_sales     = db.execute("SELECT COALESCE(SUM(total),0) as v FROM sales WHERE user_id=?", (uid,)).fetchone()["v"]
        total_collected = db.execute("SELECT COALESCE(SUM(paid_amount),0) as v FROM sales WHERE user_id=?", (uid,)).fetchone()["v"]
        total_due       = db.execute("SELECT COALESCE(SUM(due_amount),0) as v FROM sales WHERE user_id=?", (uid,)).fetchone()["v"]
        purchase_count  = db.execute("SELECT COUNT(*) as c FROM purchases WHERE user_id=?", (uid,)).fetchone()["c"]
        sale_count      = db.execute("SELECT COUNT(*) as c FROM sales WHERE user_id=?", (uid,)).fetchone()["c"]
        top_supplier    = db.execute("SELECT supplier, SUM(total) as total FROM purchases WHERE user_id=? GROUP BY supplier ORDER BY total DESC LIMIT 1", (uid,)).fetchone()
        top_customer    = db.execute("SELECT customer_name, SUM(total) as total FROM sales WHERE user_id=? GROUP BY customer_name ORDER BY total DESC LIMIT 1", (uid,)).fetchone()
        return {
            "totalPurchases": total_purchases,
            "totalSales": total_sales,
            "totalCollected": total_collected,
            "totalDue": total_due,
            "profit": total_collected - total_purchases,
            "purchaseCount": purchase_count,
            "saleCount": sale_count,
            "topSupplier": dict(top_supplier) if top_supplier else None,
            "topCustomer": dict(top_customer) if top_customer else None,
        }

@app.get("/api/analytics/monthly")
def get_monthly(current_user=Depends(get_current_user)):
    uid = current_user["id"]
    with get_db() as db:
        p_data = db.execute("SELECT strftime('%Y-%m',date) as month, SUM(total) as total FROM purchases WHERE user_id=? GROUP BY month", (uid,)).fetchall()
        s_data = db.execute("SELECT strftime('%Y-%m',date) as month, SUM(total) as total, SUM(paid_amount) as collected FROM sales WHERE user_id=? GROUP BY month", (uid,)).fetchall()
        months = {}
        for r in p_data:
            months[r["month"]] = {"month": r["month"], "purchases": r["total"], "sales": 0, "collected": 0}
        for r in s_data:
            if r["month"] not in months:
                months[r["month"]] = {"month": r["month"], "purchases": 0, "sales": 0, "collected": 0}
            months[r["month"]]["sales"] = r["total"]
            months[r["month"]]["collected"] = r["collected"]
        result = []
        for m in sorted(months.values(), key=lambda x: x["month"]):
            m["profit"] = m["collected"] - m["purchases"]
            result.append(m)
        return result

@app.get("/api/analytics/inventory")
def get_inventory(current_user=Depends(get_current_user)):
    uid = current_user["id"]
    with get_db() as db:
        bought = db.execute("SELECT item, SUM(qty) as qty FROM purchases WHERE user_id=? GROUP BY item", (uid,)).fetchall()
        sold   = db.execute("SELECT item, SUM(qty) as qty FROM sales WHERE user_id=? GROUP BY item", (uid,)).fetchall()
        stock = {}
        for r in bought: stock[r["item"]] = stock.get(r["item"], 0) + r["qty"]
        for r in sold:   stock[r["item"]] = stock.get(r["item"], 0) - r["qty"]
        return [{"item": item, "qty": max(0, qty)} for item, qty in stock.items()]

@app.get("/api/analytics/dues")
def get_dues(current_user=Depends(get_current_user)):
    """Returns all sales with pending due amounts."""
    with get_db() as db:
        rows = db.execute(
            """SELECT * FROM sales
               WHERE user_id=? AND due_amount > 0
               ORDER BY date ASC""",
            (current_user["id"],)
        ).fetchall()
        return [dict(r) for r in rows]

@app.get("/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat(), "language": "Python 🐍", "version": "2.0"}
