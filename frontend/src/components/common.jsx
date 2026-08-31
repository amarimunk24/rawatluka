import { Star } from "lucide-react";

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
      <Icon className="h-12 w-12 mx-auto text-slate-300" />
      <p className="mt-4 text-slate-500">{text}</p>
    </div>
  );
}

const STATUS_MAP = {
  pending: ["Menunggu", "bg-amber-100 text-amber-700"],
  accepted: ["Diterima", "bg-sky-100 text-sky-700"],
  rejected: ["Ditolak", "bg-red-100 text-red-700"],
  completed: ["Selesai", "bg-emerald-100 text-emerald-700"],
  pending_pay: ["Belum Bayar", "bg-amber-100 text-amber-700"],
  menunggu_verifikasi: ["Verifikasi Pembayaran", "bg-amber-100 text-amber-700"],
  sukses: ["Lunas", "bg-emerald-100 text-emerald-700"],
  verified: ["Terverifikasi", "bg-emerald-100 text-emerald-700"],
};

export function StatusBadge({ status }) {
  const [label, cls] = STATUS_MAP[status] || [status, "bg-slate-100 text-slate-600"];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}

export function StarRating({ value = 0, size = 16, onChange, editable = false }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} style={{ width: size, height: size }}
          data-testid={editable ? `star-${i}` : undefined}
          onClick={editable ? () => onChange?.(i) : undefined}
          className={`${editable ? "cursor-pointer" : ""} ${i <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </div>
  );
}
