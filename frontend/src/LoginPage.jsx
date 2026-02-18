import { useState } from "react";
import { useAuth } from "./AuthContext";

const C = {
  bg:"#0f0f13",card:"#16161d",border:"#2a2a3a",
  accent:"#f0c040",text:"#e8e8f0",textDim:"#9999b0",muted:"#666680",red:"#f05e5e"
};

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display:"block", fontSize:12, color:C.textDim, marginBottom:6, fontFamily:"'DM Sans',sans-serif" }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        style={{ width:"100%", background:"#0f0f13", border:`1px solid ${C.border}`, borderRadius:9,
          padding:"11px 14px", color:C.text, fontSize:14, fontFamily:"'DM Sans',sans-serif",
          boxSizing:"border-box", outline:"none" }} />
    </div>
  );
}

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleKey = e => { if (e.key === "Enter") submit(); };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap'); * { box-sizing:border-box; margin:0; }`}</style>
      <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:18, padding:"40px 36px", width:400, maxWidth:"95vw" }}>
          <div style={{ textAlign:"center", marginBottom:32 }}>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:C.text }}>
              Trade<span style={{ color:C.accent }}>Desk</span>
            </div>
            <div style={{ color:C.muted, fontSize:13, marginTop:6 }}>
              {mode==="login" ? "Welcome back — sign in to continue" : "Create your account"}
            </div>
          </div>
          {mode==="register" && <Field label="Full Name" type="text" value={form.name} onChange={set("name")} placeholder="Your name" />}
          <Field label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" />
          {error && <div style={{ color:C.red, fontSize:13, marginBottom:14, textAlign:"center" }}>{error}</div>}
          <button onClick={submit} onKeyDown={handleKey} disabled={loading}
            style={{ width:"100%", background:C.accent, border:"none", borderRadius:9, padding:"13px",
              cursor:"pointer", fontWeight:700, fontSize:15, fontFamily:"'DM Sans',sans-serif",
              color:"#0f0f13", opacity:loading?0.7:1 }}>
            {loading ? "Please wait..." : mode==="login" ? "Sign In" : "Create Account"}
          </button>
          <div style={{ textAlign:"center", marginTop:20, fontSize:13, color:C.textDim }}>
            {mode==="login" ? "Don't have an account? " : "Already have one? "}
            <span onClick={() => { setMode(mode==="login"?"register":"login"); setError(""); }}
              style={{ color:C.accent, cursor:"pointer", fontWeight:600 }}>
              {mode==="login" ? "Register" : "Sign In"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
