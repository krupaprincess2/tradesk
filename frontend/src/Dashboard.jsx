import { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Package, TrendingUp, ShoppingCart, Users, Plus, X, FileText, LogOut, RefreshCw } from "lucide-react";
import { purchasesApi, salesApi, analyticsApi } from "./api";
import { useAuth } from "./AuthContext";

const TABS = ["Dashboard","Purchases","Sales","Inventory","Invoices"];
const C = {
  bg:"#0f0f13",card:"#16161d",border:"#2a2a3a",accent:"#f0c040",
  green:"#3de898",red:"#f05e5e",muted:"#666680",text:"#e8e8f0",textDim:"#9999b0"
};
const fmt = n => `₹${Number(n).toLocaleString("en-IN")}`;

function StatCard({ icon:Icon, label, value, sub, color }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 24px", flex:1, minWidth:160 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
        <div style={{ background:color+"22", borderRadius:8, padding:8 }}><Icon size={18} color={color} /></div>
        <span style={{ color:C.textDim, fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
      </div>
      <div style={{ fontSize:26, fontWeight:700, color:C.text, fontFamily:"'Syne',sans-serif", letterSpacing:-1 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#000a", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:32, width:460, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:C.text }}>{title}</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted }}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({ label, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block", fontSize:12, color:C.textDim, marginBottom:6, fontFamily:"'DM Sans',sans-serif" }}>{label}</label>
      <input {...props} style={{ width:"100%", background:"#0f0f13", border:`1px solid ${C.border}`, borderRadius:8,
        padding:"10px 12px", color:C.text, fontSize:14, fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box", outline:"none" }} />
    </div>
  );
}

function Table({ cols, rows, emptyMsg }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>
        <thead>
          <tr style={{ borderBottom:`1px solid ${C.border}` }}>
            {cols.map(c => <th key={c} style={{ padding:"10px 14px", textAlign:"left", color:C.textDim, fontWeight:500, fontSize:12 }}>{c.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={cols.length} style={{ padding:"32px 14px", textAlign:"center", color:C.muted }}>{emptyMsg}</td></tr>
            : rows.map((row,i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${C.border}22` }}
                onMouseEnter={e=>e.currentTarget.style.background="#ffffff08"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                {Object.values(row).map((v,j) => <td key={j} style={{ padding:"12px 14px", color:C.text }}>{v}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

const emptyP = { date:"", supplier:"", item:"", qty:"", unit:"kg", unit_cost:"" };
const emptyS = { date:"", customer:"", item:"", qty:"", unit:"kg", unit_price:"" };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab]   = useState("Dashboard");
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales]         = useState([]);
  const [summary, setSummary]     = useState({ totalPurchases:0, totalSales:0, profit:0, purchaseCount:0, saleCount:0 });
  const [monthly, setMonthly]     = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showPModal, setShowPModal] = useState(false);
  const [showSModal, setShowSModal] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [pForm, setPForm] = useState(emptyP);
  const [sForm, setSForm] = useState(emptyS);
  const [saving, setSaving] = useState(false);

  const loadAll = async () => {
    setLoadingData(true);
    try {
      const [p, s, sum, mon, inv] = await Promise.all([
        purchasesApi.list(), salesApi.list(),
        analyticsApi.summary(), analyticsApi.monthly(), analyticsApi.inventory()
      ]);
      setPurchases(p); setSales(s); setSummary(sum); setMonthly(mon); setInventory(inv);
    } catch(e) { console.error(e); }
    finally { setLoadingData(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const addPurchase = async () => {
    if (!pForm.date||!pForm.supplier||!pForm.item||!pForm.qty||!pForm.unit_cost) return;
    setSaving(true);
    try {
      await purchasesApi.create({ ...pForm, qty:+pForm.qty, unit_cost:+pForm.unit_cost });
      await loadAll(); setPForm(emptyP); setShowPModal(false);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const addSale = async () => {
    if (!sForm.date||!sForm.customer||!sForm.item||!sForm.qty||!sForm.unit_price) return;
    setSaving(true);
    try {
      await salesApi.create({ ...sForm, qty:+sForm.qty, unit_price:+sForm.unit_price });
      await loadAll(); setSForm(emptyS); setShowSModal(false);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const deletePurchase = async (id) => {
    if (!confirm("Delete this purchase?")) return;
    await purchasesApi.remove(id); loadAll();
  };

  const deleteSale = async (id) => {
    if (!confirm("Delete this sale?")) return;
    await salesApi.remove(id); loadAll();
  };

  const trendData = monthly.map(m => ({
    ...m, month: new Date(m.month+"-01").toLocaleString("default",{month:"short",year:"2-digit"})
  }));

  const btnStyle = active => ({
    padding:"9px 20px", borderRadius:8, border:"none", cursor:"pointer", fontSize:14,
    fontFamily:"'DM Sans',sans-serif", fontWeight:500, transition:"all 0.15s",
    background: active ? C.accent : "transparent",
    color: active ? "#0f0f13" : C.textDim,
  });

  const addBtn = (label, onClick) => (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:7, background:C.accent, color:"#0f0f13",
      border:"none", borderRadius:9, padding:"10px 18px", cursor:"pointer", fontWeight:700, fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>
      <Plus size={16} />{label}
    </button>
  );

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap'); *{box-sizing:border-box;margin:0;} ::-webkit-scrollbar{width:5px;height:5px;} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}`}</style>
      <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:"16px 32px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:22, color:C.text }}>
              Trade<span style={{ color:C.accent }}>Desk</span>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>Welcome back, {user?.name}</div>
          </div>
          <div style={{ display:"flex", gap:12, alignItems:"center" }}>
            <button onClick={loadAll} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.textDim, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button onClick={logout} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 12px", color:C.textDim, cursor:"pointer", display:"flex", alignItems:"center", gap:6, fontSize:13 }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding:"0 32px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:4 }}>
          {TABS.map(t => <button key={t} onClick={() => setTab(t)} style={btnStyle(tab===t)}>{t}</button>)}
        </div>

        {loadingData && (
          <div style={{ textAlign:"center", padding:60, color:C.muted }}>Loading your data...</div>
        )}

        {!loadingData && (
          <div style={{ padding:"32px", maxWidth:1100, margin:"0 auto" }}>

            {/* DASHBOARD */}
            {tab==="Dashboard" && (
              <div>
                <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:32 }}>
                  <StatCard icon={ShoppingCart} label="Total Purchases" value={fmt(summary.totalPurchases)} sub={`${summary.purchaseCount} transactions`} color={C.accent} />
                  <StatCard icon={TrendingUp} label="Total Sales" value={fmt(summary.totalSales)} sub={`${summary.saleCount} transactions`} color={C.green} />
                  <StatCard icon={Package} label="Net Profit / Loss" value={fmt(summary.profit)} sub={summary.profit>=0?"▲ Profit":"▼ Loss"} color={summary.profit>=0?C.green:C.red} />
                  <StatCard icon={Users} label="Inventory Items" value={inventory.length} sub="unique goods" color="#a78bfa" />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:20 }}>Monthly Overview</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={trendData} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="month" stroke={C.muted} fontSize={11} />
                        <YAxis stroke={C.muted} fontSize={11} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text }} />
                        <Bar dataKey="purchases" fill={C.accent} radius={[4,4,0,0]} name="Purchases" />
                        <Bar dataKey="sales" fill={C.green} radius={[4,4,0,0]} name="Sales" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, marginBottom:20 }}>Profit Trend</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="month" stroke={C.muted} fontSize={11} />
                        <YAxis stroke={C.muted} fontSize={11} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text }} />
                        <Line type="monotone" dataKey="profit" stroke={C.green} strokeWidth={2.5} dot={{ fill:C.green, r:4 }} name="Profit" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {summary.topSupplier && (
                  <div style={{ display:"flex", gap:16 }}>
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 24px", flex:1 }}>
                      <div style={{ color:C.textDim, fontSize:12 }}>TOP SUPPLIER</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, marginTop:4 }}>{summary.topSupplier?.supplier}</div>
                      <div style={{ color:C.accent, fontSize:13 }}>{fmt(summary.topSupplier?.total)} purchased</div>
                    </div>
                    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"16px 24px", flex:1 }}>
                      <div style={{ color:C.textDim, fontSize:12 }}>TOP CUSTOMER</div>
                      <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, marginTop:4 }}>{summary.topCustomer?.customer}</div>
                      <div style={{ color:C.green, fontSize:13 }}>{fmt(summary.topCustomer?.total)} in sales</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PURCHASES */}
            {tab==="Purchases" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20 }}>Purchase Records</div>
                  {addBtn("Add Purchase", () => setShowPModal(true))}
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <Table
                    cols={["Date","Supplier","Item","Qty","Unit Cost","Total","Action"]}
                    rows={purchases.map(p => ({
                      date:p.date, supplier:p.supplier, item:p.item,
                      qty:`${p.qty} ${p.unit}`, unitCost:fmt(p.unit_cost), total:fmt(p.total),
                      action:<button onClick={()=>deletePurchase(p.id)} style={{ background:"none", border:`1px solid ${C.red}44`, borderRadius:6, padding:"4px 10px", color:C.red, cursor:"pointer", fontSize:12 }}>Delete</button>
                    }))}
                    emptyMsg="No purchases yet. Add your first purchase!"
                  />
                </div>
                <div style={{ marginTop:16, textAlign:"right", color:C.textDim, fontSize:14 }}>
                  Total spent: <strong style={{ color:C.accent }}>{fmt(summary.totalPurchases)}</strong>
                </div>
              </div>
            )}

            {/* SALES */}
            {tab==="Sales" && (
              <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20 }}>Sales Records</div>
                  {addBtn("Add Sale", () => setShowSModal(true))}
                </div>
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                  <Table
                    cols={["Date","Customer","Item","Qty","Unit Price","Total","Invoice","Action"]}
                    rows={sales.map(s => ({
                      date:s.date, customer:s.customer, item:s.item,
                      qty:`${s.qty} ${s.unit}`, unitPrice:fmt(s.unit_price), total:fmt(s.total),
                      invoice:<button onClick={()=>setShowInvoice(s)} style={{ background:"none", border:`1px solid ${C.border}`, borderRadius:6, padding:"4px 10px", color:C.textDim, cursor:"pointer", fontSize:12, display:"flex", alignItems:"center", gap:5 }}><FileText size={12}/>View</button>,
                      action:<button onClick={()=>deleteSale(s.id)} style={{ background:"none", border:`1px solid ${C.red}44`, borderRadius:6, padding:"4px 10px", color:C.red, cursor:"pointer", fontSize:12 }}>Delete</button>
                    }))}
                    emptyMsg="No sales yet. Add your first sale!"
                  />
                </div>
                <div style={{ marginTop:16, textAlign:"right", color:C.textDim, fontSize:14 }}>
                  Total earned: <strong style={{ color:C.green }}>{fmt(summary.totalSales)}</strong>
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {tab==="Inventory" && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, marginBottom:24 }}>Current Inventory</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:16, marginBottom:24 }}>
                  {inventory.length===0
                    ? <div style={{ color:C.muted }}>No inventory data yet.</div>
                    : inventory.map(inv => (
                      <div key={inv.item} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 28px", minWidth:180 }}>
                        <div style={{ color:C.textDim, fontSize:12, marginBottom:8 }}>IN STOCK</div>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:26, color:inv.qty>0?C.green:C.red }}>{inv.qty}</div>
                        <div style={{ color:C.text, marginTop:4 }}>{inv.item}</div>
                      </div>
                    ))}
                </div>
                {inventory.length > 0 && (
                  <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:24 }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={inventory} barSize={32}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                        <XAxis dataKey="item" stroke={C.muted} fontSize={12} />
                        <YAxis stroke={C.muted} fontSize={12} />
                        <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text }} />
                        <Bar dataKey="qty" fill={C.accent} radius={[6,6,0,0]} name="Stock" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* INVOICES */}
            {tab==="Invoices" && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:20, marginBottom:24 }}>Invoices</div>
                {sales.length===0
                  ? <div style={{ color:C.muted }}>No sales yet — add sales to generate invoices.</div>
                  : sales.map((s,i) => (
                    <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:600 }}>INV-{String(i+1).padStart(3,"0")}</div>
                        <div style={{ color:C.textDim, fontSize:13, marginTop:2 }}>{s.customer} · {s.date}</div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                        <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:C.green }}>{fmt(s.total)}</div>
                        <button onClick={()=>setShowInvoice(s)} style={{ background:C.accent, border:"none", borderRadius:8, padding:"8px 16px", cursor:"pointer", color:"#0f0f13", fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:5 }}>
                          <FileText size={14}/>View Invoice
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Add Purchase Modal */}
        {showPModal && (
          <Modal title="Add Purchase" onClose={()=>setShowPModal(false)}>
            <InputField label="Date" type="date" value={pForm.date} onChange={e=>setPForm(f=>({...f,date:e.target.value}))} />
            <InputField label="Supplier" type="text" placeholder="e.g. Alpha Traders" value={pForm.supplier} onChange={e=>setPForm(f=>({...f,supplier:e.target.value}))} />
            <InputField label="Item / Raw Good" type="text" placeholder="e.g. Raw Cotton" value={pForm.item} onChange={e=>setPForm(f=>({...f,item:e.target.value}))} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <InputField label="Quantity" type="number" value={pForm.qty} onChange={e=>setPForm(f=>({...f,qty:e.target.value}))} />
              <InputField label="Unit" type="text" value={pForm.unit} onChange={e=>setPForm(f=>({...f,unit:e.target.value}))} />
            </div>
            <InputField label="Unit Cost (₹)" type="number" value={pForm.unit_cost} onChange={e=>setPForm(f=>({...f,unit_cost:e.target.value}))} />
            {pForm.qty && pForm.unit_cost && (
              <div style={{ background:"#ffffff08", borderRadius:8, padding:"10px 14px", marginBottom:16, color:C.green, fontWeight:600 }}>
                Total: {fmt(pForm.qty * pForm.unit_cost)}
              </div>
            )}
            <button onClick={addPurchase} disabled={saving} style={{ width:"100%", background:C.accent, border:"none", borderRadius:9, padding:12, cursor:"pointer", fontWeight:700, fontSize:15, fontFamily:"'DM Sans',sans-serif", color:"#0f0f13", opacity:saving?0.7:1 }}>
              {saving?"Saving...":"Save Purchase"}
            </button>
          </Modal>
        )}

        {/* Add Sale Modal */}
        {showSModal && (
          <Modal title="Add Sale" onClose={()=>setShowSModal(false)}>
            <InputField label="Date" type="date" value={sForm.date} onChange={e=>setSForm(f=>({...f,date:e.target.value}))} />
            <InputField label="Customer" type="text" placeholder="e.g. Sunrise Textiles" value={sForm.customer} onChange={e=>setSForm(f=>({...f,customer:e.target.value}))} />
            <InputField label="Item Sold" type="text" placeholder="e.g. Processed Cotton" value={sForm.item} onChange={e=>setSForm(f=>({...f,item:e.target.value}))} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <InputField label="Quantity" type="number" value={sForm.qty} onChange={e=>setSForm(f=>({...f,qty:e.target.value}))} />
              <InputField label="Unit" type="text" value={sForm.unit} onChange={e=>setSForm(f=>({...f,unit:e.target.value}))} />
            </div>
            <InputField label="Unit Price (₹)" type="number" value={sForm.unit_price} onChange={e=>setSForm(f=>({...f,unit_price:e.target.value}))} />
            {sForm.qty && sForm.unit_price && (
              <div style={{ background:"#ffffff08", borderRadius:8, padding:"10px 14px", marginBottom:16, color:C.green, fontWeight:600 }}>
                Total: {fmt(sForm.qty * sForm.unit_price)}
              </div>
            )}
            <button onClick={addSale} disabled={saving} style={{ width:"100%", background:C.green, border:"none", borderRadius:9, padding:12, cursor:"pointer", fontWeight:700, fontSize:15, fontFamily:"'DM Sans',sans-serif", color:"#0f0f13", opacity:saving?0.7:1 }}>
              {saving?"Saving...":"Save Sale"}
            </button>
          </Modal>
        )}

        {/* Invoice Modal */}
        {showInvoice && (() => {
          const s = showInvoice;
          const idx = sales.findIndex(x=>x.id===s.id);
          return (
            <Modal title={`Invoice INV-${String(idx+1).padStart(3,"0")}`} onClose={()=>setShowInvoice(null)}>
              <div style={{ background:"#0f0f13", borderRadius:10, padding:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
                  <div>
                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color:C.accent }}>TradDesk</div>
                    <div style={{ color:C.textDim, fontSize:12 }}>Your Business</div>
                  </div>
                  <div style={{ textAlign:"right", color:C.textDim, fontSize:12 }}>
                    <div>Date: {s.date}</div>
                    <div>INV-{String(idx+1).padStart(3,"0")}</div>
                  </div>
                </div>
                <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:16, marginBottom:16 }}>
                  <div style={{ color:C.textDim, fontSize:12 }}>Bill To</div>
                  <div style={{ color:C.text, fontWeight:600, fontSize:15 }}>{s.customer}</div>
                </div>
                <table style={{ width:"100%", fontSize:13 }}>
                  <thead>
                    <tr style={{ color:C.textDim, borderBottom:`1px solid ${C.border}` }}>
                      <th style={{ textAlign:"left", padding:"6px 0" }}>Item</th>
                      <th style={{ textAlign:"right", padding:"6px 0" }}>Qty</th>
                      <th style={{ textAlign:"right", padding:"6px 0" }}>Rate</th>
                      <th style={{ textAlign:"right", padding:"6px 0" }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ color:C.text }}>
                      <td style={{ padding:"8px 0" }}>{s.item}</td>
                      <td style={{ textAlign:"right" }}>{s.qty} {s.unit}</td>
                      <td style={{ textAlign:"right" }}>{fmt(s.unit_price)}</td>
                      <td style={{ textAlign:"right" }}>{fmt(s.total)}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ borderTop:`1px solid ${C.border}`, marginTop:12, paddingTop:12, display:"flex", justifyContent:"space-between" }}>
                  <span style={{ fontWeight:700, color:C.text }}>Total</span>
                  <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, color:C.green, fontSize:18 }}>{fmt(s.total)}</span>
                </div>
              </div>
              <div style={{ color:C.muted, fontSize:12, textAlign:"center", marginTop:16 }}>Thank you for your business!</div>
            </Modal>
          );
        })()}
      </div>
    </>
  );
}
