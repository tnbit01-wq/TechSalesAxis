"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Clock,
  Trash2,
  Square,
  CheckSquare,
  AlertCircle,
  UserCheck,
  Users,
  Calendar,
  Filter,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; border: string; iconBg: string; iconColor: string; badge: string }> = {
  APPLICATION_SUBMITTED: {
    label: "Application",
    bg: "bg-blue-50/60",
    border: "border-blue-200/60",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview",
    bg: "bg-amber-50/60",
    border: "border-amber-200/60",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
  CANDIDATE_REJECTED: {
    label: "Rejected",
    bg: "bg-red-50/40",
    border: "border-red-200/50",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    badge: "bg-red-100 text-red-600 border-red-200",
  },
  CANDIDATE_HIRED: {
    label: "Hired",
    bg: "bg-emerald-50/60",
    border: "border-emerald-200/60",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  DEFAULT: {
    label: "Notification",
    bg: "bg-slate-50/40",
    border: "border-slate-200/50",
    iconBg: "bg-orange-100",
    iconColor: "text-[#FF8A00]",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
  },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.DEFAULT;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "APPLICATION_SUBMITTED") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "INTERVIEW_SCHEDULED") return <Calendar className="h-4 w-4" />;
  if (type === "CANDIDATE_REJECTED") return <AlertCircle className="h-4 w-4" />;
  if (type === "CANDIDATE_HIRED") return <UserCheck className="h-4 w-4" />;
  if (type.includes("TEAM") || type.includes("USER")) return <Users className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

export default function RecruiterNotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadNotifications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) { router.replace("/login"); return; }
      const data = await apiClient.get("/notifications", token);
      if (data && Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter((n) => !n.is_read);

  const visibleIds = filteredNotifications.map((n) => n.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const toggleSelectAll = () => {
    if (allSelected) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(visibleIds)); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const markAsRead = async (id: string) => {
    try {
      const token = awsAuth.getToken(); if (!token) return;
      await apiClient.patch(`/notifications/${id}/read`, {}, token);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) { console.error("Mark read failed:", err); }
  };

  const markAllRead = async () => {
    try {
      const token = awsAuth.getToken(); if (!token) return;
      await apiClient.patch(`/notifications/read-all`, {}, token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) { console.error("Mark all read failed:", err); }
  };

  const deleteOne = async (id: string) => {
    try {
      const token = awsAuth.getToken(); if (!token) return;
      await apiClient.delete(`/notifications/${id}`, token);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const next = new Set(selectedIds); next.delete(id); setSelectedIds(next);
    } catch (err) { console.error("Delete failed:", err); }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = awsAuth.getToken(); if (!token) return;
      await apiClient.request("DELETE", "/notifications/bulk", { notification_ids: Array.from(selectedIds) }, token);
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (err) { console.error("Bulk delete failed:", err); }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = awsAuth.getToken(); if (!token) return;
      await Promise.all(Array.from(selectedIds).map((id) => apiClient.patch(`/notifications/${id}/read`, {}, token)));
      setNotifications((prev) => prev.map((n) => selectedIds.has(n.id) ? { ...n, is_read: true } : n));
      setSelectedIds(new Set());
    } catch (err) { console.error("Bulk mark read failed:", err); }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[#FF8A00]/30 border-t-[#FF8A00] animate-spin" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 sm:px-6 py-4 gap-3 overflow-hidden">

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0">
        {/* Left: stats pill */}
        <div className="flex items-center gap-2 mr-auto">
          {unreadCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF8A00]/10 border border-[#FF8A00]/20 text-[11px] font-bold text-[#FF8A00]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF8A00] animate-pulse" />
              {unreadCount} unread
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-[11px] font-bold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              All caught up
            </span>
          )}
          <span className="text-[11px] text-slate-400">{notifications.length} total</span>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filter toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${filter === "all" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter("unread")}
              className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${filter === "unread" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
            >
              <Filter className="h-2.5 w-2.5" />
              Unread
              {unreadCount > 0 && (
                <span className="h-4 min-w-4 px-1 bg-[#FF8A00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Select all */}
          <button
            onClick={toggleSelectAll}
            className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:border-slate-300 transition-all flex items-center gap-1.5"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-[#FF8A00]" /> : <Square className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Select all</span>
          </button>

          {/* Bulk actions — only when items selected */}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={markSelectedAsRead}
                className="h-8 px-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold hover:bg-emerald-100 transition-all flex items-center gap-1.5"
              >
                <Check className="h-3 w-3" />
                Read ({selectedIds.size})
              </button>
              <button
                onClick={deleteSelected}
                className="h-8 px-2.5 rounded-lg bg-red-50 border border-red-200 text-red-600 text-[11px] font-semibold hover:bg-red-100 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3" />
                Delete ({selectedIds.size})
              </button>
            </>
          )}

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="h-8 px-2.5 rounded-lg bg-[#FF8A00] text-white text-[11px] font-semibold hover:bg-[#e67a00] transition-all flex items-center gap-1.5 shadow-sm shadow-orange-200"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Mark all</span>
            </button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl">
        {filteredNotifications.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 py-16">
            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <BellOff className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-400">
              {filter === "unread" ? "No unread notifications" : "No notifications yet"}
            </p>
            <p className="text-xs text-slate-300">
              {filter === "unread" ? `Switch to "All" to see everything` : "Hiring activity will appear here"}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pb-4">
            {filteredNotifications.map((notif) => {
              const cfg = getTypeConfig(notif.type);
              const isSelected = selectedIds.has(notif.id);
              return (
                <div
                  key={notif.id}
                  className={`group relative flex items-start gap-3 p-3 sm:p-3.5 rounded-xl border transition-all duration-150 cursor-pointer
                    ${isSelected ? "border-[#FF8A00]/40 bg-orange-50/50 shadow-sm" : !notif.is_read ? `${cfg.bg} ${cfg.border}` : "bg-white border-slate-200/60 hover:border-slate-300/60 hover:shadow-sm"}`}
                  onClick={() => toggleSelect(notif.id)}
                >
                  {/* Unread indicator dot */}
                  {!notif.is_read && !isSelected && (
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />
                  )}

                  {/* Checkbox */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(notif.id); }}
                    className="flex-shrink-0 mt-0.5 transition-opacity"
                    title="Select"
                  >
                    {isSelected
                      ? <CheckSquare className="h-4 w-4 text-[#FF8A00]" />
                      : <Square className="h-4 w-4 text-slate-300 group-hover:text-slate-400 transition-colors" />}
                  </button>

                  {/* Icon */}
                  <div className={`flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor}`}>
                    <NotifIcon type={notif.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                        {notif.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className={`text-[13px] leading-snug truncate ${!notif.is_read ? "font-semibold text-slate-800" : "font-medium text-slate-600"}`}>
                      {notif.title}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{notif.message}</p>
                  </div>

                  {/* Per-item action buttons (visible on hover) */}
                  <div
                    className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="h-7 w-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 transition-all flex items-center justify-center"
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteOne(notif.id)}
                      className="h-7 w-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all flex items-center justify-center"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
