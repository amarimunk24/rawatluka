import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError, formatRupiah, formatTanggal } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell";
import ChatDialog from "@/components/ChatDialog";
import DatePicker from "@/components/DatePicker";
import { StatusBadge, StarRating } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Home, ClipboardList, FileHeart, UserCog, Search, MapPin, Star, MessageCircle,
  Wallet, CalendarIcon, Loader2, Stethoscope, Clock, Printer, QrCode, Banknote,
} from "lucide-react";

const NAV = [
  { key: "beranda", label: "Beranda", icon: Home },
  { key: "pesanan", label: "Pesanan Saya", icon: ClipboardList },
  { key: "rekam", label: "Rekam Medis", icon: FileHeart },
  { key: "profil", label: "Profil", icon: UserCog },
];
const TITLES = { beranda: "Cari Tenaga Kesehatan", pesanan: "Pesanan Saya", rekam: "Rekam Medis", profil: "Profil Saya" };
const JAKARTA = { lat: -6.2088, lng: 106.8456 };
const TIME_SLOTS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "18:00"];

export default function PatientDashboard() {
  const [active, setActive] = useState("beranda");
  return (
    <DashboardShell nav={NAV} active={active} onNav={setActive} title={TITLES[active]}>
      {active === "beranda" && <SearchSection />}
      {active === "pesanan" && <OrdersSection />}
      {active === "rekam" && <RecordsSection />}
      {active === "profil" && <ProfileSection />}
    </DashboardShell>
  );
}

