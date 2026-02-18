const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "tradesk_default_secret_change_me";

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "tradesk.db"));
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    supplier TEXT NOT NULL,
    item TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'units',
    unit_cost REAL NOT NULL,
    total REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    date TEXT NOT NULL,
    customer TEXT NOT NULL,
    item TEXT NOT NULL,
    qty REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'units',
    unit_price REAL NOT NULL,
    total REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
  CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
`);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post("/api/auth/register", [
  body("name").trim().notEmpty(),
  body("email").isEmail().normalizeEmail(),
  body("password").isLength({ min: 6 }),
], validate, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const r = db.prepare("INSERT INTO users (name,email,password) VALUES (?,?,?)").run(name, email, hashed);
    const token = jwt.sign({ id: r.lastInsertRowid, email, name }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: r.lastInsertRowid, name, email } });
  } catch (e) {
    if (e.message.includes("UNIQUE")) return res.status(409).json({ error: "Email already registered" });
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", [
  body("email").isEmail().normalizeEmail(),
  body("password").notEmpty(),
], validate, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: "Login failed" }); }
});

app.get("/api/auth/me", auth, (req, res) => {
  const user = db.prepare("SELECT id,name,email,created_at FROM users WHERE id=?").get(req.user.id);
  res.json(user);
});

// ─── PURCHASES ────────────────────────────────────────────────────────────────
app.get("/api/purchases", auth, (req, res) => {
  const { from, to } = req.query;
  let q = "SELECT * FROM purchases WHERE user_id=?", p = [req.user.id];
  if (from) { q += " AND date>=?"; p.push(from); }
  if (to)   { q += " AND date<=?"; p.push(to); }
  res.json(db.prepare(q + " ORDER BY date DESC").all(...p));
});

app.post("/api/purchases", auth, [
  body("date").isDate(), body("supplier").trim().notEmpty(),
  body("item").trim().notEmpty(), body("qty").isFloat({ min: 0.01 }),
  body("unit_cost").isFloat({ min: 0 }),
], validate, (req, res) => {
  const { date, supplier, item, qty, unit="units", unit_cost, notes } = req.body;
  const total = qty * unit_cost;
  const r = db.prepare("INSERT INTO purchases (user_id,date,supplier,item,qty,unit,unit_cost,total,notes) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(req.user.id, date, supplier, item, qty, unit, unit_cost, total, notes||null);
  res.status(201).json(db.prepare("SELECT * FROM purchases WHERE id=?").get(r.lastInsertRowid));
});

app.put("/api/purchases/:id", auth, (req, res) => {
  const p = db.prepare("SELECT * FROM purchases WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const { date, supplier, item, qty, unit, unit_cost, notes } = { ...p, ...req.body };
  const total = qty * unit_cost;
  db.prepare("UPDATE purchases SET date=?,supplier=?,item=?,qty=?,unit=?,unit_cost=?,total=?,notes=? WHERE id=?")
    .run(date, supplier, item, qty, unit, unit_cost, total, notes, req.params.id);
  res.json(db.prepare("SELECT * FROM purchases WHERE id=?").get(req.params.id));
});

app.delete("/api/purchases/:id", auth, (req, res) => {
  const r = db.prepare("DELETE FROM purchases WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: "Not found" });
  res.json({ success: true });
});

// ─── SALES ────────────────────────────────────────────────────────────────────
app.get("/api/sales", auth, (req, res) => {
  const { from, to } = req.query;
  let q = "SELECT * FROM sales WHERE user_id=?", p = [req.user.id];
  if (from) { q += " AND date>=?"; p.push(from); }
  if (to)   { q += " AND date<=?"; p.push(to); }
  res.json(db.prepare(q + " ORDER BY date DESC").all(...p));
});

app.post("/api/sales", auth, [
  body("date").isDate(), body("customer").trim().notEmpty(),
  body("item").trim().notEmpty(), body("qty").isFloat({ min: 0.01 }),
  body("unit_price").isFloat({ min: 0 }),
], validate, (req, res) => {
  const { date, customer, item, qty, unit="units", unit_price, notes } = req.body;
  const total = qty * unit_price;
  const r = db.prepare("INSERT INTO sales (user_id,date,customer,item,qty,unit,unit_price,total,notes) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(req.user.id, date, customer, item, qty, unit, unit_price, total, notes||null);
  res.status(201).json(db.prepare("SELECT * FROM sales WHERE id=?").get(r.lastInsertRowid));
});

app.put("/api/sales/:id", auth, (req, res) => {
  const s = db.prepare("SELECT * FROM sales WHERE id=? AND user_id=?").get(req.params.id, req.user.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  const { date, customer, item, qty, unit, unit_price, notes } = { ...s, ...req.body };
  const total = qty * unit_price;
  db.prepare("UPDATE sales SET date=?,customer=?,item=?,qty=?,unit=?,unit_price=?,total=?,notes=? WHERE id=?")
    .run(date, customer, item, qty, unit, unit_price, total, notes, req.params.id);
  res.json(db.prepare("SELECT * FROM sales WHERE id=?").get(req.params.id));
});

app.delete("/api/sales/:id", auth, (req, res) => {
  const r = db.prepare("DELETE FROM sales WHERE id=? AND user_id=?").run(req.params.id, req.user.id);
  if (!r.changes) return res.status(404).json({ error: "Not found" });
  res.json({ success: true });
});

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
app.get("/api/analytics/summary", auth, (req, res) => {
  const uid = req.user.id;
  const totalPurchases = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM purchases WHERE user_id=?").get(uid).v;
  const totalSales     = db.prepare("SELECT COALESCE(SUM(total),0) as v FROM sales WHERE user_id=?").get(uid).v;
  const purchaseCount  = db.prepare("SELECT COUNT(*) as c FROM purchases WHERE user_id=?").get(uid).c;
  const saleCount      = db.prepare("SELECT COUNT(*) as c FROM sales WHERE user_id=?").get(uid).c;
  const topSupplier    = db.prepare("SELECT supplier, SUM(total) as total FROM purchases WHERE user_id=? GROUP BY supplier ORDER BY total DESC LIMIT 1").get(uid);
  const topCustomer    = db.prepare("SELECT customer, SUM(total) as total FROM sales WHERE user_id=? GROUP BY customer ORDER BY total DESC LIMIT 1").get(uid);
  res.json({ totalPurchases, totalSales, profit: totalSales - totalPurchases, purchaseCount, saleCount, topSupplier, topCustomer });
});

app.get("/api/analytics/monthly", auth, (req, res) => {
  const uid = req.user.id;
  const pData = db.prepare("SELECT strftime('%Y-%m',date) as month, SUM(total) as total FROM purchases WHERE user_id=? GROUP BY month").all(uid);
  const sData = db.prepare("SELECT strftime('%Y-%m',date) as month, SUM(total) as total FROM sales WHERE user_id=? GROUP BY month").all(uid);
  const months = {};
  pData.forEach(r => { months[r.month] = { month: r.month, purchases: r.total, sales: 0 }; });
  sData.forEach(r => { if (!months[r.month]) months[r.month] = { month: r.month, purchases: 0, sales: 0 }; months[r.month].sales = r.total; });
  res.json(Object.values(months).sort((a,b) => a.month.localeCompare(b.month)).map(m => ({ ...m, profit: m.sales - m.purchases })));
});

app.get("/api/analytics/inventory", auth, (req, res) => {
  const uid = req.user.id;
  const bought = db.prepare("SELECT item, SUM(qty) as qty FROM purchases WHERE user_id=? GROUP BY item").all(uid);
  const sold   = db.prepare("SELECT item, SUM(qty) as qty FROM sales WHERE user_id=? GROUP BY item").all(uid);
  const map = {};
  bought.forEach(r => { map[r.item] = (map[r.item]||0) + r.qty; });
  sold.forEach(r => { map[r.item] = (map[r.item]||0) - r.qty; });
  res.json(Object.entries(map).map(([item, qty]) => ({ item, qty: Math.max(0, qty) })));
});

app.get("/health", (_, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`✅ TradDesk API running on http://localhost:${PORT}`));
