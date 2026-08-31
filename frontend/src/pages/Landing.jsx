import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  HeartPulse, MapPin, ShieldCheck, Stethoscope, ClipboardList, Star,
  Search, CalendarCheck, FileHeart, Wallet, ArrowRight,
} from "lucide-react";

const HERO = "https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";
const ABOUT = "https://images.unsplash.com/photo-1765896387387-0538bc9f997e?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";
const ELDER = "https://images.unsplash.com/photo-1762955911431-4c44c7c3f408?crop=entropy&cs=srgb&fm=jpg&q=85&w=1000";

const layanan = [
  { icon: FileHeart, t: "Perawatan Luka", d: "Ganti perban & perawatan luka pasca operasi." },
  { icon: Stethoscope, t: "Cek Vital Sign", d: "Tekanan darah, gula darah & tanda vital." },
  { icon: HeartPulse, t: "Perawatan Lansia", d: "Pendampingan harian untuk orang tua tercinta." },
  { icon: ClipboardList, t: "Fisioterapi", d: "Terapi pemulihan gerak langsung di rumah." },
];

const steps = [
  { icon: Search, t: "Cari Nakes", d: "Temukan tenaga kesehatan terdekat sesuai kebutuhan." },
  { icon: CalendarCheck, t: "Buat Pesanan", d: "Pilih jadwal kunjungan & konfirmasi layanan." },
  { icon: HeartPulse, t: "Dilayani di Rumah", d: "Nakes datang & mencatat rekam medis SOAP." },
  { icon: Wallet, t: "Bayar & Ulas", d: "Bayar via QRIS/Cash lalu beri rating." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" data-testid="brand-logo">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 grid place-items-center">
              <HeartPulse className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading font-extrabold text-lg text-slate-900">
              HomeCare<span className="text-emerald-600">.id</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#layanan" className="hover:text-emerald-600 transition-colors">Layanan</a>
            <a href="#cara" className="hover:text-emerald-600 transition-colors">Cara Kerja</a>
            <a href="#nakes" className="hover:text-emerald-600 transition-colors">Untuk Nakes</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" data-testid="nav-login-btn" className="rounded-full">Masuk</Button>
            </Link>
            <Link to="/register">
              <Button data-testid="nav-register-btn" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">Daftar</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-5 py-16 md:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="h-4 w-4" /> Tenaga Kesehatan Terverifikasi
            </div>
            <h1 className="mt-6 font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.05]">
              Perawatan kesehatan <span className="text-emerald-600">datang ke rumah</span> Anda
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
              Pesan perawat & tenaga kesehatan profesional terdekat untuk perawatan luka, infus, lansia, fisioterapi, dan lainnya — lengkap dengan rekam medis digital.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register">
                <Button size="lg" data-testid="hero-cta-btn" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-7 h-12 text-base">
                  Pesan Sekarang <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a href="#cara">
                <Button size="lg" variant="outline" className="rounded-full px-7 h-12 text-base border-slate-300">
                  Lihat Cara Kerja
                </Button>
              </a>
            </div>
            <div className="mt-10 flex gap-8">
              {[["500+", "Tenaga Kesehatan"], ["24/7", "Layanan Tersedia"], ["4.9★", "Rating Pengguna"]].map(([n, l]) => (
                <div key={l}>
                  <div className="font-heading text-2xl font-extrabold text-slate-900">{n}</div>
                  <div className="text-sm text-slate-500">{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-emerald-200/40 rounded-[2rem] blur-2xl" />
            <img src={HERO} alt="Perawat home care" className="relative rounded-[2rem] shadow-xl object-cover w-full h-[440px]" />
            <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-sky-100 grid place-items-center">
                <MapPin className="h-5 w-5 text-sky-600" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Nakes terdekat</div>
                <div className="font-semibold text-slate-900 text-sm">1.2 km dari Anda</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Layanan */}
      <section id="layanan" className="max-w-7xl mx-auto px-5 py-16">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-bold text-slate-900">Layanan unggulan kami</h2>
          <p className="mt-3 text-slate-600">Berbagai layanan kesehatan yang bisa Anda pesan langsung ke rumah.</p>
        </div>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {layanan.map((l) => (
            <div key={l.t} className="group rounded-2xl border border-slate-200 bg-white p-6 hover:-translate-y-1 hover:shadow-sm transition-transform duration-200">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 grid place-items-center group-hover:bg-emerald-600 transition-colors">
                <l.icon className="h-6 w-6 text-emerald-600 group-hover:text-white transition-colors" />
              </div>
              <h3 className="mt-4 font-heading font-bold text-lg text-slate-900">{l.t}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{l.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cara kerja */}
      <section id="cara" className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-5 py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="font-heading text-3xl font-bold text-slate-900">Cara kerja HomeCare.id</h2>
            <p className="mt-3 text-slate-600">Empat langkah mudah mendapatkan perawatan di rumah.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.t} className="relative rounded-2xl border border-slate-200 p-6">
                <span className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-emerald-600 text-white grid place-items-center font-bold text-sm">{i + 1}</span>
                <s.icon className="h-8 w-8 text-emerald-600" />
                <h3 className="mt-4 font-heading font-bold text-slate-900">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nakes CTA */}
      <section id="nakes" className="max-w-7xl mx-auto px-5 py-16 grid lg:grid-cols-2 gap-12 items-center">
        <div className="grid grid-cols-2 gap-4">
          <img src={ABOUT} alt="Nakes" className="rounded-2xl object-cover h-64 w-full" />
          <img src={ELDER} alt="Perawatan lansia" className="rounded-2xl object-cover h-64 w-full mt-8" />
        </div>
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 text-sky-700 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
            <Stethoscope className="h-4 w-4" /> Untuk Tenaga Kesehatan
          </div>
          <h2 className="mt-6 font-heading text-3xl font-bold text-slate-900">Kembangkan praktik Anda bersama kami</h2>
          <p className="mt-4 text-slate-600 leading-relaxed">
            Daftarkan STR, SIP, dan sertifikat kompetensi Anda. Terima pesanan sesuai lokasi & keahlian, catat rekam medis SOAP, dan kelola pendapatan dari satu dashboard.
          </p>
          <ul className="mt-6 space-y-3">
            {["Verifikasi dokumen resmi", "Atur tarif & radius layanan sendiri", "Rekam medis & vital sign digital", "Pantau pendapatan real-time"].map((f) => (
              <li key={f} className="flex items-center gap-3 text-slate-700">
                <Star className="h-4 w-4 text-emerald-600 fill-emerald-600" /> {f}
              </li>
            ))}
          </ul>
          <Link to="/register">
            <Button className="mt-8 rounded-full bg-slate-900 hover:bg-slate-800 text-white px-7 h-12">Gabung sebagai Nakes</Button>
          </Link>
        </div>
      </section>

      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-5 py-10 flex flex-col md:flex-row justify-between gap-6">
          <div className="flex items-center gap-2 text-white">
            <HeartPulse className="h-5 w-5 text-emerald-400" />
            <span className="font-heading font-bold">HomeCare.id</span>
          </div>
          <p className="text-sm">© 2026 HomeCare Indonesia. Perawatan kesehatan tepercaya ke rumah Anda.</p>
        </div>
      </footer>
    </div>
  );
}
