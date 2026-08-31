import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeartPulse, Loader2 } from "lucide-react";

const roleRoute = { patient: "/pasien", nakes: "/nakes", admin: "/admin" };

export default function Login() {
  const navigate = useNavigate();
  const { user, loginWithToken } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate(roleRoute[user.role], { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      loginWithToken(data.token, data.user);
      toast.success("Selamat datang kembali!");
      navigate(roleRoute[data.user.role], { replace: true });
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-emerald-600 p-12 text-white relative overflow-hidden">
        <div className="grain-overlay absolute inset-0" />
        <Link to="/" className="relative flex items-center gap-2">
          <HeartPulse className="h-7 w-7" />
          <span className="font-heading font-extrabold text-xl">HomeCare.id</span>
        </Link>
        <div className="relative">
          <h2 className="font-heading text-4xl font-extrabold leading-tight">Kesehatan terbaik,<br />di rumah Anda.</h2>
          <p className="mt-4 text-emerald-50 text-lg max-w-md">Masuk untuk memesan tenaga kesehatan atau mengelola layanan Anda.</p>
        </div>
        <p className="relative text-emerald-100 text-sm">© 2026 HomeCare Indonesia</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 text-emerald-600">
            <HeartPulse className="h-6 w-6" />
            <span className="font-heading font-extrabold text-lg">HomeCare.id</span>
          </Link>
          <h1 className="font-heading text-3xl font-extrabold text-slate-900">Masuk ke akun</h1>
          <p className="mt-2 text-slate-500">Belum punya akun?{" "}
            <Link to="/register" className="text-emerald-600 font-semibold hover:underline" data-testid="goto-register">Daftar di sini</Link>
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" data-testid="login-email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input id="password" data-testid="login-password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <Button type="submit" data-testid="login-submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Masuk"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase tracking-widest">atau</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Button type="button" variant="outline" data-testid="google-login-btn" onClick={googleLogin}
            className="w-full h-11 rounded-xl border-slate-300 gap-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="h-5 w-5" />
            Lanjutkan dengan Google
          </Button>

          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
            <p className="font-semibold text-slate-700 mb-1">Akun demo admin:</p>
            admin@homecare.id / admin123
          </div>
        </div>
      </div>
    </div>
  );
}
