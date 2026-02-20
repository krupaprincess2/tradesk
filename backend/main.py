from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import sqlite3, hashlib, hmac, jwt, os, secrets, base64
from datetime import datetime, timedelta

app = FastAPI(title="TradDesk API", version="3.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

JWT_SECRET     = os.getenv("JWT_SECRET", "tradesk_secret_2026")
DB_PATH        = os.getenv("DB_PATH", "tradesk.db")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "tradesk_admin_2026")
bearer_scheme  = HTTPBearer()

# ─── DB ───────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    with get_db() as db:
        db.executescript("""
            -- Users with roles
            CREATE TABLE IF NOT EXISTS users (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                name         TEXT NOT NULL,
                email        TEXT UNIQUE NOT NULL,
                password     TEXT NOT NULL,
                role         TEXT NOT NULL DEFAULT 'staff',
                is_active    INTEGER NOT NULL DEFAULT 1,
                created_at   TEXT DEFAULT (datetime('now'))
            );

            -- Suppliers contact book
            CREATE TABLE IF NOT EXISTS suppliers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id   INTEGER NOT NULL REFERENCES users(id),
                name       TEXT NOT NULL,
                phone      TEXT,
                address    TEXT,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Raw material purchases with image + partial payment
            CREATE TABLE IF NOT EXISTS purchases (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id       INTEGER NOT NULL REFERENCES users(id),
                added_by       INTEGER NOT NULL REFERENCES users(id),
                date           TEXT NOT NULL,
                supplier_name  TEXT NOT NULL,
                item           TEXT NOT NULL,
                qty            REAL NOT NULL,
                unit           TEXT NOT NULL DEFAULT 'units',
                unit_cost      REAL NOT NULL,
                total          REAL NOT NULL,
                paid_amount    REAL NOT NULL DEFAULT 0,
                due_amount     REAL NOT NULL DEFAULT 0,
                payment_status TEXT NOT NULL DEFAULT 'unpaid',
                low_stock_alert REAL DEFAULT 0,
                image_data     TEXT,
                image_name     TEXT,
                notes          TEXT,
                created_at     TEXT DEFAULT (datetime('now'))
            );

            -- Purchase payments
            CREATE TABLE IF NOT EXISTS purchase_payments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id INTEGER NOT NULL REFERENCES purchases(id),
                owner_id    INTEGER NOT NULL REFERENCES users(id),
                amount      REAL NOT NULL,
                date        TEXT NOT NULL,
                notes       TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            -- Raw material items (from purchases)
            CREATE TABLE IF NOT EXISTS raw_items (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id   INTEGER NOT NULL REFERENCES users(id),
                name       TEXT NOT NULL,
                unit       TEXT NOT NULL DEFAULT 'units',
                low_stock_threshold REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(owner_id, name)
            );

            -- Products (final products for sale)
            CREATE TABLE IF NOT EXISTS products (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id     INTEGER NOT NULL REFERENCES users(id),
                name         TEXT NOT NULL,
                description  TEXT,
                defined_price REAL NOT NULL,
                unit         TEXT NOT NULL DEFAULT 'pcs',
                image_data   TEXT,
                image_name   TEXT,
                is_active    INTEGER NOT NULL DEFAULT 1,
                created_at   TEXT DEFAULT (datetime('now'))
            );

            -- Customers
            CREATE TABLE IF NOT EXISTS customers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id   INTEGER NOT NULL REFERENCES users(id),
                name       TEXT NOT NULL,
                phone      TEXT,
                address    TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            -- Sales with partial payment
            CREATE TABLE IF NOT EXISTS sales (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id       INTEGER NOT NULL REFERENCES users(id),
                added_by       INTEGER NOT NULL REFERENCES users(id),
                date           TEXT NOT NULL,
                customer_name  TEXT NOT NULL,
                customer_phone TEXT,
                customer_addr  TEXT,
                product_id     INTEGER REFERENCES products(id),
                product_name   TEXT NOT NULL,
                qty            REAL NOT NULL,
                unit           TEXT NOT NULL DEFAULT 'pcs',
                defined_price  REAL NOT NULL DEFAULT 0,
                unit_price     REAL NOT NULL,
                total          REAL NOT NULL,
                paid_amount    REAL NOT NULL DEFAULT 0,
                due_amount     REAL NOT NULL DEFAULT 0,
                payment_status TEXT NOT NULL DEFAULT 'unpaid',
                is_return      INTEGER NOT NULL DEFAULT 0,
                notes          TEXT,
                created_at     TEXT DEFAULT (datetime('now'))
            );

            -- Sale payments
            CREATE TABLE IF NOT EXISTS sale_payments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id    INTEGER NOT NULL REFERENCES sales(id),
                owner_id   INTEGER NOT NULL REFERENCES users(id),
                amount     REAL NOT NULL,
                date       TEXT NOT NULL,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_purchases_owner   ON purchases(owner_id);
            CREATE INDEX IF NOT EXISTS idx_sales_owner       ON sales(owner_id);
            CREATE INDEX IF NOT EXISTS idx_products_owner    ON products(owner_id);
            CREATE INDEX IF NOT EXISTS idx_customers_owner   ON customers(owner_id);
            CREATE INDEX IF NOT EXISTS idx_suppliers_owner   ON suppliers(owner_id);
        """)
        db.commit()

        # Migrate: add role column if upgrading from v2
        try:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'")
            db.commit()
        except: pass
        try:
            db.execute("ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1")
            db.commit()
        except: pass

