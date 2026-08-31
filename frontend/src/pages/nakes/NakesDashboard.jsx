import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError, formatRupiah, formatTanggal } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import ChatDialog from "@/components/ChatDialog";
import DatePicker from "@/components/DatePicker";
import { StatusBadge, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, ClipboardList, Stethoscope, FileBadge, UserCog, Loader2,
  MessageCircle, Check, X, ClipboardPlus, Wallet, TrendingUp, Star, Trash2, ShieldCheck, MapPin, Clock,
} from "lucide-react";

const NAV = [
  { key: "beranda", label: "Ringkasan", icon: LayoutDashboard },
  { key: "pesanan", label: "Pesanan Masuk", icon: ClipboardList },
  { key: "layanan", label: "Layanan & Tarif", icon: Stethoscope },
  { key: "dokumen", label: "Dokumen Legal", icon: FileBadge },
  { key: "profil", label: "Profil & Lokasi", icon: UserCog },
];
const TITLES = { beranda: "Ringkasan", pesanan: "Pesanan Masuk", layanan: "Layanan & Tarif", dokumen: "Dokumen Legal", profil: "Profil & Lokasi" };

export default function NakesDashboard() {
  const [active, setActive] = useState("beranda");
  return (
    <DashboardShell nav={NAV} active={active} onNav={setActive} title={TITLES[active]}>
      {active === "beranda" && <Overview />}
      {active === "pesanan" && <Orders />}
      {active === "layanan" && <Services />}
      {active === "dokumen" && <Documents />}
      {active === "profil" && <Profile />}
    </DashboardShell>
  );
}

