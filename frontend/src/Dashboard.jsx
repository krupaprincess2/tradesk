import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Package, TrendingUp, ShoppingCart, Plus, X, FileText, LogOut, RefreshCw,
  AlertCircle, CheckCircle, Phone, MapPin, History, Search, Image, Users,
  AlertTriangle, RotateCcw, Shield, Eye, EyeOff } from "lucide-react";
import { useAuth } from "./AuthContext";

const BASE = "/api";
const h = (ct=true) => ({ ...(ct?{"Content-Type":"application/json"}:{}), Authorization:`Bearer ${localStorage.getItem("tradesk_token")}` });

const handleRes = async (r) => {
  const d = await r.json();
  if(!r.ok) throw new Error(d.detail||"Failed");
  return d;
};

const get = async url => {
  const r = await fetch(`${BASE}${url}`,{headers:h()});
  const d = await r.json();
  return Array.isArray(d) ? d : (d && typeof d === "object" ? d : []);
};
const post = (url,body) => fetch(`${BASE}${url}`,{method:"POST",headers:h(),body:JSON.stringify(body)}).then(handleRes);
const put  = (url,body) => fetch(`${BASE}${url}`,{method:"PUT",headers:h(),body:JSON.stringify(body)}).then(handleRes);
const del  = url => fetch(`${BASE}${url}`,{method:"DELETE",headers:h()}).then(handleRes);
const uploadImage = async (url, file) => {
  const fd = new FormData(); fd.append("file", file);
  const r = await fetch(`${BASE}${url}`,{method:"POST",headers:h(false),body:fd});
  return handleRes(r);
};

const C = {
  bg:"#0a0a0f",card:"#13131a",card2:"#1a1a24",border:"#252535",
  accent:"#f0c040",green:"#2ecc71",red:"#e74c3c",orange:"#f39c12",
  blue:"#3498db",purple:"#9b59b6",text:"#eeeef5",textDim:"#8888aa",muted:"#555570"
};
const fmt = n=>`₹${Number(n||0).toLocaleString("en-IN")}`;
const payColor = s=>s==="paid"?C.green:s==="partial"?C.orange:C.red;
const payLabel = s=>s==="paid"?"✓ Paid":s==="partial"?"⏳ Partial":"✗ Unpaid";
const today = ()=>new Date().toISOString().split("T")[0];
const fmtDate = d=>d?new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";

// ── UI Atoms ──────────────────────────────────────────────────
const iStyle = {width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 13px",color:C.text,fontSize:14,fontFamily:"'DM Sans',sans-serif",boxSizing:"border-box",outline:"none"};
function Input(props){return <input {...props} style={{...iStyle,...(props.style||{})}}/>;}
function DatePicker({value,onChange}){return <input type="date" value={value} onChange={e=>onChange(e.target.value)} style={{...iStyle,cursor:"pointer",colorScheme:"dark"}}/>;}
function SelectInput({options,value,onChange,placeholder}){
  return <select value={value} onChange={onChange} style={{...iStyle,cursor:"pointer"}}>
    <option value="">{placeholder||"Select..."}</option>
    {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
  </select>;
}
function Badge({label,color}){return <span style={{background:color+"22",color,borderRadius:6,padding:"3px 9px",fontSize:11,fontWeight:600}}>{label}</span>;}
function Field({label,children}){return <div style={{marginBottom:12}}><label style={{display:"block",fontSize:11,color:C.textDim,marginBottom:5,letterSpacing:0.8,textTransform:"uppercase"}}>{label}</label>{children}</div>;}

function Modal({title,onClose,children,wide}){
  return <div style={{position:"fixed",inset:0,background:"#000d",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:18,padding:28,width:wide?640:460,maxWidth:"96vw",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:C.text}}>{title}</span>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:C.muted}}><X size={20}/></button>
      </div>
      {children}
    </div>
  </div>;
}

function StatCard({icon:Icon,label,value,sub,color}){
  return <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"16px 20px",flex:1,minWidth:145}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{background:color+"22",borderRadius:7,padding:6}}><Icon size={15} color={color}/></div>
      <span style={{color:C.textDim,fontSize:11,letterSpacing:0.6}}>{label}</span>
    </div>
    <div style={{fontSize:20,fontWeight:700,color:C.text,fontFamily:"'Syne',sans-serif"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:C.textDim,marginTop:2}}>{sub}</div>}
  </div>;
}

