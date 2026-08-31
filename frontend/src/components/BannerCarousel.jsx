import { useEffect, useState } from "react";
import api from "@/lib/api";
import AuthImage from "@/components/AuthImage";

export default function BannerCarousel() {
  const [banners, setBanners] = useState([]);
  useEffect(() => { api.get("/banners").then(({ data }) => setBanners(data)).catch(() => {}); }, []);
  if (banners.length === 0) return null;
  return (
    <div className="mb-6" data-testid="banner-carousel">
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
        {banners.map((b) => {
          const inner = (
            <div className="relative h-40 w-full overflow-hidden rounded-2xl border border-slate-200 group">
              <AuthImage path={b.gambar_url} alt={b.judul} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4">
                <div className="font-heading font-bold text-white text-lg drop-shadow">{b.judul}</div>
              </div>
            </div>
          );
          return (
            <div key={b.id} className="snap-start shrink-0 w-[85%] sm:w-[420px]">
              {b.link_url ? <a href={b.link_url} target="_blank" rel="noopener noreferrer">{inner}</a> : inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
