import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { formatTanggal } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HeartPulse, Bell, LogOut, Menu, X } from "lucide-react";

export default function DashboardShell({ nav, active, onNav, title, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [openMobile, setOpenMobile] = useState(false);

  const loadNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 20000);
    return () => clearInterval(t);
  }, []);

  const unread = notifs.filter((n) => !n.status_baca).length;

  const markRead = async (id) => {
    await api.put(`/notifications/${id}/read`);
    loadNotifs();
  };

  const doLogout = () => {
    logout();
    navigate("/");
  };

  const SidebarContent = ({ mobile = false }) => (
    <>
      <div className="flex items-center gap-2 px-2 py-4">
        <div className="h-9 w-9 rounded-xl bg-emerald-600 grid place-items-center">
          <HeartPulse className="h-5 w-5 text-white" />
        </div>
        <span className="font-heading font-extrabold text-slate-900">HomeCare.id</span>
      </div>
      <nav className="mt-4 space-y-1">
        {nav.map((n) => (
          <button key={n.key} data-testid={`nav-${n.key}${mobile ? "-mobile" : ""}`}
            onClick={() => { onNav(n.key); setOpenMobile(false); }}
            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active === n.key ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <n.icon className="h-5 w-5" /> {n.label}
          </button>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white px-3 py-2 fixed h-screen">
        <SidebarContent />
        <div className="mt-auto pb-4">
          <button onClick={doLogout} data-testid="logout-btn"
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="h-5 w-5" /> Keluar
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {openMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white px-3 py-2 flex flex-col">
            <div className="flex justify-end"><Button variant="ghost" size="icon" onClick={() => setOpenMobile(false)}><X className="h-5 w-5" /></Button></div>
            <SidebarContent mobile />
            <div className="mt-auto pb-4">
              <button onClick={doLogout} data-testid="mobile-logout-btn" className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                <LogOut className="h-5 w-5" /> Keluar
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setOpenMobile(false)} />
        </div>
      )}

      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden" data-testid="mobile-menu-btn" onClick={() => setOpenMobile(true)}><Menu className="h-5 w-5" /></Button>
            <h1 className="font-heading text-lg md:text-xl font-bold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative p-2 rounded-full hover:bg-slate-100 transition-colors" data-testid="notif-bell">
                  <Bell className="h-5 w-5 text-slate-600" />
                  {unread > 0 && <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] grid place-items-center">{unread}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b font-semibold text-slate-800">Notifikasi</div>
                <ScrollArea className="h-80">
                  {notifs.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada notifikasi</p>}
                  {notifs.map((n) => (
                    <button key={n.id} onClick={() => markRead(n.id)}
                      className={`w-full text-left p-3 border-b hover:bg-slate-50 ${!n.status_baca ? "bg-emerald-50/50" : ""}`}>
                      <div className="font-medium text-sm text-slate-800">{n.judul}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{n.isi_pesan}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{formatTanggal(n.waktu_kirim)}</div>
                    </button>
                  ))}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.foto_profil} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-sm">{user?.nama_lengkap?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-slate-700">{user?.nama_lengkap}</span>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