init_db()

# ─── PASSWORD & JWT ───────────────────────────────────────────
def hash_password(p):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', p.encode(), salt.encode(), 100000)
    return f"{salt}:{h.hex()}"

def verify_password(p, stored):
    try:
        salt, h = stored.split(':')
        return hmac.compare_digest(hashlib.pbkdf2_hmac('sha256', p.encode(), salt.encode(), 100000).hex(), h)
    except: return False

def create_token(uid, email, name, role):
    return jwt.encode({"id":uid,"email":email,"name":name,"role":role,
        "exp": datetime.utcnow()+timedelta(days=7)}, JWT_SECRET, algorithm="HS256")

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try:
        return jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except: raise HTTPException(401, "Invalid token")

def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin": raise HTTPException(403, "Admin access required")
    return user

def owner_id(user): return user["id"]

# ─── MODELS ───────────────────────────────────────────────────
class RegisterReq(BaseModel):
    name: str; email: EmailStr; password: str

class LoginReq(BaseModel):
    email: EmailStr; password: str

class CreateUserReq(BaseModel):
    name: str; email: EmailStr; password: str; role: str = "staff"

class ResetPasswordReq(BaseModel):
    new_password: str

class SupplierCreate(BaseModel):
    name: str; phone: Optional[str]=None; address: Optional[str]=None; notes: Optional[str]=None

class PurchaseCreate(BaseModel):
    date: str; supplier_name: str; item: str
    qty: float; unit: str="units"; unit_cost: float
    paid_amount: float=0; low_stock_alert: float=0; notes: Optional[str]=None

class PurchasePaymentCreate(BaseModel):
    amount: float; date: str; notes: Optional[str]=None

class ProductCreate(BaseModel):
    name: str; description: Optional[str]=None
    defined_price: float; unit: str="pcs"; is_active: int=1

class CustomerCreate(BaseModel):
    name: str; phone: Optional[str]=None; address: Optional[str]=None

class SaleCreate(BaseModel):
    date: str; customer_name: str
    customer_phone: Optional[str]=None; customer_addr: Optional[str]=None
    product_id: Optional[int]=None; product_name: str
    qty: float; unit: str="pcs"; defined_price: float=0
    unit_price: float; paid_amount: float=0; notes: Optional[str]=None

class SalePaymentCreate(BaseModel):
    amount: float; date: str; notes: Optional[str]=None

class SaleReturnCreate(BaseModel):
    date: str; notes: Optional[str]=None

# ─── AUTH ─────────────────────────────────────────────────────
@app.post("/api/auth/register", status_code=201)
def register(data: RegisterReq):
    if len(data.password) < 6: raise HTTPException(400, "Password min 6 chars")
    with get_db() as db:
        # First user becomes admin automatically
        count = db.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
        role = "admin" if count == 0 else "staff"
        if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(409, "Email already registered")
        cur = db.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
            (data.name, data.email, hash_password(data.password), role))
        db.commit()
        token = create_token(cur.lastrowid, data.email, data.name, role)
        return {"token":token,"user":{"id":cur.lastrowid,"name":data.name,"email":data.email,"role":role}}

