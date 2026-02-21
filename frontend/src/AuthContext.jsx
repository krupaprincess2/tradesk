import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const BASE = "/api";

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
  }, []);

  const login = async (email, password) => {
    const r = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.detail || "Login failed");
    localStorage.setItem("tradesk_token", data.access_token);
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
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// ── Login Page ────────────────────────────────────────────────
const C = {
  bg: "#0a0a0f", card: "#13131a", card2: "#1a1a24", border: "#252535",
  accent: "#f0c040", red: "#e74c3c", text: "#eeeef5", textDim: "#8888aa", muted: "#555570"
};

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true);
    try {
      await login(email, password);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Enter key submits login
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  const iStyle = {
    width: "100%", background: C.bg, border: `1px solid ${C.border}`,
    borderRadius: 9, padding: "11px 13px", color: C.text, fontSize: 14,
    fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box", outline: "none",
    transition: "border-color 0.15s",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; }
        body { background: ${C.bg}; }
        input:focus { border-color: ${C.accent} !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
      `}</style>

      <div style={{
        minHeight: "100vh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans',sans-serif", padding: 20,
      }}>
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
          padding: "38px 36px", width: "100%", maxWidth: 400,
          boxShadow: "0 20px 60px #000000aa",
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 28, color: C.text }}>
              Trade<span style={{ color: C.accent }}>Desk</span>
            </div>
            <div style={{ color: C.textDim, fontSize: 13, marginTop: 4 }}>
              Business Management Suite
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 5, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Email
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              style={iStyle}
              autoFocus
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, color: C.textDim, marginBottom: 5, letterSpacing: 0.8, textTransform: "uppercase" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...iStyle, paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: C.muted,
                  fontSize: 13, padding: 0,
                }}
              >
                {showPwd ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: `${C.red}18`, border: `1px solid ${C.red}44`,
              borderRadius: 8, padding: "9px 13px", marginBottom: 14,
              color: C.red, fontSize: 13,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%", background: C.accent, border: "none", borderRadius: 10,
              padding: "12px 0", cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 15, fontFamily: "'DM Sans',sans-serif",
              color: "#0a0a0f", opacity: loading ? 0.7 : 1,
              transition: "opacity 0.2s, transform 0.1s",
            }}
            onMouseEnter={e => { if (!loading) e.target.style.opacity = "0.9"; }}
            onMouseLeave={e => { e.target.style.opacity = loading ? "0.7" : "1"; }}
          >
            {loading ? "Signing in..." : "Sign In →"}
          </button>

          {/* Hint */}
          <div style={{ textAlign: "center", marginTop: 16, color: C.muted, fontSize: 12 }}>
            Press <kbd style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 4, padding: "1px 6px", fontSize: 11 }}>Enter</kbd> to login
          </div>
        </div>
      </div>
    </>
  );
}
