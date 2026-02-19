import { useState, useEffect } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Package, TrendingUp, ShoppingCart, Plus, X, FileText, LogOut, RefreshCw, AlertCircle, CheckCircle, Phone, MapPin, History } from "lucide-react";
import { useAuth } from "./AuthContext";

const BASE = "/api";
const h = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("tradesk_token")}` });

const api = {
  get: (url) => fetch(`${BASE}${url}`, { headers: h() }).then(r => r.json()),
  post: (url, body) => fetch(`${BASE}${url}`, { method:"POST", headers: h(), body: JSON.stringify(body) }).then(async r => {
    const d = await r.json(); if (!r.ok) throw new Error(d.detail || "Failed"); return d;
  }),
  del: (url) => fetch(`${BASE}${url}`, { method:"DELETE", headers: h() }).then(r => r.json()),
};

const TABS = ["Dashboard","Purchases","Sales","Dues","Inventory","Invoices"];
const C = {
  bg:"#0a0a0f", card:"#13131a", card2:"#1a1a24", border:"#252535",
  accent:"#f0c040", green:"#2ecc71", red:"#e74c3c", orange:"#f39c12",
  blue:"#3498db", text:"#eeeef5", textDim:"#8888aa", muted:"#555570"
};
const fmt = n => `₹${Number(n||0).toLocaleString("en-IN")}`;
const payColor = s => s==="paid"?C.green:s==="partial"?C.orange:C.red;
const payLabel = s => s==="paid"?"✓ Paid":s==="partial"?"⏳ Partial":"✗ Unpaid";
const today = () => new Date().toISOString().split("T")[0];
const displayDate = d => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";

// ── UI Components ──────────────────────────────────────────────
function StatCard({ icon:Icon, label, value, sub, color }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 22px", flex:1, minWidth:150 }}>
      <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:10 }}>
        <div style={{ background:color+"22", borderRadius:7, padding:7 }}><Icon size={16} color={color}/></div>
        <span style={{ color:C.textDim, fontSize:11, letterSpacing:0.6 }}>{label}</span>
      </div>
      <div style={{ fontSize:22, fontWeight:700, color:C.text, fontFamily:"'Syne',sans-serif", letterSpacing:-0.5 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:C.textDim, marginTop:3 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000d", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:28, width:wide?620:460, maxWidth:"95vw", maxHeight:"92vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17, color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:13 }}>
      <label style={{ display:"block", fontSize:11, color:C.textDim, marginBottom:5, letterSpacing:0.8, textTransform:"uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const iStyle = { width:"100%", background:C.bg, border:`1px solid ${C.border}`, borderRadius:9, padding:"10px 13px", color:C.text, fontSize:14, fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box", outline:"none" };
function Input(props) { return <input {...props} style={iStyle}/>; }

// Date picker — shows calendar popup, displays formatted date
function DatePicker({ value, onChange }) {
  return (
    <div style={{ position:"relative" }}>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...iStyle, cursor:"pointer", colorScheme:"dark" }}
      />
    </div>
  );
}

function SelectInput({ options, value, onChange, placeholder }) {
  return (
    <select value={value} onChange={onChange} style={{ ...iStyle, cursor:"pointer" }}>
      <option value="">{placeholder||"Select..."}</option>
      {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
    </select>
  );
}

function Badge({ label, color }) {
  return <span style={{ background:color+"22", color, borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:600 }}>{label}</span>;
}

function Table({ cols, rows, emptyMsg }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {cols.map(c=><th key={c} style={{ padding:"9px 12px", textAlign:"left", color:C.textDim, fontWeight:500, fontSize:11, letterSpacing:0.7, textTransform:"uppercase", whiteSpace:"nowrap" }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{ padding:"40px", textAlign:"center", color:C.muted }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📭</div>{emptyMsg}
              </td></tr>
            : rows.map((row,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${C.border}18` }}
                onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {Object.values(row).map((v,j)=><td key={j} style={{ padding:"11px 12px", color:C.text }}>{v}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

const emptyP = { date:today(), supplier:"", item:"", qty:"", unit:"units", unit_cost:"" };
const emptyS = { date:today(), customer_name:"", customer_phone:"", customer_addr:"", item:"", qty:"", unit:"", unit_price:"", paid_amount:"" };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab]   = useState("Dashboard");
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales]         = useState([]);
  const [items, setItems]         = useState([]);
  const [dues, setDues]           = useState([]);
  const [summary, setSummary]     = useState({});
  const [monthly, setMonthly]     = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading]     = useState(true);

  const [showPModal, setShowPModal]   = useState(false);
  const [showSModal, setShowSModal]   = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [showHistory, setShowHistory] = useState(null);  // Payment history modal
  const [payHistory, setPayHistory]   = useState([]);

  const [pForm, setPForm] = useState(emptyP);
  const [sForm, setSForm] = useState(emptyS);
  const [payForm, setPayForm] = useState({ amount:"", date:today(), notes:"" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [p, s, i, d, sum, mon, inv] = await Promise.all([
        api.get("/purchases"), api.get("/sales"), api.get("/items"),
        api.get("/analytics/dues"), api.get("/analytics/summary"),
        api.get("/analytics/monthly"), api.get("/analytics/inventory"),
      ]);
      setPurchases(Array.isArray(p)?p:[]); setSales(Array.isArray(s)?s:[]);
      setItems(Array.isArray(i)?i:[]); setDues(Array.isArray(d)?d:[]);
      setSummary(sum||{}); setMonthly(Array.isArray(mon)?mon:[]);
      setInventory(Array.isArray(inv)?inv:[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // When item selected in sale, auto-fill unit from item master
  const onSelectSaleItem = (itemName) => {
    const found = items.find(i => i.name === itemName);
    setSForm(f => ({ ...f, item: itemName, unit: found?.unit || "units" }));
  };

  // Load payment history for a sale
  const openHistory = async (sale) => {
    const payments = await api.get(`/sales/${sale.id}/payments`);
    setPayHistory(Array.isArray(payments) ? payments : []);
    setShowHistory(sale);
  };

  const addPurchase = async () => {
    setError("");
    if (!pForm.date||!pForm.supplier||!pForm.item||!pForm.qty||!pForm.unit_cost) { setError("All fields are required"); return; }
    setSaving(true);
    try {
      await api.post("/purchases", { ...pForm, qty:+pForm.qty, unit_cost:+pForm.unit_cost });
      await loadAll(); setPForm(emptyP); setShowPModal(false);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const addSale = async () => {
    setError("");
    if (!sForm.date||!sForm.customer_name||!sForm.item||!sForm.qty||!sForm.unit_price) { setError("Date, customer, item, qty and price are required"); return; }
    setSaving(true);
    try {
      await api.post("/sales", { ...sForm, qty:+sForm.qty, unit_price:+sForm.unit_price, paid_amount:+(sForm.paid_amount||0) });
      await loadAll(); setSForm(emptyS); setShowSModal(false);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const addPayment = async () => {
    if (!payForm.amount || !payForm.date) return;
    setSaving(true);
    try {
      await api.post(`/sales/${showPayment.id}/payments`, { amount:+payForm.amount, date:payForm.date, notes:payForm.notes });
      await loadAll();
      setShowPayment(null); setPayForm({ amount:"", date:today(), notes:"" });
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const availableItems = items.filter(i => i.available_qty > 0);
  const saleTotal = sForm.qty && sForm.unit_price ? +sForm.qty * +sForm.unit_price : 0;
  const saleDue = Math.max(0, saleTotal - +(sForm.paid_amount||0));

  const trendData = monthly.map(m => ({
    ...m, month: new Date(m.month+"-01").toLocaleString("default",{month:"short",year:"2-digit"})
  }));

  const addBtn = (label, onClick, color=C.accent) => (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, background:color, color:color===C.accent?"#0a0a0f":C.text, border:"none", borderRadius:9, padding:"10px 18px", cursor:"pointer", fontWeight:700, fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
      <Plus size={14}/>{label}
    </button>
  );

  const tabStyle = active => ({
    padding:"10px 16px", borderRadius:"8px 8px 0 0", border:"none", cursor:"pointer", fontSize:13,
    fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.15s",
    background: active ? C.card2 : "transparent", color: active ? C.accent : C.textDim,
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
  });

  const saveBtn = (label, onClick) => (
    <button onClick={onClick} disabled={saving} style={{ width:"100%", background:C.accent, border:"none", borderRadius:9, padding:12, cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"'DM Sans',sans-serif", color:"#0a0a0f", opacity:saving?0.7:1, marginTop:4 }}>
      {saving?"Saving...":label}
    </button>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;} body{background:${C.bg};}
        select option{background:${C.card};}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      `}</style>

      <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"13px 26px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.card }}>
          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:19 }}>
            Trade<span style={{ color:C.accent }}>Desk</span>
            <span style={{ fontSize:10, color:C.textDim, fontWeight:400, marginLeft:10 }}>v2.0</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:12, color:C.textDim }}>👋 {user?.name}</span>
            <button onClick={loadAll} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 10px", color:C.textDim, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:12 }}><RefreshCw size={11}/>Refresh</button>
            <button onClick={logout} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:7, padding:"6px 10px", color:C.textDim, cursor:"pointer", display:"flex", alignItems:"center", gap:4, fontSize:12 }}><LogOut size={11}/>Logout</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding:"0 26px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:1, background:C.card }}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={tabStyle(tab===t)}>
              {t}{t==="Dues"&&dues.length>0&&<span style={{ background:C.red, color:"#fff", borderRadius:"50%", fontSize:10, padding:"1px 5px", marginLeft:4 }}>{dues.length}</span>}
            </button>
          ))}
        </div>

        {loading && <div style={{ textAlign:"center", padding:60, color:C.muted, fontSize:13 }}>Loading...</div>}

        {!loading && (
          <div style={{ padding:"26px", maxWidth:1200, margin:"0 auto" }}>

            {/* ── DASHBOARD ── */}
            {tab==="Dashboard" && (
              <div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:22 }}>
                  <StatCard icon={ShoppingCart} label="Total Purchases" value={fmt(summary.totalPurchases)} sub={`${summary.purchaseCount||0} transactions`} color={C.accent}/>
                  <StatCard icon={TrendingUp} label="Total Sales" value={fmt(summary.totalSales)} sub={`${summary.saleCount||0} transactions`} color={C.green}/>
                  <StatCard icon={CheckCircle} label="Collected" value={fmt(summary.totalCollected)} sub="Amount received" color={C.blue}/>
                  <StatCard icon={AlertCircle} label="Total Due" value={fmt(summary.totalDue)} sub={`${dues.length} pending`} color={C.red}/>
                  <StatCard icon={Package} label="Net Profit" value={fmt(summary.profit)} sub="Collected − Purchases" color={summary.profit>=0?C.green:C.red}/>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:22 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:18, fontSize:14 }}>Monthly Overview</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={trendData} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="month" stroke={C.muted} fontSize={10}/>
                        <YAxis stroke={C.muted} fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12 }}/>
                        <Bar dataKey="purchases" fill={C.accent} radius={[4,4,0,0]} name="Purchases"/>
                        <Bar dataKey="collected" fill={C.green} radius={[4,4,0,0]} name="Collected"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:22 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:18, fontSize:14 }}>Profit Trend</div>
                    <ResponsiveContainer width="100%" height={190}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="month" stroke={C.muted} fontSize={10}/>
                        <YAxis stroke={C.muted} fontSize={10} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:12 }}/>
                        <Line type="monotone" dataKey="profit" stroke={C.green} strokeWidth={2.5} dot={{ fill:C.green, r:4 }} name="Profit"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                  {summary.topSupplier && (
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", flex:1, minWidth:140 }}>
                      <div style={{ color:C.textDim, fontSize:10, letterSpacing:0.8, marginBottom:5 }}>TOP SUPPLIER</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700 }}>{summary.topSupplier?.supplier}</div>
                      <div style={{ color:C.accent, fontSize:12, marginTop:2 }}>{fmt(summary.topSupplier?.total)}</div>
                    </div>
                  )}
                  {summary.topCustomer && (
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", flex:1, minWidth:140 }}>
                      <div style={{ color:C.textDim, fontSize:10, letterSpacing:0.8, marginBottom:5 }}>TOP CUSTOMER</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700 }}>{summary.topCustomer?.customer_name}</div>
                      <div style={{ color:C.green, fontSize:12, marginTop:2 }}>{fmt(summary.topCustomer?.total)}</div>
                    </div>
                  )}
                  {dues.length>0 && (
                    <div style={{ background:"#e74c3c0d", border:`1px solid ${C.red}33`, borderRadius:12, padding:"14px 18px", flex:2, minWidth:180 }}>
                      <div style={{ color:C.red, fontSize:10, letterSpacing:0.8, marginBottom:8 }}>⚠️ PENDING DUES</div>
                      {dues.slice(0,3).map(d=>(
                        <div key={d.id} style={{ display:"flex", justifyContent:"space-between", marginBottom:4, fontSize:13 }}>
                          <span>{d.customer_name}</span>
                          <span style={{ color:C.red, fontWeight:600 }}>{fmt(d.due_amount)}</span>
                        </div>
                      ))}
                      {dues.length>3 && <div style={{ color:C.textDim, fontSize:11, marginTop:4 }}>+{dues.length-3} more in Dues tab</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── PURCHASES ── */}
            {tab==="Purchases" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:19 }}>Purchases</div>
                    <div style={{ color:C.textDim, fontSize:12, marginTop:2 }}>Items you buy are automatically available for sale</div>
                  </div>
                  {addBtn("Add Purchase", ()=>{setError("");setShowPModal(true);})}
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:22 }}>
                  <Table
                    cols={["Date","Supplier","Item","Qty","Unit Cost","Total","Action"]}
                    rows={purchases.map(p=>({
                      date:displayDate(p.date), supplier:p.supplier, item:p.item,
                      qty:`${p.qty} ${p.unit}`, cost:fmt(p.unit_cost), total:fmt(p.total),
                      action:<button onClick={()=>api.del(`/purchases/${p.id}`).then(loadAll)} style={{ background:"none", border:`1px solid ${C.red}44`, borderRadius:6, padding:"3px 9px", color:C.red, cursor:"pointer", fontSize:11 }}>Delete</button>
                    }))}
                    emptyMsg="No purchases yet. Add your first purchase!"
                  />
                </div>
                <div style={{ textAlign:"right", fontSize:13, color:C.textDim, marginTop:10 }}>Total spent: <strong style={{ color:C.accent }}>{fmt(summary.totalPurchases)}</strong></div>
              </div>
            )}

            {/* ── SALES ── */}
            {tab==="Sales" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:19 }}>Sales</div>
                    <div style={{ color:C.textDim, fontSize:12, marginTop:2 }}>Only items with available stock appear in the dropdown</div>
                  </div>
                  {addBtn("Add Sale", ()=>{setError("");setShowSModal(true);})}
                </div>
                {availableItems.length===0 && (
                  <div style={{ background:"#f0c04011", border:`1px solid ${C.accent}44`, borderRadius:10, padding:"13px 18px", marginBottom:14, fontSize:13, color:C.accent }}>
                    ⚠️ No stock available. Add purchases first!
                  </div>
                )}
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:22 }}>
                  <Table
                    cols={["Date","Customer","Phone","Item","Qty","Total","Paid","Due","Status","Actions"]}
                    rows={sales.map((s,i)=>({
                      date:displayDate(s.date),
                      customer:s.customer_name,
                      phone:s.customer_phone||"—",
                      item:s.item,
                      qty:`${s.qty} ${s.unit}`,
                      total:fmt(s.total),
                      paid:<span style={{ color:C.green, fontWeight:600 }}>{fmt(s.paid_amount)}</span>,
                      due:s.due_amount>0?<span style={{ color:C.red, fontWeight:600 }}>{fmt(s.due_amount)}</span>:<span style={{ color:C.green }}>—</span>,
                      status:<Badge label={payLabel(s.payment_status)} color={payColor(s.payment_status)}/>,
                      actions:(
                        <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                          {/* Payment history button */}
                          <button onClick={()=>openHistory(s)} style={{ background:C.blue+"22", border:`1px solid ${C.blue}44`, borderRadius:6, padding:"3px 9px", color:C.blue, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:3 }}><History size={10}/>History</button>
                          {/* Invoice */}
                          <button onClick={()=>setShowInvoice({...s,idx:i})} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"3px 9px", color:C.textDim, cursor:"pointer", fontSize:11, display:"flex", alignItems:"center", gap:3 }}><FileText size={10}/>Invoice</button>
                          {/* Pay button only if due */}
                          {s.due_amount>0&&<button onClick={()=>{setShowPayment(s);setPayForm({amount:s.due_amount,date:today(),notes:""});}} style={{ background:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:6, padding:"3px 9px", color:C.green, cursor:"pointer", fontSize:11 }}>+Pay</button>}
                          <button onClick={()=>api.del(`/sales/${s.id}`).then(loadAll)} style={{ background:"none", border:`1px solid ${C.red}44`, borderRadius:6, padding:"3px 9px", color:C.red, cursor:"pointer", fontSize:11 }}>Delete</button>
                        </div>
                      )
                    }))}
                    emptyMsg="No sales yet."
                  />
                </div>
              </div>
            )}

            {/* ── DUES ── */}
            {tab==="Dues" && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:19, marginBottom:5 }}>Pending Dues</div>
                <div style={{ color:C.textDim, fontSize:12, marginBottom:18 }}>All outstanding payments from customers</div>
                {dues.length===0
                  ? <div style={{ textAlign:"center", padding:60, color:C.muted }}><div style={{ fontSize:36, marginBottom:10 }}>🎉</div>No pending dues!</div>
                  : (
                    <div style={{ display:"grid", gap:12 }}>
                      {dues.map(d=>(
                        <div key={d.id} style={{ background:C.card, border:`1px solid ${C.red}33`, borderRadius:14, padding:"18px 22px" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:10 }}>
                            <div>
                              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:16, marginBottom:4 }}>{d.customer_name}</div>
                              <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
                                {d.customer_phone&&<span style={{ color:C.textDim, fontSize:12, display:"flex", alignItems:"center", gap:3 }}><Phone size={11}/>{d.customer_phone}</span>}
                                {d.customer_addr&&<span style={{ color:C.textDim, fontSize:12, display:"flex", alignItems:"center", gap:3 }}><MapPin size={11}/>{d.customer_addr}</span>}
                              </div>
                              <div style={{ marginTop:6, fontSize:12, color:C.textDim }}>{d.item} × {d.qty} {d.unit} · {displayDate(d.date)}</div>
                            </div>
                            <div style={{ textAlign:"right" }}>
                              <div style={{ fontSize:10, color:C.textDim }}>SALE TOTAL</div>
                              <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17 }}>{fmt(d.total)}</div>
                            </div>
                          </div>
                          <div style={{ margin:"14px 0 10px" }}>
                            <div style={{ height:7, background:C.border, borderRadius:4, overflow:"hidden" }}>
                              <div style={{ height:"100%", width:`${Math.min(100,(d.paid_amount/d.total)*100)}%`, background:C.green, borderRadius:4 }}/>
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:5, fontSize:12 }}>
                              <span style={{ color:C.green }}>✓ Paid: {fmt(d.paid_amount)}</span>
                              <span style={{ color:C.red }}>Due: {fmt(d.due_amount)}</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                            <div style={{ display:"flex", gap:8 }}>
                              <Badge label={payLabel(d.payment_status)} color={payColor(d.payment_status)}/>
                              <button onClick={()=>openHistory(d)} style={{ background:C.blue+"22", border:`1px solid ${C.blue}44`, borderRadius:7, padding:"5px 12px", color:C.blue, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                                <History size={12}/>View Transactions
                              </button>
                            </div>
                            <button onClick={()=>{setShowPayment(d);setPayForm({amount:d.due_amount,date:today(),notes:""});}} style={{ background:C.green, border:"none", borderRadius:9, padding:"8px 18px", cursor:"pointer", color:"#0a0a0f", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:5 }}>
                              <Plus size={13}/>Record Payment
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"13px 18px", display:"flex", justifyContent:"space-between" }}>
                        <span style={{ color:C.textDim }}>Total Outstanding</span>
                        <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:C.red, fontSize:17 }}>{fmt(summary.totalDue)}</span>
                      </div>
                    </div>
                  )}
              </div>
            )}

            {/* ── INVENTORY ── */}
            {tab==="Inventory" && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:19, marginBottom:5 }}>Inventory</div>
                <div style={{ color:C.textDim, fontSize:12, marginBottom:18 }}>Current stock = Purchased − Sold</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:22 }}>
                  {inventory.length===0
                    ? <div style={{ color:C.muted }}>No inventory yet.</div>
                    : inventory.map(inv=>(
                      <div key={inv.item} style={{ background:C.card, border:`1px solid ${inv.qty>0?C.border:C.red+"44"}`, borderRadius:12, padding:"16px 22px", minWidth:150 }}>
                        <div style={{ color:C.textDim, fontSize:10, letterSpacing:0.8, marginBottom:6 }}>IN STOCK</div>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:26, color:inv.qty>0?C.green:C.red }}>{inv.qty}</div>
                        <div style={{ color:C.text, marginTop:4, fontSize:13 }}>{inv.item}</div>
                        {inv.qty===0&&<div style={{ color:C.red, fontSize:11, marginTop:3 }}>Out of stock</div>}
                      </div>
                    ))}
                </div>
                {inventory.length>0&&(
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:22 }}>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={inventory} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="item" stroke={C.muted} fontSize={12}/>
                        <YAxis stroke={C.muted} fontSize={12}/>
                        <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text }}/>
                        <Bar dataKey="qty" fill={C.accent} radius={[6,6,0,0]} name="Stock"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* ── INVOICES ── */}
            {tab==="Invoices" && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:19, marginBottom:18 }}>Invoices</div>
                {sales.length===0
                  ? <div style={{ color:C.muted }}>No sales yet.</div>
                  : sales.map((s,i)=>(
                    <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9, flexWrap:"wrap", gap:10 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>INV-{String(i+1).padStart(3,"0")} · {s.customer_name}</div>
                        <div style={{ color:C.textDim, fontSize:12, marginTop:2 }}>{s.item} · {displayDate(s.date)}</div>
                        {s.customer_phone&&<div style={{ color:C.textDim, fontSize:11, marginTop:2, display:"flex", alignItems:"center", gap:3 }}><Phone size={10}/>{s.customer_phone}</div>}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:C.green }}>{fmt(s.total)}</div>
                          {s.due_amount>0&&<div style={{ fontSize:11, color:C.red }}>Due: {fmt(s.due_amount)}</div>}
                        </div>
                        <Badge label={payLabel(s.payment_status)} color={payColor(s.payment_status)}/>
                        <button onClick={()=>setShowInvoice({...s,idx:i})} style={{ background:C.accent, border:"none", borderRadius:7, padding:"7px 14px", cursor:"pointer", color:"#0a0a0f", fontWeight:700, fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                          <FileText size={12}/>Invoice
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── ADD PURCHASE MODAL ── */}
        {showPModal && (
          <Modal title="Add Purchase" onClose={()=>setShowPModal(false)}>
            <Field label="Date"><DatePicker value={pForm.date} onChange={v=>setPForm(f=>({...f,date:v}))}/></Field>
            <Field label="Supplier Name"><Input type="text" placeholder="e.g. Jewel Mart" value={pForm.supplier} onChange={e=>setPForm(f=>({...f,supplier:e.target.value}))}/></Field>
            <Field label="Item Name"><Input type="text" placeholder="e.g. Gold Chain, Silver Ring" value={pForm.item} onChange={e=>setPForm(f=>({...f,item:e.target.value}))}/></Field>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1 }}><Field label="Quantity"><Input type="number" placeholder="0" value={pForm.qty} onChange={e=>setPForm(f=>({...f,qty:e.target.value}))}/></Field></div>
              <div style={{ flex:1 }}><Field label="Unit (pcs/grams/sets)"><Input type="text" placeholder="pcs" value={pForm.unit} onChange={e=>setPForm(f=>({...f,unit:e.target.value}))}/></Field></div>
            </div>
            <Field label="Unit Cost (₹)"><Input type="number" placeholder="0" value={pForm.unit_cost} onChange={e=>setPForm(f=>({...f,unit_cost:e.target.value}))}/></Field>
            {pForm.qty&&pForm.unit_cost&&(
              <div style={{ background:"#2ecc7111", border:`1px solid ${C.green}44`, borderRadius:8, padding:"9px 13px", marginBottom:12, color:C.green, fontWeight:600, fontSize:14 }}>
                Total: {fmt(pForm.qty * pForm.unit_cost)}
              </div>
            )}
            {error&&<div style={{ color:C.red, fontSize:12, marginBottom:10 }}>{error}</div>}
            {saveBtn("Save Purchase", addPurchase)}
            <div style={{ marginTop:8, fontSize:11, color:C.textDim, textAlign:"center" }}>💡 New items auto-added to your item list</div>
          </Modal>
        )}

        {/* ── ADD SALE MODAL ── */}
        {showSModal && (
          <Modal title="Add Sale" onClose={()=>setShowSModal(false)} wide>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Field label="Date"><DatePicker value={sForm.date} onChange={v=>setSForm(f=>({...f,date:v}))}/></Field>
              <Field label="Select Item">
                <SelectInput
                  value={sForm.item}
                  onChange={e=>onSelectSaleItem(e.target.value)}
                  placeholder="— Choose purchased item —"
                  options={availableItems.map(i=>({ value:i.name, label:`${i.name} (${i.available_qty} ${i.unit} left)` }))}
                />
              </Field>
            </div>

            <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", marginBottom:13 }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:10, letterSpacing:0.8 }}>CUSTOMER DETAILS</div>
              <Field label="Customer Name"><Input type="text" placeholder="Full name" value={sForm.customer_name} onChange={e=>setSForm(f=>({...f,customer_name:e.target.value}))}/></Field>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1 }}><Field label="Phone"><Input type="text" placeholder="+91 99999 99999" value={sForm.customer_phone} onChange={e=>setSForm(f=>({...f,customer_phone:e.target.value}))}/></Field></div>
                <div style={{ flex:1 }}><Field label="Address"><Input type="text" placeholder="City / Area" value={sForm.customer_addr} onChange={e=>setSForm(f=>({...f,customer_addr:e.target.value}))}/></Field></div>
              </div>
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1 }}><Field label="Quantity"><Input type="number" placeholder="0" value={sForm.qty} onChange={e=>setSForm(f=>({...f,qty:e.target.value}))}/></Field></div>
              <div style={{ flex:1 }}><Field label="Unit"><Input type="text" value={sForm.unit} onChange={e=>setSForm(f=>({...f,unit:e.target.value}))}/></Field></div>
            </div>
            <Field label="Unit Price (₹)"><Input type="number" placeholder="0" value={sForm.unit_price} onChange={e=>setSForm(f=>({...f,unit_price:e.target.value}))}/></Field>

            {saleTotal > 0 && (
              <div style={{ background:C.card2, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", marginBottom:13 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
                  <span style={{ color:C.textDim }}>Sale Total</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:17 }}>{fmt(saleTotal)}</span>
                </div>
                <Field label="Amount Paid Now (₹) — 0 if fully unpaid">
                  <Input type="number" placeholder="0" value={sForm.paid_amount} onChange={e=>setSForm(f=>({...f,paid_amount:e.target.value}))}/>
                </Field>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:13 }}>
                  <span style={{ color:C.green }}>✓ Paid: {fmt(sForm.paid_amount||0)}</span>
                  <span style={{ color:C.red }}>Due: {fmt(saleDue)}</span>
                </div>
                <div style={{ height:5, background:C.border, borderRadius:3, marginTop:8, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${saleTotal>0?Math.min(100,((sForm.paid_amount||0)/saleTotal)*100):0}%`, background:C.green, borderRadius:3, transition:"width 0.2s" }}/>
                </div>
              </div>
            )}

            {error&&<div style={{ color:C.red, fontSize:12, marginBottom:10 }}>{error}</div>}
            {saveBtn("Save Sale", addSale)}
          </Modal>
        )}

        {/* ── PAYMENT HISTORY MODAL ── */}
        {showHistory && (
          <Modal title={`Payment History — ${showHistory.customer_name}`} onClose={()=>setShowHistory(null)}>
            <div style={{ background:C.card2, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:C.textDim }}>Item</span><span>{showHistory.item} × {showHistory.qty} {showHistory.unit}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:C.textDim }}>Sale Total</span><span style={{ fontWeight:700 }}>{fmt(showHistory.total)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ color:C.green }}>Total Paid</span><span style={{ color:C.green, fontWeight:700 }}>{fmt(showHistory.paid_amount)}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.red }}>Balance Due</span><span style={{ color:C.red, fontWeight:700 }}>{fmt(showHistory.due_amount)}</span>
              </div>
              <div style={{ height:5, background:C.border, borderRadius:3, marginTop:10, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,(showHistory.paid_amount/showHistory.total)*100)}%`, background:C.green, borderRadius:3 }}/>
              </div>
            </div>

            <div style={{ fontWeight:700, fontSize:13, marginBottom:10, color:C.textDim, letterSpacing:0.8 }}>ALL TRANSACTIONS ({payHistory.length})</div>

            {payHistory.length===0
              ? <div style={{ color:C.muted, textAlign:"center", padding:20, fontSize:13 }}>No payments recorded yet.</div>
              : payHistory.map((p,i)=>(
                <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:C.card2, borderRadius:9, marginBottom:8, border:`1px solid ${C.border}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:C.green }}>#{i+1} Payment</div>
                    <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{displayDate(p.date)} {p.notes?`· ${p.notes}`:""}</div>
                  </div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:C.green, fontSize:16 }}>{fmt(p.amount)}</div>
                </div>
              ))}

            {showHistory.due_amount > 0 && (
              <button onClick={()=>{setShowHistory(null);setShowPayment(showHistory);setPayForm({amount:showHistory.due_amount,date:today(),notes:""});}}
                style={{ width:"100%", background:C.green, border:"none", borderRadius:9, padding:11, cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"'DM Sans',sans-serif", color:"#0a0a0f", marginTop:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Plus size={14}/>Record New Payment
              </button>
            )}
          </Modal>
        )}

        {/* ── RECORD PAYMENT MODAL ── */}
        {showPayment && (
          <Modal title="Record Payment" onClose={()=>setShowPayment(null)}>
            <div style={{ background:C.card2, borderRadius:10, padding:"14px 16px", marginBottom:18 }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{showPayment.customer_name}</div>
              {showPayment.customer_phone&&<div style={{ color:C.textDim, fontSize:12, marginBottom:10 }}>{showPayment.customer_phone}</div>}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                <div><div style={{ fontSize:10, color:C.textDim }}>TOTAL</div><div style={{ fontWeight:700 }}>{fmt(showPayment.total)}</div></div>
                <div><div style={{ fontSize:10, color:C.textDim }}>PAID SO FAR</div><div style={{ fontWeight:700, color:C.green }}>{fmt(showPayment.paid_amount)}</div></div>
                <div><div style={{ fontSize:10, color:C.textDim }}>BALANCE DUE</div><div style={{ fontWeight:700, color:C.red }}>{fmt(showPayment.due_amount)}</div></div>
              </div>
              <div style={{ height:5, background:C.border, borderRadius:3, marginTop:10, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(100,(showPayment.paid_amount/showPayment.total)*100)}%`, background:C.green, borderRadius:3 }}/>
              </div>
            </div>
            <Field label="Amount Receiving Now (₹)"><Input type="number" placeholder={`Max ₹${showPayment.due_amount}`} value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}/></Field>
            <Field label="Date"><DatePicker value={payForm.date} onChange={v=>setPayForm(f=>({...f,date:v}))}/></Field>
            <Field label="Notes (optional)"><Input type="text" placeholder="e.g. Cash / UPI / Cheque" value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}/></Field>
            {saveBtn("Confirm Payment", addPayment)}
          </Modal>
        )}

        {/* ── INVOICE MODAL ── */}
        {showInvoice && (
          <Modal title={`Invoice INV-${String((showInvoice.idx||0)+1).padStart(3,"0")}`} onClose={()=>setShowInvoice(null)} wide>
            <div style={{ background:"#0a0a0f", borderRadius:12, padding:22 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:18 }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20, color:C.accent }}>TradDesk</div>
                  <div style={{ color:C.textDim, fontSize:11 }}>Business Invoice</div>
                </div>
                <div style={{ textAlign:"right", fontSize:11, color:C.textDim }}>
                  <div>Date: {displayDate(showInvoice.date)}</div>
                  <div>INV-{String((showInvoice.idx||0)+1).padStart(3,"0")}</div>
                </div>
              </div>
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:14, marginBottom:14 }}>
                <div style={{ fontSize:10, color:C.textDim, marginBottom:5, letterSpacing:0.8 }}>BILL TO</div>
                <div style={{ fontWeight:700, fontSize:15 }}>{showInvoice.customer_name}</div>
                {showInvoice.customer_phone&&<div style={{ color:C.textDim, fontSize:12, marginTop:3, display:"flex", alignItems:"center", gap:4 }}><Phone size={11}/>{showInvoice.customer_phone}</div>}
                {showInvoice.customer_addr&&<div style={{ color:C.textDim, fontSize:12, marginTop:2, display:"flex", alignItems:"center", gap:4 }}><MapPin size={11}/>{showInvoice.customer_addr}</div>}
              </div>
              <table style={{ width:"100%", fontSize:13, marginBottom:14 }}>
                <thead>
                  <tr style={{ color:C.textDim, borderBottom:`1px solid ${C.border}` }}>
                    <th style={{ textAlign:"left", padding:"5px 0" }}>Item</th>
                    <th style={{ textAlign:"right", padding:"5px 0" }}>Qty</th>
                    <th style={{ textAlign:"right", padding:"5px 0" }}>Rate</th>
                    <th style={{ textAlign:"right", padding:"5px 0" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding:"9px 0", color:C.text }}>{showInvoice.item}</td>
                    <td style={{ textAlign:"right", color:C.text }}>{showInvoice.qty} {showInvoice.unit}</td>
                    <td style={{ textAlign:"right", color:C.text }}>{fmt(showInvoice.unit_price)}</td>
                    <td style={{ textAlign:"right", color:C.text, fontWeight:600 }}>{fmt(showInvoice.total)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:13 }}>
                  <span style={{ color:C.textDim }}>Subtotal</span><span>{fmt(showInvoice.total)}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:13 }}>
                  <span style={{ color:C.green }}>Amount Paid</span><span style={{ color:C.green, fontWeight:600 }}>{fmt(showInvoice.paid_amount)}</span>
                </div>
                {showInvoice.due_amount>0
                  ? <div style={{ display:"flex", justifyContent:"space-between", background:`${C.red}11`, padding:"9px 12px", borderRadius:8, marginTop:6 }}>
                      <span style={{ color:C.red, fontWeight:600 }}>⚠️ Balance Due</span>
                      <span style={{ color:C.red, fontWeight:700, fontSize:17 }}>{fmt(showInvoice.due_amount)}</span>
                    </div>
                  : <div style={{ display:"flex", justifyContent:"space-between", background:`${C.green}11`, padding:"9px 12px", borderRadius:8, marginTop:6 }}>
                      <span style={{ color:C.green, fontWeight:600 }}>✓ Fully Paid</span>
                      <span style={{ color:C.green, fontWeight:700 }}>CLEARED</span>
                    </div>
                }
              </div>
              <div style={{ textAlign:"center", color:C.muted, fontSize:11, marginTop:14 }}>Thank you for your business!</div>
            </div>
          </Modal>
        )}
      </div>
    </>
  );
}
