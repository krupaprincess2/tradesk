import { createContext, useContext, useState, useEffect } from "react";
import { authApi } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("tradesk_token");
    if (token) {
      authApi.me()
        .then(setUser)
        .catch(() => localStorage.removeItem("tradesk_token"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem("tradesk_token", data.token);
    setUser(data.user);
  };

  const register = async (name, email, password) => {
    const data = await authApi.register({ name, email, password });
    localStorage.setItem("tradesk_token", data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("tradesk_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