function PayBar({paid,total}){
  const pct=total>0?Math.min(100,(paid/total)*100):0;
  return <div>
    <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${pct}%`,background:C.green,borderRadius:3,transition:"width 0.2s"}}/>
    </div>
  </div>;
}

function ImageUpload({onUpload,currentImage,label="Upload Image"}){
  const ref=useRef();
  return <div style={{marginBottom:12}}>
    <label style={{display:"block",fontSize:11,color:C.textDim,marginBottom:5,letterSpacing:0.8,textTransform:"uppercase"}}>{label}</label>
    <div style={{display:"flex",gap:10,alignItems:"center"}}>
      {currentImage && <img src={currentImage} alt="preview" style={{width:60,height:60,borderRadius:8,objectFit:"cover",border:`1px solid ${C.border}`}}/>}
      <button type="button" onClick={()=>ref.current?.click()} style={{background:C.card2,border:`1px dashed ${C.border}`,borderRadius:9,padding:"9px 16px",color:C.textDim,cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
        <Image size={14}/>Choose Image
      </button>
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files[0]&&onUpload(e.target.files[0])}/>
      <span style={{fontSize:11,color:C.muted}}>Max 5MB</span>
    </div>
  </div>;
}

// ── Tabs based on role ─────────────────────────────────────────
const ADMIN_TABS = ["Dashboard","Raw Goods","Products","Orders","Dues","Inventory","Invoices","Users","Suppliers"];
const STAFF_TABS = ["Raw Goods","Products","Orders","Dues","Inventory","Invoices"];

const emptyP = {date:today(),supplier_name:"",item:"",qty:"",unit:"units",unit_cost:"",paid_amount:"",low_stock_alert:""};
const emptyProd = {name:"",description:"",defined_price:"",unit:"pcs"};
const emptyS = {date:today(),customer_name:"",customer_phone:"",customer_addr:"",product_id:"",product_name:"",qty:"",unit:"pcs",defined_price:0,unit_price:"",paid_amount:""};

export default function Dashboard(){
  const {user,logout} = useAuth();
  const isAdmin = user?.role==="admin";
  const canEditDelete = isAdmin || user?.can_edit_delete===1;
  const TABS = isAdmin ? ADMIN_TABS : STAFF_TABS;

  const [tab,setTab]             = useState(isAdmin?"Dashboard":"Raw Goods");
  const [purchases,setPurchases] = useState([]);
  const [products,setProducts]   = useState([]);
  const [sales,setSales]         = useState([]);
  const [dues,setDues]           = useState([]);
  const [purchaseDues,setPurchaseDues] = useState([]);
  const [suppliers,setSuppliers] = useState([]);
  const [customers,setCustomers] = useState([]);
  const [inventory,setInventory] = useState([]);
  const [summary,setSummary]     = useState({});
  const [monthly,setMonthly]     = useState([]);
  const [users,setUsers]         = useState([]);
  const [loading,setLoading]     = useState(true);

  // Modals
  const [showPModal,setShowPModal]     = useState(false);
  const [showProdModal,setShowProdModal] = useState(false);
  const [showSModal,setShowSModal]     = useState(false);
  const [showInvoice,setShowInvoice]   = useState(null);
  const [showSalePay,setShowSalePay]   = useState(null);
  const [showPurchasePay,setShowPurchasePay] = useState(null);
  const [showHistory,setShowHistory]   = useState(null);
  const [historyData,setHistoryData]   = useState([]);
  const [historyType,setHistoryType]   = useState("sale");
  const [showAddUser,setShowAddUser]   = useState(false);
  const [showResetPwd,setShowResetPwd] = useState(null);
  const [showSupplier,setShowSupplier] = useState(false);
  const [showReturn,setShowReturn]     = useState(null);
  const [showEditProd,setShowEditProd] = useState(null);  // product being edited
  const [editProdForm,setEditProdForm] = useState({name:"",description:"",defined_price:"",unit:"pcs",qty_available:"",is_active:1});
  const [editProdImage,setEditProdImage] = useState(null);

  // Forms
  const [pForm,setPForm]     = useState(emptyP);
  const [prodForm,setProdForm] = useState(emptyProd);
  const [sForm,setSForm]     = useState(emptyS);
  const [payForm,setPayForm] = useState({amount:"",date:today(),notes:""});
  const [userForm,setUserForm] = useState({name:"",email:"",password:"",role:"staff"});
  const [resetPwd,setResetPwd] = useState({new_password:"",show:false});
  const [supplierForm,setSupplierForm] = useState({name:"",phone:"",address:"",notes:""});
  const [returnForm,setReturnForm] = useState({date:today(),notes:"",return_collected:0,return_owe:0});

  // Image states
  const [pImage,setPImage]   = useState(null);
  const [prodImage,setProdImage] = useState(null);

  const [returnDues,setReturnDues]     = useState([]);
  // Lightbox for image preview
  const [lightboxImg,setLightboxImg]   = useState(null);

  // Customer search
  const [custSearch,setCustSearch]     = useState("");
  const [custResults,setCustResults]   = useState([]);
  const [showCustDrop,setShowCustDrop] = useState(false);

  // Multi-product order items
  const [orderItems,setOrderItems] = useState([{product_id:"",product_name:"",qty:"",unit:"pcs",unit_price:"",defined_price:0}]);
  const [orderCustomer,setOrderCustomer] = useState({date:today(),customer_name:"",customer_phone:"",customer_addr:"",paid_amount:"",payment_notes:""});

  // Product builder - ingredients from raw goods + custom charges
  const [prodIngredients,setProdIngredients] = useState([]);
  const [prodCharges,setProdCharges] = useState([]);
  const [prodBuildMode,setProdBuildMode] = useState(false); // true = builder mode, false = simple mode
  const [saving,setSaving]             = useState(false);
  const [error,setError]               = useState("");
  const [priceWarning,setPriceWarning] = useState("");
  const [salesSearch,setSalesSearch]   = useState("");
  const [productsSearch,setProductsSearch] = useState("");
  const [rawGoodsPage,setRawGoodsPage] = useState(0);
  const [ordersPage,setOrdersPage]     = useState(0);
  const [prodPageNum,setProdPageNum]   = useState(0);
  const [purchasesSearch,setPurchasesSearch] = useState("");

  const loadAll = async()=>{
    setLoading(true);
    try{
      const calls = [
        get("/purchases"), get("/products"), get("/sales"),
        get("/analytics/dues"), get("/analytics/purchase-dues"),
        get("/suppliers"), get("/analytics/inventory"),
        get("/customers"), get("/analytics/return-dues"),
      ];
      if(isAdmin) calls.push(get("/analytics/summary"), get("/analytics/monthly"), get("/users"));
      const [p,pr,s,d,pd,sup,inv,cust,rd,...rest] = await Promise.all(calls);
      setPurchases(Array.isArray(p)?p:[]); setProducts(Array.isArray(pr)?pr:[]);
      setSales(Array.isArray(s)?s:[]); setDues(Array.isArray(d)?d:[]);
      setPurchaseDues(Array.isArray(pd)?pd:[]); setSuppliers(Array.isArray(sup)?sup:[]);
      setInventory(Array.isArray(inv)?inv:[]); setCustomers(Array.isArray(cust)?cust:[]);
      setReturnDues(Array.isArray(rd)?rd:[]);
      if(isAdmin){ setSummary(rest[0]||{}); setMonthly(Array.isArray(rest[1])?rest[1]:[]); setUsers(Array.isArray(rest[2])?rest[2]:[]); }
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  };

  useEffect(()=>{loadAll();},[]);

  // Customer search
  const searchCustomers = async(q)=>{
    setCustSearch(q);
    if(q.length<2){setCustResults([]);setShowCustDrop(false);return;}
    const res = await get(`/customers?q=${encodeURIComponent(q)}`);
    setCustResults(Array.isArray(res)?res:[]);
    setShowCustDrop(true);
  };

  const selectCustomer = (c)=>{
    setSForm(f=>({...f,customer_name:c.name,customer_phone:c.phone||"",customer_addr:c.address||""}));
    setCustSearch(c.name); setShowCustDrop(false);
  };

  // Product selection → price warning
  const onSelectProduct = (pid)=>{
    const prod = products.find(p=>String(p.id)===String(pid));
    if(!prod) return;
    setSForm(f=>({...f,product_id:pid,product_name:prod.name,unit:prod.unit,defined_price:prod.defined_price}));
    setPriceWarning("");
  };

  const onChangeSalePrice = (price)=>{
    setSForm(f=>({...f,unit_price:price}));
    const dp = sForm.defined_price;
    if(dp>0 && +price < dp){
      setPriceWarning(`⚠️ Selling below defined price! Defined: ${fmt(dp)}, You entered: ${fmt(price)}`);
    } else { setPriceWarning(""); }
  };

  // Add Purchase
  const addPurchase = async()=>{
    setError("");
    if(!pForm.date||!pForm.supplier_name||!pForm.item||!pForm.qty||!pForm.unit_cost){setError("All fields required");return;}
    setSaving(true);
    try{
      const res = await post("/purchases",{...pForm,qty:+pForm.qty,unit_cost:+pForm.unit_cost,paid_amount:+(pForm.paid_amount||0),low_stock_alert:+(pForm.low_stock_alert||0)});
      if(pImage) await uploadImage(`/purchases/${res.id}/image`,pImage);
      await loadAll(); setPForm(emptyP); setPImage(null); setShowPModal(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Add Product
  const addProduct = async()=>{
    setError("");
    if(!prodForm.name){setError("Product name required");return;}
    setSaving(true);
    try{
      let res;
      if(prodBuildMode){
        // Builder mode: ingredients + charges, auto-calc price
        if(prodIngredients.length===0&&prodCharges.length===0){setError("Add at least one ingredient or charge");setSaving(false);return;}
        res = await post("/products/build",{
          ...prodForm,
          defined_price:0,  // backend calculates
          ingredients: prodIngredients.filter(i=>i.item_name).map(i=>({...i,qty:+i.qty,unit_cost:+i.unit_cost})),
          charges: prodCharges.filter(c=>c.label&&c.amount).map(c=>({...c,amount:+c.amount}))
        });
      } else {
        if(!prodForm.defined_price){setError("Price required");setSaving(false);return;}
        res = await post("/products",{...prodForm,defined_price:+prodForm.defined_price});
      }
      if(prodImage) await uploadImage(`/products/${res.id}/image`,prodImage);
      await loadAll();
      setProdForm(emptyProd); setProdImage(null); setProdIngredients([]); setProdCharges([]); setProdBuildMode(false);
      setShowProdModal(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Add multi-product Order
  const addOrder = async()=>{
    setError("");
    if(!orderCustomer.date){setError("Order date is required");return;}
    if(!orderCustomer.customer_name){setError("Customer name is required");return;}
    const validItems = orderItems.filter(i=>i.product_name&&i.qty&&i.unit_price);
    if(validItems.length===0){setError("Add at least one product with qty and price");return;}
    setSaving(true);
    try{
      await post("/orders",{
        date:orderCustomer.date,
        customer_name:orderCustomer.customer_name,
        customer_phone:orderCustomer.customer_phone,
        customer_addr:orderCustomer.customer_addr,
        paid_amount:+(orderCustomer.paid_amount||0),
        payment_notes:orderCustomer.payment_notes,
        items: validItems.map(i=>({
          product_id:i.product_id||null,
          product_name:i.product_name,
          qty:+i.qty,
          unit:i.unit||"pcs",
          unit_price:+i.unit_price
        }))
      });
      await loadAll();
      setShowSModal(false);
      setOrderItems([{product_id:"",product_name:"",qty:"",unit:"pcs",unit_price:"",defined_price:0}]);
      setOrderCustomer({date:today(),customer_name:"",customer_phone:"",customer_addr:"",paid_amount:"",payment_notes:""});
      setPriceWarning("");
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Add Sale (legacy single-product)
  const addSale = async()=>{
    setError("");
    if(!sForm.date||!sForm.customer_name||!sForm.product_name||!sForm.qty||!sForm.unit_price){setError("Date, customer, product, qty and price required");return;}
    setSaving(true);
    try{
      await post("/sales",{...sForm,qty:+sForm.qty,unit_price:+sForm.unit_price,paid_amount:+(sForm.paid_amount||0),defined_price:+sForm.defined_price});
      await loadAll(); setSForm(emptyS); setCustSearch(""); setPriceWarning(""); setShowSModal(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Add Payment
  const addPayment = async(type)=>{
    if(!payForm.amount||!payForm.date) return;
    setSaving(true);
    try{
      if(type==="sale") await post(`/sales/${showSalePay.id}/payments`,payForm);
      else await post(`/purchases/${showPurchasePay.id}/payments`,payForm);
      await loadAll();
      setShowSalePay(null); setShowPurchasePay(null);
      setPayForm({amount:"",date:today(),notes:""});
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // View history
  const openHistory = async(item,type)=>{
    const url = type==="sale"?`/sales/${item.id}/payments`:`/purchases/${item.id}/payments`;
    const data = await get(url);
    setHistoryData(Array.isArray(data)?data:[]);
    setHistoryType(type); setShowHistory(item);
  };

  // Return sale
  const doReturn = async()=>{
    setSaving(true);
    try{
      await post(`/sales/${showReturn.id}/return`,returnForm);
      await loadAll(); setShowReturn(null);
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // Add User
  const addUser = async()=>{
    setError("");
    if(!userForm.name||!userForm.email||!userForm.password){setError("All fields required");return;}
    setSaving(true);
    try{
      await post("/users",userForm);
      await loadAll(); setUserForm({name:"",email:"",password:"",role:"staff"}); setShowAddUser(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Reset Password
  const doResetPwd = async()=>{
    if(!resetPwd.new_password||resetPwd.new_password.length<6){alert("Min 6 characters");return;}
    setSaving(true);
    try{
      await put(`/users/${showResetPwd.id}/reset-password`,{new_password:resetPwd.new_password});
      alert(`Password reset for ${showResetPwd.name}!`);
      setShowResetPwd(null); setResetPwd({new_password:"",show:false});
    }catch(e){alert(e.message);}
    finally{setSaving(false);}
  };

  // Toggle user
  const toggleUser = async(u)=>{
    await put(`/users/${u.id}/toggle`,{});
    await loadAll();
  };

  // Add Supplier
  const addSupplier = async()=>{
    setError("");
    if(!supplierForm.name){setError("Name required");return;}
    setSaving(true);
    try{
      await post("/suppliers",supplierForm);
      await loadAll(); setSupplierForm({name:"",phone:"",address:"",notes:""}); setShowSupplier(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  // Edit product
  const [editProdBuildInfo,setEditProdBuildInfo] = useState(null); // {ingredients,charges}
  const openEditProduct = async (prod) => {
    setEditProdForm({name:prod.name,description:prod.description||"",defined_price:prod.defined_price,unit:prod.unit,qty_available:prod.qty_available,is_active:prod.is_active});
    setEditProdImage(null);
    setEditProdBuildInfo(null);
    setShowEditProd(prod);
    setError("");
    // Fetch ingredients & charges if this is a builder product
    try {
      const info = await get(`/products/${prod.id}/build-info`);
      if(info && (info.ingredients?.length>0 || info.charges?.length>0)) {
        setEditProdBuildInfo(info);
      }
    } catch(e) {}
  };

  const saveEditProduct = async () => {
    setError("");
    if(!editProdForm.name||!editProdForm.defined_price){setError("Name and price required");return;}
    setSaving(true);
    try{
      const res = await put(`/products/${showEditProd.id}`,{...editProdForm,defined_price:+editProdForm.defined_price,qty_available:+editProdForm.qty_available,is_active:+editProdForm.is_active});
      if(editProdImage) await uploadImage(`/products/${res.id}/image`,editProdImage);
      await loadAll(); setShowEditProd(null); setEditProdImage(null);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  };

  const saleTotal  = +sForm.qty * +sForm.unit_price || 0;
  const saleDue    = Math.max(0, saleTotal - +(sForm.paid_amount||0));
  // Order totals (multi-product)
  const orderTotal = orderItems.reduce((sum,i)=>(sum + (+i.qty||0)*(+i.unit_price||0)),0);
  const orderDue   = Math.max(0, orderTotal - +(orderCustomer.paid_amount||0));
  // Product builder totals
  const ingredientsCost = prodIngredients.reduce((sum,i)=>(sum + (+i.qty||0)*(+i.unit_cost||0)),0);
  const chargesTotal = prodCharges.reduce((sum,c)=>(sum + (+c.amount||0)),0);
  const builderTotal = ingredientsCost + chargesTotal;
  const trendData  = monthly.map(m=>({...m,month:new Date(m.month+"-01").toLocaleString("default",{month:"short",year:"2-digit"})}));
  const totalDues  = dues.reduce((a,d)=>a+d.due_amount,0);
  const totalPurchaseDues = purchaseDues.reduce((a,d)=>a+d.due_amount,0);
  const lowStockItems = inventory.filter(i=>i.is_low);

  const saveBtn = (label,fn,color=C.accent)=>(
    <button onClick={fn} disabled={saving} style={{width:"100%",background:color,border:"none",borderRadius:9,padding:12,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:"'DM Sans',sans-serif",color:color===C.accent?"#0a0a0f":C.text,opacity:saving?0.7:1,marginTop:6}}>
      {saving?"Saving...":label}
    </button>
  );

  const tabStyle = active=>({
    padding:"9px 14px",borderRadius:"8px 8px 0 0",border:"none",cursor:"pointer",fontSize:12,
    fontFamily:"'DM Sans',sans-serif",fontWeight:500,transition:"all 0.15s",whiteSpace:"nowrap",
    background:active?C.card2:"transparent",color:active?C.accent:C.textDim,
    borderBottom:active?`2px solid ${C.accent}`:"2px solid transparent",
  });

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;} body{background:${C.bg};}
        select option{background:${C.card};}
        input[type="date"]::-webkit-calendar-picker-indicator{filter:invert(0.7);cursor:pointer;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;}
      `}</style>

      <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"'DM Sans',sans-serif"}}>

        {/* Header */}
        <div style={{padding:"12px 24px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",background:C.card}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18}}>
            Trade<span style={{color:C.accent}}>Desk</span>
            <span style={{fontSize:10,color:C.textDim,fontWeight:400,marginLeft:8}}>v3.0</span>
            {isAdmin&&<span style={{marginLeft:8,background:C.accent+"22",color:C.accent,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>ADMIN</span>}
            {!isAdmin&&<span style={{marginLeft:8,background:C.blue+"22",color:C.blue,borderRadius:5,padding:"2px 7px",fontSize:10,fontWeight:700}}>STAFF</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {lowStockItems.length>0&&<span style={{background:C.orange+"22",color:C.orange,borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:600}}>⚠️ {lowStockItems.length} Low Stock</span>}
            <span style={{fontSize:12,color:C.textDim}}>👋 {user?.name}</span>
            <button onClick={loadAll} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.textDim,cursor:"pointer",display:"flex",alignItems:"center",gap:3,fontSize:11}}><RefreshCw size={10}/>Refresh</button>
            <button onClick={logout} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 10px",color:C.textDim,cursor:"pointer",display:"flex",alignItems:"center",gap:3,fontSize:11}}><LogOut size={10}/>Logout</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{padding:"0 24px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:1,background:C.card,overflowX:"auto"}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={tabStyle(tab===t)}>
              {t}
              {t==="Dues"&&(dues.length+purchaseDues.length)>0&&<span style={{background:C.red,color:"#fff",borderRadius:"50%",fontSize:9,padding:"1px 5px",marginLeft:3}}>{dues.length+purchaseDues.length}</span>}
            </button>
          ))}
        </div>

        {loading&&<div style={{textAlign:"center",padding:60,color:C.muted,fontSize:13}}>Loading...</div>}

        {!loading&&(
          <div style={{padding:"24px",maxWidth:1300,margin:"0 auto"}}>

            {/* ── DASHBOARD (Admin only) ── */}
            {tab==="Dashboard"&&isAdmin&&(
              <div>
                {/* Low stock alert banner */}
                {lowStockItems.length>0&&(
                  <div style={{background:`${C.orange}11`,border:`1px solid ${C.orange}44`,borderRadius:10,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
                    <AlertTriangle size={16} color={C.orange}/>
                    <span style={{color:C.orange,fontSize:13}}>
                      <strong>Low Stock Alert:</strong> {lowStockItems.map(i=>i.name).join(", ")}
                    </span>
                  </div>
                )}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
                  <StatCard icon={ShoppingCart} label="Purchase Total" value={fmt(summary.totalPurchases)} sub={`Paid: ${fmt(summary.purchasePaid)} · Due: ${fmt(summary.purchaseDue)}`} color={C.accent}/>
                  <StatCard icon={TrendingUp} label="Sales Total" value={fmt(summary.totalSales)} sub={`${summary.saleCount||0} sales · ${summary.returnsCount||0} returns`} color={C.green}/>
                  <StatCard icon={CheckCircle} label="Collected" value={fmt(summary.saleCollected)} sub="From customers" color={C.blue}/>
                  <StatCard icon={AlertCircle} label="Customer Due" value={fmt(summary.saleDue)} sub={`${dues.length} pending`} color={C.red}/>
                  <StatCard icon={Package} label="Net Profit" value={fmt(summary.profit)} sub="Collected − Purchase Paid" color={summary.profit>=0?C.green:C.red}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:14,fontSize:14}}>Monthly Overview</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={trendData} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="month" stroke={C.muted} fontSize={9}/>
                        <YAxis stroke={C.muted} fontSize={9} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:11}}/>
                        <Bar dataKey="purchases" fill={C.accent} radius={[3,3,0,0]} name="Purchases"/>
                        <Bar dataKey="collected" fill={C.green} radius={[3,3,0,0]} name="Collected"/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,marginBottom:14,fontSize:14}}>Profit Trend</div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="month" stroke={C.muted} fontSize={9}/>
                        <YAxis stroke={C.muted} fontSize={9} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
                        <Tooltip formatter={v=>fmt(v)} contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,fontSize:11}}/>
                        <Line type="monotone" dataKey="profit" stroke={C.green} strokeWidth={2} dot={{fill:C.green,r:3}} name="Profit"/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {summary.topProduct&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px",flex:1,minWidth:130}}><div style={{color:C.textDim,fontSize:10,letterSpacing:0.8,marginBottom:4}}>TOP PRODUCT</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{summary.topProduct?.product_name}</div><div style={{color:C.green,fontSize:12,marginTop:2}}>{fmt(summary.topProduct?.total)}</div></div>}
                  {summary.topSupplier&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px",flex:1,minWidth:130}}><div style={{color:C.textDim,fontSize:10,letterSpacing:0.8,marginBottom:4}}>TOP SUPPLIER</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{summary.topSupplier?.supplier_name}</div><div style={{color:C.accent,fontSize:12,marginTop:2}}>{fmt(summary.topSupplier?.total)}</div></div>}
                  {summary.topCustomer&&<div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"14px 18px",flex:1,minWidth:130}}><div style={{color:C.textDim,fontSize:10,letterSpacing:0.8,marginBottom:4}}>TOP CUSTOMER</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700}}>{summary.topCustomer?.customer_name}</div><div style={{color:C.blue,fontSize:12,marginTop:2}}>{fmt(summary.topCustomer?.total)}</div></div>}
                  {(totalPurchaseDues>0)&&<div style={{background:`${C.orange}0d`,border:`1px solid ${C.orange}33`,borderRadius:12,padding:"14px 18px",flex:1,minWidth:130}}><div style={{color:C.orange,fontSize:10,letterSpacing:0.8,marginBottom:4}}>SUPPLIER DUES</div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.orange,fontSize:18}}>{fmt(totalPurchaseDues)}</div><div style={{color:C.textDim,fontSize:11}}>{purchaseDues.length} pending</div></div>}
                </div>
              </div>
            )}

            {/* ── RAW GOODS ── */}
            {tab==="Raw Goods"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>Raw Material Purchases</div>
                    <div style={{color:C.textDim,fontSize:12,marginTop:2}}>Track raw goods with partial payments and images · {purchases.length} total</div>
                  </div>
                  <button onClick={()=>{setError("");setShowPModal(true);}} style={{display:"flex",alignItems:"center",gap:6,background:C.accent,color:"#0a0a0f",border:"none",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}><Plus size={14}/>Add Purchase</button>
                </div>
                {purchaseDues.length>0&&(
                  <div style={{background:`${C.orange}0d`,border:`1px solid ${C.orange}33`,borderRadius:10,padding:"10px 16px",marginBottom:12,fontSize:12,color:C.orange}}>
                    ⚠️ Supplier dues pending: <strong>{fmt(totalPurchaseDues)}</strong> from {purchaseDues.length} purchase(s)
                  </div>
                )}

                {/* Search bar */}
                <div style={{position:"relative",marginBottom:14}}>
                  <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
                  <input type="text" placeholder="Search by supplier name or item..." value={purchasesSearch}
                    onChange={e=>{setPurchasesSearch(e.target.value);setRawGoodsPage(0);}}
                    style={{...iStyle,paddingLeft:36,paddingRight:purchasesSearch?36:13}}/>
                  {purchasesSearch&&<button onClick={()=>setPurchasesSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted}}><X size={14}/></button>}
                </div>

                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
                  {(()=>{
                    const filtered = purchasesSearch.trim()
                      ? purchases.filter(p=>
                          p.supplier_name?.toLowerCase().includes(purchasesSearch.toLowerCase()) ||
                          p.item?.toLowerCase().includes(purchasesSearch.toLowerCase()))
                      : purchases;
                    const PAGE_RG=10; const rgPages=Math.ceil(filtered.length/PAGE_RG);
                    const paginatedRG=filtered.slice(rawGoodsPage*PAGE_RG,(rawGoodsPage+1)*PAGE_RG);
                    return (
                  <div style={{overflowX:"auto"}}>
                    {purchasesSearch&&<div style={{fontSize:11,color:C.textDim,marginBottom:10}}>{filtered.length} result{filtered.length!==1?"s":""} for "{purchasesSearch}"</div>}
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Image","Date","Supplier","Item","Qty","Total","Paid","Due","Status","Actions"].map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",color:C.textDim,fontWeight:500,fontSize:10,letterSpacing:0.7,textTransform:"uppercase",whiteSpace:"nowrap"}}>{c}</th>)}
                      </tr></thead>
                      <tbody>
                        {filtered.length===0
                          ? <tr><td colSpan={10} style={{padding:40,textAlign:"center",color:C.muted}}>{purchasesSearch?"🔍 No results found":"📭 No raw goods yet"}</td></tr>
                          : paginatedRG.map((p,i)=>(
                          <tr key={p.id} style={{borderBottom:`1px solid ${C.border}18`}}
                            onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"10px 10px"}}>
                              {p.image_data
                                ? <img src={p.image_data} alt={p.item} onClick={()=>setLightboxImg(p.image_data)}
                                    style={{width:40,height:40,borderRadius:6,objectFit:"cover",cursor:"pointer",transition:"transform 0.15s"}}
                                    onMouseEnter={e=>e.target.style.transform="scale(1.12)"}
                                    onMouseLeave={e=>e.target.style.transform="scale(1)"}
                                    title="Click to enlarge"/>
                                : <div style={{width:40,height:40,background:C.card2,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:9}}>No img</div>}
                            </td>
                            <td style={{padding:"10px 10px",color:C.text,whiteSpace:"nowrap"}}>{fmtDate(p.date)}</td>
                            <td style={{padding:"10px 10px",color:C.text}}>{p.supplier_name}</td>
                            <td style={{padding:"10px 10px",color:C.text,fontWeight:600}}>{p.item}</td>
                            <td style={{padding:"10px 10px",color:C.text}}>{p.qty} {p.unit}</td>
                            <td style={{padding:"10px 10px",color:C.text,fontWeight:600}}>{fmt(p.total)}</td>
                            <td style={{padding:"10px 10px",color:C.green,fontWeight:600}}>{fmt(p.paid_amount)}</td>
                            <td style={{padding:"10px 10px",color:p.due_amount>0?C.red:C.green,fontWeight:600}}>{p.due_amount>0?fmt(p.due_amount):"—"}</td>
                            <td style={{padding:"10px 10px"}}><Badge label={payLabel(p.payment_status)} color={payColor(p.payment_status)}/></td>
                            <td style={{padding:"10px 10px"}}>
                              <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                <button onClick={()=>openHistory(p,"purchase")} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,borderRadius:5,padding:"3px 8px",color:C.blue,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",gap:2}}><History size={9}/>History</button>
                                {p.due_amount>0&&<button onClick={()=>{setShowPurchasePay(p);setPayForm({amount:p.due_amount,date:today(),notes:""});}} style={{background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:5,padding:"3px 8px",color:C.green,cursor:"pointer",fontSize:10}}>+Pay</button>}
                                {canEditDelete&&<button onClick={()=>del(`/purchases/${p.id}`).then(loadAll)} style={{background:"none",border:`1px solid ${C.red}44`,borderRadius:5,padding:"3px 8px",color:C.red,cursor:"pointer",fontSize:10}}>Del</button>}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                    {rgPages>1&&(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:16}}>
                        <button onClick={()=>setRawGoodsPage(p=>Math.max(0,p-1))} disabled={rawGoodsPage===0}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:rawGoodsPage===0?C.muted:C.text,cursor:rawGoodsPage===0?"not-allowed":"pointer",fontSize:12}}>← Prev</button>
                        <span style={{color:C.textDim,fontSize:12}}>Page {rawGoodsPage+1} of {rgPages}</span>
                        <button onClick={()=>setRawGoodsPage(p=>Math.min(rgPages-1,p+1))} disabled={rawGoodsPage===rgPages-1}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:rawGoodsPage===rgPages-1?C.muted:C.text,cursor:rawGoodsPage===rgPages-1?"not-allowed":"pointer",fontSize:12}}>Next →</button>
                      </div>
                    )}
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── PRODUCTS ── */}
            {tab==="Products"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>Products</div>
                    <div style={{color:C.textDim,fontSize:12,marginTop:2}}>Final products for sale · {products.length} total</div>
                  </div>
                  <button onClick={()=>{setError("");setProdForm(emptyProd);setProdImage(null);setProdIngredients([]);setProdCharges([]);setProdBuildMode(false);setShowProdModal(true);}} style={{display:"flex",alignItems:"center",gap:6,background:C.purple,color:C.text,border:"none",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}><Plus size={14}/>Add Product</button>
                </div>
                {/* Search */}
                <div style={{position:"relative",marginBottom:14}}>
                  <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
                  <input type="text" placeholder="Search by product name or description..." value={productsSearch}
                    onChange={e=>{setProductsSearch(e.target.value);setProdPageNum(0);}}
                    style={{...iStyle,paddingLeft:36,paddingRight:productsSearch?36:13}}/>
                  {productsSearch&&<button onClick={()=>setProductsSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted}}><X size={14}/></button>}
                </div>
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
                  {(()=>{
                    const filtered = productsSearch.trim()
                      ? products.filter(p=>p.name?.toLowerCase().includes(productsSearch.toLowerCase())||p.description?.toLowerCase().includes(productsSearch.toLowerCase()))
                      : products;
                    const PAGE=10; const pages=Math.ceil(filtered.length/PAGE);
                    const paginated=filtered.slice(prodPageNum*PAGE,(prodPageNum+1)*PAGE);
                    return(<>
                    {productsSearch&&<div style={{fontSize:11,color:C.textDim,marginBottom:10}}>{filtered.length} result{filtered.length!==1?"s":""} for "{productsSearch}"</div>}
                    <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                        {["Image","Product","Description","Price","Stock","Status","Actions"].map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",color:C.textDim,fontWeight:500,fontSize:10,letterSpacing:0.7,textTransform:"uppercase",whiteSpace:"nowrap"}}>{c}</th>)}
                      </tr></thead>
                      <tbody>
                        {paginated.length===0
                          ? <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:C.muted}}>{productsSearch?"🔍 No results found":"📭 No products yet"}</td></tr>
                          : paginated.map(prod=>(
                          <tr key={prod.id} style={{borderBottom:`1px solid ${C.border}18`}}
                            onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <td style={{padding:"8px 10px"}}>
                              {prod.image_data
                                ? <img src={prod.image_data} alt={prod.name} style={{width:48,height:48,objectFit:"cover",borderRadius:7,border:`1px solid ${C.border}`}}/>
                                : <div style={{width:48,height:48,background:C.card2,borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontSize:10}}>No img</div>}
                            </td>
                            <td style={{padding:"8px 10px",fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.text}}>{prod.name}</td>
                            <td style={{padding:"8px 10px",color:C.textDim,maxWidth:180}}>{prod.description||"—"}</td>
                            <td style={{padding:"8px 10px",color:C.accent,fontWeight:700,whiteSpace:"nowrap"}}>{fmt(prod.defined_price)}<span style={{color:C.muted,fontSize:10,fontWeight:400}}> /{prod.unit}</span></td>
                            <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                              <span style={{fontWeight:700,color:prod.qty_available>0?C.green:C.orange}}>{prod.qty_available}</span>
                              <span style={{color:C.muted,fontSize:10,marginLeft:4}}>{prod.unit}</span>
                            </td>
                            <td style={{padding:"8px 10px"}}><Badge label={prod.is_active?"Active":"Inactive"} color={prod.is_active?C.green:C.red}/></td>
                            <td style={{padding:"8px 10px"}}>
                              {canEditDelete&&(
                                <div style={{display:"flex",gap:4}}>
                                  <button onClick={()=>openEditProduct(prod)} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,borderRadius:5,padding:"4px 10px",color:C.blue,cursor:"pointer",fontSize:11,fontWeight:600}}>✏️ Edit</button>
                                  <button onClick={()=>del(`/products/${prod.id}`).then(loadAll)} style={{background:C.red+"18",border:`1px solid ${C.red}44`,borderRadius:5,padding:"4px 8px",color:C.red,cursor:"pointer",fontSize:11}}>Del</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                    {pages>1&&(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:16}}>
                        <button onClick={()=>setProdPageNum(p=>Math.max(0,p-1))} disabled={prodPage===0}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:prodPageNum===0?C.muted:C.text,cursor:prodPageNum===0?"not-allowed":"pointer",fontSize:12}}>← Prev</button>
                        {Array.from({length:pages},(_,i)=>(
                          <button key={i} onClick={()=>setProdPageNum(i)}
                            style={{background:i===prodPageNum?C.accent:C.card2,border:`1px solid ${i===prodPageNum?C.accent:C.border}`,borderRadius:7,padding:"5px 10px",color:i===prodPageNum?"#0a0a0f":C.text,cursor:"pointer",fontSize:12,fontWeight:i===prodPageNum?700:400}}>{i+1}</button>
                        ))}
                        <button onClick={()=>setProdPageNum(p=>Math.min(pages-1,p+1))} disabled={prodPage===pages-1}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:prodPageNum===pages-1?C.muted:C.text,cursor:prodPageNum===pages-1?"not-allowed":"pointer",fontSize:12}}>Next →</button>
                      </div>
                    )}
                    </>);
                  })()}
                </div>
              </div>
            )}

            {/* ── ORDERS ── */}
            {tab==="Orders"&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>Orders</div>
                    <div style={{color:C.textDim,fontSize:12,marginTop:2}}>Create orders with multiple products · track payments · {sales.length} total</div>
                  </div>
                  <button onClick={()=>{setError("");setPriceWarning("");setShowSModal(true);setOrderItems([{product_id:"",product_name:"",qty:"",unit:"pcs",unit_price:"",defined_price:0}]);}} style={{display:"flex",alignItems:"center",gap:6,background:C.green,color:"#0a0a0f",border:"none",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}><Plus size={14}/>New Order</button>
                </div>

                {/* Search bar above table */}
                <div style={{position:"relative",marginBottom:14}}>
                  <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}/>
                  <input
                    type="text"
                    placeholder="Search by customer name or phone number..."
                    value={salesSearch}
                    onChange={e=>{setSalesSearch(e.target.value);setOrdersPage(0);}}
                    style={{...iStyle,paddingLeft:36,paddingRight:salesSearch?36:13}}
                  />
                  {salesSearch&&<button onClick={()=>setSalesSearch("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.muted}}><X size={14}/></button>}
                </div>

                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:20}}>
                  {(()=>{
                    const filtered = salesSearch.trim()
                      ? sales.filter(s=>
                          s.customer_name?.toLowerCase().includes(salesSearch.toLowerCase()) ||
                          s.customer_phone?.includes(salesSearch))
                      : sales;
                    const PAGE_OR=10; const orPages=Math.ceil(filtered.length/PAGE_OR);
                    const paginatedOR=filtered.slice(ordersPage*PAGE_OR,(ordersPage+1)*PAGE_OR);
                    return (
                    <div style={{overflowX:"auto"}}>
                      {salesSearch&&<div style={{fontSize:11,color:C.textDim,marginBottom:10}}>{filtered.length} result{filtered.length!==1?"s":""} for "{salesSearch}"</div>}
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{borderBottom:`1px solid ${C.border}`}}>
                          {["Date","Customer","Phone","Product","Qty","Total","Paid","Due","Status","Actions"].map(c=><th key={c} style={{padding:"8px 10px",textAlign:"left",color:C.textDim,fontWeight:500,fontSize:10,letterSpacing:0.7,textTransform:"uppercase",whiteSpace:"nowrap"}}>{c}</th>)}
                        </tr></thead>
                        <tbody>
                          {filtered.length===0
                            ? <tr><td colSpan={10} style={{padding:40,textAlign:"center",color:C.muted}}>{salesSearch?"🔍 No results found":"📭 No sales yet"}</td></tr>
                            : paginatedOR.map((s,i)=>(
                            <tr key={s.id} style={{borderBottom:`1px solid ${C.border}18`,opacity:s.is_return?0.5:1}}
                              onMouseEnter={e=>e.currentTarget.style.background="#ffffff05"}
                              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                              <td style={{padding:"10px 10px",color:C.text,whiteSpace:"nowrap"}}>{fmtDate(s.date)}</td>
                              <td style={{padding:"10px 10px",color:C.text}}>{s.customer_name}{s.is_return&&<span style={{color:C.red,fontSize:10,marginLeft:4}}>RETURNED</span>}</td>
                              <td style={{padding:"10px 10px",color:C.textDim}}>{s.customer_phone||"—"}</td>
                              <td style={{padding:"10px 10px",color:C.text,fontWeight:600,maxWidth:200}}>
                                {s.order_items&&s.order_items.length>0
                                  ? <div>{s.order_items.map((oi,k)=>(
                                      <div key={k} style={{fontSize:11,marginBottom:2}}>
                                        <span style={{fontWeight:600}}>{oi.product_name}</span>
                                        <span style={{color:C.textDim,fontWeight:400}}> × {oi.qty}</span>
                                      </div>
                                    ))}</div>
                                  : <span>{s.product_name||"—"}</span>}
                              </td>
                              <td style={{padding:"10px 10px",color:C.text}}>
                                {s.order_items&&s.order_items.length>0
                                  ? <span style={{color:C.textDim,fontSize:11}}>{s.order_items.length} item{s.order_items.length!==1?"s":""}</span>
                                  : <span>{s.qty} {s.unit}</span>}
                              </td>
                              <td style={{padding:"10px 10px",fontWeight:600}}>{fmt(s.total)}</td>
                              <td style={{padding:"10px 10px",color:C.green,fontWeight:600}}>{fmt(s.paid_amount)}</td>
                              <td style={{padding:"10px 10px",color:s.due_amount>0?C.red:C.green,fontWeight:600}}>{s.due_amount>0?fmt(s.due_amount):"—"}</td>
                              <td style={{padding:"10px 10px"}}><Badge label={payLabel(s.payment_status)} color={payColor(s.payment_status)}/></td>
                              <td style={{padding:"10px 10px"}}>
                                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                  <button onClick={()=>openHistory(s,"sale")} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,borderRadius:5,padding:"3px 8px",color:C.blue,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",gap:2}}><History size={9}/>History</button>
                                  <button onClick={()=>setShowInvoice({...s,idx:i})} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 8px",color:C.textDim,cursor:"pointer",fontSize:10}}><FileText size={9}/></button>
                                  {s.due_amount>0&&!s.is_return&&<button onClick={()=>{setShowSalePay(s);setPayForm({amount:s.due_amount,date:today(),notes:""});}} style={{background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:5,padding:"3px 8px",color:C.green,cursor:"pointer",fontSize:10}}>+Pay</button>}
                                  {!s.is_return&&<button onClick={()=>setShowReturn(s)} style={{background:C.orange+"22",border:`1px solid ${C.orange}44`,borderRadius:5,padding:"3px 8px",color:C.orange,cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",gap:2}}><RotateCcw size={9}/>Return</button>}
                                  {canEditDelete&&<button onClick={()=>del(`/sales/${s.id}`).then(loadAll)} style={{background:"none",border:`1px solid ${C.red}44`,borderRadius:5,padding:"3px 8px",color:C.red,cursor:"pointer",fontSize:10}}>Del</button>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {orPages>1&&(
                      <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:8,marginTop:16}}>
                        <button onClick={()=>setOrdersPage(p=>Math.max(0,p-1))} disabled={ordersPage===0}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:ordersPage===0?C.muted:C.text,cursor:ordersPage===0?"not-allowed":"pointer",fontSize:12}}>← Prev</button>
                        <span style={{color:C.textDim,fontSize:12}}>Page {ordersPage+1} of {orPages}</span>
                        <button onClick={()=>setOrdersPage(p=>Math.min(orPages-1,p+1))} disabled={ordersPage===orPages-1}
                          style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:7,padding:"5px 12px",color:ordersPage===orPages-1?C.muted:C.text,cursor:ordersPage===orPages-1?"not-allowed":"pointer",fontSize:12}}>Next →</button>
                      </div>
                    )}
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── DUES ── */}
            {tab==="Dues"&&(
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:5}}>Dues</div>
                <div style={{color:C.textDim,fontSize:12,marginBottom:16}}>Customer dues + supplier dues in one place</div>

                {/* Customer Dues */}
                {dues.length>0&&(
                  <div style={{marginBottom:24}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:12,color:C.red}}>Customer Dues — {fmt(totalDues)}</div>
                    <div style={{display:"grid",gap:10}}>
                      {dues.map(d=>(
                        <div key={d.id} style={{background:C.card,border:`1px solid ${C.red}33`,borderRadius:12,padding:"16px 20px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                            <div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{d.customer_name}</div>
                              <div style={{display:"flex",gap:12,marginTop:3}}>
                                {d.customer_phone&&<span style={{color:C.textDim,fontSize:12,display:"flex",alignItems:"center",gap:3}}><Phone size={10}/>{d.customer_phone}</span>}
                                {d.customer_addr&&<span style={{color:C.textDim,fontSize:12,display:"flex",alignItems:"center",gap:3}}><MapPin size={10}/>{d.customer_addr}</span>}
                              </div>
                              <div style={{color:C.textDim,fontSize:12,marginTop:4}}>{d.product_name} × {d.qty} · {fmtDate(d.date)}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{fmt(d.total)}</div>
                            </div>
                          </div>
                          <PayBar paid={d.paid_amount} total={d.total}/>
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12}}>
                            <span style={{color:C.green}}>✓ Paid: {fmt(d.paid_amount)}</span>
                            <span style={{color:C.red}}>Due: {fmt(d.due_amount)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                            <div style={{display:"flex",gap:6}}>
                              <Badge label={payLabel(d.payment_status)} color={payColor(d.payment_status)}/>
                              <button onClick={()=>openHistory(d,"sale")} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,borderRadius:6,padding:"4px 10px",color:C.blue,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><History size={10}/>Transactions</button>
                            </div>
                            <button onClick={()=>{setShowSalePay(d);setPayForm({amount:d.due_amount,date:today(),notes:""});}} style={{background:C.green,border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",color:"#0a0a0f",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Plus size={12}/>Record Payment</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Supplier/Purchase Dues */}
                {purchaseDues.length>0&&(
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:12,color:C.orange}}>Supplier Dues — {fmt(totalPurchaseDues)}</div>
                    <div style={{display:"grid",gap:10}}>
                      {purchaseDues.map(p=>(
                        <div key={p.id} style={{background:C.card,border:`1px solid ${C.orange}33`,borderRadius:12,padding:"16px 20px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                            <div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{p.supplier_name}</div>
                              <div style={{color:C.textDim,fontSize:12,marginTop:4}}>{p.item} × {p.qty} {p.unit} · {fmtDate(p.date)}</div>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16}}>{fmt(p.total)}</div>
                            </div>
                          </div>
                          <PayBar paid={p.paid_amount} total={p.total}/>
                          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:12}}>
                            <span style={{color:C.green}}>✓ Paid: {fmt(p.paid_amount)}</span>
                            <span style={{color:C.orange}}>Due: {fmt(p.due_amount)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
                            <button onClick={()=>openHistory(p,"purchase")} style={{background:C.blue+"22",border:`1px solid ${C.blue}44`,borderRadius:6,padding:"4px 10px",color:C.blue,cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",gap:3}}><History size={10}/>Transactions</button>
                            <button onClick={()=>{setShowPurchasePay(p);setPayForm({amount:p.due_amount,date:today(),notes:""});}} style={{background:C.orange,border:"none",borderRadius:8,padding:"7px 16px",cursor:"pointer",color:"#0a0a0f",fontWeight:700,fontSize:12,display:"flex",alignItems:"center",gap:4}}><Plus size={12}/>Pay Supplier</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dues.length===0&&purchaseDues.length===0&&(
                  <div style={{textAlign:"center",padding:60,color:C.muted}}><div style={{fontSize:36,marginBottom:10}}>🎉</div>No pending dues!</div>
                )}

                {/* Return Refunds Owed */}
                {returnDues.length>0&&(
                  <div style={{marginTop:24}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14,marginBottom:12,color:C.purple}}>
                      Refunds Owed to Customers — {fmt(returnDues.reduce((a,r)=>a+(r.return_owe-r.return_paid_back),0))}
                    </div>
                    <div style={{display:"grid",gap:10}}>
                      {returnDues.map(r=>{
                        const owed=r.return_owe||0;
                        const paidBack=r.return_paid_back||0;
                        const remaining=Math.max(0,owed-paidBack);
                        return(
                        <div key={r.id} style={{background:C.card,border:`1px solid ${C.purple}44`,borderRadius:12,padding:"16px 20px"}}>
                          <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:10}}>
                            <div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15}}>{r.customer_name}</div>
                              <div style={{color:C.textDim,fontSize:12,marginTop:3}}>{r.product_name} × {r.qty} · Returned {fmtDate(r.return_date)}</div>
                              {r.customer_phone&&<div style={{color:C.textDim,fontSize:12,marginTop:2,display:"flex",alignItems:"center",gap:3}}><Phone size={9}/>{r.customer_phone}</div>}
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:10,color:C.textDim}}>ORIGINAL SALE</div>
                              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:14}}>{fmt(r.total)}</div>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:12,fontSize:12,marginBottom:10,background:C.card2,borderRadius:8,padding:"10px 14px",flexWrap:"wrap"}}>
                            <div><div style={{color:C.textDim,fontSize:10}}>CUSTOMER PAID</div><div style={{fontWeight:700,color:C.green,fontSize:15}}>{fmt(r.return_collected)}</div></div>
                            <div style={{color:C.border,fontSize:18,alignSelf:"center"}}>→</div>
                            <div><div style={{color:C.textDim,fontSize:10}}>YOU OWE BACK</div><div style={{fontWeight:700,color:C.purple,fontSize:15}}>{fmt(owed)}</div></div>
                            <div style={{color:C.border,fontSize:18,alignSelf:"center"}}>−</div>
                            <div><div style={{color:C.textDim,fontSize:10}}>PAID BACK</div><div style={{fontWeight:700,color:C.blue,fontSize:15}}>{fmt(paidBack)}</div></div>
                            <div style={{color:C.border,fontSize:18,alignSelf:"center"}}>=</div>
                            <div><div style={{color:C.textDim,fontSize:10}}>STILL TO RETURN</div><div style={{fontWeight:700,color:remaining>0?C.red:C.green,fontSize:15}}>{remaining>0?fmt(remaining):"✓ Done"}</div></div>
                          </div>
                          <PayBar paid={paidBack} total={owed}/>
                          {remaining>0&&(
                            <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
                              <button onClick={()=>{
                                const amt=prompt(`Refund amount to ${r.customer_name} (remaining: ₹${remaining}):`);
                                if(!amt||isNaN(amt)) return;
                                post(`/sales/${r.id}/return-payback`,{amount:+amt,date:today(),notes:"Refund to customer"})
                                  .then(loadAll).catch(e=>alert(e.message));
                              }} style={{background:C.purple,border:"none",borderRadius:8,padding:"8px 18px",cursor:"pointer",color:C.text,fontWeight:700,fontSize:12}}>
                                + Record Refund Payment
                              </button>
                            </div>
                          )}
                        </div>
                      );})}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── INVENTORY ── */}
            {tab==="Inventory"&&(
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:5}}>Raw Material Inventory</div>
                <div style={{color:C.textDim,fontSize:12,marginBottom:16}}>Current stock of raw materials</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:20}}>
                  {inventory.length===0
                    ? <div style={{color:C.muted}}>No inventory yet.</div>
                    : inventory.map(inv=>(
                    <div key={inv.name} style={{background:C.card,border:`1px solid ${inv.is_low?C.orange+"66":C.border}`,borderRadius:12,padding:"16px 20px",minWidth:150}}>
                      {inv.is_low&&<div style={{color:C.orange,fontSize:10,marginBottom:4,display:"flex",alignItems:"center",gap:3}}><AlertTriangle size={10}/>LOW STOCK</div>}
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:26,color:inv.is_low?C.orange:C.green}}>{inv.available||inv.purchased}</div>
                      <div style={{color:C.text,marginTop:3,fontSize:13}}>{inv.name}</div>
                      <div style={{color:C.textDim,fontSize:11}}>{inv.unit}</div>
                      {inv.low_stock_threshold>0&&<div style={{color:C.textDim,fontSize:10,marginTop:4}}>Alert at: {inv.low_stock_threshold}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── INVOICES ── */}
            {tab==="Invoices"&&(
              <div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:16}}>Invoices</div>
                {sales.filter(s=>!s.is_return).map((s,i)=>(
                  <div key={s.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:11,padding:"13px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:8}}>
                    <div>
                      <div style={{fontWeight:600,fontSize:13}}>INV-{String(i+1).padStart(3,"0")} · {s.customer_name}</div>
                      <div style={{color:C.textDim,fontSize:11,marginTop:2}}>{s.product_name} · {fmtDate(s.date)}</div>
                      {s.customer_phone&&<div style={{color:C.textDim,fontSize:11,marginTop:1,display:"flex",alignItems:"center",gap:3}}><Phone size={9}/>{s.customer_phone}</div>}
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.green,fontSize:14}}>{fmt(s.total)}</div>
                        {s.due_amount>0&&<div style={{fontSize:10,color:C.red}}>Due: {fmt(s.due_amount)}</div>}
                      </div>
                      <Badge label={payLabel(s.payment_status)} color={payColor(s.payment_status)}/>
                      <button onClick={()=>setShowInvoice({...s,idx:i})} style={{background:C.accent,border:"none",borderRadius:7,padding:"6px 13px",cursor:"pointer",color:"#0a0a0f",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",gap:3}}><FileText size={11}/>View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── USERS (Admin only) ── */}
            {tab==="Users"&&isAdmin&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>User Management</div>
                    <div style={{color:C.textDim,fontSize:12,marginTop:2}}>Manage staff accounts and reset passwords</div>
                  </div>
                  <button onClick={()=>{setError("");setShowAddUser(true);}} style={{display:"flex",alignItems:"center",gap:6,background:C.purple,color:C.text,border:"none",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}><Plus size={14}/>Add Staff</button>
                </div>
                <div style={{display:"grid",gap:10}}>
                  {users.map(u=>(
                    <div key={u.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10,opacity:u.is_active?1:0.6}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                          {u.name}
                          <Badge label={u.role.toUpperCase()} color={u.role==="admin"?C.accent:C.blue}/>
                          {u.role!=="admin"&&u.can_edit_delete===1&&<Badge label="✓ SPECIAL PERM" color={C.purple}/>}
                          {!u.is_active&&<Badge label="DISABLED" color={C.red}/>}
                        </div>
                        <div style={{color:C.textDim,fontSize:12,marginTop:3}}>{u.email}</div>
                        <div style={{color:C.muted,fontSize:11,marginTop:2}}>
                          Added: {fmtDate(u.created_at)}
                          {u.role==="staff"&&<span style={{marginLeft:8,color:u.can_edit_delete?C.purple:C.muted}}>
                            {u.can_edit_delete?"· Can edit & delete records":"· View + Add only"}
                          </span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {u.role!=="admin"&&(
                          <button onClick={async()=>{
                            const res=await put(`/users/${u.id}/toggle-permission`,{});
                            await loadAll();
                          }} style={{background:u.can_edit_delete?C.purple+"22":C.card2,border:`1px solid ${u.can_edit_delete?C.purple+"66":C.border}`,borderRadius:7,padding:"7px 14px",color:u.can_edit_delete?C.purple:C.textDim,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}>
                            <Shield size={12}/>{u.can_edit_delete?"Revoke Edit Perm":"Grant Edit Perm"}
                          </button>
                        )}
                        <button onClick={()=>{setShowResetPwd(u);setResetPwd({new_password:"",show:false});}} style={{background:C.orange+"22",border:`1px solid ${C.orange}44`,borderRadius:7,padding:"7px 14px",color:C.orange,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",gap:4}}><Shield size={12}/>Reset Password</button>
                        {u.role!=="admin"&&<button onClick={()=>toggleUser(u)} style={{background:u.is_active?C.red+"22":C.green+"22",border:`1px solid ${u.is_active?C.red:C.green}44`,borderRadius:7,padding:"7px 14px",color:u.is_active?C.red:C.green,cursor:"pointer",fontSize:12}}>{u.is_active?"Disable":"Enable"}</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SUPPLIERS (Admin only) ── */}
            {tab==="Suppliers"&&isAdmin&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                  <div>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18}}>Supplier Contact Book</div>
                    <div style={{color:C.textDim,fontSize:12,marginTop:2}}>Save supplier details for quick reference</div>
                  </div>
                  <button onClick={()=>{setError("");setShowSupplier(true);}} style={{display:"flex",alignItems:"center",gap:6,background:C.accent,color:"#0a0a0f",border:"none",borderRadius:9,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:13}}><Plus size={14}/>Add Supplier</button>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
                  {suppliers.length===0
                    ? <div style={{color:C.muted,padding:20}}>No suppliers yet.</div>
                    : suppliers.map(s=>(
                    <div key={s.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 18px"}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,marginBottom:8}}>{s.name}</div>
                      {s.phone&&<div style={{color:C.textDim,fontSize:13,display:"flex",alignItems:"center",gap:5,marginBottom:4}}><Phone size={11}/>{s.phone}</div>}
                      {s.address&&<div style={{color:C.textDim,fontSize:13,display:"flex",alignItems:"center",gap:5,marginBottom:4}}><MapPin size={11}/>{s.address}</div>}
                      {s.notes&&<div style={{color:C.muted,fontSize:12,marginTop:6,fontStyle:"italic"}}>{s.notes}</div>}
                      <button onClick={()=>del(`/suppliers/${s.id}`).then(loadAll)} style={{marginTop:10,background:"none",border:`1px solid ${C.red}44`,borderRadius:6,padding:"4px 10px",color:C.red,cursor:"pointer",fontSize:11}}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── ADD PURCHASE MODAL ── */}
        {showPModal&&(
          <Modal title="Add Raw Material Purchase" onClose={()=>setShowPModal(false)} wide>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Date"><DatePicker value={pForm.date} onChange={v=>setPForm(f=>({...f,date:v}))}/></Field>
              <Field label="Supplier Name"><Input type="text" placeholder="Supplier name" value={pForm.supplier_name} onChange={e=>setPForm(f=>({...f,supplier_name:e.target.value}))}/></Field>
            </div>
            <Field label="Item / Raw Material Name"><Input type="text" placeholder="e.g. Pearls, Gold Thread, Silver Wire" value={pForm.item} onChange={e=>setPForm(f=>({...f,item:e.target.value}))}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <Field label="Quantity"><Input type="number" placeholder="0" value={pForm.qty} onChange={e=>setPForm(f=>({...f,qty:e.target.value}))}/></Field>
              <Field label="Unit"><Input type="text" placeholder="pcs/grams" value={pForm.unit} onChange={e=>setPForm(f=>({...f,unit:e.target.value}))}/></Field>
              <Field label="Unit Cost (₹)"><Input type="number" placeholder="0" value={pForm.unit_cost} onChange={e=>setPForm(f=>({...f,unit_cost:e.target.value}))}/></Field>
            </div>
            {pForm.qty&&pForm.unit_cost&&(
              <div style={{background:`${C.green}11`,border:`1px solid ${C.green}44`,borderRadius:8,padding:"9px 13px",marginBottom:12,fontSize:14}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.textDim}}>Total Amount</span>
                  <span style={{color:C.green,fontWeight:700}}>{fmt(+pForm.qty * +pForm.unit_cost)}</span>
                </div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Paid Now (₹)"><Input type="number" placeholder="0 = unpaid" value={pForm.paid_amount} onChange={e=>setPForm(f=>({...f,paid_amount:e.target.value}))}/></Field>
              <Field label="Low Stock Alert At"><Input type="number" placeholder="e.g. 10" value={pForm.low_stock_alert} onChange={e=>setPForm(f=>({...f,low_stock_alert:e.target.value}))}/></Field>
            </div>
            {pForm.qty&&pForm.unit_cost&&pForm.paid_amount&&(
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:12}}>
                <span style={{color:C.green}}>✓ Paid: {fmt(pForm.paid_amount)}</span>
                <span style={{color:C.orange}}>Supplier Due: {fmt(Math.max(0,+pForm.qty * +pForm.unit_cost - +pForm.paid_amount))}</span>
              </div>
            )}
            <ImageUpload label="Raw Material Image (optional)" currentImage={pImage?URL.createObjectURL(pImage):null} onUpload={setPImage}/>
            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Save Purchase",addPurchase)}
          </Modal>
        )}

        {/* ── ADD PRODUCT MODAL (with builder) ── */}
        {showProdModal&&(
          <Modal title="Add Product" onClose={()=>{setShowProdModal(false);setProdIngredients([]);setProdCharges([]);setProdBuildMode(false);}} wide>
            {/* Toggle: simple vs builder */}
            <div style={{display:"flex",gap:8,marginBottom:16,background:C.card2,borderRadius:10,padding:5}}>
              <button onClick={()=>setProdBuildMode(false)} style={{flex:1,background:!prodBuildMode?C.purple:"transparent",border:"none",borderRadius:7,padding:"7px 0",color:!prodBuildMode?C.text:C.textDim,cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.2s"}}>
                📝 Simple (Enter Price)
              </button>
              <button onClick={()=>setProdBuildMode(true)} style={{flex:1,background:prodBuildMode?C.purple:"transparent",border:"none",borderRadius:7,padding:"7px 0",color:prodBuildMode?C.text:C.textDim,cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.2s"}}>
                🔧 Builder (Select Ingredients)
              </button>
            </div>

            <Field label="Product Name"><Input type="text" placeholder="e.g. Pearl Necklace, Gold Earring" value={prodForm.name} onChange={e=>setProdForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Description (optional)"><Input type="text" placeholder="Brief description" value={prodForm.description} onChange={e=>setProdForm(f=>({...f,description:e.target.value}))}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {!prodBuildMode&&<Field label="Defined Price (₹)"><Input type="number" placeholder="0" value={prodForm.defined_price} onChange={e=>setProdForm(f=>({...f,defined_price:e.target.value}))}/></Field>}
              <Field label="Unit"><Input type="text" placeholder="pcs/set" value={prodForm.unit} onChange={e=>setProdForm(f=>({...f,unit:e.target.value}))}/></Field>
              <Field label="Qty Available"><Input type="number" placeholder="0" value={prodForm.qty_available} onChange={e=>setProdForm(f=>({...f,qty_available:e.target.value}))}/></Field>
            </div>

            {/* BUILDER MODE: ingredients + charges */}
            {prodBuildMode&&(
              <div>
                {/* Raw Ingredients section */}
                <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.accent}}>🧪 Raw Material Ingredients</span>
                    <button onClick={()=>setProdIngredients(arr=>[...arr,{item_name:"",qty:"",unit:"units",unit_cost:""}])}
                      style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:6,padding:"4px 10px",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add Item</button>
                  </div>
                  {prodIngredients.length===0&&(
                    <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"10px 0"}}>No ingredients yet. Click "Add Item" to select raw materials.</div>
                  )}
                  {prodIngredients.map((ing,idx)=>(
                    <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
                      <Field label={idx===0?"Item Name":""}>
                        <SelectInput value={ing.item_name} onChange={e=>{
                          const name=e.target.value;
                          const invItem = inventory.find(i=>i.name===name);
                          // Auto-fill unit_cost from most recent purchase of this item
                          const recentPurch = purchases.filter(p=>p.item===name).sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
                          setProdIngredients(arr=>arr.map((x,i)=>i===idx?{...x,item_name:name,unit:invItem?.unit||x.unit,unit_cost:recentPurch?.unit_cost||""}:x));
                        }} placeholder="— Select item —" options={inventory.map(i=>({value:i.name,label:`${i.name} (${i.purchased} ${i.unit})`}))}/>
                      </Field>
                      <Field label={idx===0?"Qty":""}>
                        <Input type="number" placeholder="0" value={ing.qty} onChange={e=>setProdIngredients(arr=>arr.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}/>
                      </Field>
                      <Field label={idx===0?"Unit":""}>
                        <Input type="text" placeholder="pcs" value={ing.unit} onChange={e=>setProdIngredients(arr=>arr.map((x,i)=>i===idx?{...x,unit:e.target.value}:x))}/>
                      </Field>
                      <Field label={idx===0?"Cost/Unit (₹)":""}>
                        <Input type="number" placeholder="0" value={ing.unit_cost} onChange={e=>setProdIngredients(arr=>arr.map((x,i)=>i===idx?{...x,unit_cost:e.target.value}:x))}/>
                      </Field>
                      <div style={{paddingBottom:2}}>
                        <button onClick={()=>setProdIngredients(arr=>arr.filter((_,i)=>i!==idx))}
                          style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:6,padding:"8px 10px",color:C.red,cursor:"pointer",fontSize:11}}>✕</button>
                      </div>
                    </div>
                  ))}
                  {prodIngredients.length>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:6,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                      <span style={{color:C.textDim}}>Ingredients Subtotal</span>
                      <span style={{color:C.accent,fontWeight:700}}>{fmt(ingredientsCost)}</span>
                    </div>
                  )}
                </div>

                {/* Extra charges section */}
                <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:12,fontWeight:600,color:C.orange}}>💰 Extra Charges</span>
                    <button onClick={()=>setProdCharges(arr=>[...arr,{label:"",amount:""}])}
                      style={{background:C.orange+"22",border:`1px solid ${C.orange}44`,borderRadius:6,padding:"4px 10px",color:C.orange,cursor:"pointer",fontSize:11,fontWeight:600}}>+ Add Charge</button>
                  </div>
                  {prodCharges.length===0&&(
                    <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"8px 0"}}>No charges yet. Add making charges, transport, etc.</div>
                  )}
                  {prodCharges.map((chg,idx)=>(
                    <div key={idx} style={{display:"grid",gridTemplateColumns:"2fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
                      <Field label={idx===0?"Charge Name":""}>
                        <Input type="text" placeholder="e.g. Making charges, Transport" value={chg.label} onChange={e=>setProdCharges(arr=>arr.map((x,i)=>i===idx?{...x,label:e.target.value}:x))}/>
                      </Field>
                      <Field label={idx===0?"Amount (₹)":""}>
                        <Input type="number" placeholder="0" value={chg.amount} onChange={e=>setProdCharges(arr=>arr.map((x,i)=>i===idx?{...x,amount:e.target.value}:x))}/>
                      </Field>
                      <div style={{paddingBottom:2}}>
                        <button onClick={()=>setProdCharges(arr=>arr.filter((_,i)=>i!==idx))}
                          style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:6,padding:"8px 10px",color:C.red,cursor:"pointer",fontSize:11}}>✕</button>
                      </div>
                    </div>
                  ))}
                  {prodCharges.length>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:6,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                      <span style={{color:C.textDim}}>Charges Subtotal</span>
                      <span style={{color:C.orange,fontWeight:700}}>{fmt(chargesTotal)}</span>
                    </div>
                  )}
                </div>

                {/* Grand total */}
                {builderTotal>0&&(
                  <div style={{background:`${C.green}11`,border:`1px solid ${C.green}44`,borderRadius:10,padding:"12px 16px",marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:12,color:C.textDim,marginBottom:4}}>Calculated Product Price</div>
                        <div style={{fontSize:11,color:C.textDim}}>Ingredients {fmt(ingredientsCost)} + Charges {fmt(chargesTotal)}</div>
                      </div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:C.green}}>{fmt(builderTotal)}</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <ImageUpload label="Product Image (optional)" currentImage={prodImage?URL.createObjectURL(prodImage):null} onUpload={setProdImage}/>
            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Save Product",addProduct,C.purple)}
          </Modal>
        )}

        {/* ── NEW ORDER MODAL (multi-product) ── */}
        {showSModal&&(
          <Modal title="New Order" onClose={()=>{setShowSModal(false);setPriceWarning("");}} wide>

            {/* Date + Customer */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:4}}>
              <Field label="Order Date"><DatePicker value={orderCustomer.date} onChange={v=>setOrderCustomer(f=>({...f,date:v}))}/></Field>
            </div>
            <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{fontSize:11,color:C.textDim,marginBottom:10,letterSpacing:0.8}}>CUSTOMER DETAILS</div>
              <Field label="Customer Name"><Input type="text" placeholder="Full name" value={orderCustomer.customer_name} onChange={e=>setOrderCustomer(f=>({...f,customer_name:e.target.value}))}/></Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="Phone"><Input type="text" placeholder="+91 99999 99999" value={orderCustomer.customer_phone} onChange={e=>setOrderCustomer(f=>({...f,customer_phone:e.target.value}))}/></Field>
                <Field label="Address"><Input type="text" placeholder="City / Area" value={orderCustomer.customer_addr} onChange={e=>setOrderCustomer(f=>({...f,customer_addr:e.target.value}))}/></Field>
              </div>
            </div>

            {/* Product line items */}
            <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <span style={{fontSize:12,fontWeight:600,color:C.green}}>🛒 Order Items</span>
                <button onClick={()=>setOrderItems(arr=>[...arr,{product_id:"",product_name:"",qty:"",unit:"pcs",unit_price:"",defined_price:0}])}
                  style={{background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:6,padding:"5px 12px",color:C.green,cursor:"pointer",fontSize:11,fontWeight:600}}>
                  + Add Product
                </button>
              </div>

              {orderItems.map((item,idx)=>(
                <div key={idx} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 14px",marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:11,color:C.textDim,fontWeight:600}}>Item #{idx+1}</span>
                    {orderItems.length>1&&<button onClick={()=>setOrderItems(arr=>arr.filter((_,i)=>i!==idx))}
                      style={{background:C.red+"18",border:`1px solid ${C.red}44`,borderRadius:5,padding:"3px 8px",color:C.red,cursor:"pointer",fontSize:10}}>✕ Remove</button>}
                  </div>
                  <Field label="Select Product">
                    <SelectInput value={item.product_id} onChange={e=>{
                      const pid=e.target.value;
                      const prod=products.find(p=>String(p.id)===String(pid));
                      setOrderItems(arr=>arr.map((x,i)=>i===idx?{...x,
                        product_id:pid,
                        product_name:prod?.name||"",
                        unit:prod?.unit||"pcs",
                        unit_price:prod?.defined_price||"",
                        defined_price:prod?.defined_price||0
                      }:x));
                    }} placeholder="— Choose product —"
                    options={products.filter(p=>p.is_active).map(p=>({value:p.id,label:`${p.name} — ${fmt(p.defined_price)} · Stock: ${p.qty_available} ${p.unit}${p.qty_available<=0?" ⚠️ OUT":""}`}))}/>
                  </Field>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                    <Field label="Qty"><Input type="number" placeholder="0" value={item.qty} onChange={e=>setOrderItems(arr=>arr.map((x,i)=>i===idx?{...x,qty:e.target.value}:x))}/></Field>
                    <Field label="Unit"><Input type="text" value={item.unit} onChange={e=>setOrderItems(arr=>arr.map((x,i)=>i===idx?{...x,unit:e.target.value}:x))}/></Field>
                    <Field label="Price/Unit (₹)">
                      <Input type="number" placeholder="0" value={item.unit_price} onChange={e=>{
                        const price=e.target.value;
                        setOrderItems(arr=>arr.map((x,i)=>i===idx?{...x,unit_price:price}:x));
                        if(item.defined_price>0 && +price < item.defined_price)
                          setPriceWarning(`⚠️ Item #${idx+1} price below defined price (${fmt(item.defined_price)})`);
                        else setPriceWarning("");
                      }}/>
                    </Field>
                  </div>
                  {item.qty&&item.unit_price&&(
                    <div style={{display:"flex",justifyContent:"flex-end",fontSize:12,color:C.accent,fontWeight:600,marginTop:4}}>
                      Item total: {fmt(+item.qty * +item.unit_price)}
                    </div>
                  )}
                </div>
              ))}

              {priceWarning&&(
                <div style={{background:`${C.orange}11`,border:`1px solid ${C.orange}55`,borderRadius:8,padding:"8px 12px",marginTop:6,color:C.orange,fontSize:12,display:"flex",alignItems:"center",gap:6}}>
                  <AlertTriangle size={12}/>{priceWarning}<span style={{color:C.textDim,fontSize:10}}>(can still proceed)</span>
                </div>
              )}
            </div>

            {/* Order total + payment */}
            {orderTotal>0&&(
              <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{color:C.textDim,fontSize:13}}>Order Total ({orderItems.filter(i=>i.qty&&i.unit_price).length} item{orderItems.filter(i=>i.qty&&i.unit_price).length!==1?"s":""})</span>
                  <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:C.text}}>{fmt(orderTotal)}</span>
                </div>
                <Field label="Paid Now (₹)"><Input type="number" placeholder="0 = unpaid" value={orderCustomer.paid_amount} onChange={e=>setOrderCustomer(f=>({...f,paid_amount:e.target.value}))}/></Field>
                {+(orderCustomer.paid_amount||0)>0&&(
                  <Field label="Payment Comment"><Input type="text" placeholder="e.g. Cash, UPI, Advance..." value={orderCustomer.payment_notes} onChange={e=>setOrderCustomer(f=>({...f,payment_notes:e.target.value}))}/></Field>
                )}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:8}}>
                  <span style={{color:C.green}}>✓ Paid: {fmt(orderCustomer.paid_amount||0)}</span>
                  <span style={{color:orderDue>0?C.red:C.green}}>Due: {orderDue>0?fmt(orderDue):"Fully paid ✓"}</span>
                </div>
                <div style={{height:4,background:C.border,borderRadius:2,marginTop:8,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${orderTotal>0?Math.min(100,((+(orderCustomer.paid_amount)||0)/orderTotal)*100):0}%`,background:C.green,borderRadius:2,transition:"width 0.2s"}}/>
                </div>
              </div>
            )}

            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Place Order",addOrder,C.green)}
          </Modal>
        )}

        {/* ── PAYMENT MODALS ── */}
        {(showSalePay||showPurchasePay)&&(
          <Modal title={showSalePay?"Record Customer Payment":"Pay Supplier"} onClose={()=>{setShowSalePay(null);setShowPurchasePay(null);}}>
            {(()=>{const item=showSalePay||showPurchasePay;const type=showSalePay?"sale":"purchase";return(<>
              <div style={{background:C.card2,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
                <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{showSalePay?item.customer_name:item.supplier_name}</div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:8}}>
                  <div><div style={{fontSize:10,color:C.textDim}}>TOTAL</div><div style={{fontWeight:700}}>{fmt(item.total)}</div></div>
                  <div><div style={{fontSize:10,color:C.textDim}}>PAID</div><div style={{fontWeight:700,color:C.green}}>{fmt(item.paid_amount)}</div></div>
                  <div><div style={{fontSize:10,color:C.textDim}}>DUE</div><div style={{fontWeight:700,color:C.red}}>{fmt(item.due_amount)}</div></div>
                </div>
                <PayBar paid={item.paid_amount} total={item.total}/>
              </div>
              <Field label="Amount (₹)"><Input type="number" placeholder={`Max ${fmt(item.due_amount)}`} value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))}/></Field>
              <Field label="Date"><DatePicker value={payForm.date} onChange={v=>setPayForm(f=>({...f,date:v}))}/></Field>
              <Field label="Notes"><Input type="text" placeholder="Cash/UPI/Cheque" value={payForm.notes} onChange={e=>setPayForm(f=>({...f,notes:e.target.value}))}/></Field>
              {saveBtn("Confirm Payment",()=>addPayment(type),type==="sale"?C.green:C.orange)}
            </>);})()}
          </Modal>
        )}

        {/* ── HISTORY MODAL ── */}
        {showHistory&&(
          <Modal title={`Payment History — ${historyType==="sale"?showHistory.customer_name:showHistory.supplier_name}`} onClose={()=>setShowHistory(null)}>
            <div style={{background:C.card2,borderRadius:10,padding:"12px 16px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <div><div style={{fontSize:10,color:C.textDim}}>TOTAL</div><div style={{fontWeight:700}}>{fmt(showHistory.total)}</div></div>
                <div><div style={{fontSize:10,color:C.textDim}}>PAID</div><div style={{fontWeight:700,color:C.green}}>{fmt(showHistory.paid_amount)}</div></div>
                <div><div style={{fontSize:10,color:C.textDim}}>DUE</div><div style={{fontWeight:700,color:C.red}}>{fmt(showHistory.due_amount)}</div></div>
              </div>
              <PayBar paid={showHistory.paid_amount} total={showHistory.total}/>
            </div>
            <div style={{fontSize:11,color:C.textDim,marginBottom:10,letterSpacing:0.8}}>ALL TRANSACTIONS ({historyData.length})</div>
            {historyData.length===0
              ? <div style={{color:C.muted,textAlign:"center",padding:20}}>No payments recorded yet.</div>
              : historyData.map((p,i)=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 13px",background:C.card2,borderRadius:8,marginBottom:7,border:`1px solid ${C.border}`}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.green}}>#{i+1} Payment</div>
                  <div style={{fontSize:11,color:C.textDim,marginTop:1}}>{fmtDate(p.date)}{p.notes?` · ${p.notes}`:""}</div>
                </div>
                <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,color:C.green,fontSize:15}}>{fmt(p.amount)}</div>
              </div>
            ))}
          </Modal>
        )}

        {/* ── ADD USER MODAL ── */}
        {showAddUser&&(
          <Modal title="Add Staff Member" onClose={()=>setShowAddUser(false)}>
            <Field label="Full Name"><Input type="text" placeholder="Staff name" value={userForm.name} onChange={e=>setUserForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Email"><Input type="email" placeholder="staff@email.com" value={userForm.email} onChange={e=>setUserForm(f=>({...f,email:e.target.value}))}/></Field>
            <Field label="Password"><Input type="password" placeholder="Min 6 characters" value={userForm.password} onChange={e=>setUserForm(f=>({...f,password:e.target.value}))}/></Field>
            <Field label="Role">
              <SelectInput value={userForm.role} onChange={e=>setUserForm(f=>({...f,role:e.target.value}))}
                options={[{value:"staff",label:"Staff — cannot see P&L"},{value:"admin",label:"Admin — full access"}]}/>
            </Field>
            <div style={{background:C.card2,borderRadius:8,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.textDim}}>
              <strong style={{color:C.text}}>Staff access:</strong> Can add/view Purchases, Sales, Dues, Inventory, Invoices<br/>
              <strong style={{color:C.text}}>Cannot access:</strong> Dashboard (P&L), Users, Suppliers, Delete records
            </div>
            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Create Account",addUser,C.purple)}
          </Modal>
        )}

        {/* ── RESET PASSWORD MODAL ── */}
        {showResetPwd&&(
          <Modal title={`Reset Password — ${showResetPwd.name}`} onClose={()=>setShowResetPwd(null)}>
            <div style={{background:`${C.orange}11`,border:`1px solid ${C.orange}44`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:C.orange}}>
              ⚠️ This will immediately change the password for <strong>{showResetPwd.name}</strong>. They will need to use the new password to login.
            </div>
            <Field label="New Password">
              <div style={{position:"relative"}}>
                <Input type={resetPwd.show?"text":"password"} placeholder="Min 6 characters" value={resetPwd.new_password} onChange={e=>setResetPwd(f=>({...f,new_password:e.target.value}))}/>
                <button type="button" onClick={()=>setResetPwd(f=>({...f,show:!f.show}))}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:C.textDim}}>
                  {resetPwd.show?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </Field>
            {saveBtn("Reset Password",doResetPwd,C.orange)}
          </Modal>
        )}

        {/* ── ADD SUPPLIER MODAL ── */}
        {showSupplier&&(
          <Modal title="Add Supplier" onClose={()=>setShowSupplier(false)}>
            <Field label="Supplier Name"><Input type="text" placeholder="Company/Person name" value={supplierForm.name} onChange={e=>setSupplierForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Phone"><Input type="text" placeholder="+91 99999 99999" value={supplierForm.phone} onChange={e=>setSupplierForm(f=>({...f,phone:e.target.value}))}/></Field>
            <Field label="Address"><Input type="text" placeholder="City / Area" value={supplierForm.address} onChange={e=>setSupplierForm(f=>({...f,address:e.target.value}))}/></Field>
            <Field label="Notes"><Input type="text" placeholder="Any notes about this supplier" value={supplierForm.notes} onChange={e=>setSupplierForm(f=>({...f,notes:e.target.value}))}/></Field>
            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Save Supplier",addSupplier)}
          </Modal>
        )}

        {/* ── RETURN MODAL ── */}
        {showReturn&&(
          <Modal title="Mark as Return" onClose={()=>setShowReturn(null)}>
            {/* Sale summary */}
            <div style={{background:C.card2,borderRadius:10,padding:"14px 16px",marginBottom:16}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>{showReturn.customer_name} — {showReturn.product_name}</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}>
                <div><div style={{fontSize:10,color:C.textDim}}>SALE TOTAL</div><div style={{fontWeight:700}}>{fmt(showReturn.total)}</div></div>
                <div><div style={{fontSize:10,color:C.textDim}}>CUSTOMER PAID</div><div style={{fontWeight:700,color:C.green}}>{fmt(showReturn.paid_amount)}</div></div>
                <div><div style={{fontSize:10,color:C.textDim}}>STILL DUE</div><div style={{fontWeight:700,color:showReturn.due_amount>0?C.red:C.muted}}>{showReturn.due_amount>0?fmt(showReturn.due_amount):"—"}</div></div>
              </div>
            </div>

            <Field label="Return Date"><DatePicker value={returnForm.date} onChange={v=>setReturnForm(f=>({...f,date:v}))}/></Field>
            <Field label="Reason / Notes"><Input type="text" placeholder="Reason for return" value={returnForm.notes} onChange={e=>setReturnForm(f=>({...f,notes:e.target.value}))}/></Field>

            {/* Return financials */}
            <div style={{background:`${C.orange}0d`,border:`1px solid ${C.orange}33`,borderRadius:10,padding:"14px 16px",marginBottom:12}}>
              <div style={{fontSize:11,color:C.orange,fontWeight:700,marginBottom:10,letterSpacing:0.8}}>💰 RETURN FINANCIALS</div>
              <Field label="Amount Collected from Customer (₹)">
                <Input type="number" placeholder="How much customer already paid" value={returnForm.return_collected}
                  onChange={e=>setReturnForm(f=>({...f,return_collected:e.target.value,return_owe:e.target.value}))}/>
                <div style={{fontSize:11,color:C.textDim,marginTop:3}}>Auto-filled from paid amount: {fmt(showReturn.paid_amount)}</div>
              </Field>
              <Field label="Amount to Repay to Customer (₹)">
                <Input type="number" placeholder="How much you owe back to customer"
                  value={returnForm.return_owe}
                  onChange={e=>setReturnForm(f=>({...f,return_owe:e.target.value}))}/>
                <div style={{fontSize:11,color:C.textDim,marginTop:3}}>Usually same as collected. Adjust if you're deducting any charges.</div>
              </Field>
              {(+returnForm.return_owe > 0) && (
                <div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:7,padding:"8px 12px",fontSize:12,color:C.red}}>
                  ⚠️ You will owe <strong>{fmt(returnForm.return_owe)}</strong> back to {showReturn.customer_name}. This will be tracked in Dues.
                </div>
              )}
            </div>

            {saveBtn("Confirm Return", ()=>{
              const form = {...returnForm,
                return_collected: +(returnForm.return_collected||showReturn.paid_amount),
                return_owe: +(returnForm.return_owe||showReturn.paid_amount)
              };
              setSaving(true);
              post(`/sales/${showReturn.id}/return`, form)
                .then(()=>{loadAll();setShowReturn(null);setReturnForm({date:today(),notes:"",return_collected:0,return_owe:0});})
                .catch(e=>alert(e.message))
                .finally(()=>setSaving(false));
            }, C.orange)}
          </Modal>
        )}

        {/* ── EDIT PRODUCT MODAL ── */}
        {showEditProd&&(
          <Modal title={`Edit Product — ${showEditProd.name}`} onClose={()=>setShowEditProd(null)}>
            <Field label="Product Name"><Input type="text" value={editProdForm.name} onChange={e=>setEditProdForm(f=>({...f,name:e.target.value}))}/></Field>
            <Field label="Description"><Input type="text" placeholder="Optional" value={editProdForm.description} onChange={e=>setEditProdForm(f=>({...f,description:e.target.value}))}/></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Field label="Defined Price (₹)"><Input type="number" value={editProdForm.defined_price} onChange={e=>setEditProdForm(f=>({...f,defined_price:e.target.value}))}/></Field>
              <Field label="Unit"><Input type="text" value={editProdForm.unit} onChange={e=>setEditProdForm(f=>({...f,unit:e.target.value}))}/></Field>
            </div>
            <Field label="Available Quantity">
              <Input type="number" placeholder="How many available to sell" value={editProdForm.qty_available} onChange={e=>setEditProdForm(f=>({...f,qty_available:e.target.value}))}/>
              <div style={{fontSize:11,color:C.textDim,marginTop:4}}>💡 This is the stock available for sale. Decreases automatically when sold.</div>
            </Field>
            <Field label="Status">
              <SelectInput value={String(editProdForm.is_active)} onChange={e=>setEditProdForm(f=>({...f,is_active:+e.target.value}))}
                options={[{value:"1",label:"Active — visible in Sales"},{value:"0",label:"Inactive — hidden from Sales"}]}/>
            </Field>
            <ImageUpload label="Update Image (optional)" currentImage={editProdImage?URL.createObjectURL(editProdImage):showEditProd.image_data} onUpload={setEditProdImage}/>
            {editProdBuildInfo&&(editProdBuildInfo.ingredients.length>0||editProdBuildInfo.charges.length>0)&&(
              <div style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:14}}>
                <div style={{fontSize:11,color:C.textDim,marginBottom:10,letterSpacing:0.8}}>📦 PRODUCT COMPOSITION</div>
                {editProdBuildInfo.ingredients.length>0&&(
                  <>
                    <div style={{fontSize:11,fontWeight:600,color:C.accent,marginBottom:6}}>🧪 Raw Materials</div>
                    {editProdBuildInfo.ingredients.map((ing,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${C.border}33`}}>
                        <span style={{color:C.text}}>{ing.item_name} <span style={{color:C.textDim}}>× {ing.qty} {ing.unit}</span></span>
                        <span style={{color:C.accent,fontWeight:600}}>{fmt(ing.qty*ing.unit_cost)}</span>
                      </div>
                    ))}
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginTop:6,color:C.textDim}}>
                      <span>Materials subtotal</span>
                      <span style={{color:C.accent,fontWeight:600}}>{fmt(editProdBuildInfo.ingredients.reduce((s,i)=>s+i.qty*i.unit_cost,0))}</span>
                    </div>
                  </>
                )}
                {editProdBuildInfo.charges.length>0&&(
                  <>
                    <div style={{fontSize:11,fontWeight:600,color:C.orange,marginTop:10,marginBottom:6}}>💰 Extra Charges</div>
                    {editProdBuildInfo.charges.map((chg,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"5px 0",borderBottom:`1px solid ${C.border}33`}}>
                        <span style={{color:C.text}}>{chg.label}</span>
                        <span style={{color:C.orange,fontWeight:600}}>{fmt(chg.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:10,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontWeight:700,color:C.text}}>Total Cost</span>
                  <span style={{fontWeight:700,color:C.green}}>{fmt(editProdBuildInfo.ingredients.reduce((s,i)=>s+i.qty*i.unit_cost,0)+editProdBuildInfo.charges.reduce((s,c)=>s+c.amount,0))}</span>
                </div>
                <div style={{fontSize:10,color:C.muted,marginTop:6}}>⚡ To change ingredients, delete this product and recreate it with the builder.</div>
              </div>
            )}
            {error&&<div style={{color:C.red,fontSize:12,marginBottom:10}}>{error}</div>}
            {saveBtn("Save Changes",saveEditProduct,C.blue)}
          </Modal>
        )}

        {/* ── INVOICE MODAL ── */}
        {showInvoice&&(
          <Modal title={`Invoice INV-${String((showInvoice.idx||0)+1).padStart(3,"0")}`} onClose={()=>setShowInvoice(null)} wide>
            <div style={{background:"#0a0a0f",borderRadius:12,padding:22}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
                <div><div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:C.accent}}>TradDesk</div><div style={{color:C.textDim,fontSize:11}}>Business Invoice</div></div>
                <div style={{textAlign:"right",fontSize:11,color:C.textDim}}><div>Date: {fmtDate(showInvoice.date)}</div><div>INV-{String((showInvoice.idx||0)+1).padStart(3,"0")}</div></div>
              </div>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12,marginBottom:12}}>
                <div style={{fontSize:10,color:C.textDim,marginBottom:5,letterSpacing:0.8}}>BILL TO</div>
                <div style={{fontWeight:700,fontSize:15}}>{showInvoice.customer_name}</div>
                {showInvoice.customer_phone&&<div style={{color:C.textDim,fontSize:12,marginTop:3,display:"flex",alignItems:"center",gap:4}}><Phone size={10}/>{showInvoice.customer_phone}</div>}
                {showInvoice.customer_addr&&<div style={{color:C.textDim,fontSize:12,marginTop:2,display:"flex",alignItems:"center",gap:4}}><MapPin size={10}/>{showInvoice.customer_addr}</div>}
              </div>
              <table style={{width:"100%",fontSize:13,marginBottom:12}}>
                <thead><tr style={{color:C.textDim,borderBottom:`1px solid ${C.border}`}}>
                  <th style={{textAlign:"left",padding:"5px 0"}}>Product</th>
                  <th style={{textAlign:"right",padding:"5px 0"}}>Qty</th>
                  <th style={{textAlign:"right",padding:"5px 0"}}>Rate</th>
                  <th style={{textAlign:"right",padding:"5px 0"}}>Amount</th>
                </tr></thead>
                <tbody><tr>
                  <td style={{padding:"9px 0",color:C.text}}>{showInvoice.product_name}</td>
                  <td style={{textAlign:"right",color:C.text}}>{showInvoice.qty} {showInvoice.unit}</td>
                  <td style={{textAlign:"right",color:C.text}}>{fmt(showInvoice.unit_price)}</td>
                  <td style={{textAlign:"right",color:C.text,fontWeight:600}}>{fmt(showInvoice.total)}</td>
                </tr></tbody>
              </table>
              <div style={{borderTop:`1px solid ${C.border}`,paddingTop:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:C.textDim}}>Total</span><span style={{fontWeight:700}}>{fmt(showInvoice.total)}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:13}}><span style={{color:C.green}}>Paid</span><span style={{color:C.green,fontWeight:600}}>{fmt(showInvoice.paid_amount)}</span></div>
                {showInvoice.due_amount>0
                  ? <div style={{display:"flex",justifyContent:"space-between",background:`${C.red}11`,padding:"8px 12px",borderRadius:7,marginTop:5}}><span style={{color:C.red,fontWeight:600}}>⚠️ Balance Due</span><span style={{color:C.red,fontWeight:700,fontSize:16}}>{fmt(showInvoice.due_amount)}</span></div>
                  : <div style={{display:"flex",justifyContent:"space-between",background:`${C.green}11`,padding:"8px 12px",borderRadius:7,marginTop:5}}><span style={{color:C.green,fontWeight:600}}>✓ Fully Paid</span><span style={{color:C.green,fontWeight:700}}>CLEARED</span></div>}
              </div>
              <div style={{textAlign:"center",color:C.muted,fontSize:11,marginTop:14}}>Thank you for your business!</div>
            </div>
          </Modal>
        )}

        {/* ── IMAGE LIGHTBOX ── */}
        {lightboxImg&&(
          <div onClick={()=>setLightboxImg(null)}
            style={{position:"fixed",inset:0,background:"#000000ee",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}}>
            <div style={{position:"relative",maxWidth:"92vw",maxHeight:"92vh"}}>
              <img src={lightboxImg} alt="Preview"
                style={{maxWidth:"92vw",maxHeight:"92vh",borderRadius:14,objectFit:"contain",boxShadow:"0 0 60px #000a"}}
                onClick={e=>e.stopPropagation()}/>
              <button onClick={()=>setLightboxImg(null)}
                style={{position:"absolute",top:-14,right:-14,background:C.card,border:`1px solid ${C.border}`,borderRadius:"50%",width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:C.text,fontSize:16,fontWeight:700}}>×</button>
              <div style={{textAlign:"center",marginTop:10,color:"#ffffff88",fontSize:12}}>Click anywhere outside to close</div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
