import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

const AuthContext = createContext(null);
const BASE = "/api";

// ── Theme ─────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0f", card: "#13131a", card2: "#1a1a24", border: "#252535",
  accent: "#f0c040", red: "#e74c3c", green: "#2ecc71",
  text: "#eeeef5", textDim: "#8888aa", muted: "#555570"
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; }
  body { background: ${C.bg}; font-family: 'DM Sans', sans-serif; }
  input:focus { border-color: ${C.accent} !important; box-shadow: 0 0 0 3px ${C.accent}18 !important; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
`;

const inputStyle = {
  width: "100%", background: C.bg, border: `1px solid ${C.border}`,
  borderRadius: 9, padding: "11px 13px", color: C.text, fontSize: 14,
  fontFamily: "'DM Sans',sans-serif", outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 28 }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 30, color: C.text, letterSpacing: -1 }}>
        Trade<span style={{ color: C.accent }}>Desk</span>
      </div>
    </div>
  );
}

function Card({ children }) {
  return (
    <div style={{
      minHeight: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "'DM Sans',sans-serif",
    }}>
      <style>{globalCss}</style>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
        padding: "38px 36px", width: "100%", maxWidth: 420,
        boxShadow: "0 24px 64px #00000099",
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{
        display: "block", fontSize: 11, color: C.textDim,
        marginBottom: 5, letterSpacing: 0.8, textTransform: "uppercase",
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: `${C.red}18`, border: `1px solid ${C.red}44`,
      borderRadius: 8, padding: "9px 13px", marginBottom: 14,
      color: C.red, fontSize: 13,
    }}>
      ⚠️ {msg}
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", background: C.accent, border: "none", borderRadius: 10,
        padding: "12px 0", cursor: loading ? "not-allowed" : "pointer",
        fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans',sans-serif",
        color: "#0a0a0f", opacity: loading ? 0.7 : 1,
        transition: "opacity 0.2s",
      }}
      onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = "0.88"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = loading ? "0.7" : "1"; }}
    >
      {loading ? loadingLabel : label}
    </button>
  );
}

// ── AuthProvider ──────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tradesk_token");
    const userData = localStorage.getItem("tradesk_user");
    if (token && userData) {
      try { setUser(JSON.parse(userData)); } catch {}
    }
    setLoading(false);

    // Listen for forced logout event (fired when API returns 401)
    const handleForceLogout = () => {
      localStorage.removeItem("tradesk_token");
      localStorage.removeItem("tradesk_user");
      setUser(null);
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  const login = async (email, password) => {
    const r = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Login failed");
    const loginToken = data.access_token || data.token;
    localStorage.setItem("tradesk_token", loginToken);
    localStorage.setItem("tradesk_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const register = async (name, email, password) => {
    const r = await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Registration failed");
    const regToken = data.access_token || data.token;
    localStorage.setItem("tradesk_token", regToken);
    localStorage.setItem("tradesk_user", JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem("tradesk_token");
    localStorage.removeItem("tradesk_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── Login Page ────────────────────────────────────────────────
export function LoginPage({ onGoRegister }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const btnRef = useRef(null);

  const handleLogin = useCallback(async () => {
    setError("");
    if (!email || !password) { setError("Email and password are required"); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, login]);

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnRef.current?.click();
    }
  };

  return (
    <Card>
      <Logo />
      <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, marginBottom: 26, marginTop: -18 }}>
        Sign in to your account
      </div>

      <Field label="Email">
        <input type="email" placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
          style={inputStyle} autoFocus />
      </Field>

      <Field label="Password">
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} placeholder="Your password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={onKey} style={{ ...inputStyle, paddingRight: 44 }} />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, padding: 0 }}>
            {showPwd ? "🙈" : "👁"}
          </button>
        </div>
      </Field>

      <ErrorBox msg={error} />

      <button
        ref={btnRef}
        onClick={handleLogin}
        disabled={loading}
        style={{
          width: "100%", background: C.accent, border: "none", borderRadius: 10,
          padding: "12px 0", cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans',sans-serif",
          color: "#0a0a0f", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
        }}
      >
        {loading ? "Signing in..." : "Sign In →"}
      </button>

      {onGoRegister && (
        <div style={{ textAlign: "center", marginTop: 18, color: C.textDim, fontSize: 13 }}>
          Don't have an account?{" "}
          <span onClick={onGoRegister} style={{ color: C.accent, fontWeight: 700, cursor: "pointer" }}>
            Create Account
          </span>
        </div>
      )}
    </Card>
  );
}

// ── Register / Create Account Page ───────────────────────────
export function RegisterPage({ onGoLogin }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const btnRef = useRef(null);

  const handleRegister = useCallback(async () => {
    setError("");
    if (!name.trim()) { setError("Full name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (!password) { setError("Password is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [name, email, password, register]);

  const onKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      btnRef.current?.click();
    }
  };

  return (
    <Card>
      <Logo />
      <div style={{ textAlign: "center", color: C.textDim, fontSize: 13, marginBottom: 26, marginTop: -18 }}>
        Create your account
      </div>

      <Field label="Full Name">
        <input type="text" placeholder="Your name" value={name}
          onChange={e => setName(e.target.value)} onKeyDown={onKey}
          style={inputStyle} autoFocus />
      </Field>

      <Field label="Email">
        <input type="email" placeholder="your@email.com" value={email}
          onChange={e => setEmail(e.target.value)} onKeyDown={onKey}
          style={inputStyle} />
      </Field>

      <Field label="Password">
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={onKey} style={{ ...inputStyle, paddingRight: 44 }} />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, padding: 0 }}>
            {showPwd ? "🙈" : "👁"}
          </button>
        </div>
      </Field>

      <ErrorBox msg={error} />

      <button
        ref={btnRef}
        onClick={handleRegister}
        disabled={loading}
        style={{
          width: "100%", background: C.accent, border: "none", borderRadius: 10,
          padding: "12px 0", cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans',sans-serif",
          color: "#0a0a0f", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
        }}
      >
        {loading ? "Creating account..." : "Create Account"}
      </button>

      {onGoLogin && (
        <div style={{ textAlign: "center", marginTop: 18, color: C.textDim, fontSize: 13 }}>
          Already have one?{" "}
          <span onClick={onGoLogin} style={{ color: C.accent, fontWeight: 700, cursor: "pointer" }}>
            Sign In
          </span>
        </div>
      )}
    </Card>
  );
}

// ── Auth Shell (used in App.jsx — toggles between Login & Register) ──
export function AuthShell() {
  const [mode, setMode] = useState("login");
  return mode === "login"
    ? <LoginPage onGoRegister={() => setMode("register")} />
    : <RegisterPage onGoLogin={() => setMode("login")} />;
}