/* ---------------- Search ---------------- */
function SearchSection() {
  const { user } = useAuth();
  const p = user?.profile || {};
  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");
  const [lat, setLat] = useState(p.latitude ?? JAKARTA.lat);
  const [lng, setLng] = useState(p.longitude ?? JAKARTA.lng);
  const [alamat, setAlamat] = useState(p.alamat || "");
  const [maxDist, setMaxDist] = useState(30);
  const [minRating, setMinRating] = useState("0");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(null);

  useEffect(() => { api.get("/services").then(({ data }) => setServices(data)); }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolokasi tidak didukung");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); toast.success("Lokasi diperbarui"); },
      () => toast.error("Gagal mendapatkan lokasi")
    );
  };

  const search = async () => {
    if (!serviceId) return toast.error("Pilih layanan terlebih dahulu");
    setLoading(true);
    try {
      const { data } = await api.get("/providers/search", {
        params: { service_id: serviceId, lat, lng, max_distance: maxDist, min_rating: Number(minRating) },
      });
      setResults(data);
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 md:p-6 border-slate-200">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Layanan yang dibutuhkan</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="search-service"><SelectValue placeholder="Pilih layanan" /></SelectTrigger>
              <SelectContent>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.nama_layanan}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Alamat lokasi</Label>
            <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat kunjungan" className="mt-1.5 h-11 rounded-xl" data-testid="search-alamat" />
          </div>
          <div>
            <Label>Koordinat (Lat, Lng)</Label>
            <div className="flex gap-2 mt-1.5">
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(parseFloat(e.target.value))} className="h-11 rounded-xl" data-testid="search-lat" />
              <Input type="number" step="any" value={lng} onChange={(e) => setLng(parseFloat(e.target.value))} className="h-11 rounded-xl" data-testid="search-lng" />
              <Button type="button" variant="outline" onClick={useMyLocation} className="h-11 rounded-xl shrink-0"><MapPin className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <Label>Rating minimum</Label>
            <Select value={minRating} onValueChange={setMinRating}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Semua</SelectItem>
                <SelectItem value="3">3★ ke atas</SelectItem>
                <SelectItem value="4">4★ ke atas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <div className="flex justify-between"><Label>Radius pencarian</Label><span className="text-sm font-semibold text-emerald-600">{maxDist} km</span></div>
            <Slider value={[maxDist]} onValueChange={(v) => setMaxDist(v[0])} min={1} max={50} step={1} className="mt-3" />
          </div>
        </div>
        <Button onClick={search} disabled={loading} data-testid="search-submit" className="mt-5 w-full md:w-auto h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-8">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-4 w-4" /> Cari Nakes</>}
        </Button>
      </Card>

      {results !== null && (
        <div>
          <h3 className="font-heading font-bold text-slate-900 mb-4">{results.length} tenaga kesehatan ditemukan</h3>
          {results.length === 0 && (
            <Card className="p-10 text-center text-slate-500 border-dashed">
              <Stethoscope className="h-10 w-10 mx-auto text-slate-300" />
              <p className="mt-3">Tidak ada nakes online untuk layanan ini di sekitar Anda. Coba perluas radius.</p>
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((r) => (
              <Card key={r.nakes_id} className="p-5 border-slate-200 hover:-translate-y-1 hover:shadow-sm transition-transform duration-200" data-testid="provider-card">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14"><AvatarImage src={r.foto_profil} /><AvatarFallback className="bg-emerald-100 text-emerald-700">{r.nama?.[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{r.gelar ? `${r.gelar} ` : ""}{r.nama}</div>
                    <div className="text-sm text-slate-500 truncate">{r.spesialisasi || "Tenaga Kesehatan"}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <StarRating value={r.rating_rata_rata} size={14} />
                  <span className="text-slate-500">({r.jumlah_review})</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{r.jarak_km} km</span>
                </div>
                {r.pengalaman_tahun != null && <p className="mt-2 text-xs text-slate-500">{r.pengalaman_tahun} tahun pengalaman</p>}
                <div className="mt-4 flex items-center justify-between">
                  <div><div className="text-xs text-slate-400">Tarif</div><div className="font-heading font-bold text-emerald-600">{formatRupiah(r.tarif_nakes)}</div></div>
                  <Button onClick={() => setBooking(r)} data-testid="book-btn" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">Pesan</Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {booking && <BookDialog provider={booking} serviceId={serviceId} alamat={alamat} lat={lat} lng={lng} onClose={() => setBooking(null)} />}
    </div>
  );
}

function BookDialog({ provider, serviceId, alamat, lat, lng, onClose }) {
  const [date, setDate] = useState();
  const [slot, setSlot] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!date || !slot) return toast.error("Pilih tanggal & jam kunjungan");
    if (!alamat) return toast.error("Isi alamat pada form pencarian");
    setLoading(true);
    const jadwal = new Date(date);
    const [h, m] = slot.split(":");
    jadwal.setHours(Number(h), Number(m), 0, 0);
    try {
      await api.post("/orders", {
        nakes_id: provider.nakes_id, service_id: serviceId, jadwal_kunjungan: jadwal.toISOString(),
        catatan_pasien: catatan, alamat, latitude: lat, longitude: lng,
      });
      toast.success("Pesanan berhasil dibuat! Menunggu konfirmasi nakes.");
      onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const transport = Math.round(provider.jarak_km * 3000);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pesan Layanan</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10"><AvatarImage src={provider.foto_profil} /><AvatarFallback>{provider.nama?.[0]}</AvatarFallback></Avatar>
            <div><div className="font-semibold text-slate-900">{provider.nama}</div><div className="text-xs text-slate-500">{provider.nama_layanan}</div></div>
          </div>
          <div>
            <Label>Tanggal kunjungan</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" data-testid="book-date" className="mt-1.5 w-full h-11 rounded-xl justify-start font-normal">
                  <CalendarIcon className="h-4 w-4 mr-2" />{date ? date.toLocaleDateString("id-ID") : "Pilih tanggal"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))} /></PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Jam kunjungan</Label>
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl" data-testid="book-time"><SelectValue placeholder="Pilih jam" /></SelectTrigger>
              <SelectContent>{TIME_SLOTS.map((t) => <SelectItem key={t} value={t}><Clock className="h-3 w-3 inline mr-2" />{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Catatan (opsional)</Label>
            <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Keluhan atau instruksi khusus" className="mt-1.5 rounded-xl" data-testid="book-note" />
          </div>
          <div className="rounded-xl border border-slate-200 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Tarif layanan</span><span className="font-medium">{formatRupiah(provider.tarif_nakes)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Transport ({provider.jarak_km} km)</span><span className="font-medium">{formatRupiah(transport)}</span></div>
            <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900"><span>Total</span><span className="text-emerald-600">{formatRupiah(provider.tarif_nakes + transport)}</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} data-testid="book-confirm" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Konfirmasi Pesanan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Orders ---------------- */
function OrdersSection() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState(null);
  const [pay, setPay] = useState(null);
  const [review, setReview] = useState(null);
  const [record, setRecord] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get("/orders");
    setOrders(data);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (orders.length === 0) return <EmptyState icon={ClipboardList} text="Belum ada pesanan. Cari nakes di menu Beranda." />;

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <Card key={o.id} className="p-5 border-slate-200" data-testid="order-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-slate-900">{o.nama_layanan}</span>
                <StatusBadge status={o.status_order} />
              </div>
              <p className="text-sm text-slate-500 mt-1">Nakes: {o.nakes_nama} • {formatTanggal(o.jadwal_kunjungan)}</p>
              <p className="text-sm text-slate-500">{o.alamat}</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400">Total</div>
              <div className="font-heading font-bold text-emerald-600">{formatRupiah(o.total_biaya)}</div>
              {o.payment && <div className="mt-1"><StatusBadge status={o.payment.status_pembayaran} /></div>}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setChat(o)} data-testid="order-chat"><MessageCircle className="h-4 w-4" /> Chat</Button>
            {o.has_record && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setRecord(o)} data-testid="order-record"><FileHeart className="h-4 w-4" /> Rekam Medis</Button>}
            {o.status_order === "completed" && !o.payment && <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setPay(o)} data-testid="order-pay"><Wallet className="h-4 w-4" /> Bayar</Button>}
            {o.status_order === "completed" && !o.has_review && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setReview(o)} data-testid="order-review"><Star className="h-4 w-4" /> Beri Ulasan</Button>}
          </div>
        </Card>
      ))}
      {chat && <ChatDialog orderId={chat.id} open onOpenChange={() => setChat(null)} title={chat.nakes_nama} />}
      {pay && <PayDialog order={pay} onClose={() => setPay(null)} onDone={load} />}
      {review && <ReviewDialog order={review} onClose={() => setReview(null)} onDone={load} />}
      {record && <RecordDialog orderId={record.id} onClose={() => setRecord(null)} />}
    </div>
  );
}

