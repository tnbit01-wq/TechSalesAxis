"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useCallback } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type?: string;
  created_at: string;
}

export default function RecruiterNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const loadNotifications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const data = await apiClient.get("/notifications", token);
      if (data && Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

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
    } catch (err) {
      console.error("Mark read failed:", err);
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
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const deleteNotification = async (id: string) => {
    // Note: Assuming a delete endpoint exists or we just hide it
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const filteredNotifications =
    filter === "all" ? notifications : notifications.filter((n) => !n.is_read);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      <div className="max-w-4xl mx-auto p-10">
        {/* Header Region */}
        <header className="mb-10 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                <Bell className="h-4 w-4 text-indigo-600" />
              </div>
              <span className="text-indigo-600 font-black text-[10px] uppercase tracking-widest opacity-80">
                Inbox
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-3">
              Your <span className="text-indigo-600">Notifications.</span>
            </h1>
            <p className="text-slate-500 text-sm font-bold opacity-60 max-w-lg leading-relaxed uppercase tracking-widest">
              Manage alerts from your hiring activity.
            </p>
          </div>

          <div className="flex gap-3 mb-1">
            <button
              onClick={markAllRead}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] text-slate-600 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark All Read
            </button>
          </div>
        </header>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all ${
              filter === "all"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200/40"
                : "bg-white text-slate-400 border border-slate-200 hover:border-slate-300"
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all ${
              filter === "unread"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200/40"
                : "bg-white text-slate-400 border border-slate-200 hover:border-slate-300"
            }`}
          >
            Unread Only
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-4xl border border-dashed border-slate-200 p-20 text-center">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Bell className="h-6 w-6 text-slate-200" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                Clear Frequency
              </h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest opacity-60">
                No active signals found.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                className={`group relative bg-white rounded-2xl border transition-all duration-300 hover:shadow-xl hover:shadow-indigo-100/30 overflow-hidden ${
                  !notif.is_read
                    ? "border-indigo-200 bg-indigo-50/5"
                    : "border-slate-100"
                }`}
              >
                <div className="p-5 flex items-start gap-6">
                  {/* Type Icon */}
                  <div
                    className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${
                      notif.type === "INTERVIEW_PROPOSED"
                        ? "bg-amber-50 border-amber-100"
                        : notif.type === "INTERVIEW_CONFIRMED"
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-slate-50 border-white shadow-sm"
                    }`}
                  >
                    <Bell
                      className={`h-5 w-5 ${
                        notif.type === "INTERVIEW_PROPOSED"
                          ? "text-amber-500"
                          : notif.type === "INTERVIEW_CONFIRMED"
                            ? "text-emerald-500"
                            : "text-indigo-600"
                      }`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.2em] py-0.5 px-2 bg-indigo-50 rounded-md border border-indigo-100">
                        {notif.type?.replace("_", " ")}
                      </span>
                      <span className="text-[8px] font-bold text-slate-300 uppercase tracking-[0.2em] flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(notif.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <h3
                      className={`text-sm font-black tracking-tight mb-1 ${!notif.is_read ? "text-slate-900" : "text-slate-600"}`}
                    >
                      {notif.title}
                    </h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-2xl">
                      {notif.message}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-center">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        title="Mark as Read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif.id)}
                      className="p-2.5 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      title="Clear Notification"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
