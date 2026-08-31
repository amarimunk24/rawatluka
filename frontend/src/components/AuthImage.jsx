import { API } from "@/lib/api";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export default function AuthImage({ path, alt = "", className = "", onClick }) {
  const [error, setError] = useState(false);
  if (!path) return null;
  const token = localStorage.getItem("hc_token");
  const src = `${API}/files/${path}?auth=${token}`;
  if (error)
    return (
      <div className={`grid place-items-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  return <img src={src} alt={alt} className={className} onClick={onClick} loading="lazy" onError={() => setError(true)} />;
}
