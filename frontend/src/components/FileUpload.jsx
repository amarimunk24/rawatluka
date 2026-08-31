import { useRef, useState } from "react";
import { toast } from "sonner";
import api, { apiError } from "@/lib/api";
import AuthImage from "@/components/AuthImage";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, X, FileText } from "lucide-react";

export default function FileUpload({ value, onChange, label = "Unggah file", testId, accept = "image/*", className = "" }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const isPdf = value && value.toLowerCase().endsWith(".pdf");

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.path);
      toast.success("File berhasil diunggah");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} onChange={handle} className="hidden" data-testid={testId} />
      {value ? (
        <div className="relative inline-block">
          {isPdf ? (
            <div className="h-24 w-24 rounded-xl border border-slate-200 grid place-items-center bg-slate-50"><FileText className="h-8 w-8 text-slate-400" /></div>
          ) : (
            <AuthImage path={value} alt="preview" className="h-24 w-24 rounded-xl object-cover border border-slate-200" />
          )}
          <button type="button" onClick={() => onChange("")} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white grid place-items-center shadow">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading} className="rounded-xl h-11 border-dashed border-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4" /> {label}</>}
        </Button>
      )}
    </div>
  );
}