@app.post("/api/auth/login")
def login(data: LoginReq):
    with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not u or not verify_password(data.password, u["password"]):
            raise HTTPException(401, "Invalid email or password")
        if not u["is_active"]: raise HTTPException(403, "Account disabled")
        token = create_token(u["id"], u["email"], u["name"], u["role"])
        return {"token":token,"user":{"id":u["id"],"name":u["name"],"email":u["email"],"role":u["role"]}}

@app.get("/api/auth/me")
def get_me(user=Depends(get_current_user)):
    with get_db() as db:
        u = db.execute("SELECT id,name,email,role,created_at FROM users WHERE id=?", (user["id"],)).fetchone()
        return dict(u)

# ─── USER MANAGEMENT (Admin only) ─────────────────────────────
@app.get("/api/users")
def list_users(admin=Depends(require_admin)):
    with get_db() as db:
        rows = db.execute("SELECT id,name,email,role,is_active,created_at FROM users ORDER BY created_at").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/users", status_code=201)
def create_user(data: CreateUserReq, admin=Depends(require_admin)):
    if len(data.password) < 6: raise HTTPException(400, "Password min 6 chars")
    with get_db() as db:
        if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(409, "Email already exists")
        cur = db.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
            (data.name, data.email, hash_password(data.password), data.role))
        db.commit()
        return dict(db.execute("SELECT id,name,email,role,is_active FROM users WHERE id=?", (cur.lastrowid,)).fetchone())

@app.put("/api/users/{uid}/reset-password")
def reset_password(uid: int, data: ResetPasswordReq, admin=Depends(require_admin)):
    if len(data.new_password) < 6: raise HTTPException(400, "Password min 6 chars")
    with get_db() as db:
        db.execute("UPDATE users SET password=? WHERE id=?", (hash_password(data.new_password), uid))
        db.commit()
        return {"success": True}

@app.put("/api/users/{uid}/toggle")
def toggle_user(uid: int, admin=Depends(require_admin)):
    with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u: raise HTTPException(404, "User not found")
        if u["role"] == "admin": raise HTTPException(400, "Cannot disable admin")
        new_status = 0 if u["is_active"] else 1
        db.execute("UPDATE users SET is_active=? WHERE id=?", (new_status, uid))
        db.commit()
        return {"is_active": new_status}

