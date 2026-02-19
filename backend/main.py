# ============================================================
# TradDesk Backend — Python FastAPI Version
# ============================================================
# FastAPI is a modern Python web framework for building APIs.
# It's fast, easy to read, and great for learning Python!
# ============================================================

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr          # For data validation
from typing import Optional, List
import sqlite3                                     # Built-in Python database
import hashlib                                     # For hashing passwords
import hmac                                        # For secure comparison
import jwt                                         # For login tokens
import os                                          # For reading env variables
from datetime import datetime, timedelta
import secrets

# ─── APP SETUP ───────────────────────────────────────────────
# Create the FastAPI app — this is like Express() in Node.js
app = FastAPI(title="TradDesk API", version="1.0.0")

# Allow frontend to talk to backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # In production, set this to your Vercel URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secret key for JWT tokens — read from environment variable
JWT_SECRET = os.getenv("JWT_SECRET", "tradesk_default_secret_change_me")
JWT_EXPIRE_DAYS = 7

# Security scheme for protected routes
bearer_scheme = HTTPBearer()

# ─── DATABASE SETUP ──────────────────────────────────────────
# SQLite is a simple file-based database — perfect for learning!
DB_PATH = os.getenv("DB_PATH", "tradesk.db")

def get_db():
    """
    This function creates a database connection.
    'with get_db() as db' automatically closes it when done.
    Think of it like opening and closing a file.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # Makes rows behave like dictionaries
    conn.execute("PRAGMA journal_mode=WAL")  # Better for concurrent access
    return conn

def init_db():
    """
    Creates all database tables when the app starts.
    This is like setting up your spreadsheet columns.
    """
    with get_db() as db:
        db.executescript("""
            -- Users table: stores login info
            CREATE TABLE IF NOT EXISTS users (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                email      TEXT UNIQUE NOT NULL,
                password   TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Purchases table: raw goods you buy
            CREATE TABLE IF NOT EXISTS purchases (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
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

            -- Sales table: goods you sell
            CREATE TABLE IF NOT EXISTS sales (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id),
                date       TEXT NOT NULL,
                customer   TEXT NOT NULL,
                item       TEXT NOT NULL,
                qty        REAL NOT NULL,
                unit       TEXT NOT NULL DEFAULT 'units',
                unit_price REAL NOT NULL,
                total      REAL NOT NULL,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
            CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
        """)
        db.commit()

# Run DB setup when app starts
init_db()

# ─── PASSWORD HELPERS ─────────────────────────────────────────
def hash_password(password: str) -> str:
    """
    Converts a plain password to a secure hash.
    Example: "mypassword" → "a3f2b1c9d4..."
    We NEVER store plain passwords — always hashed!
    """
    salt = secrets.token_hex(16)    # Random string to make hash unique
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000                       # 100k iterations = hard to crack
    )
    return f"{salt}:{hashed.hex()}"

def verify_password(password: str, stored: str) -> bool:
    """
    Checks if a plain password matches the stored hash.
    Returns True if match, False if not.
    """
    try:
        salt, hashed = stored.split(':')
        new_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(new_hash.hex(), hashed)
    except Exception:
        return False

# ─── JWT TOKEN HELPERS ────────────────────────────────────────
def create_token(user_id: int, email: str, name: str) -> str:
    """
    Creates a JWT token — like a temporary ID card.
    The user gets this after login and sends it with every request.
    """
    payload = {
        "id": user_id,
        "email": email,
        "name": name,
        "exp": datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """
    This runs on every protected route.
    It reads the token from the request header and returns the user info.
    If token is invalid → returns 401 Unauthorized error.
    """
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload   # Returns {"id": 1, "email": "...", "name": "..."}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired, please login again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── PYDANTIC MODELS (Data Validation) ───────────────────────
# These are like forms — FastAPI checks all data matches before processing
# If someone sends wrong data, FastAPI automatically returns an error!

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr          # Automatically validates email format
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PurchaseCreate(BaseModel):
    date: str
    supplier: str
    item: str
    qty: float
    unit: str = "units"     # Default value if not provided
    unit_cost: float
    notes: Optional[str] = None

class SaleCreate(BaseModel):
    date: str
    customer: str
    item: str
    qty: float
    unit: str = "units"
    unit_price: float
    notes: Optional[str] = None

# ─── AUTH ROUTES ──────────────────────────────────────────────

@app.post("/api/auth/register", status_code=201)
def register(data: RegisterRequest):
    """
    Creates a new user account.
    POST /api/auth/register
    Body: { name, email, password }
    """
    # Validate password length
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    with get_db() as db:
        # Check if email already exists
        existing = db.execute(
            "SELECT id FROM users WHERE email = ?", (data.email,)
        ).fetchone()

        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        # Hash the password before storing
        hashed = hash_password(data.password)

        # Insert new user into database
        cursor = db.execute(
            "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
            (data.name, data.email, hashed)
        )
        db.commit()

        # Create and return JWT token
        token = create_token(cursor.lastrowid, data.email, data.name)
        return {
            "token": token,
            "user": {"id": cursor.lastrowid, "name": data.name, "email": data.email}
        }

@app.post("/api/auth/login")
def login(data: LoginRequest):
    """
    Logs in an existing user.
    POST /api/auth/login
    Body: { email, password }
    """
    with get_db() as db:
        # Find user by email
        user = db.execute(
            "SELECT * FROM users WHERE email = ?", (data.email,)
        ).fetchone()

        # Check user exists AND password matches
        if not user or not verify_password(data.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        # Create and return JWT token
        token = create_token(user["id"], user["email"], user["name"])
        return {
            "token": token,
            "user": {"id": user["id"], "name": user["name"], "email": user["email"]}
        }

@app.get("/api/auth/me")
def get_me(current_user = Depends(get_current_user)):
    """
    Returns current logged-in user info.
    GET /api/auth/me
    Requires: Authorization header with JWT token
    """
    with get_db() as db:
        user = db.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = ?",
            (current_user["id"],)
        ).fetchone()
        return dict(user)

# ─── PURCHASES ROUTES ─────────────────────────────────────────

@app.get("/api/purchases")
def list_purchases(
    from_date: Optional[str] = None,   # Optional filter: ?from_date=2026-01-01
    to_date: Optional[str] = None,     # Optional filter: ?to_date=2026-12-31
    current_user = Depends(get_current_user)
):
    """
    Returns all purchases for the logged-in user.
    GET /api/purchases
    Optional query params: from_date, to_date
    """
    # Build query dynamically based on filters
    query = "SELECT * FROM purchases WHERE user_id = ?"
    params = [current_user["id"]]

    if from_date:
        query += " AND date >= ?"
        params.append(from_date)
    if to_date:
        query += " AND date <= ?"
        params.append(to_date)

    query += " ORDER BY date DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]   # Convert to list of dicts

@app.post("/api/purchases", status_code=201)
def create_purchase(data: PurchaseCreate, current_user = Depends(get_current_user)):
    """
    Adds a new purchase record.
    POST /api/purchases
    Body: { date, supplier, item, qty, unit, unit_cost, notes }
    """
    total = data.qty * data.unit_cost   # Calculate total automatically

    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO purchases
               (user_id, date, supplier, item, qty, unit, unit_cost, total, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (current_user["id"], data.date, data.supplier, data.item,
             data.qty, data.unit, data.unit_cost, total, data.notes)
        )
        db.commit()

        # Return the newly created record
        row = db.execute(
            "SELECT * FROM purchases WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)

@app.put("/api/purchases/{purchase_id}")
def update_purchase(
    purchase_id: int,
    data: PurchaseCreate,
    current_user = Depends(get_current_user)
):
    """
    Updates an existing purchase.
    PUT /api/purchases/5
    """
    with get_db() as db:
        # Make sure this purchase belongs to the current user
        existing = db.execute(
            "SELECT * FROM purchases WHERE id = ? AND user_id = ?",
            (purchase_id, current_user["id"])
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Purchase not found")

        total = data.qty * data.unit_cost
        db.execute(
            """UPDATE purchases
               SET date=?, supplier=?, item=?, qty=?, unit=?, unit_cost=?, total=?, notes=?
               WHERE id=?""",
            (data.date, data.supplier, data.item, data.qty, data.unit,
             data.unit_cost, total, data.notes, purchase_id)
        )
        db.commit()

        row = db.execute("SELECT * FROM purchases WHERE id = ?", (purchase_id,)).fetchone()
        return dict(row)

@app.delete("/api/purchases/{purchase_id}")
def delete_purchase(purchase_id: int, current_user = Depends(get_current_user)):
    """
    Deletes a purchase record.
    DELETE /api/purchases/5
    """
    with get_db() as db:
        result = db.execute(
            "DELETE FROM purchases WHERE id = ? AND user_id = ?",
            (purchase_id, current_user["id"])
        )
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Purchase not found")

        return {"success": True}

# ─── SALES ROUTES ─────────────────────────────────────────────

@app.get("/api/sales")
def list_sales(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Returns all sales for the logged-in user."""
    query = "SELECT * FROM sales WHERE user_id = ?"
    params = [current_user["id"]]

    if from_date:
        query += " AND date >= ?"
        params.append(from_date)
    if to_date:
        query += " AND date <= ?"
        params.append(to_date)

    query += " ORDER BY date DESC"

    with get_db() as db:
        rows = db.execute(query, params).fetchall()
        return [dict(row) for row in rows]

@app.post("/api/sales", status_code=201)
def create_sale(data: SaleCreate, current_user = Depends(get_current_user)):
    """Adds a new sale record."""
    total = data.qty * data.unit_price

    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO sales
               (user_id, date, customer, item, qty, unit, unit_price, total, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (current_user["id"], data.date, data.customer, data.item,
             data.qty, data.unit, data.unit_price, total, data.notes)
        )
        db.commit()

        row = db.execute(
            "SELECT * FROM sales WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()
        return dict(row)

@app.put("/api/sales/{sale_id}")
def update_sale(
    sale_id: int,
    data: SaleCreate,
    current_user = Depends(get_current_user)
):
    """Updates an existing sale."""
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM sales WHERE id = ? AND user_id = ?",
            (sale_id, current_user["id"])
        ).fetchone()

        if not existing:
            raise HTTPException(status_code=404, detail="Sale not found")

        total = data.qty * data.unit_price
        db.execute(
            """UPDATE sales
               SET date=?, customer=?, item=?, qty=?, unit=?, unit_price=?, total=?, notes=?
               WHERE id=?""",
            (data.date, data.customer, data.item, data.qty, data.unit,
             data.unit_price, total, data.notes, sale_id)
        )
        db.commit()

        row = db.execute("SELECT * FROM sales WHERE id = ?", (sale_id,)).fetchone()
        return dict(row)

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int, current_user = Depends(get_current_user)):
    """Deletes a sale record."""
    with get_db() as db:
        result = db.execute(
            "DELETE FROM sales WHERE id = ? AND user_id = ?",
            (sale_id, current_user["id"])
        )
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Sale not found")

        return {"success": True}

# ─── ANALYTICS ROUTES ─────────────────────────────────────────

@app.get("/api/analytics/summary")
def get_summary(current_user = Depends(get_current_user)):
    """
    Returns overall business summary.
    GET /api/analytics/summary
    """
    uid = current_user["id"]

    with get_db() as db:
        # Use SQL to calculate totals — Python reads the results
        total_purchases = db.execute(
            "SELECT COALESCE(SUM(total), 0) as val FROM purchases WHERE user_id = ?", (uid,)
        ).fetchone()["val"]

        total_sales = db.execute(
            "SELECT COALESCE(SUM(total), 0) as val FROM sales WHERE user_id = ?", (uid,)
        ).fetchone()["val"]

        purchase_count = db.execute(
            "SELECT COUNT(*) as c FROM purchases WHERE user_id = ?", (uid,)
        ).fetchone()["c"]

        sale_count = db.execute(
            "SELECT COUNT(*) as c FROM sales WHERE user_id = ?", (uid,)
        ).fetchone()["c"]

        top_supplier = db.execute(
            """SELECT supplier, SUM(total) as total FROM purchases
               WHERE user_id = ? GROUP BY supplier ORDER BY total DESC LIMIT 1""",
            (uid,)
        ).fetchone()

        top_customer = db.execute(
            """SELECT customer, SUM(total) as total FROM sales
               WHERE user_id = ? GROUP BY customer ORDER BY total DESC LIMIT 1""",
            (uid,)
        ).fetchone()

        return {
            "totalPurchases": total_purchases,
            "totalSales": total_sales,
            "profit": total_sales - total_purchases,   # Simple math!
            "purchaseCount": purchase_count,
            "saleCount": sale_count,
            "topSupplier": dict(top_supplier) if top_supplier else None,
            "topCustomer": dict(top_customer) if top_customer else None,
        }

@app.get("/api/analytics/monthly")
def get_monthly(current_user = Depends(get_current_user)):
    """
    Returns month-by-month breakdown.
    GET /api/analytics/monthly
    """
    uid = current_user["id"]

    with get_db() as db:
        # Group purchases by month using SQLite's strftime function
        p_data = db.execute(
            """SELECT strftime('%Y-%m', date) as month, SUM(total) as total
               FROM purchases WHERE user_id = ? GROUP BY month ORDER BY month""",
            (uid,)
        ).fetchall()

        s_data = db.execute(
            """SELECT strftime('%Y-%m', date) as month, SUM(total) as total
               FROM sales WHERE user_id = ? GROUP BY month ORDER BY month""",
            (uid,)
        ).fetchall()

        # Combine purchases and sales into one dictionary per month
        months = {}
        for row in p_data:
            months[row["month"]] = {"month": row["month"], "purchases": row["total"], "sales": 0}
        for row in s_data:
            if row["month"] not in months:
                months[row["month"]] = {"month": row["month"], "purchases": 0, "sales": 0}
            months[row["month"]]["sales"] = row["total"]

        # Add profit calculation for each month
        result = []
        for m in sorted(months.values(), key=lambda x: x["month"]):
            m["profit"] = m["sales"] - m["purchases"]
            result.append(m)

        return result

@app.get("/api/analytics/inventory")
def get_inventory(current_user = Depends(get_current_user)):
    """
    Calculates current stock: purchased qty minus sold qty.
    GET /api/analytics/inventory
    """
    uid = current_user["id"]

    with get_db() as db:
        bought = db.execute(
            "SELECT item, SUM(qty) as qty FROM purchases WHERE user_id = ? GROUP BY item",
            (uid,)
        ).fetchall()

        sold = db.execute(
            "SELECT item, SUM(qty) as qty FROM sales WHERE user_id = ? GROUP BY item",
            (uid,)
        ).fetchall()

        # Python dictionary to track stock levels
        stock = {}
        for row in bought:
            stock[row["item"]] = stock.get(row["item"], 0) + row["qty"]
        for row in sold:
            stock[row["item"]] = stock.get(row["item"], 0) - row["qty"]

        # Return only items with stock >= 0
        return [
            {"item": item, "qty": max(0, qty)}
            for item, qty in stock.items()
        ]

# ─── HEALTH CHECK ─────────────────────────────────────────────
@app.get("/health")
def health():
    """Simple check to confirm the API is running."""
    return {"status": "ok", "time": datetime.utcnow().isoformat(), "language": "Python 🐍"}

# ─── API DOCS ─────────────────────────────────────────────────
# FastAPI automatically generates interactive API docs!
# Visit: https://your-railway-url.up.railway.app/docs
# You can test all your API endpoints directly in the browser!
