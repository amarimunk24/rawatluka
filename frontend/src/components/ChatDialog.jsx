import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

export default function ChatDialog({ orderId, open, onOpenChange, title }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const endRef = useRef(null);

  const load = async () => {
    if (!orderId) return;
    const { data } = await api.get(`/orders/${orderId}/chat`);
    setMsgs(data);
  };

  useEffect(() => {
    if (open) {
      load();
      const t = setInterval(load, 2500);
      return () => clearInterval(t);
    }
  }, [open, orderId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await api.post(`/orders/${orderId}/chat`, { pesan: text });
    setText("");
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Chat — {title}</DialogTitle></DialogHeader>
        <ScrollArea className="h-80 pr-3">
          <div className="space-y-3 py-2">
            {msgs.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Belum ada pesan. Mulai percakapan.</p>}
            {msgs.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-600 text-white rounded-br-sm" : "bg-slate-100 text-slate-800 rounded-bl-sm"}`}>
                    {!mine && <div className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_nama}</div>}
                    {m.pesan}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        </ScrollArea>
        <form onSubmit={send} className="flex gap-2">
          <Input data-testid="chat-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ketik pesan..." className="rounded-xl" />
          <Button type="submit" data-testid="chat-send" className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"><Send className="h-4 w-4" /></Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
