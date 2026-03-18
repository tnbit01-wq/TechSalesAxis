"use client";

import { useState, useEffect } from "react";
import { Bell, Check, Sparkles } from "lucide-react";
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

export default function RecruiterHeader() {
  const { toggleChatMode } = useChatViewStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

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
    // Refresh notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const markAsRead = async (id: string) => {
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

  return (
    <div className="flex items-center gap-3 p-4 absolute top-4 right-8 z-50">
      <button
        onClick={toggleChatMode}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl border border-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 group"
      >
        <Sparkles className="h-4 w-4 text-blue-100 group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-semibold tracking-wide uppercase">AI Chat Mode</span>
      </button>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 bg-white rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm group active:scale-95"
        >
          <Bell
            className={`h-5 w-5 ${unreadCount > 0 ? "text-indigo-600 animate-pulse" : "text-slate-500"}`}
          />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-3 w-96 bg-white/80 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right ring-1 ring-slate-900/5">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                >
                  <Check className="h-3 w-3" />
                  Mark All
                </button>
              )}
            </div>

            <div className="max-h-112.5 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                    <Bell className="h-5 w-5 text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-bold text-sm tracking-tight">
                    You&apos;re all caught up.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-5 transition-colors hover:bg-slate-50/50 flex gap-4 ${!notif.is_read ? "bg-indigo-50/20" : ""}`}
                      onClick={() => !notif.is_read && markAsRead(notif.id)}
                    >
                      <div
                        className={`h-10 w-10 rounded-2xl shrink-0 flex items-center justify-center border ${
                          notif.type === "INTERVIEW_PROPOSED"
                            ? "bg-amber-50 border-amber-100"
                            : notif.type === "INTERVIEW_CONFIRMED"
                              ? "bg-emerald-50 border-emerald-100"
                              : "bg-blue-50 border-blue-100"
                        }`}
                      >
                        <Bell
                          className={`h-4 w-4 ${
                            notif.type === "INTERVIEW_PROPOSED"
                              ? "text-amber-500"
                              : notif.type === "INTERVIEW_CONFIRMED"
                                ? "text-emerald-500"
                                : "text-indigo-500"
                          }`}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p
                            className={`text-sm font-bold ${!notif.is_read ? "text-slate-900" : "text-slate-600"}`}
                          >
                            {notif.title}
                          </p>
                          {!notif.is_read && (
                            <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium mb-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                          {new Date(notif.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 text-center bg-slate-50/50">
              <button
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-900 transition-colors"
              >
                Close Notification Center
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
