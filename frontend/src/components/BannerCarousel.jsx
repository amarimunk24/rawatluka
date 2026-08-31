import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function BannerCarousel() {
  const [banners, setBanners] = useState([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => { api.get("/banners").then(({ data }) => setBanners(data)).catch(() => {}); }, []);

  const go = useCallback((n) => {
    setIdx((prev) => (banners.length ? (n + banners.length) % banners.length : 0));
  }, [banners.length]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setIdx((p) => (p + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const b = banners[idx];

  const slide = (
    <div className="relative h-44 sm:h-52 w-full overflow-hidden rounded-2xl group">
      <AuthImage path={b.gambar_url} alt={b.judul} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
      <div className="absolute bottom-4 left-5 right-5">
        <div className="font-heading font-extrabold text-white text-xl sm:text-2xl drop-shadow">{b.judul}</div>
        {b.link_url && <span className="mt-1 inline-block text-xs font-semibold text-emerald-300">Ketuk untuk selengkapnya →</span>}
      </div>
    </div>
  );

  return (
    <div className="mb-6" data-testid="banner-carousel">
      <div className="relative">
        {b.link_url ? (
          <a href={b.link_url} target="_blank" rel="noopener noreferrer" data-testid="banner-link" className="block">{slide}</a>
        ) : slide}

        {banners.length > 1 && (
          <>
            <button aria-label="Sebelumnya" data-testid="banner-prev" onClick={() => go(idx - 1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow grid place-items-center transition-colors">
              <ChevronLeft className="h-5 w-5 text-slate-700" />
            </button>
            <button aria-label="Berikutnya" data-testid="banner-next" onClick={() => go(idx + 1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/90 hover:bg-white shadow grid place-items-center transition-colors">
              <ChevronRight className="h-5 w-5 text-slate-700" />
            </button>
          </>
        )}
      </div>

      {banners.length > 1 && (
        <div className="mt-3 flex justify-center gap-2" data-testid="banner-dots">
          {banners.map((_, i) => (
            <button key={i} aria-label={`Iklan ${i + 1}`} data-testid={`banner-dot-${i}`} onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === idx ? "w-6 bg-emerald-600" : "w-2 bg-slate-300 hover:bg-slate-400"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
