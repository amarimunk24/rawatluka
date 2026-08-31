import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HeartPulse, Loader2, User, Stethoscope } from "lucide-react";

const roleRoute = { patient: "/pasien", nakes: "/nakes" };

export default function Register() {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [role, setRole] = useState("patient");
  const [form, setForm] = useState({ nama_lengkap: "", email: "", nomor_hp: "", password: "" });
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const googleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", { ...form, role });
      loginWithToken(data.token, data.user);
      toast.success("Akun berhasil dibuat!");
      navigate(roleRoute[role], { replace: true });
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 p-12 text-white relative overflow-hidden">
        <div className="grain-overlay absolute inset-0" />
        <Link to="/" className="relative flex items-center gap-2">
          <HeartPulse className="h-7 w-7 text-emerald-400" />
          <span className="font-heading font-extrabold text-xl">HomeCare.id</span>
        </Link>
        <div className="relative">
          <h2 className="font-heading text-4xl font-extrabold leading-tight">Mulai perjalanan<br />kesehatan Anda.</h2>
          <p className="mt-4 text-slate-300 text-lg max-w-md">Bergabung sebagai pasien atau tenaga kesehatan dalam hitungan menit.</p>
        </div>
        <p className="relative text-slate-400 text-sm">© 2026 HomeCare Indonesia</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <h1 className="font-heading text-3xl font-extrabold text-slate-900">Buat akun baru</h1>
          <p className="mt-2 text-slate-500">Sudah punya akun?{" "}
            <Link to="/login" className="text-emerald-600 font-semibold hover:underline" data-testid="goto-login">Masuk</Link>
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            {[["patient", "Pasien", User], ["nakes", "Nakes", Stethoscope]].map(([val, label, Icon]) => (
              <button key={val} type="button" data-testid={`role-${val}`} onClick={() => setRole(val)}
                className={`flex items-center gap-2 rounded-xl border-2 p-4 transition-colors ${role === val ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}>
                <Icon className={`h-5 w-5 ${role === val ? "text-emerald-600" : "text-slate-400"}`} />
                <span className={`font-semibold ${role === val ? "text-emerald-700" : "text-slate-600"}`}>{label}</span>
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="nama">Nama Lengkap</Label>
              <Input id="nama" data-testid="reg-nama" required value={form.nama_lengkap} onChange={set("nama_lengkap")}
                placeholder="Nama lengkap Anda" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" data-testid="reg-email" type="email" required value={form.email} onChange={set("email")}
                placeholder="nama@email.com" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="hp">Nomor HP</Label>
              <Input id="hp" data-testid="reg-hp" required value={form.nomor_hp} onChange={set("nomor_hp")}
                placeholder="08xxxxxxxxxx" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="pw">Kata Sandi</Label>
              <Input id="pw" data-testid="reg-password" type="password" required minLength={6} value={form.password} onChange={set("password")}
                placeholder="Minimal 6 karakter" className="mt-1.5 h-11 rounded-xl" />
            </div>
            <Button type="submit" data-testid="register-submit" disabled={loading}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : `Daftar sebagai ${role === "patient" ? "Pasien" : "Nakes"}`}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 uppercase tracking-widest">atau</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
          <Button type="button" variant="outline" data-testid="google-register-btn" onClick={googleLogin}
            className="w-full h-11 rounded-xl border-slate-300 gap-3">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" className="h-5 w-5" />
            Daftar dengan Google
          </Button>
          <p className="mt-3 text-xs text-slate-400 text-center">Pendaftaran via Google otomatis sebagai Pasien.</p>
        </div>
      </div>
    </div>
  );
}
