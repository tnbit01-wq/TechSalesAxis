"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Trash2, X, Sparkles, Zap, Clock, Calendar } from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useChatViewStore } from "@/hooks/useChatViewStore";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type?: string;
  created_at: string;
}

export default function CandidateHeader() {
  const router = useRouter();
  const { toggleChatMode } = useChatViewStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const data = await apiClient.get(
          "/notifications",
          token,
        );
        if (data && Array.isArray(data)) {
          setNotifications(data);
          setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
        }
      } catch (err) {
        console.error("Failed to load notifications:", err);
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);

    // Close dropdown on outside click
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const markAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        `/notifications/${id}/read`,
        {},
        token,
      );
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllRead = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        `/notifications/read-all`,
        {},
        token,
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.delete(`/notifications/${id}`, token);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.is_read) setUnreadCount((u) => Math.max(0, u - 1));
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 absolute top-0 right-0 z-50">
      <button
        onClick={toggleChatMode}
        className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl border border-slate-800 transition-all shadow-lg active:scale-95 group overflow-hidden relative"
      >
        <Sparkles className="h-4 w-4 text-indigo-400 group-hover:rotate-12 transition-transform" />
        <span className="text-[11px] font-black tracking-[0.1em] uppercase">AI Assistant</span>
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2.5 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 hover:bg-white transition-all shadow-sm group active:scale-95 flex items-center gap-2"
        >
          <Bell
            className={`h-5 w-5 ${unreadCount > 0 ? "text-indigo-600 animate-pulse" : "text-slate-500"}`}
          />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-indigo-600 rounded-full ring-2 ring-white"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-4 w-104 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500 origin-top-right">
            <div className="p-7 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3 group-hover:rotate-0 transition-transform">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] italic">
                    Notification <span className="text-indigo-600">Center</span>
                  </h3>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Your latest updates
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:text-slate-900 transition-all border-b border-transparent hover:border-slate-900 pb-0.5"
                  >
                    SYNC ALL
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-144 overflow-y-auto custom-scrollbar p-3 space-y-2">
              {notifications.length === 0 ? (
                <div className="py-20 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 bg-slate-50 rounded-4xl flex items-center justify-center mb-6 border border-slate-100/60 relative">
                    <div className="absolute inset-0 bg-indigo-50 rounded-4xl animate-ping opacity-20 scale-125" />
                    <Sparkles className="h-7 w-7 text-slate-200" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-2">
                    Transmission Quiet
                  </h4>
                  <p className="text-[9px] text-slate-300 font-bold max-w-xs uppercase tracking-widest leading-relaxed">
                    Awaiting next matching pulse
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 px-1">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`group p-5 rounded-4xl transition-all cursor-pointer relative overflow-hidden ${
                        !notif.is_read
                          ? "bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-100/50 shadow-sm"
                          : "hover:bg-slate-50/80 border border-transparent"
                      }`}
                    >
                      {!notif.is_read && (
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
                      )}

                      <div className="flex justify-between gap-4 relative z-10">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            {notif.type === "INTERVIEW_PROPOSED" && (
                              <div className="h-6 w-6 bg-amber-50 rounded-lg flex items-center justify-center border border-amber-100/50">
                                <Calendar className="h-3 w-3 text-amber-500" />
                              </div>
                            )}
                            <h4
                              className={`text-[13px] ${!notif.is_read ? "font-black" : "font-bold text-slate-700"} text-slate-900 leading-snug`}
                            >
                              {notif.title}
                            </h4>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed italic line-clamp-2 ${!notif.is_read ? "text-slate-700 font-medium" : "text-slate-500 font-normal"}`}
                          >
                            &quot;{notif.message}&quot;
                          </p>
                          <div className="flex items-center gap-3 mt-4">
                            <div className="px-2 py-0.5 bg-white/60 rounded flex items-center gap-1.5 border border-slate-100">
                              <Clock className="h-2.5 w-2.5 text-slate-400" />
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                                {new Date(notif.created_at).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </div>
                            {!notif.is_read && (
                              <div className="flex items-center gap-1">
                                <div className="h-1 w-1 bg-indigo-600 rounded-full animate-pulse" />
                                <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">
                                  UNREAD TRANSMISSION
                                </span>
                              </div>
                            )}

                            {notif.type === "INTERVIEW_PROPOSED" && (
                              <button
                                onClick={() =>
                                  router.push(
                                    "/dashboard/candidate/notifications",
                                  )
                                }
                                className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors"
                              >
                                PICK SLOT
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                          <button
                            onClick={(e) => markAsRead(notif.id, e)}
                            className="p-2 bg-white border border-slate-200 rounded-xl text-indigo-600 hover:bg-slate-900 hover:text-white hover:border-slate-900 shadow-md transition-all active:scale-90"
                            title="Mark read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => deleteNotification(notif.id, e)}
                            className="p-2 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-100 shadow-md transition-all active:scale-90"
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-5 bg-slate-900 text-center group cursor-pointer hover:bg-black transition-colors">
              <button
                onClick={() => {
                  setIsOpen(false);
                }}
                className="flex items-center justify-center gap-2 w-full"
              >
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] font-black text-white uppercase tracking-[0.3em] group-hover:text-indigo-400 transition-colors">
                  ENTER ANALYTICS NEXUS
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
