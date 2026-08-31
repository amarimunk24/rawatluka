import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import api, { apiError, formatRupiah, formatTanggal, formatTanggalOnly } from "@/lib/api";
import DashboardShell from "@/components/DashboardShell";
import { StatusBadge, EmptyState } from "@/components/common";
import AuthImage from "@/components/AuthImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard, ShieldCheck, Receipt, Stethoscope, Users, Loader2,
  Check, X, Wallet, TrendingUp, UserCheck, ClipboardList, Eye, Plus,
} from "lucide-react";

const NAV = [
  { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { key: "verifikasi", label: "Verifikasi Nakes", icon: ShieldCheck },
  { key: "transaksi", label: "Transaksi", icon: Receipt },
  { key: "layanan", label: "Kelola Layanan", icon: Stethoscope },
  { key: "pasien", label: "Data Pasien", icon: Users },
];
const TITLES = { ringkasan: "Ringkasan Platform", verifikasi: "Verifikasi Tenaga Kesehatan", transaksi: "Transaksi & Pembayaran", layanan: "Kelola Layanan", pasien: "Data Pasien" };

export default function AdminDashboard() {
  const [active, setActive] = useState("ringkasan");
  return (
    <DashboardShell nav={NAV} active={active} onNav={setActive} title={TITLES[active]}>
      {active === "ringkasan" && <Summary />}
      {active === "verifikasi" && <Verifikasi />}
      {active === "transaksi" && <Transaksi />}
      {active === "layanan" && <Layanan />}
      {active === "pasien" && <Pasien />}
    </DashboardShell>
  );
}

function Summary() {
  const [s, setS] = useState(null);
  useEffect(() => { api.get("/admin/stats").then(({ data }) => setS(data)); }, []);
  if (!s) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  const cards = [
    { label: "Pendapatan Platform", value: formatRupiah(s.pendapatan_platform), icon: Wallet, c: "bg-emerald-100 text-emerald-600" },
    { label: "Total Omzet", value: formatRupiah(s.total_omzet), icon: TrendingUp, c: "bg-sky-100 text-sky-600" },
    { label: "Total Nakes", value: s.total_nakes, icon: Stethoscope, c: "bg-violet-100 text-violet-600" },
    { label: "Menunggu Verifikasi", value: s.pending_nakes, icon: ShieldCheck, c: "bg-amber-100 text-amber-600" },
    { label: "Total Pasien", value: s.total_pasien, icon: Users, c: "bg-rose-100 text-rose-600" },
    { label: "Total Pesanan", value: s.total_order, icon: ClipboardList, c: "bg-indigo-100 text-indigo-600" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-5 border-slate-200" data-testid="admin-stat">
          <div className={`h-11 w-11 rounded-xl grid place-items-center ${c.c}`}><c.icon className="h-5 w-5" /></div>
          <div className="mt-3 font-heading text-2xl font-extrabold text-slate-900">{c.value}</div>
          <div className="text-sm text-slate-500">{c.label}</div>
        </Card>
      ))}
    </div>
  );
}

