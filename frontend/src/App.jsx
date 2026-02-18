import { AuthProvider, useAuth } from "./AuthContext";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";

function AppInner() {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0f0f13", display:"flex", alignItems:"center", justifyContent:"center", color:"#f0c040", fontSize:18, fontFamily:"sans-serif" }}>
      Loading...
    </div>
  );
  return user ? <Dashboard /> : <LoginPage />;
}

export default function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
