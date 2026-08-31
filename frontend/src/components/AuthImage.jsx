import { API } from "@/lib/api";

export default function AuthImage({ path, alt = "", className = "", onClick }) {
  if (!path) return null;
  const token = localStorage.getItem("hc_token");
  const src = `${API}/files/${path}?auth=${token}`;
  return <img src={src} alt={alt} className={className} onClick={onClick} loading="lazy" />;
}