function Verifikasi() {
  const [nakes, setNakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const load = useCallback(async () => { setLoading(true); const { data } = await api.get("/admin/nakes"); setNakes(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  const verify = async (id, action) => {
    try { await api.put(`/admin/nakes/${id}/verify`, { action }); toast.success(action === "accept" ? "Nakes disetujui" : "Nakes ditolak"); load(); setDetail(null); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  const verifyDoc = async (id, action) => { await api.put(`/admin/documents/${id}/verify`, { action }); toast.success("Dokumen diperbarui"); load(); };

  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (nakes.length === 0) return <EmptyState icon={UserCheck} text="Belum ada nakes terdaftar." />;
  return (
    <Card className="border-slate-200 overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Spesialisasi</TableHead><TableHead>Dokumen</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {nakes.map((n) => (
            <TableRow key={n.id} data-testid="verif-row">
              <TableCell><div className="font-medium text-slate-900">{n.nama}</div><div className="text-xs text-slate-500">{n.email}</div></TableCell>
              <TableCell className="text-slate-600">{n.spesialisasi || "-"}</TableCell>
              <TableCell className="text-slate-600">{n.documents?.length || 0} dok • {n.services?.length || 0} layanan</TableCell>
              <TableCell><StatusBadge status={n.status_verifikasi} /></TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDetail(n)} data-testid="verif-detail"><Eye className="h-4 w-4" /></Button>
                  {n.status_verifikasi !== "verified" && <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => verify(n.id, "accept")} data-testid="verif-approve"><Check className="h-4 w-4" /></Button>}
                  {n.status_verifikasi !== "rejected" && <Button size="sm" variant="outline" className="rounded-full text-red-600 border-red-200" onClick={() => verify(n.id, "reject")}><X className="h-4 w-4" /></Button>}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {detail && (
        <Dialog open onOpenChange={() => setDetail(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{detail.nama}</DialogTitle></DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <Info l="Spesialisasi" v={detail.spesialisasi} /><Info l="Gelar" v={detail.gelar} />
                <Info l="Pengalaman" v={detail.pengalaman_tahun ? `${detail.pengalaman_tahun} tahun` : "-"} /><Info l="Radius" v={`${detail.radius_layanan} km`} />
              </div>
              {detail.deskripsi_bio && <Info l="Bio" v={detail.deskripsi_bio} />}
              <div>
                <div className="font-semibold text-slate-800 mb-2">Dokumen Legal</div>
                {detail.documents?.length ? detail.documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 mb-2">
                    <div className="flex items-center gap-2">
                      {d.file_url && !d.file_url.toLowerCase().endsWith(".pdf") && <AuthImage path={d.file_url} className="h-12 w-12 rounded object-cover border border-slate-200" />}
                      <div><div className="font-medium">{d.jenis_dokumen} — {d.nomor_dokumen}</div><div className="text-xs text-slate-500">s/d {formatTanggalOnly(d.tanggal_valid)}</div></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={d.status_verifikasi_admin} />
                      <Button size="icon" variant="ghost" aria-label="Setujui dokumen" data-testid={`doc-approve-${d.id}`} className="h-7 w-7 text-emerald-600" onClick={() => verifyDoc(d.id, "accept")}><Check className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label="Tolak dokumen" data-testid={`doc-reject-${d.id}`} className="h-7 w-7 text-red-500" onClick={() => verifyDoc(d.id, "reject")}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )) : <p className="text-slate-400">Tidak ada dokumen.</p>}
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => verify(detail.id, "accept")}>Setujui Nakes</Button>
                <Button variant="outline" className="flex-1 rounded-xl text-red-600 border-red-200" onClick={() => verify(detail.id, "reject")}>Tolak</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

function Transaksi() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); const { data } = await api.get("/admin/transactions"); setRows(data); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);
  const verify = async (id) => { try { await api.put(`/payments/${id}/verify`); toast.success("Pembayaran diverifikasi"); load(); } catch (e) { toast.error(apiError(e.response?.data?.detail)); } };
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (rows.length === 0) return <EmptyState icon={Receipt} text="Belum ada transaksi." />;
  return (
    <Card className="border-slate-200 overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Layanan</TableHead><TableHead>Metode</TableHead><TableHead>Jumlah</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} data-testid="trx-row">
              <TableCell className="font-medium text-slate-900">{p.nama_layanan}</TableCell>
              <TableCell className="uppercase text-slate-600">{p.metode_pembayaran}</TableCell>
              <TableCell className="text-slate-900">{formatRupiah(p.jumlah)}</TableCell>
              <TableCell className="text-slate-500 text-sm">{formatTanggal(p.tanggal_bayar)}</TableCell>
              <TableCell><StatusBadge status={p.status_pembayaran} /></TableCell>
              <TableCell className="text-right">
                {p.status_pembayaran !== "sukses" && <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => verify(p.id)} data-testid="verify-payment"><Check className="h-4 w-4" /> Verifikasi</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function Layanan() {
  const [services, setServices] = useState([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ nama_layanan: "", kategori: "", deskripsi: "", tarif_dasar: "" });
  const load = useCallback(async () => { const { data } = await api.get("/services"); setServices(data); }, []);
  useEffect(() => { load(); }, [load]);
  const add = async () => {
    if (!f.nama_layanan || !f.tarif_dasar) return toast.error("Isi nama & tarif dasar");
    try { await api.post("/admin/services", { ...f, tarif_dasar: Number(f.tarif_dasar) }); toast.success("Layanan ditambahkan"); setOpen(false); setF({ nama_layanan: "", kategori: "", deskripsi: "", tarif_dasar: "" }); load(); }
    catch (e) { toast.error(apiError(e.response?.data?.detail)); }
  };
  return (
    <div>
      <div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)} data-testid="add-service-btn" className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4" /> Tambah Layanan</Button></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((s) => (
          <Card key={s.id} className="p-5 border-slate-200" data-testid="service-item">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-600">{s.kategori}</div>
            <div className="font-heading font-bold text-slate-900 mt-1">{s.nama_layanan}</div>
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{s.deskripsi}</p>
            <div className="mt-3 font-semibold text-slate-900">Dasar: {formatRupiah(s.tarif_dasar)}</div>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Tambah Layanan Baru</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Layanan</Label><Input value={f.nama_layanan} onChange={(e) => setF({ ...f, nama_layanan: e.target.value })} className="mt-1.5 h-11 rounded-xl" data-testid="svc-nama" /></div>
            <div><Label>Kategori</Label><Input value={f.kategori} onChange={(e) => setF({ ...f, kategori: e.target.value })} placeholder="Perawatan" className="mt-1.5 h-11 rounded-xl" /></div>
            <div><Label>Deskripsi</Label><Textarea value={f.deskripsi} onChange={(e) => setF({ ...f, deskripsi: e.target.value })} className="mt-1.5 rounded-xl" /></div>
            <div><Label>Tarif Dasar (Rp)</Label><Input type="number" value={f.tarif_dasar} onChange={(e) => setF({ ...f, tarif_dasar: e.target.value })} className="mt-1.5 h-11 rounded-xl" data-testid="svc-tarif-dasar" /></div>
            <Button onClick={add} data-testid="svc-save" className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Pasien() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/admin/patients").then(({ data }) => { setRows(data); setLoading(false); }); }, []);
  if (loading) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />;
  if (rows.length === 0) return <EmptyState icon={Users} text="Belum ada pasien." />;
  return (
    <Card className="border-slate-200 overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>No. HP</TableHead><TableHead>Alamat</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id} data-testid="pasien-row">
              <TableCell className="font-medium text-slate-900">{p.nama}</TableCell>
              <TableCell className="text-slate-600">{p.email}</TableCell>
              <TableCell className="text-slate-600">{p.nomor_hp || "-"}</TableCell>
              <TableCell className="text-slate-500 text-sm">{p.alamat || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

const Info = ({ l, v }) => (<div><div className="text-xs text-slate-400">{l}</div><div className="text-slate-800">{v || "-"}</div></div>);