function VerifBanner() {
  const { user } = useAuth();
  const status = user?.profile?.status_verifikasi;
  if (status === "verified") return null;
  const msg = status === "rejected" ? "Verifikasi akun Anda ditolak. Perbarui dokumen dan hubungi admin." : "Akun Anda menunggu verifikasi admin. Lengkapi profil, dokumen & layanan agar segera diverifikasi. Anda belum akan muncul di pencarian pasien sampai terverifikasi.";
  return (
    <Card className={`p-4 mb-6 border ${status === "rejected" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-start gap-3">
        <ShieldCheck className={`h-5 w-5 mt-0.5 ${status === "rejected" ? "text-red-600" : "text-amber-600"}`} />
        <p className={`text-sm ${status === "rejected" ? "text-red-700" : "text-amber-700"}`}>{msg}</p>
      </div>
    </Card>
  );
}

function Overview() {
  const { user } = useAuth();
  const [income, setIncome] = useState(null);
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    api.get("/nakes/income").then(({ data }) => setIncome(data));
    api.get("/orders").then(({ data }) => setOrders(data));
  }, []);
  const p = user?.profile || {};
  const pending = orders.filter((o) => o.status_order === "pending").length;
  const stats = [
    { label: "Total Pendapatan", value: formatRupiah(income?.total_pendapatan || 0), icon: Wallet, color: "bg-emerald-100 text-emerald-600" },
    { label: "Pesanan Menunggu", value: pending, icon: ClipboardList, color: "bg-amber-100 text-amber-600" },
    { label: "Rating", value: `${p.rating_rata_rata || 0} ★`, icon: Star, color: "bg-sky-100 text-sky-600" },
    { label: "Transaksi Selesai", value: income?.jumlah_transaksi || 0, icon: TrendingUp, color: "bg-violet-100 text-violet-600" },
  ];
  return (
    <div>
      <VerifBanner />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 border-slate-200" data-testid="stat-card">
            <div className={`h-10 w-10 rounded-xl grid place-items-center ${s.color}`}><s.icon className="h-5 w-5" /></div>
            <div className="mt-3 font-heading text-2xl font-extrabold text-slate-900">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </Card>
        ))}
      </div>
      <h3 className="font-heading font-bold text-slate-900 mt-8 mb-3">Riwayat Pendapatan</h3>
      {income?.transaksi?.length ? (
        <Card className="border-slate-200 divide-y">
          {income.transaksi.map((t) => (
            <div key={t.id} className="p-4 flex justify-between items-center">
              <div><div className="text-sm text-slate-500">{formatTanggal(t.tanggal_transaksi)}</div><div className="text-xs text-slate-400">Komisi platform {formatRupiah(t.komisi_platform)}</div></div>
              <div className="font-semibold text-emerald-600">+{formatRupiah(t.pendapatan_nakes)}</div>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon={Wallet} text="Belum ada pendapatan." />}
    </div>
  );
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState(null);
  const [soap, setSoap] = useState(null);
  const load = useCallback(async () => { setLoading(true); const { data } = await api.get("/orders"); setOrders(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const respond = async (o, action) => {
    try { await api.put(`/orders/${o.id}/respond`, { action }); toast.success(action === "accept" ? "Pesanan diterima" : "Pesanan ditolak"); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (orders.length === 0) return <EmptyState icon={ClipboardList} text="Belum ada pesanan masuk." />;
  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Card key={o.id} className="p-5 border-slate-200" data-testid="nakes-order-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="font-heading font-bold text-slate-900">{o.nama_layanan}</span><StatusBadge status={o.status_order} /></div>
              <p className="text-sm text-slate-500 mt-1">Pasien: {o.patient_nama} • {o.patient_hp}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />{formatTanggal(o.jadwal_kunjungan)}</p>
              <p className="text-sm text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{o.alamat} ({o.jarak_km} km)</p>
              {o.catatan_pasien && <p className="text-sm text-slate-600 mt-1 italic">"{o.catatan_pasien}"</p>}
            </div>
            <div className="text-right"><div className="text-xs text-slate-400">Total</div><div className="font-heading font-bold text-emerald-600">{formatRupiah(o.total_biaya)}</div>{o.payment && <div className="mt-1"><StatusBadge status={o.payment.status_pembayaran} /></div>}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setChat(o)} data-testid="order-chat"><MessageCircle className="h-4 w-4" /> Chat</Button>
            {o.status_order === "pending" && <>
              <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => respond(o, "accept")} data-testid="accept-order"><Check className="h-4 w-4" /> Terima</Button>
              <Button size="sm" variant="outline" className="rounded-full text-red-600 border-red-200 hover:bg-red-50" onClick={() => respond(o, "reject")} data-testid="reject-order"><X className="h-4 w-4" /> Tolak</Button>
            </>}
            {o.status_order === "accepted" && !o.has_record && <Button size="sm" className="rounded-full bg-sky-600 hover:bg-sky-700 text-white" onClick={() => setSoap(o)} data-testid="fill-soap"><ClipboardPlus className="h-4 w-4" /> Isi Rekam Medis</Button>}
            {o.has_record && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" /> Rekam medis selesai</span>}
          </div>
        </Card>
      ))}
      {chat && <ChatDialog orderId={chat.id} open onOpenChange={() => setChat(null)} title={chat.patient_nama} />}
      {soap && <SoapDialog order={soap} onClose={() => setSoap(null)} onDone={load} />}
    </div>
  );
}

function SoapDialog({ order, onClose, onDone }) {
  const [f, setF] = useState({ diagnosis: "", tindakan: "", catatan_tambahan: "", keluhan: "", tekanan_darah: "", nadi: "", respirasi: "", suhu: "", spo2: "", kondisi_luka: "", assessment: "", plan: "" });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.keluhan || !f.tekanan_darah || !f.nadi || !f.suhu) return toast.error("Isi minimal keluhan & vital sign utama (TD, Nadi, Suhu)");
    setLoading(true);
    try {
      await api.post(`/orders/${order.id}/medical-record`, {
        diagnosis: f.diagnosis, tindakan: f.tindakan, catatan_tambahan: f.catatan_tambahan,
        soap: { keluhan: f.keluhan, tekanan_darah: f.tekanan_darah, nadi: f.nadi, respirasi: f.respirasi, suhu: f.suhu, spo2: f.spo2, kondisi_luka: f.kondisi_luka, assessment: f.assessment, plan: f.plan },
        attachments: [],
      });
      toast.success("Rekam medis tersimpan & layanan selesai");
      onDone(); onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Rekam Medis SOAP — {order.patient_nama}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Section title="S — Subjektif">
            <FieldT label="Keluhan pasien *" value={f.keluhan} onChange={set("keluhan")} />
          </Section>
          <Section title="O — Objektif (Vital Sign)">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <FieldI label="Tekanan Darah *" value={f.tekanan_darah} onChange={set("tekanan_darah")} ph="120/80" />
              <FieldI label="Nadi *" value={f.nadi} onChange={set("nadi")} ph="80x/mnt" />
              <FieldI label="Respirasi" value={f.respirasi} onChange={set("respirasi")} ph="20x/mnt" />
              <FieldI label="Suhu *" value={f.suhu} onChange={set("suhu")} ph="36.5°C" />
              <FieldI label="SpO2" value={f.spo2} onChange={set("spo2")} ph="98%" />
            </div>
            <FieldT label="Kondisi luka (jika ada)" value={f.kondisi_luka} onChange={set("kondisi_luka")} />
          </Section>
          <Section title="A — Assessment"><FieldT label="Penilaian kondisi" value={f.assessment} onChange={set("assessment")} /></Section>
          <Section title="P — Plan"><FieldT label="Rencana tindak lanjut" value={f.plan} onChange={set("plan")} /></Section>
          <div className="grid sm:grid-cols-2 gap-3">
            <FieldI label="Diagnosis" value={f.diagnosis} onChange={set("diagnosis")} />
            <FieldI label="Tindakan" value={f.tindakan} onChange={set("tindakan")} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} data-testid="submit-soap" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan & Selesaikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Section = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200 p-4">
    <h4 className="font-heading font-bold text-slate-900 mb-3 text-sm">{title}</h4>
    <div className="space-y-3">{children}</div>
  </div>
);
const FieldI = ({ label, value, onChange, ph }) => (<div><Label className="text-xs">{label}</Label><Input value={value} onChange={onChange} placeholder={ph} className="mt-1 h-10 rounded-lg" /></div>);
const FieldT = ({ label, value, onChange }) => (<div><Label className="text-xs">{label}</Label><Textarea value={value} onChange={onChange} className="mt-1 rounded-lg" rows={2} /></div>);

function Services() {
  const { user, refresh } = useAuth();
  const [services, setServices] = useState([]);
  const [mine, setMine] = useState(user?.profile?.services || []);
  const [serviceId, setServiceId] = useState("");
  const [tarif, setTarif] = useState("");
  const [durasi, setDurasi] = useState("60");
  useEffect(() => { api.get("/services").then(({ data }) => setServices(data)); }, []);
  useEffect(() => { setMine(user?.profile?.services || []); }, [user]);

  const add = async () => {
    if (!serviceId || !tarif) return toast.error("Pilih layanan & isi tarif");
    try {
      const { data } = await api.post("/nakes/services", { service_id: serviceId, tarif_nakes: Number(tarif), durasi_estimasi: Number(durasi) });
      setMine([...mine, data]); setServiceId(""); setTarif(""); toast.success("Layanan ditambahkan"); refresh();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const remove = async (id) => { await api.delete(`/nakes/services/${id}`); setMine(mine.filter((m) => m.id !== id)); refresh(); };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-5 border-slate-200">
        <h3 className="font-heading font-bold text-slate-900 mb-4">Tambah Layanan</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Label>Layanan</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="svc-select"><SelectValue placeholder="Pilih layanan" /></SelectTrigger>
              <SelectContent>{services.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama_layanan} — dasar {formatRupiah(s.tarif_dasar)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tarif (Rp)</Label><Input type="number" value={tarif} onChange={(e) => setTarif(e.target.value)} className="mt-1.5 h-11 rounded-xl" data-testid="svc-tarif" /></div>
          <div><Label>Durasi (menit)</Label><Input type="number" value={durasi} onChange={(e) => setDurasi(e.target.value)} className="mt-1.5 h-11 rounded-xl" /></div>
          <div className="flex items-end"><Button onClick={add} data-testid="svc-add" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Tambah</Button></div>
        </div>
      </Card>
      <div>
        <h3 className="font-heading font-bold text-slate-900 mb-3">Layanan Anda</h3>
        {mine.length === 0 ? <EmptyState icon={Stethoscope} text="Belum ada layanan. Tambahkan agar muncul di pencarian." /> : (
          <div className="space-y-2">
            {mine.map((m) => (
              <Card key={m.id} className="p-4 border-slate-200 flex items-center justify-between" data-testid="svc-item">
                <div><div className="font-semibold text-slate-900">{m.nama_layanan}</div><div className="text-sm text-slate-500">{formatRupiah(m.tarif_nakes)} • {m.durasi_estimasi} menit</div></div>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Documents() {
  const { user, refresh } = useAuth();
  const [docs, setDocs] = useState(user?.profile?.documents || []);
  const [f, setF] = useState({ jenis_dokumen: "STR", nomor_dokumen: "", tanggal_valid: "" });
  useEffect(() => { setDocs(user?.profile?.documents || []); }, [user]);
  const add = async () => {
    if (!f.nomor_dokumen || !f.tanggal_valid) return toast.error("Lengkapi nomor & tanggal valid");
    try { const { data } = await api.post("/nakes/documents", f); setDocs([...docs, data]); setF({ ...f, nomor_dokumen: "", tanggal_valid: "" }); toast.success("Dokumen ditambahkan"); refresh(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="p-5 border-slate-200">
        <h3 className="font-heading font-bold text-slate-900 mb-4">Unggah Dokumen Legal</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Jenis Dokumen</Label>
            <Select value={f.jenis_dokumen} onValueChange={(v) => setF({ ...f, jenis_dokumen: v })}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="STR">STR</SelectItem><SelectItem value="SIP">SIP</SelectItem><SelectItem value="Sertifikat">Sertifikat Kompetensi</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Nomor Dokumen</Label><Input value={f.nomor_dokumen} onChange={(e) => setF({ ...f, nomor_dokumen: e.target.value })} className="mt-1.5 h-11 rounded-xl" data-testid="doc-nomor" /></div>
          <div><Label>Berlaku Sampai</Label><DatePicker value={f.tanggal_valid} onChange={(v) => setF({ ...f, tanggal_valid: v })} testId="doc-valid" placeholder="Tanggal kedaluwarsa" fromYear={2020} /></div>
          <div className="flex items-end"><Button onClick={add} data-testid="doc-add" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Tambah Dokumen</Button></div>
        </div>
      </Card>
      {docs.length === 0 ? <EmptyState icon={FileBadge} text="Belum ada dokumen legal." /> : (
        <div className="space-y-2">
          {docs.map((d) => (
            <Card key={d.id} className="p-4 border-slate-200 flex items-center justify-between">
              <div><div className="font-semibold text-slate-900">{d.jenis_dokumen} — {d.nomor_dokumen}</div><div className="text-sm text-slate-500">Berlaku sampai {d.tanggal_valid}</div></div>
              <StatusBadge status={d.status_verifikasi_admin} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Profile() {
  const { user, refresh } = useAuth();
  const p = user?.profile || {};
  const [f, setF] = useState({ gelar: p.gelar || "", spesialisasi: p.spesialisasi || "", pengalaman_tahun: p.pengalaman_tahun ?? "", deskripsi_bio: p.deskripsi_bio || "", alamat: p.alamat || "", latitude: p.latitude ?? "", longitude: p.longitude ?? "", radius_layanan: p.radius_layanan ?? 10 });
  const [online, setOnline] = useState(p.status_online || false);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const toggle = async (v) => { setOnline(v); await api.put("/nakes/status", { status_online: v }); toast.success(v ? "Anda sekarang online" : "Anda offline"); refresh(); };
  const save = async () => {
    setLoading(true);
    try {
      await api.put("/nakes/profile", { ...f, pengalaman_tahun: f.pengalaman_tahun === "" ? null : Number(f.pengalaman_tahun), latitude: f.latitude === "" ? null : parseFloat(f.latitude), longitude: f.longitude === "" ? null : parseFloat(f.longitude), radius_layanan: Number(f.radius_layanan) });
      await refresh(); toast.success("Profil tersimpan");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="p-5 border-slate-200 flex items-center justify-between">
        <div><div className="font-heading font-bold text-slate-900">Status Ketersediaan</div><div className="text-sm text-slate-500">Aktifkan agar bisa menerima pesanan & muncul di pencarian.</div></div>
        <Switch checked={online} onCheckedChange={toggle} data-testid="online-toggle" />
      </Card>
      <Card className="p-6 border-slate-200">
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Gelar</Label><Input value={f.gelar} onChange={set("gelar")} placeholder="Ns., S.Kep" className="mt-1.5 h-11 rounded-xl" /></div>
          <div><Label>Spesialisasi</Label><Input value={f.spesialisasi} onChange={set("spesialisasi")} placeholder="Perawat Luka" className="mt-1.5 h-11 rounded-xl" data-testid="nakes-spesialisasi" /></div>
          <div><Label>Pengalaman (tahun)</Label><Input type="number" value={f.pengalaman_tahun} onChange={set("pengalaman_tahun")} className="mt-1.5 h-11 rounded-xl" /></div>
          <div className="md:col-span-2"><Label>Bio / Deskripsi</Label><Textarea value={f.deskripsi_bio} onChange={set("deskripsi_bio")} className="mt-1.5 rounded-xl" /></div>
          <div className="md:col-span-2"><Label>Alamat Praktik</Label><Textarea value={f.alamat} onChange={set("alamat")} className="mt-1.5 rounded-xl" /></div>
          <div><Label>Latitude</Label><Input type="number" step="any" value={f.latitude} onChange={set("latitude")} className="mt-1.5 h-11 rounded-xl" data-testid="nakes-lat" /></div>
          <div><Label>Longitude</Label><Input type="number" step="any" value={f.longitude} onChange={set("longitude")} className="mt-1.5 h-11 rounded-xl" data-testid="nakes-lng" /></div>
          <div className="md:col-span-2">
            <div className="flex justify-between"><Label>Radius Layanan</Label><span className="text-sm font-semibold text-emerald-600">{f.radius_layanan} km</span></div>
            <Slider value={[Number(f.radius_layanan)]} onValueChange={(v) => setF({ ...f, radius_layanan: v[0] })} min={1} max={50} step={1} className="mt-3" />
          </div>
        </div>
        <Button onClick={save} disabled={loading} data-testid="save-nakes-profile" className="mt-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-8">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan Profil"}
        </Button>
      </Card>
    </div>
  );
}