function PayDialog({ order, onClose, onDone }) {
  const [metode, setMetode] = useState("qris");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/orders/${order.id}/payment`, { metode_pembayaran: metode });
      toast.success("Pembayaran dikirim! Menunggu verifikasi admin.");
      onDone(); onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Pembayaran — {formatRupiah(order.total_biaya)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {[["qris", "QRIS", QrCode], ["cash", "Tunai", Banknote]].map(([v, l, Icon]) => (
            <button key={v} onClick={() => setMetode(v)} data-testid={`pay-${v}`}
              className={`rounded-xl border-2 p-4 flex flex-col items-center gap-2 transition-colors ${metode === v ? "border-emerald-600 bg-emerald-50" : "border-slate-200"}`}>
              <Icon className={`h-6 w-6 ${metode === v ? "text-emerald-600" : "text-slate-400"}`} />
              <span className={`font-semibold ${metode === v ? "text-emerald-700" : "text-slate-600"}`}>{l}</span>
            </button>
          ))}
        </div>
        {metode === "qris" && (
          <div className="rounded-xl bg-slate-50 p-4 text-center">
            <img alt="QRIS" className="mx-auto h-40 w-40" src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=HOMECARE-QRIS-PAYMENT" />
            <p className="text-xs text-slate-500 mt-2">Pindai QRIS ini dengan aplikasi pembayaran Anda (simulasi).</p>
          </div>
        )}
        {metode === "cash" && <p className="text-sm text-slate-500 rounded-xl bg-slate-50 p-4">Bayar tunai langsung kepada nakes saat kunjungan. Admin akan memverifikasi pembayaran.</p>}
        <DialogFooter>
          <Button onClick={submit} disabled={loading} data-testid="pay-confirm" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Konfirmasi Pembayaran"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({ order, onClose, onDone }) {
  const [rating, setRating] = useState(5);
  const [komentar, setKomentar] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await api.post(`/orders/${order.id}/review`, { rating, komentar });
      toast.success("Terima kasih atas ulasan Anda!");
      onDone(); onClose();
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Beri Ulasan untuk {order.nakes_nama}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center py-2"><StarRating value={rating} size={36} editable onChange={setRating} /></div>
          <Textarea value={komentar} onChange={(e) => setKomentar(e.target.value)} placeholder="Bagaimana pengalaman Anda?" className="rounded-xl" data-testid="review-comment" />
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} data-testid="review-submit" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Kirim Ulasan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Records ---------------- */
function RecordsSection() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState(null);
  useEffect(() => { api.get("/patient/medical-records").then(({ data }) => { setRecs(data); setLoading(false); }); }, []);
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (recs.length === 0) return <EmptyState icon={FileHeart} text="Belum ada rekam medis." />;
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {recs.map((r) => (
        <Card key={r.id} className="p-5 border-slate-200 cursor-pointer hover:shadow-sm transition-shadow" onClick={() => setView(r)} data-testid="record-card">
          <div className="flex items-center justify-between">
            <span className="font-heading font-bold text-slate-900">{r.nama_layanan}</span>
            <FileHeart className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="text-sm text-slate-500 mt-1">{r.nakes_nama} • {formatTanggal(r.tanggal_pelayanan)}</p>
          {r.diagnosis && <p className="text-sm text-slate-600 mt-2 line-clamp-2"><span className="font-medium">Diagnosis:</span> {r.diagnosis}</p>}
        </Card>
      ))}
      {view && <RecordView rec={view} onClose={() => setView(null)} />}
    </div>
  );
}

function RecordDialog({ orderId, onClose }) {
  const [rec, setRec] = useState(null);
  useEffect(() => { api.get(`/orders/${orderId}/medical-record`).then(({ data }) => setRec(data)).catch(() => onClose()); }, [orderId]);
  if (!rec) return null;
  return <RecordView rec={rec} onClose={onClose} />;
}

function RecordView({ rec, onClose }) {
  const s = rec.soap || {};
  const vitals = [["Tekanan Darah", s.tekanan_darah], ["Nadi", s.nadi], ["Respirasi", s.respirasi], ["Suhu", s.suhu], ["SpO2", s.spo2]];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Rekam Medis — {rec.nama_layanan}</DialogTitle></DialogHeader>
        <div id="record-print" className="space-y-4 text-sm">
          <p className="text-slate-500">{formatTanggal(rec.tanggal_pelayanan)}</p>
          {rec.diagnosis && <Field label="Diagnosis" value={rec.diagnosis} />}
          {rec.tindakan && <Field label="Tindakan" value={rec.tindakan} />}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <h4 className="font-heading font-bold text-slate-900">Catatan SOAP</h4>
            <Field label="S — Subjektif (Keluhan)" value={s.keluhan} />
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1">O — Objektif (Vital Sign)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {vitals.map(([l, v]) => <div key={l} className="rounded-lg bg-slate-50 p-2"><div className="text-[10px] text-slate-400">{l}</div><div className="font-semibold text-slate-800">{v || "-"}</div></div>)}
              </div>
              {s.kondisi_luka && <p className="mt-2 text-slate-600"><span className="font-medium">Kondisi luka:</span> {s.kondisi_luka}</p>}
            </div>
            <Field label="A — Assessment" value={s.assessment} />
            <Field label="P — Plan" value={s.plan} />
          </div>
          {rec.catatan_tambahan && <Field label="Catatan Tambahan" value={rec.catatan_tambahan} />}
          {rec.attachments?.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {rec.attachments.map((a, i) => <img key={i} src={a} alt="lampiran" className="rounded-lg h-24 w-full object-cover" />)}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl" data-testid="print-record"><Printer className="h-4 w-4" /> Unduh / Cetak PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }) {
  if (!value) return null;
  return <div><div className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</div><p className="text-slate-700 mt-0.5 whitespace-pre-wrap">{value}</p></div>;
}

/* ---------------- Profile ---------------- */
function ProfileSection() {
  const { user, refresh } = useAuth();
  const p = user?.profile || {};
  const [form, setForm] = useState({
    tanggal_lahir: p.tanggal_lahir || "", jenis_kelamin: p.jenis_kelamin || "", alamat: p.alamat || "",
    latitude: p.latitude ?? "", longitude: p.longitude ?? "", kontak_darurat: p.kontak_darurat || "",
    riwayat_penyakit: p.riwayat_penyakit || "", alergi: p.alergi || "", obat_rutin: p.obat_rutin || "",
  });
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target?.value ?? e });

  const save = async () => {
    setLoading(true);
    try {
      const payload = { ...form, latitude: form.latitude === "" ? null : parseFloat(form.latitude), longitude: form.longitude === "" ? null : parseFloat(form.longitude) };
      await api.put("/patient/profile", payload);
      await refresh();
      toast.success("Profil tersimpan");
    } catch (e) { toast.error(apiError(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  return (
    <Card className="p-6 border-slate-200 max-w-2xl">
      <div className="grid md:grid-cols-2 gap-4">
        <div><Label>Tanggal Lahir</Label><DatePicker value={form.tanggal_lahir} onChange={set("tanggal_lahir")} testId="profile-dob" placeholder="Pilih tanggal lahir" toYear={2026} /></div>
        <div>
          <Label>Jenis Kelamin</Label>
          <Select value={form.jenis_kelamin} onValueChange={set("jenis_kelamin")}>
            <SelectTrigger className="mt-1.5 h-11 rounded-xl"><SelectValue placeholder="Pilih" /></SelectTrigger>
            <SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2"><Label>Alamat</Label><Textarea value={form.alamat} onChange={set("alamat")} className="mt-1.5 rounded-xl" /></div>
        <div><Label>Latitude</Label><Input type="number" step="any" value={form.latitude} onChange={set("latitude")} className="mt-1.5 h-11 rounded-xl" /></div>
        <div><Label>Longitude</Label><Input type="number" step="any" value={form.longitude} onChange={set("longitude")} className="mt-1.5 h-11 rounded-xl" /></div>
        <div><Label>Kontak Darurat</Label><Input value={form.kontak_darurat} onChange={set("kontak_darurat")} className="mt-1.5 h-11 rounded-xl" /></div>
        <div><Label>Alergi</Label><Input value={form.alergi} onChange={set("alergi")} className="mt-1.5 h-11 rounded-xl" /></div>
        <div className="md:col-span-2"><Label>Riwayat Penyakit</Label><Textarea value={form.riwayat_penyakit} onChange={set("riwayat_penyakit")} className="mt-1.5 rounded-xl" /></div>
        <div className="md:col-span-2"><Label>Obat Rutin</Label><Textarea value={form.obat_rutin} onChange={set("obat_rutin")} className="mt-1.5 rounded-xl" /></div>
      </div>
      <Button onClick={save} disabled={loading} data-testid="save-profile" className="mt-5 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-8">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Simpan Profil"}
      </Button>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }) {
  return (
    <Card className="p-12 text-center border-dashed border-slate-200">
      <Icon className="h-12 w-12 mx-auto text-slate-300" />
      <p className="mt-4 text-slate-500">{text}</p>
    </Card>
  );
}
