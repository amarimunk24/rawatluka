import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : null;
    const run = async () => {
      if (!sessionId) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const { data } = await api.post("/auth/google", { session_id: sessionId });
        loginWithToken(data.token, data.user);
        window.history.replaceState(null, "", window.location.pathname);
        const map = { patient: "/pasien", nakes: "/nakes", admin: "/admin" };
        navigate(map[data.user.role] || "/pasien", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    };
    run();
  }, [navigate, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600 mx-auto" />
        <p className="mt-4 text-slate-600">Memproses login Google...</p>
      </div>
    </div>
  );
}
