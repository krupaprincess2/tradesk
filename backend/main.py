from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr
from typing import Optional
import sqlite3, hashlib, hmac, jwt, os, secrets, base64
from datetime import datetime, timedelta

app = FastAPI(title="TradDesk API", version="3.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

JWT_SECRET     = os.getenv("JWT_SECRET", "tradesk_secret_2026")
# DEPLOY_VERSION: change this value to force all users to re-login immediately
# Update this in Railway env vars OR just change the default value below
DEPLOY_VERSION = os.getenv("DEPLOY_VERSION", "v6")  # bumped → invalidates all old sessions
# Combine secret + version so changing DEPLOY_VERSION invalidates all existing tokens
_EFFECTIVE_SECRET = f"{JWT_SECRET}_{DEPLOY_VERSION}"
DB_PATH        = os.getenv("DB_PATH", "tradesk.db")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "tradesk_admin_2026")
bearer_scheme  = HTTPBearer()

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
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL,
                email           TEXT UNIQUE NOT NULL,
                password        TEXT NOT NULL,
                role            TEXT NOT NULL DEFAULT 'staff',
                is_active       INTEGER NOT NULL DEFAULT 1,
                can_edit_delete INTEGER NOT NULL DEFAULT 0,
                created_at      TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS suppliers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                phone      TEXT,
                address    TEXT,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS raw_items (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                name                TEXT NOT NULL UNIQUE,
                unit                TEXT NOT NULL DEFAULT 'units',
                low_stock_threshold REAL DEFAULT 0,
                created_at          TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS purchases (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                added_by       INTEGER REFERENCES users(id),
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
            CREATE TABLE IF NOT EXISTS purchase_payments (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                purchase_id INTEGER NOT NULL REFERENCES purchases(id),
                added_by    INTEGER REFERENCES users(id),
                amount      REAL NOT NULL,
                date        TEXT NOT NULL,
                notes       TEXT,
                created_at  TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS products (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                description   TEXT,
                defined_price REAL NOT NULL,
                unit          TEXT NOT NULL DEFAULT 'pcs',
                qty_available REAL NOT NULL DEFAULT 0,
                image_data    TEXT,
                image_name    TEXT,
                is_active     INTEGER NOT NULL DEFAULT 1,
                created_at    TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS customers (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                name       TEXT NOT NULL,
                phone      TEXT,
                address    TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS sales (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                added_by       INTEGER REFERENCES users(id),
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
                return_date    TEXT,
                return_collected REAL NOT NULL DEFAULT 0,
                return_owe     REAL NOT NULL DEFAULT 0,
                return_paid_back REAL NOT NULL DEFAULT 0,
                notes          TEXT,
                created_at     TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS sale_payments (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id    INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                added_by   INTEGER REFERENCES users(id),
                amount     REAL NOT NULL,
                date       TEXT NOT NULL,
                notes      TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS product_ingredients (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                item_name   TEXT NOT NULL,
                qty         REAL NOT NULL,
                unit        TEXT NOT NULL DEFAULT 'units',
                unit_cost   REAL NOT NULL DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS product_charges (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                label       TEXT NOT NULL,
                amount      REAL NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS order_items (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id     INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
                product_id  INTEGER REFERENCES products(id),
                product_name TEXT NOT NULL,
                qty         REAL NOT NULL,
                unit        TEXT NOT NULL DEFAULT 'pcs',
                unit_price  REAL NOT NULL,
                total       REAL NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            );
        """)
        db.commit()
        # Safe migrations
        for sql in [
            "ALTER TABLE products ADD COLUMN qty_available REAL NOT NULL DEFAULT 0",
            "ALTER TABLE users ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1",
            "ALTER TABLE users ADD COLUMN can_edit_delete INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE sales ADD COLUMN return_date TEXT",
            "ALTER TABLE sales ADD COLUMN return_collected REAL NOT NULL DEFAULT 0",
            "ALTER TABLE sales ADD COLUMN return_owe REAL NOT NULL DEFAULT 0",
            "ALTER TABLE sales ADD COLUMN return_paid_back REAL NOT NULL DEFAULT 0",
        ]:
            try: db.execute(sql); db.commit()
            except: pass

init_db()

def hash_password(p):
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac('sha256', p.encode(), salt.encode(), 100000)
    return f"{salt}:{h.hex()}"

def verify_password(p, stored):
    try:
        salt, h = stored.split(':')
        return hmac.compare_digest(hashlib.pbkdf2_hmac('sha256', p.encode(), salt.encode(), 100000).hex(), h)
    except: return False

def create_token(uid, email, name, role, can_edit_delete=0):
    return jwt.encode({"id":uid,"email":email,"name":name,"role":role,
        "can_edit_delete": can_edit_delete,
        "exp":datetime.utcnow()+timedelta(days=30)}, _EFFECTIVE_SECRET, algorithm="HS256")

def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    try: return jwt.decode(creds.credentials, _EFFECTIVE_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expired")
    except: raise HTTPException(401, "Invalid token")

def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin": raise HTTPException(403, "Admin access required")
    return user

# ── Models ────────────────────────────────────────────────────
class RegisterReq(BaseModel): name:str; email:EmailStr; password:str
class LoginReq(BaseModel): email:EmailStr; password:str
class CreateUserReq(BaseModel): name:str; email:EmailStr; password:str; role:str="staff"; can_edit_delete:int=0
class ResetPasswordReq(BaseModel): new_password:str
class SupplierCreate(BaseModel): name:str; phone:Optional[str]=None; address:Optional[str]=None; notes:Optional[str]=None
class PurchaseCreate(BaseModel): date:str; supplier_name:str; item:str; qty:float; unit:str="units"; unit_cost:float; paid_amount:float=0; low_stock_alert:float=0; notes:Optional[str]=None
class PurchasePaymentCreate(BaseModel): amount:float; date:str; notes:Optional[str]=None
class ProductCreate(BaseModel): name:str; description:Optional[str]=None; defined_price:float; unit:str="pcs"; qty_available:float=0; is_active:int=1
class CustomerCreate(BaseModel): name:str; phone:Optional[str]=None; address:Optional[str]=None
class SaleCreate(BaseModel): date:str; customer_name:str; customer_phone:Optional[str]=None; customer_addr:Optional[str]=None; product_id:Optional[int]=None; product_name:str; qty:float; unit:str="pcs"; defined_price:float=0; unit_price:float; paid_amount:float=0; payment_notes:Optional[str]=None; notes:Optional[str]=None
class SalePaymentCreate(BaseModel): amount:float; date:str; notes:Optional[str]=None
class SaleReturnCreate(BaseModel): date:str; notes:Optional[str]=None; return_collected:float=0; return_owe:float=0
class QueryRequest(BaseModel): sql:str; password:str
# Product builder models
class IngredientItem(BaseModel): item_name:str; qty:float; unit:str="units"; unit_cost:float=0
class ChargeItem(BaseModel): label:str; amount:float
class ProductBuildCreate(BaseModel):
    name:str; description:Optional[str]=None; unit:str="pcs"; qty_available:float=0; is_active:int=1
    ingredients:Optional[list]=[]
    charges:Optional[list]=[]
# Multi-product order models
class OrderLineItem(BaseModel): product_id:Optional[int]=None; product_name:str; qty:float; unit:str="pcs"; unit_price:float
class OrderCreate(BaseModel):
    date:str; customer_name:str; customer_phone:Optional[str]=None; customer_addr:Optional[str]=None
    items:list; paid_amount:float=0; payment_notes:Optional[str]=None; notes:Optional[str]=None

# ── Auth ──────────────────────────────────────────────────────
@app.post("/api/auth/register", status_code=201)
def register(data: RegisterReq):
    try:
        if len(data.password) < 6: raise HTTPException(400, "Password must be at least 6 characters")
        with get_db() as db:
            count = db.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
            role  = "admin" if count == 0 else "staff"
            if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
                raise HTTPException(409, "Email already registered")
            cur = db.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)",
                (data.name, data.email, hash_password(data.password), role))
            db.commit()
            return {"token": create_token(cur.lastrowid, data.email, data.name, role, 0),
                    "user": {"id":cur.lastrowid,"name":data.name,"email":data.email,"role":role,"can_edit_delete":0}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Registration failed: {str(e)}")

@app.post("/api/auth/login")
def login(data: LoginReq):
    try:
      with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE email=?", (data.email,)).fetchone()
        if not u or not verify_password(data.password, u["password"]):
            raise HTTPException(401, "Invalid email or password")
        if not u["is_active"]: raise HTTPException(403, "Account disabled")
        ced = u["can_edit_delete"] if "can_edit_delete" in u.keys() else 0
        return {"token": create_token(u["id"],u["email"],u["name"],u["role"],ced),
                "user": {"id":u["id"],"name":u["name"],"email":u["email"],"role":u["role"],"can_edit_delete":ced}}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Login failed: {str(e)}")

@app.get("/api/auth/me")
def get_me(user=Depends(get_current_user)):
    with get_db() as db:
        return dict(db.execute("SELECT id,name,email,role,created_at FROM users WHERE id=?", (user["id"],)).fetchone())

# ── Users ─────────────────────────────────────────────────────
@app.get("/api/users")
def list_users(admin=Depends(require_admin)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT id,name,email,role,is_active,can_edit_delete,created_at FROM users ORDER BY created_at").fetchall()]

@app.post("/api/users", status_code=201)
def create_user(data: CreateUserReq, admin=Depends(require_admin)):
    if len(data.password) < 6: raise HTTPException(400, "Password min 6 chars")
    with get_db() as db:
        if db.execute("SELECT id FROM users WHERE email=?", (data.email,)).fetchone():
            raise HTTPException(409, "Email already exists")
        cur = db.execute("INSERT INTO users(name,email,password,role,can_edit_delete) VALUES(?,?,?,?,?)",
            (data.name, data.email, hash_password(data.password), data.role, data.can_edit_delete))
        db.commit()
        return dict(db.execute("SELECT id,name,email,role,is_active,can_edit_delete FROM users WHERE id=?", (cur.lastrowid,)).fetchone())

@app.put("/api/users/{uid}/toggle-permission")
def toggle_permission(uid:int, admin=Depends(require_admin)):
    with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u: raise HTTPException(404,"Not found")
        if u["role"]=="admin": raise HTTPException(400,"Admin always has full permission")
        ced = u["can_edit_delete"] if "can_edit_delete" in u.keys() else 0
        new_ced = 0 if ced else 1
        db.execute("UPDATE users SET can_edit_delete=? WHERE id=?", (new_ced, uid))
        db.commit(); return {"can_edit_delete": new_ced}

@app.put("/api/users/{uid}/reset-password")
def reset_password(uid:int, data:ResetPasswordReq, admin=Depends(require_admin)):
    if len(data.new_password) < 6: raise HTTPException(400, "Password min 6 chars")
    with get_db() as db:
        db.execute("UPDATE users SET password=? WHERE id=?", (hash_password(data.new_password), uid))
        db.commit(); return {"success":True}

@app.put("/api/users/{uid}/toggle")
def toggle_user(uid:int, admin=Depends(require_admin)):
    with get_db() as db:
        u = db.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
        if not u: raise HTTPException(404,"Not found")
        if u["role"]=="admin": raise HTTPException(400,"Cannot disable admin")
        new_s = 0 if u["is_active"] else 1
        db.execute("UPDATE users SET is_active=? WHERE id=?", (new_s, uid))
        db.commit(); return {"is_active":new_s}

# ── Suppliers (shared) ────────────────────────────────────────
@app.get("/api/suppliers")
def list_suppliers(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM suppliers ORDER BY name").fetchall()]

@app.post("/api/suppliers", status_code=201)
def create_supplier(data:SupplierCreate, user=Depends(get_current_user)):
    with get_db() as db:
        cur = db.execute("INSERT INTO suppliers(name,phone,address,notes) VALUES(?,?,?,?)",
            (data.name,data.phone,data.address,data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM suppliers WHERE id=?", (cur.lastrowid,)).fetchone())

@app.delete("/api/suppliers/{sid}")
def delete_supplier(sid:int, admin=Depends(require_admin)):
    with get_db() as db:
        db.execute("DELETE FROM suppliers WHERE id=?", (sid,)); db.commit(); return {"success":True}

# ── Purchases (shared) ────────────────────────────────────────
@app.get("/api/purchases")
def list_purchases(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM purchases ORDER BY date DESC").fetchall()]

@app.post("/api/purchases", status_code=201)
def create_purchase(data:PurchaseCreate, user=Depends(get_current_user)):
    try:
        total = data.qty * data.unit_cost
        paid  = min(data.paid_amount, total)
        due   = total - paid
        status = "paid" if paid>=total else ("partial" if paid>0 else "unpaid")
        with get_db() as db:
            if not db.execute("SELECT id FROM raw_items WHERE name=?", (data.item,)).fetchone():
                db.execute("INSERT INTO raw_items(name,unit,low_stock_threshold) VALUES(?,?,?)",
                    (data.item, data.unit or "units", data.low_stock_alert or 0))
            else:
                db.execute("UPDATE raw_items SET low_stock_threshold=? WHERE name=?",
                    (data.low_stock_alert or 0, data.item))
            cur = db.execute(
                "INSERT INTO purchases(added_by,date,supplier_name,item,qty,unit,unit_cost,total,"
                "paid_amount,due_amount,payment_status,low_stock_alert,notes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (user["id"],data.date,data.supplier_name,data.item,data.qty,
                 data.unit or "units",data.unit_cost,
                 total,paid,due,status,data.low_stock_alert or 0,data.notes))
            if paid>0:
                db.execute(
                    "INSERT INTO purchase_payments(purchase_id,added_by,amount,date,notes) VALUES(?,?,?,?,?)",
                    (cur.lastrowid,user["id"],paid,data.date,"Initial payment"))
            db.commit()
            return dict(db.execute("SELECT * FROM purchases WHERE id=?", (cur.lastrowid,)).fetchone())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to save purchase: {str(e)}")

@app.post("/api/purchases/{pid}/image")
async def upload_purchase_image(pid:int, file:UploadFile=File(...), user=Depends(get_current_user)):
    contents = await file.read()
    if len(contents)>5*1024*1024: raise HTTPException(400,"Image too large (max 5MB)")
    ext  = file.filename.split(".")[-1].lower()
    mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext,"image/jpeg")
    data_url = f"data:{mime};base64,{base64.b64encode(contents).decode()}"
    with get_db() as db:
        db.execute("UPDATE purchases SET image_data=?,image_name=? WHERE id=?", (data_url,file.filename,pid))
        db.commit()
    return {"success":True,"image_data":data_url}

@app.post("/api/purchases/{pid}/payments", status_code=201)
def add_purchase_payment(pid:int, data:PurchasePaymentCreate, user=Depends(get_current_user)):
    with get_db() as db:
        p = db.execute("SELECT * FROM purchases WHERE id=?", (pid,)).fetchone()
        if not p: raise HTTPException(404,"Not found")
        if p["due_amount"]<=0: raise HTTPException(400,"Already fully paid")
        payment  = min(data.amount, p["due_amount"])
        new_paid = p["paid_amount"]+payment
        new_due  = p["total"]-new_paid
        db.execute("UPDATE purchases SET paid_amount=?,due_amount=?,payment_status=? WHERE id=?",
            (new_paid, max(0,new_due), "paid" if new_due<=0 else "partial", pid))
        db.execute("INSERT INTO purchase_payments(purchase_id,added_by,amount,date,notes) VALUES(?,?,?,?,?)",
            (pid,user["id"],payment,data.date,data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM purchases WHERE id=?", (pid,)).fetchone())

@app.get("/api/purchases/{pid}/payments")
def get_purchase_payments(pid:int, user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM purchase_payments WHERE purchase_id=? ORDER BY date",(pid,)).fetchall()]

@app.delete("/api/purchases/{pid}")
def delete_purchase(pid:int, user=Depends(get_current_user)):
    try:
        with get_db() as db:
            p = db.execute("SELECT * FROM purchases WHERE id=?", (pid,)).fetchone()
            if not p: raise HTTPException(404, "Purchase not found")
            # Block only if this raw material is used in a product that STILL EXISTS
            used = db.execute(
                "SELECT COUNT(*) as cnt FROM product_ingredients pi "
                "JOIN products pr ON pr.id = pi.product_id WHERE pi.item_name = ?",
                (p["item"],)
            ).fetchone()
            if used and used["cnt"] > 0:
                # Get product names separately to avoid GROUP_CONCAT issues
                names = db.execute(
                    "SELECT DISTINCT pr.name FROM product_ingredients pi "
                    "JOIN products pr ON pr.id = pi.product_id WHERE pi.item_name = ?",
                    (p["item"],)
                ).fetchall()
                name_list = ", ".join(r["name"] for r in names)
                raise HTTPException(400,
                    f"Cannot delete: '{p['item']}' is still used in: {name_list}. "
                    f"Delete those products first.")
            # Clean up orphaned product_ingredients rows for this item
            db.execute(
                "DELETE FROM product_ingredients WHERE item_name = ? "
                "AND product_id NOT IN (SELECT id FROM products)",
                (p["item"],)
            )
            db.execute("DELETE FROM purchases WHERE id=?", (pid,))
            db.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Delete failed: {str(e)}")

# ── Products (shared, with qty) ───────────────────────────────
@app.get("/api/products")
def list_products(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM products ORDER BY name").fetchall()]

@app.post("/api/products", status_code=201)
def create_product(data:ProductCreate, user=Depends(get_current_user)):
    try:
        with get_db() as db:
            cur = db.execute(
                "INSERT INTO products(name,description,defined_price,unit,qty_available,is_active) VALUES(?,?,?,?,?,?)",
                (data.name,data.description,data.defined_price,data.unit or "pcs",data.qty_available or 0,data.is_active))
            db.commit()
            return dict(db.execute("SELECT * FROM products WHERE id=?", (cur.lastrowid,)).fetchone())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to save product: {str(e)}")

@app.put("/api/products/{pid}")
def update_product(pid:int, data:ProductCreate, user=Depends(get_current_user)):
    with get_db() as db:
        if not db.execute("SELECT id FROM products WHERE id=?", (pid,)).fetchone():
            raise HTTPException(404,"Not found")
        db.execute("UPDATE products SET name=?,description=?,defined_price=?,unit=?,qty_available=?,is_active=? WHERE id=?",
            (data.name,data.description,data.defined_price,data.unit,data.qty_available,data.is_active,pid))
        db.commit()
        return dict(db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())
async def upload_product_image(pid:int, file:UploadFile=File(...), admin=Depends(require_admin)):
    contents = await file.read()
    if len(contents)>5*1024*1024: raise HTTPException(400,"Image too large (max 5MB)")
    ext  = file.filename.split(".")[-1].lower()
    mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","webp":"image/webp"}.get(ext,"image/jpeg")
    data_url = f"data:{mime};base64,{base64.b64encode(contents).decode()}"
    with get_db() as db:
        db.execute("UPDATE products SET image_data=?,image_name=? WHERE id=?", (data_url,file.filename,pid))
        db.commit()
    return {"success":True,"image_data":data_url}

@app.delete("/api/products/{pid}")
def delete_product(pid:int, admin=Depends(require_admin)):
    try:
        with get_db() as db:
            prod = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
            if not prod: raise HTTPException(404, "Product not found")
            # Block if product has been ordered
            in_sales = db.execute(
                "SELECT COUNT(*) as cnt FROM sales WHERE product_id=? AND is_return=0", (pid,)
            ).fetchone()
            in_orders = db.execute(
                "SELECT COUNT(*) as cnt FROM order_items WHERE product_id=?", (pid,)
            ).fetchone()
            total_orders = (in_sales["cnt"] if in_sales else 0) + (in_orders["cnt"] if in_orders else 0)
            if total_orders > 0:
                raise HTTPException(400,
                    f"Cannot delete '{prod['name']}': used in {total_orders} order(s). "
                    f"Mark it as Inactive instead.")
            db.execute("DELETE FROM product_ingredients WHERE product_id=?", (pid,))
            db.execute("DELETE FROM product_charges WHERE product_id=?", (pid,))
            db.execute("DELETE FROM products WHERE id=?", (pid,))
            db.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Delete failed: {str(e)}")

# Product builder: ingredients + charges
@app.post("/api/products/build", status_code=201)
def build_product(data:ProductBuildCreate, user=Depends(get_current_user)):
    """Create product from raw ingredients + extra charges. Auto-calculates defined_price."""
    try:
      ingredients = data.ingredients or []
      charges = data.charges or []
      # Validate stock availability for each ingredient
    # qty in each ingredient row is PER PRODUCT — total consumed = qty × qty_making
    # available = total purchased - already committed to other product definitions
    qty_making = max(1, float(data.qty_available) if data.qty_available else 1)
    with get_db() as db:
        for ing in ingredients:
            item_name = ing.get("item_name","")
            qty_per_product = float(ing.get("qty",0))
            total_needed = qty_per_product * qty_making
            if item_name and total_needed > 0:
                purchased_row = db.execute(
                    "SELECT COALESCE(SUM(qty),0) as total FROM purchases WHERE item=?",
                    (item_name,)
                ).fetchone()
                used_row = db.execute(
                    """SELECT COALESCE(SUM(pi.qty),0) as used
                       FROM product_ingredients pi
                       JOIN products pr ON pr.id = pi.product_id
                       WHERE pi.item_name=?""",
                    (item_name,)
                ).fetchone()
                purchased = float(purchased_row["total"]) if purchased_row else 0
                already_used = float(used_row["used"]) if used_row else 0
                available = purchased - already_used
                if total_needed > available:
                    raise HTTPException(400,
                        f"Not enough stock for '{item_name}' — "
                        f"{qty_per_product} per product × {qty_making} products = {total_needed} needed, "
                        f"but only {available} available")
    # Calculate total cost from ingredients
    ingredients_cost = sum(float(i.get("qty",0)) * float(i.get("unit_cost",0)) for i in ingredients)
    charges_total = sum(float(c.get("amount",0)) for c in charges)
    defined_price = ingredients_cost + charges_total
    with get_db() as db:
        cur = db.execute("INSERT INTO products(name,description,defined_price,unit,qty_available,is_active) VALUES(?,?,?,?,?,?)",
            (data.name, data.description, defined_price, data.unit, data.qty_available, data.is_active))
        pid = cur.lastrowid
        for ing in ingredients:
            db.execute("INSERT INTO product_ingredients(product_id,item_name,qty,unit,unit_cost) VALUES(?,?,?,?,?)",
                (pid, ing.get("item_name",""), float(ing.get("qty",0)), ing.get("unit","units"), float(ing.get("unit_cost",0))))
        for chg in charges:
            db.execute("INSERT INTO product_charges(product_id,label,amount) VALUES(?,?,?)",
                (pid, chg.get("label",""), float(chg.get("amount",0))))
        db.commit()
        prod = dict(db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone())
        prod["ingredients"] = [dict(r) for r in db.execute("SELECT * FROM product_ingredients WHERE product_id=?",(pid,)).fetchall()]
        prod["charges"] = [dict(r) for r in db.execute("SELECT * FROM product_charges WHERE product_id=?",(pid,)).fetchall()]
        return prod
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to build product: {str(e)}")

@app.get("/api/products/{pid}/build-info")
def get_product_build_info(pid:int, user=Depends(get_current_user)):
    with get_db() as db:
        prod = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
        if not prod: raise HTTPException(404,"Not found")
        return {
            "product": dict(prod),
            "ingredients": [dict(r) for r in db.execute("SELECT * FROM product_ingredients WHERE product_id=?",(pid,)).fetchall()],
            "charges": [dict(r) for r in db.execute("SELECT * FROM product_charges WHERE product_id=?",(pid,)).fetchall()]
        }

# ── Customers (shared) ────────────────────────────────────────
@app.get("/api/customers")
def list_customers(q:Optional[str]=None, user=Depends(get_current_user)):
    with get_db() as db:
        if q:
            return [dict(r) for r in db.execute("SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY name",(f"%{q}%",f"%{q}%")).fetchall()]
        return [dict(r) for r in db.execute("SELECT * FROM customers ORDER BY name").fetchall()]

@app.post("/api/customers", status_code=201)
def create_customer(data:CustomerCreate, user=Depends(get_current_user)):
    with get_db() as db:
        if data.phone:
            ex = db.execute("SELECT * FROM customers WHERE phone=?", (data.phone,)).fetchone()
            if ex: return dict(ex)
        cur = db.execute("INSERT INTO customers(name,phone,address) VALUES(?,?,?)", (data.name,data.phone,data.address))
        db.commit()
        return dict(db.execute("SELECT * FROM customers WHERE id=?", (cur.lastrowid,)).fetchone())

# ── Sales (shared) ────────────────────────────────────────────
@app.get("/api/sales")
def list_sales(user=Depends(get_current_user)):
    with get_db() as db:
        sales = [dict(r) for r in db.execute("SELECT * FROM sales ORDER BY date DESC").fetchall()]
        # Attach order_items to each sale for multi-product display
        for s in sales:
            items = db.execute("SELECT * FROM order_items WHERE sale_id=? ORDER BY id", (s["id"],)).fetchall()
            s["order_items"] = [dict(i) for i in items]
        return sales

@app.post("/api/sales", status_code=201)
def create_sale(data:SaleCreate, user=Depends(get_current_user)):
    try:
        total = data.qty * data.unit_price
        paid  = min(data.paid_amount, total)
        due   = total - paid
        status = "paid" if paid>=total else ("partial" if paid>0 else "unpaid")
        with get_db() as db:
            if data.product_id:
                prod = db.execute("SELECT * FROM products WHERE id=?", (data.product_id,)).fetchone()
                if prod and prod["qty_available"] < data.qty:
                    raise HTTPException(400, f"Not enough stock. Available: {prod['qty_available']}")
                if prod:
                    db.execute("UPDATE products SET qty_available=qty_available-? WHERE id=?",
                               (data.qty, data.product_id))
            if data.customer_phone:
                if not db.execute("SELECT id FROM customers WHERE phone=?", (data.customer_phone,)).fetchone():
                    db.execute("INSERT INTO customers(name,phone,address) VALUES(?,?,?)",
                        (data.customer_name,data.customer_phone,data.customer_addr))
            cur = db.execute(
                "INSERT INTO sales(added_by,date,customer_name,customer_phone,customer_addr,"
                "product_id,product_name,qty,unit,defined_price,unit_price,total,paid_amount,due_amount,payment_status,notes)"
                " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (user["id"],data.date,data.customer_name,data.customer_phone,data.customer_addr,
                 data.product_id,data.product_name,data.qty,data.unit or "pcs",data.defined_price,
                 data.unit_price,total,paid,due,status,data.notes))
            if paid>0:
                db.execute(
                    "INSERT INTO sale_payments(sale_id,added_by,amount,date,notes) VALUES(?,?,?,?,?)",
                    (cur.lastrowid,user["id"],paid,data.date, data.payment_notes or "Initial payment"))
            db.commit()
            return dict(db.execute("SELECT * FROM sales WHERE id=?", (cur.lastrowid,)).fetchone())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to save order: {str(e)}")

@app.post("/api/sales/{sid}/payments", status_code=201)
def add_sale_payment(sid:int, data:SalePaymentCreate, user=Depends(get_current_user)):
    with get_db() as db:
        s = db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone()
        if not s: raise HTTPException(404,"Not found")
        if s["due_amount"]<=0: raise HTTPException(400,"Already fully paid")
        payment  = min(data.amount, s["due_amount"])
        new_paid = s["paid_amount"]+payment
        new_due  = s["total"]-new_paid
        db.execute("UPDATE sales SET paid_amount=?,due_amount=?,payment_status=? WHERE id=?",
            (new_paid,max(0,new_due),"paid" if new_due<=0 else "partial",sid))
        db.execute("INSERT INTO sale_payments(sale_id,added_by,amount,date,notes) VALUES(?,?,?,?,?)",
            (sid,user["id"],payment,data.date,data.notes))
        db.commit()
        return dict(db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone())

@app.get("/api/sales/{sid}/payments")
def get_sale_payments(sid:int, user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM sale_payments WHERE sale_id=? ORDER BY date",(sid,)).fetchall()]

@app.post("/api/sales/{sid}/return")
def return_sale(sid:int, data:SaleReturnCreate, user=Depends(get_current_user)):
    with get_db() as db:
        s = db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone()
        if not s: raise HTTPException(404,"Not found")
        if s["is_return"]: raise HTTPException(400,"Already returned")
        if s["product_id"]:
            db.execute("UPDATE products SET qty_available=qty_available+? WHERE id=?", (s["qty"],s["product_id"]))
        # return_owe = how much we owe back to customer (what they paid minus any restocking or fees)
        return_owe = data.return_owe if data.return_owe > 0 else data.return_collected
        db.execute("""UPDATE sales SET is_return=1, return_date=?, return_collected=?, return_owe=?,
            return_paid_back=0, notes=? WHERE id=?""",
            (data.date, data.return_collected, return_owe,
             f"RETURNED on {data.date}: {data.notes or ''}", sid))
        db.commit(); return dict(db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone())

@app.post("/api/sales/{sid}/return-payback")
def return_payback(sid:int, data:SalePaymentCreate, user=Depends(get_current_user)):
    """Record money paid back to customer after a return."""
    with get_db() as db:
        s = db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone()
        if not s: raise HTTPException(404,"Not found")
        if not s["is_return"]: raise HTTPException(400,"Sale not returned")
        already_paid_back = s["return_paid_back"] or 0
        owe = s["return_owe"] or 0
        remaining = max(0, owe - already_paid_back)
        payment = min(data.amount, remaining)
        new_paid_back = already_paid_back + payment
        db.execute("UPDATE sales SET return_paid_back=? WHERE id=?", (new_paid_back, sid))
        db.commit(); return dict(db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone())

@app.delete("/api/sales/{sid}")
def delete_sale(sid:int, user=Depends(get_current_user)):
    try:
        with get_db() as db:
            s = db.execute("SELECT * FROM sales WHERE id=?", (sid,)).fetchone()
            if not s: raise HTTPException(404, "Order not found")
            # Restore product stock for single-product sale
            if s["product_id"] and not s["is_return"]:
                db.execute("UPDATE products SET qty_available=qty_available+? WHERE id=?",
                           (s["qty"], s["product_id"]))
            # Restore product stock for each order_item (multi-product order)
            items = db.execute("SELECT * FROM order_items WHERE sale_id=?", (sid,)).fetchall()
            for item in items:
                if item["product_id"] and not s["is_return"]:
                    db.execute("UPDATE products SET qty_available=qty_available+? WHERE id=?",
                               (item["qty"], item["product_id"]))
            # Delete child rows first (sale_payments has no ON DELETE CASCADE)
            db.execute("DELETE FROM sale_payments WHERE sale_id=?", (sid,))
            db.execute("DELETE FROM order_items WHERE sale_id=?", (sid,))
            db.execute("DELETE FROM sales WHERE id=?", (sid,))
            db.commit()
            return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Delete failed: {str(e)}")

# ── Multi-product Orders ──────────────────────────────────────
@app.post("/api/orders", status_code=201)
def create_order(data:OrderCreate, user=Depends(get_current_user)):
    """Create an order with multiple product line items."""
    try:
      items = data.items or []
      if not items: raise HTTPException(400, "Order must have at least one item")
    total = sum(float(i.get("qty",0)) * float(i.get("unit_price",0)) for i in items)
    paid  = min(data.paid_amount, total)
    due   = total - paid
    status = "paid" if paid>=total else ("partial" if paid>0 else "unpaid")
    # For display, join product names
    product_name = ", ".join(i.get("product_name","") for i in items[:3])
    if len(items) > 3: product_name += f" +{len(items)-3} more"
    qty_display = sum(float(i.get("qty",0)) for i in items)
    with get_db() as db:
        # Stock check + deduct
        for i in items:
            pid = i.get("product_id")
            qty = float(i.get("qty",0))
            if pid:
                prod = db.execute("SELECT * FROM products WHERE id=?", (pid,)).fetchone()
                if prod and prod["qty_available"] < qty:
                    raise HTTPException(400, f"Not enough stock for {i.get('product_name')}. Available: {prod['qty_available']}")
                if prod:
                    db.execute("UPDATE products SET qty_available=qty_available-? WHERE id=?", (qty, pid))
        if data.customer_phone:
            if not db.execute("SELECT id FROM customers WHERE phone=?", (data.customer_phone,)).fetchone():
                db.execute("INSERT INTO customers(name,phone,address) VALUES(?,?,?)",
                    (data.customer_name, data.customer_phone, data.customer_addr))
        cur = db.execute("""INSERT INTO sales(added_by,date,customer_name,customer_phone,customer_addr,
            product_id,product_name,qty,unit,defined_price,unit_price,total,paid_amount,due_amount,payment_status,notes)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (user["id"],data.date,data.customer_name,data.customer_phone,data.customer_addr,
             None,product_name,qty_display,"pcs",0,total/qty_display if qty_display>0 else 0,
             total,paid,due,status,data.notes))
        sale_id = cur.lastrowid
        for i in items:
            db.execute("INSERT INTO order_items(sale_id,product_id,product_name,qty,unit,unit_price,total) VALUES(?,?,?,?,?,?,?)",
                (sale_id, i.get("product_id"), i.get("product_name",""), float(i.get("qty",0)),
                 i.get("unit","pcs"), float(i.get("unit_price",0)),
                 float(i.get("qty",0))*float(i.get("unit_price",0))))
        if paid>0:
            db.execute("INSERT INTO sale_payments(sale_id,added_by,amount,date,notes) VALUES(?,?,?,?,?)",
                (sale_id,user["id"],paid,data.date, data.payment_notes or "Initial payment"))
        db.commit()
        return dict(db.execute("SELECT * FROM sales WHERE id=?", (sale_id,)).fetchone())
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to create order: {str(e)}")

@app.get("/api/orders/{sid}/items")
def get_order_items(sid:int, user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM order_items WHERE sale_id=? ORDER BY id",(sid,)).fetchall()]

# ── Analytics (Admin only) ────────────────────────────────────
@app.get("/api/analytics/summary")
def get_summary(admin=Depends(require_admin)):
    with get_db() as db:
        def q(sql): return db.execute(sql).fetchone()[0]
        top_sup  = db.execute("SELECT supplier_name,SUM(total) as t FROM purchases GROUP BY supplier_name ORDER BY t DESC LIMIT 1").fetchone()
        top_cust = db.execute("SELECT customer_name,SUM(total) as t FROM sales WHERE is_return=0 GROUP BY customer_name ORDER BY t DESC LIMIT 1").fetchone()
        top_prod = db.execute("SELECT product_name,SUM(total) as t FROM sales WHERE is_return=0 GROUP BY product_name ORDER BY t DESC LIMIT 1").fetchone()
        return {
            "totalPurchases": q("SELECT COALESCE(SUM(total),0) FROM purchases"),
            "purchasePaid":   q("SELECT COALESCE(SUM(paid_amount),0) FROM purchases"),
            "purchaseDue":    q("SELECT COALESCE(SUM(due_amount),0) FROM purchases"),
            "totalSales":     q("SELECT COALESCE(SUM(total),0) FROM sales WHERE is_return=0"),
            "saleCollected":  q("SELECT COALESCE(SUM(paid_amount),0) FROM sales WHERE is_return=0"),
            "saleDue":        q("SELECT COALESCE(SUM(due_amount),0) FROM sales WHERE is_return=0"),
            "profit":         q("SELECT COALESCE(SUM(paid_amount),0) FROM sales WHERE is_return=0") - q("SELECT COALESCE(SUM(paid_amount),0) FROM purchases"),
            "purchaseCount":  q("SELECT COUNT(*) FROM purchases"),
            "saleCount":      q("SELECT COUNT(*) FROM sales WHERE is_return=0"),
            "returnsCount":   q("SELECT COUNT(*) FROM sales WHERE is_return=1"),
            "topSupplier":  dict(top_sup)  if top_sup  else None,
            "topCustomer":  dict(top_cust) if top_cust else None,
            "topProduct":   dict(top_prod) if top_prod else None,
        }

@app.get("/api/analytics/monthly")
def get_monthly(admin=Depends(require_admin)):
    with get_db() as db:
        p = db.execute("SELECT strftime('%Y-%m',date) as m,SUM(total) as t,SUM(paid_amount) as paid FROM purchases GROUP BY m").fetchall()
        s = db.execute("SELECT strftime('%Y-%m',date) as m,SUM(total) as t,SUM(paid_amount) as collected FROM sales WHERE is_return=0 GROUP BY m").fetchall()
        months={}
        for r in p: months[r["m"]]={"month":r["m"],"purchases":r["t"],"purchase_paid":r["paid"],"sales":0,"collected":0}
        for r in s:
            if r["m"] not in months: months[r["m"]]={"month":r["m"],"purchases":0,"purchase_paid":0,"sales":0,"collected":0}
            months[r["m"]]["sales"]=r["t"]; months[r["m"]]["collected"]=r["collected"]
        result=[]
        for m in sorted(months.values(),key=lambda x:x["month"]):
            m["profit"]=m["collected"]-m["purchase_paid"]; result.append(m)
        return result

@app.get("/api/analytics/dues")
def get_dues(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM sales WHERE due_amount>0 AND is_return=0 ORDER BY date").fetchall()]

@app.get("/api/analytics/purchase-dues")
def get_purchase_dues(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("SELECT * FROM purchases WHERE due_amount>0 ORDER BY date").fetchall()]

@app.get("/api/analytics/return-dues")
def get_return_dues(user=Depends(get_current_user)):
    """Sales that are returned and we still owe money back to customer."""
    with get_db() as db:
        return [dict(r) for r in db.execute(
            "SELECT * FROM sales WHERE is_return=1 AND return_owe > return_paid_back ORDER BY return_date DESC"
        ).fetchall()]

@app.get("/api/analytics/inventory")
def get_inventory(user=Depends(get_current_user)):
    with get_db() as db:
        return [dict(r) for r in db.execute("""
            SELECT r.name, r.unit, r.low_stock_threshold,
                COALESCE(p.qty,0) as purchased,
                COALESCE(pi.used,0) as used_in_products,
                COALESCE(p.qty,0) - COALESCE(pi.used,0) as available,
                CASE WHEN (COALESCE(p.qty,0) - COALESCE(pi.used,0)) <= r.low_stock_threshold
                     AND r.low_stock_threshold > 0 THEN 1 ELSE 0 END as is_low
            FROM raw_items r
            LEFT JOIN (SELECT item, SUM(qty) as qty FROM purchases GROUP BY item) p
                ON p.item = r.name
            LEFT JOIN (SELECT item_name, SUM(qty) as used FROM product_ingredients GROUP BY item_name) pi
                ON pi.item_name = r.name
        """).fetchall()]

@app.get("/health")
def health():
    return {"status":"ok","version":"3.1","language":"Python 🐍","time":datetime.utcnow().isoformat()}

@app.get("/admin", response_class=HTMLResponse)
def admin_page():
    return """<!DOCTYPE html><html><head><title>TradDesk DB</title>
<style>body{font-family:monospace;background:#0a0a0f;color:#eee;padding:30px;}h2{color:#f0c040;}
textarea{width:100%;height:80px;background:#1a1a24;color:#eee;border:1px solid #333;border-radius:8px;padding:12px;font-size:14px;font-family:monospace;}
input[type=password]{background:#1a1a24;color:#eee;border:1px solid #333;border-radius:8px;padding:10px;width:300px;font-size:14px;margin-bottom:12px;}
button{background:#f0c040;color:#000;border:none;border-radius:8px;padding:10px 24px;cursor:pointer;font-weight:bold;font-size:14px;margin-top:8px;}
pre{background:#1a1a24;padding:16px;border-radius:8px;overflow-x:auto;font-size:12px;white-space:pre-wrap;border:1px solid #252535;margin-top:14px;}
.shortcuts{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0;}.btn-sm{background:#252535;color:#aaa;border:1px solid #333;border-radius:6px;padding:5px 11px;cursor:pointer;font-size:11px;font-family:monospace;}
</style></head><body>
<h2>TradDesk DB Viewer v3.1</h2>
<label>Admin Password</label><br><input type="password" id="pwd"/><br>
<label>SQL Query</label><textarea id="sql"></textarea>
<div class="shortcuts">
<button class="btn-sm" onclick="q('SELECT id,name,email,role,is_active FROM users;')">users</button>
<button class="btn-sm" onclick="q('SELECT id,name,defined_price,unit,qty_available,is_active FROM products;')">products</button>
<button class="btn-sm" onclick="q('SELECT id,date,supplier_name,item,qty,total,paid_amount,due_amount,payment_status FROM purchases ORDER BY date DESC;')">purchases</button>
<button class="btn-sm" onclick="q('SELECT id,date,customer_name,product_name,qty,total,paid_amount,due_amount,payment_status FROM sales ORDER BY date DESC;')">sales</button>
<button class="btn-sm" onclick="q('SELECT * FROM customers;')">customers</button>
<button class="btn-sm" onclick="q('SELECT * FROM suppliers;')">suppliers</button>
<button class="btn-sm" onclick="q('SELECT * FROM raw_items;')">raw_items</button>
</div>
<button onclick="run()">Run Query</button>
<pre id="out">Results appear here...</pre>
<script>
function q(s){document.getElementById('sql').value=s;}
async function run(){
  const sql=document.getElementById('sql').value,pwd=document.getElementById('pwd').value;
  document.getElementById('out').textContent='Running...';
  try{const r=await fetch('/admin/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sql,password:pwd})});
  const d=await r.json();if(d.error){document.getElementById('out').textContent='Error: '+d.error;return;}
  const rows=d.rows;if(!rows||!rows.length){document.getElementById('out').textContent='OK. No rows.';return;}
  const cols=Object.keys(rows[0]);let out=cols.join(' | ')+'\n'+'-'.repeat(80)+'\n';
  rows.forEach(r=>{out+=cols.map(c=>String(r[c]??'NULL').substring(0,40)).join(' | ')+'\n';});
  out+='\n('+rows.length+' rows)';document.getElementById('out').textContent=out;
  }catch(e){document.getElementById('out').textContent='Error: '+e.message;}
}
</script></body></html>"""

@app.post("/admin/query")
def run_query(req:QueryRequest):
    if req.password!=ADMIN_PASSWORD: return {"error":"Wrong password"}
    if not req.sql.strip().upper().startswith(("SELECT","PRAGMA","WITH")): return {"error":"Only SELECT allowed"}
    try:
        with get_db() as db: return {"rows":[dict(r) for r in db.execute(req.sql).fetchall()]}
    except Exception as e: return {"error":str(e)}