# ─── SUPPLIERS ────────────────────────────────────────────────
@app.get("/api/suppliers")
def list_suppliers(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM suppliers WHERE owner_id=? ORDER BY name", (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/suppliers", status_code=201)
def create_supplier(data: SupplierCreate, user=Depends(get_current_user)):
    with get_db() as db:
        cur = db.execute("INSERT INTO suppliers(owner_id,name,phone,address,notes) VALUES(?,?,?,?,?)",
            (owner_id(user), data.name, data.phone, data.address, data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM suppliers WHERE id=?", (cur.lastrowid,)).fetchone())

@app.delete("/api/suppliers/{sid}")
def delete_supplier(sid: int, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM suppliers WHERE id=? AND owner_id=?", (sid, owner_id(admin)))
        db.commit()
        return {"success": True}

# ─── RAW ITEMS ────────────────────────────────────────────────
@app.get("/api/raw-items")
def list_raw_items(user=Depends(get_current_user)):
    uid = owner_id(user)
    with get_db() as db:
        rows = db.execute("""
            SELECT r.id, r.name, r.unit, r.low_stock_threshold,
                COALESCE(p.total_qty,0) as purchased_qty,
                COALESCE(s.total_qty,0) as used_qty,
                COALESCE(p.total_qty,0)-COALESCE(s.total_qty,0) as available_qty,
                CASE WHEN COALESCE(p.total_qty,0)-COALESCE(s.total_qty,0) <= r.low_stock_threshold
                     AND r.low_stock_threshold > 0 THEN 1 ELSE 0 END as is_low_stock
            FROM raw_items r
            LEFT JOIN (SELECT item, SUM(qty) as total_qty FROM purchases WHERE owner_id=? GROUP BY item) p ON p.item=r.name
            LEFT JOIN (SELECT item, SUM(qty) as total_qty FROM purchases WHERE owner_id=? GROUP BY item) s ON s.item=r.name
            WHERE r.owner_id=? ORDER BY r.name
        """, (uid, uid, uid)).fetchall()
        return [dict(r) for r in rows]

# ─── PURCHASES (with image + partial payment) ─────────────────
@app.get("/api/purchases")
def list_purchases(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM purchases WHERE owner_id=? ORDER BY date DESC", (owner_id(user),)
        ).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/purchases", status_code=201)
def create_purchase(data: PurchaseCreate, user=Depends(get_current_user)):
    uid = owner_id(user)
    total = data.qty * data.unit_cost
    paid  = min(data.paid_amount, total)
    due   = total - paid
    status = "paid" if paid>=total else ("partial" if paid>0 else "unpaid")
    with get_db() as db:
        # Auto-create raw item
        if not db.execute("SELECT id FROM raw_items WHERE owner_id=? AND name=?", (uid,data.item)).fetchone():
            db.execute("INSERT INTO raw_items(owner_id,name,unit,low_stock_threshold) VALUES(?,?,?,?)",
                (uid, data.item, data.unit, data.low_stock_alert))
        else:
            db.execute("UPDATE raw_items SET low_stock_threshold=? WHERE owner_id=? AND name=?",
                (data.low_stock_alert, uid, data.item))
        cur = db.execute("""INSERT INTO purchases
            (owner_id,added_by,date,supplier_name,item,qty,unit,unit_cost,total,
             paid_amount,due_amount,payment_status,low_stock_alert,notes)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid,uid,data.date,data.supplier_name,data.item,data.qty,data.unit,
             data.unit_cost,total,paid,due,status,data.low_stock_alert,data.notes))
        if paid > 0:
            db.execute("INSERT INTO purchase_payments(purchase_id,owner_id,amount,date,notes) VALUES(?,?,?,?,?)",
                (cur.lastrowid,uid,paid,data.date,"Initial payment"))
        db.commit()
        return dict(db.execute("SELECT * FROM purchases WHERE id=?", (cur.lastrowid,)).fetchone())

@app.post("/api/purchases/{pid}/image")
async def upload_purchase_image(pid: int, file: UploadFile = File(...), user=Depends(get_current_user)):
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024: raise HTTPException(400, "Image too large (max 5MB)")
    b64 = base64.b64encode(contents).decode()
    ext = file.filename.split(".")[-1].lower()
    mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext,"image/jpeg")
    data_url = f"data:{mime};base64,{b64}"
    with get_db() as db:
        p = db.execute("SELECT * FROM purchases WHERE id=? AND owner_id=?", (pid, owner_id(user))).fetchone()
        if not p: raise HTTPException(404, "Purchase not found")
        db.execute("UPDATE purchases SET image_data=?, image_name=? WHERE id=?", (data_url, file.filename, pid))
        db.commit()
    return {"success": True, "image_data": data_url}

@app.post("/api/purchases/{pid}/payments", status_code=201)
def add_purchase_payment(pid: int, data: PurchasePaymentCreate, user=Depends(get_current_user)):
    uid = owner_id(user)
    with get_db() as db:
        p = db.execute("SELECT * FROM purchases WHERE id=? AND owner_id=?", (pid,uid)).fetchone()
        if not p: raise HTTPException(404, "Not found")
        if p["due_amount"] <= 0: raise HTTPException(400, "Already fully paid")
        payment = min(data.amount, p["due_amount"])
        new_paid = p["paid_amount"] + payment
        new_due  = p["total"] - new_paid
        status   = "paid" if new_due<=0 else "partial"
        db.execute("UPDATE purchases SET paid_amount=?,due_amount=?,payment_status=? WHERE id=?",
            (new_paid, max(0,new_due), status, pid))
        db.execute("INSERT INTO purchase_payments(purchase_id,owner_id,amount,date,notes) VALUES(?,?,?,?,?)",
            (pid,uid,payment,data.date,data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM purchases WHERE id=?", (pid,)).fetchone())

@app.get("/api/purchases/{pid}/payments")
def get_purchase_payments(pid: int, user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM purchase_payments WHERE purchase_id=? AND owner_id=? ORDER BY date",
            (pid, owner_id(user))).fetchall()
        return [dict(r) for r in rows]

@app.delete("/api/purchases/{pid}")
def delete_purchase(pid: int, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM purchases WHERE id=? AND owner_id=?", (pid, owner_id(admin)))
        db.commit()
        return {"success": True}

# ─── PRODUCTS (final products for sale) ───────────────────────
@app.get("/api/products")
def list_products(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM products WHERE owner_id=? ORDER BY name", (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/products", status_code=201)
def create_product(data: ProductCreate, admin=Depends(require_admin)):
    with get_db() as db:
        cur = db.execute("""INSERT INTO products(owner_id,name,description,defined_price,unit,is_active)
            VALUES(?,?,?,?,?,?)""", (owner_id(admin),data.name,data.description,data.defined_price,data.unit,data.is_active))
        db.commit()
        return dict(db.execute("SELECT * FROM products WHERE id=?", (cur.lastrowid,)).fetchone())

@app.post("/api/products/{prod_id}/image")
async def upload_product_image(prod_id: int, file: UploadFile = File(...), admin=Depends(require_admin)):
    contents = await file.read()
    if len(contents) > 5*1024*1024: raise HTTPException(400, "Image too large (max 5MB)")
    b64 = base64.b64encode(contents).decode()
    ext = file.filename.split(".")[-1].lower()
    mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext,"image/jpeg")
    data_url = f"data:{mime};base64,{b64}"
    with get_db() as db:
        db.execute("UPDATE products SET image_data=?,image_name=? WHERE id=? AND owner_id=?",
            (data_url, file.filename, prod_id, owner_id(admin)))
        db.commit()
    return {"success": True, "image_data": data_url}

@app.put("/api/products/{prod_id}")
def update_product(prod_id: int, data: ProductCreate, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("""UPDATE products SET name=?,description=?,defined_price=?,unit=?,is_active=?
            WHERE id=? AND owner_id=?""",
            (data.name,data.description,data.defined_price,data.unit,data.is_active,prod_id,owner_id(admin)))
        db.commit()
        return dict(db.execute("SELECT * FROM products WHERE id=?", (prod_id,)).fetchone())

@app.delete("/api/products/{prod_id}")
def delete_product(prod_id: int, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM products WHERE id=? AND owner_id=?", (prod_id, owner_id(admin)))
        db.commit()
        return {"success": True}

# ─── CUSTOMERS ────────────────────────────────────────────────
@app.get("/api/customers")
def list_customers(q: Optional[str]=None, user=Depends(get_current_user)):
    with get_db() as db:
        if q:
            rows = db.execute("""SELECT * FROM customers WHERE owner_id=?
                AND (name LIKE ? OR phone LIKE ?) ORDER BY name""",
                (owner_id(user), f"%{q}%", f"%{q}%")).fetchall()
        else:
            rows = db.execute("SELECT * FROM customers WHERE owner_id=? ORDER BY name", (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/customers", status_code=201)
def create_customer(data: CustomerCreate, user=Depends(get_current_user)):
    with get_db() as db:
        # Check if customer already exists with same phone
        existing = None
        if data.phone:
            existing = db.execute("SELECT * FROM customers WHERE owner_id=? AND phone=?",
                (owner_id(user), data.phone)).fetchone()
        if not existing:
            cur = db.execute("INSERT INTO customers(owner_id,name,phone,address) VALUES(?,?,?,?)",
                (owner_id(user), data.name, data.phone, data.address))
            db.commit()
            return dict(db.execute("SELECT * FROM customers WHERE id=?", (cur.lastrowid,)).fetchone())
        return dict(existing)

# ─── SALES ────────────────────────────────────────────────────
@app.get("/api/sales")
def list_sales(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM sales WHERE owner_id=? ORDER BY date DESC", (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/sales", status_code=201)
def create_sale(data: SaleCreate, user=Depends(get_current_user)):
    uid = owner_id(user)
    total = data.qty * data.unit_price
    paid  = min(data.paid_amount, total)
    due   = total - paid
    status = "paid" if paid>=total else ("partial" if paid>0 else "unpaid")
    with get_db() as db:
        # Auto-save customer
        if data.customer_name and data.customer_phone:
            existing = db.execute("SELECT id FROM customers WHERE owner_id=? AND phone=?",
                (uid, data.customer_phone)).fetchone()
            if not existing:
                db.execute("INSERT INTO customers(owner_id,name,phone,address) VALUES(?,?,?,?)",
                    (uid, data.customer_name, data.customer_phone, data.customer_addr))
        cur = db.execute("""INSERT INTO sales
            (owner_id,added_by,date,customer_name,customer_phone,customer_addr,
             product_id,product_name,qty,unit,defined_price,unit_price,total,
             paid_amount,due_amount,payment_status,notes)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (uid,uid,data.date,data.customer_name,data.customer_phone,data.customer_addr,
             data.product_id,data.product_name,data.qty,data.unit,data.defined_price,
             data.unit_price,total,paid,due,status,data.notes))
        if paid > 0:
            db.execute("INSERT INTO sale_payments(sale_id,owner_id,amount,date,notes) VALUES(?,?,?,?,?)",
                (cur.lastrowid,uid,paid,data.date,"Initial payment"))
        db.commit()
        return dict(db.execute("SELECT * FROM sales WHERE id=?", (cur.lastrowid,)).fetchone())

@app.post("/api/sales/{sid}/payments", status_code=201)
def add_sale_payment(sid: int, data: SalePaymentCreate, user=Depends(get_current_user)):
    uid = owner_id(user)
    with get_db() as db:
        s = db.execute("SELECT * FROM sales WHERE id=? AND owner_id=?", (sid,uid)).fetchone()
        if not s: raise HTTPException(404, "Not found")
        if s["due_amount"] <= 0: raise HTTPException(400, "Already fully paid")
        payment  = min(data.amount, s["due_amount"])
        new_paid = s["paid_amount"] + payment
        new_due  = s["total"] - new_paid
        status   = "paid" if new_due<=0 else "partial"
        db.execute("UPDATE sales SET paid_amount=?,due_amount=?,payment_status=? WHERE id=?",
            (new_paid,max(0,new_due),status,sid))
        db.execute("INSERT INTO sale_payments(sale_id,owner_id,amount,date,notes) VALUES(?,?,?,?,?)",
            (sid,uid,payment,data.date,data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone())

@app.get("/api/sales/{sid}/payments")
def get_sale_payments(sid: int, user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM sale_payments WHERE sale_id=? AND owner_id=? ORDER BY date",
            (sid, owner_id(user))).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/sales/{sid}/return")
def return_sale(sid: int, data: SaleReturnCreate, admin=Depends(require_admin)):
    uid = owner_id(admin)
    with get_db() as db:
        s = db.execute("SELECT * FROM sales WHERE id=? AND owner_id=?", (sid,uid)).fetchone()
        if not s: raise HTTPException(404, "Not found")
        if s["is_return"]: raise HTTPException(400, "Already returned")
        db.execute("UPDATE sales SET is_return=1, notes=? WHERE id=?",
            (f"RETURNED on {data.date}: {data.notes or ''}", sid))
        db.commit()
        return {"success": True}

@app.delete("/api/sales/{sid}")
def delete_sale(sid: int, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM sales WHERE id=? AND owner_id=?", (sid, owner_id(admin)))
        db.commit()
        return {"success": True}

# ─── ANALYTICS (Admin only) ───────────────────────────────────
@app.get("/api/analytics/summary")
def get_summary(admin=Depends(require_admin)):
    uid = owner_id(admin)
    with get_db() as db:
        total_purchases  = db.execute("SELECT COALESCE(SUM(total),0) as v FROM purchases WHERE owner_id=?", (uid,)).fetchone()["v"]
        purchase_paid    = db.execute("SELECT COALESCE(SUM(paid_amount),0) as v FROM purchases WHERE owner_id=?", (uid,)).fetchone()["v"]
        purchase_due     = db.execute("SELECT COALESCE(SUM(due_amount),0) as v FROM purchases WHERE owner_id=?", (uid,)).fetchone()["v"]
        total_sales      = db.execute("SELECT COALESCE(SUM(total),0) as v FROM sales WHERE owner_id=? AND is_return=0", (uid,)).fetchone()["v"]
        sale_collected   = db.execute("SELECT COALESCE(SUM(paid_amount),0) as v FROM sales WHERE owner_id=? AND is_return=0", (uid,)).fetchone()["v"]
        sale_due         = db.execute("SELECT COALESCE(SUM(due_amount),0) as v FROM sales WHERE owner_id=? AND is_return=0", (uid,)).fetchone()["v"]
        purchase_count   = db.execute("SELECT COUNT(*) as c FROM purchases WHERE owner_id=?", (uid,)).fetchone()["c"]
        sale_count       = db.execute("SELECT COUNT(*) as c FROM sales WHERE owner_id=? AND is_return=0", (uid,)).fetchone()["c"]
        returns_count    = db.execute("SELECT COUNT(*) as c FROM sales WHERE owner_id=? AND is_return=1", (uid,)).fetchone()["c"]
        top_supplier     = db.execute("SELECT supplier_name, SUM(total) as total FROM purchases WHERE owner_id=? GROUP BY supplier_name ORDER BY total DESC LIMIT 1", (uid,)).fetchone()
        top_customer     = db.execute("SELECT customer_name, SUM(total) as total FROM sales WHERE owner_id=? AND is_return=0 GROUP BY customer_name ORDER BY total DESC LIMIT 1", (uid,)).fetchone()
        top_product      = db.execute("SELECT product_name, SUM(total) as total FROM sales WHERE owner_id=? AND is_return=0 GROUP BY product_name ORDER BY total DESC LIMIT 1", (uid,)).fetchone()
        low_stock        = db.execute("""SELECT name, low_stock_threshold FROM raw_items WHERE owner_id=?
            AND low_stock_threshold > 0""", (uid,)).fetchall()
        return {
            "totalPurchases": total_purchases, "purchasePaid": purchase_paid, "purchaseDue": purchase_due,
            "totalSales": total_sales, "saleCollected": sale_collected, "saleDue": sale_due,
            "profit": sale_collected - purchase_paid,
            "purchaseCount": purchase_count, "saleCount": sale_count, "returnsCount": returns_count,
            "topSupplier": dict(top_supplier) if top_supplier else None,
            "topCustomer": dict(top_customer) if top_customer else None,
            "topProduct": dict(top_product) if top_product else None,
            "lowStockItems": [dict(r) for r in low_stock],
        }

@app.get("/api/analytics/monthly")
def get_monthly(admin=Depends(require_admin)):
    uid = owner_id(admin)
    with get_db() as db:
        p = db.execute("SELECT strftime('%Y-%m',date) as m, SUM(total) as t, SUM(paid_amount) as paid FROM purchases WHERE owner_id=? GROUP BY m", (uid,)).fetchall()
        s = db.execute("SELECT strftime('%Y-%m',date) as m, SUM(total) as t, SUM(paid_amount) as collected FROM sales WHERE owner_id=? AND is_return=0 GROUP BY m", (uid,)).fetchall()
        months = {}
        for r in p: months[r["m"]] = {"month":r["m"],"purchases":r["t"],"purchase_paid":r["paid"],"sales":0,"collected":0}
        for r in s:
            if r["m"] not in months: months[r["m"]] = {"month":r["m"],"purchases":0,"purchase_paid":0,"sales":0,"collected":0}
            months[r["m"]]["sales"] = r["t"]; months[r["m"]]["collected"] = r["collected"]
        result = []
        for m in sorted(months.values(), key=lambda x: x["month"]):
            m["profit"] = m["collected"] - m["purchase_paid"]; result.append(m)
        return result

@app.get("/api/analytics/dues")
def get_dues(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM sales WHERE owner_id=? AND due_amount>0 AND is_return=0 ORDER BY date",
            (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/analytics/purchase-dues")
def get_purchase_dues(user=Depends(get_current_user)):
    with get_db() as db:
        rows = db.execute("SELECT * FROM purchases WHERE owner_id=? AND due_amount>0 ORDER BY date",
            (owner_id(user),)).fetchall()
        return [dict(r) for r in rows]

@app.get("/api/analytics/inventory")
def get_inventory(user=Depends(get_current_user)):
    uid = owner_id(user)
    with get_db() as db:
        rows = db.execute("""
            SELECT r.name, r.unit, r.low_stock_threshold,
                COALESCE(p.qty,0) as purchased,
                COALESCE(p.qty,0) as available,
                CASE WHEN COALESCE(p.qty,0) <= r.low_stock_threshold AND r.low_stock_threshold>0
                     THEN 1 ELSE 0 END as is_low
            FROM raw_items r
            LEFT JOIN (SELECT item, SUM(qty) as qty FROM purchases WHERE owner_id=? GROUP BY item) p ON p.item=r.name
            WHERE r.owner_id=?
        """, (uid, uid)).fetchall()
        return [dict(r) for r in rows]

# ─── HEALTH ───────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status":"ok","time":datetime.utcnow().isoformat(),"version":"3.0","language":"Python 🐍"}

# ─── ADMIN SQL VIEWER ─────────────────────────────────────────
@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return """<!DOCTYPE html><html><head><title>TradDesk DB</title>
<style>body{font-family:monospace;background:#0a0a0f;color:#eee;padding:30px;}
h2{color:#f0c040;}textarea{width:100%;height:80px;background:#1a1a24;color:#eee;border:1px solid #333;border-radius:8px;padding:12px;font-size:14px;font-family:monospace;}
input[type=password]{background:#1a1a24;color:#eee;border:1px solid #333;border-radius:8px;padding:10px;width:300px;font-size:14px;margin-bottom:12px;}
button{background:#f0c040;color:#000;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-weight:bold;font-size:14px;margin-top:8px;}
pre{background:#1a1a24;padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;white-space:pre-wrap;border:1px solid #252535;margin-top:14px;}
.shortcuts{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0;}.btn-sm{background:#252535;color:#aaa;border:1px solid #333;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:11px;font-family:monospace;}
</style></head><body>
<h2>TradDesk DB Viewer v3</h2>
<label>Admin Password</label><br><input type="password" id="pwd" placeholder="Enter admin password"/><br>
<label>SQL Query</label><textarea id="sql"></textarea>
<div class="shortcuts">
<button class="btn-sm" onclick="q('SELECT id,name,email,role,is_active FROM users;')">users</button>
<button class="btn-sm" onclick="q('SELECT * FROM suppliers;')">suppliers</button>
<button class="btn-sm" onclick="q('SELECT * FROM raw_items;')">raw_items</button>
<button class="btn-sm" onclick="q('SELECT id,date,supplier_name,item,qty,unit,total,paid_amount,due_amount,payment_status FROM purchases ORDER BY date DESC;')">purchases</button>
<button class="btn-sm" onclick="q('SELECT * FROM products;')">products</button>
<button class="btn-sm" onclick="q('SELECT * FROM customers;')">customers</button>
<button class="btn-sm" onclick="q('SELECT id,date,customer_name,product_name,qty,total,paid_amount,due_amount,payment_status,is_return FROM sales ORDER BY date DESC;')">sales</button>
<button class="btn-sm" onclick="q('SELECT * FROM sale_payments ORDER BY created_at DESC;')">sale_payments</button>
<button class="btn-sm" onclick="q('SELECT * FROM purchase_payments ORDER BY created_at DESC;')">purchase_payments</button>
<button class="btn-sm" onclick="q(&quot;SELECT name FROM sqlite_master WHERE type='table';&quot;)">all tables</button>
</div>
<button onclick="run()">Run Query</button>
<pre id="out">Results appear here...</pre>
<script>
function q(s){document.getElementById('sql').value=s;}
async function run(){
  const sql=document.getElementById('sql').value,pwd=document.getElementById('pwd').value;
  document.getElementById('out').textContent='Running...';
  try{const r=await fetch('/admin/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,password:pwd})});
  const d=await r.json();
  if(d.error){document.getElementById('out').textContent='Error: '+d.error;return;}
  const rows=d.rows;if(!rows||!rows.length){document.getElementById('out').textContent='OK. No rows.';return;}
  const cols=Object.keys(rows[0]);
  let out=cols.join(' | ')+'\n'+'-'.repeat(80)+'\n';
  rows.forEach(r=>{out+=cols.map(c=>String(r[c]??'NULL').substring(0,40)).join(' | ')+'\n';});
  out+='\n('+rows.length+' rows)';document.getElementById('out').textContent=out;
  }catch(e){document.getElementById('out').textContent='Error: '+e.message;}
}
</script></body></html>"""

class QueryRequest(BaseModel):
    sql: str; password: str

@app.post("/admin/query")
def run_query(req: QueryRequest):
    if req.password != ADMIN_PASSWORD: return {"error":"Wrong password"}
    if not req.sql.strip().upper().startswith(("SELECT","PRAGMA","WITH")): return {"error":"Only SELECT allowed"}
    try:
        with get_db() as db:
            return {"rows":[dict(r) for r in db.execute(req.sql).fetchall()]}
    except Exception as e:
        return {"error": str(e)}
