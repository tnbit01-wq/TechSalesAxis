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
  Calendar,
  Sparkles,
  Filter,
  UserCheck,
  Users,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import CandidateInterviewConfirmModal from "./CandidateInterviewConfirmModal";

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
  // Candidate Types
  INTERVIEW_PROPOSED: {
    label: "Interview",
    bg: "bg-amber-50/50",
    border: "border-amber-100",
    iconBg: "bg-amber-100/80",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 border-amber-250",
  },
  ASSESSMENT_REMINDER: {
    label: "Assessment",
    bg: "bg-blue-50/50",
    border: "border-blue-100",
    iconBg: "bg-blue-100/80",
    iconColor: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-250",
  },
  APPLICATION_UPDATE: {
    label: "Application",
    bg: "bg-emerald-50/50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100/80",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-250",
  },
  // Recruiter Types
  APPLICATION_SUBMITTED: {
    label: "Application",
    bg: "bg-blue-50/50",
    border: "border-blue-100",
    iconBg: "bg-blue-100/80",
    iconColor: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border-blue-250",
  },
  INTERVIEW_SCHEDULED: {
    label: "Interview",
    bg: "bg-amber-50/50",
    border: "border-amber-100",
    iconBg: "bg-amber-100/80",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 border-amber-250",
  },
  CANDIDATE_REJECTED: {
    label: "Rejected",
    bg: "bg-red-50/40",
    border: "border-red-100",
    iconBg: "bg-red-100/80",
    iconColor: "text-red-500",
    badge: "bg-red-50 text-red-650 border-red-250",
  },
  CANDIDATE_HIRED: {
    label: "Hired",
    bg: "bg-emerald-50/50",
    border: "border-emerald-100",
    iconBg: "bg-emerald-100/80",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-250",
  },
  DEFAULT: {
    label: "Notification",
    bg: "bg-slate-50/40",
    border: "border-slate-100",
    iconBg: "bg-orange-100/80",
    iconColor: "text-[#FF8A00]",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG.DEFAULT;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "ASSESSMENT_REMINDER" || type === "CANDIDATE_REJECTED") return <AlertCircle className="h-4 w-4" />;
  if (type === "INTERVIEW_PROPOSED" || type === "INTERVIEW_SCHEDULED") return <Calendar className="h-4 w-4" />;
  if (type === "APPLICATION_UPDATE" || type === "APPLICATION_SUBMITTED") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "CANDIDATE_HIRED") return <UserCheck className="h-4 w-4" />;
  if (type.includes("TEAM") || type.includes("USER")) return <Users className="h-4 w-4" />;
  return <Bell className="h-4 w-4" />;
}

interface NotificationsPanelProps {
  role: "candidate" | "recruiter";
}

export default function NotificationsPanel({ role }: NotificationsPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedInterviewId, setSelectedInterviewId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const data = await apiClient.get("/notifications", token);
      if (data && Array.isArray(data)) setNotifications(data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const filteredNotifications = filter === "all"
    ? notifications
    : notifications.filter((n) => !n.is_read);

  const visibleIds = filteredNotifications.map((n) => n.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleIds));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const markAsRead = async (id: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/notifications/${id}/read`, {}, token);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  };

  const markAllRead = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/notifications/read-all`, {}, token);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const deleteOne = async (id: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.delete(`/notifications/${id}`, token);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const next = new Set(selectedIds);
      next.delete(id);
      setSelectedIds(next);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.request("DELETE", "/notifications/bulk", { notification_ids: Array.from(selectedIds) }, token);
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await Promise.all(Array.from(selectedIds).map((id) => apiClient.patch(`/notifications/${id}/read`, {}, token)));
      setNotifications((prev) => prev.map((n) => selectedIds.has(n.id) ? { ...n, is_read: true } : n));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk mark read failed:", err);
    }
  };

  const handleAction = (notif: Notification) => {
    if (role === "candidate") {
      if (notif.type === "INTERVIEW_PROPOSED") {
        setSelectedInterviewId(notif.metadata?.interview_id as string);
        setIsModalOpen(true);
      } else if (notif.type === "ASSESSMENT_REMINDER") {
        router.push("/assessment/candidate");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[#FF8A00]/30 border-t-[#FF8A00] animate-spin" />
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Loading Alerts…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${filter === "all" ? "bg-white shadow-xs text-slate-800 border border-slate-200/40" : "text-slate-500 hover:text-slate-800"}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1 ${filter === "unread" ? "bg-white shadow-xs text-slate-800 border border-slate-200/40" : "text-slate-500 hover:text-slate-800"}`}
          >
            <Filter className="h-2.5 w-2.5" />
            Unread
            {unreadCount > 0 && (
              <span className="h-4 min-w-4 px-1 bg-[#FF8A00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {/* Select All */}
          <button
            onClick={toggleSelectAll}
            className="p-1.5 rounded-lg border border-slate-200/80 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
            title="Select all"
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5 text-[#FF8A00]" /> : <Square className="h-3.5 w-3.5" />}
          </button>

          {/* Bulk Actions */}
          {selectedIds.size > 0 ? (
            <>
              <button
                onClick={markSelectedAsRead}
                className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-150 text-emerald-650 hover:bg-emerald-100 transition-all"
                title={`Mark selected (${selectedIds.size}) as read`}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={deleteSelected}
                className="p-1.5 rounded-lg bg-red-50 border border-red-150 text-red-500 hover:bg-red-100 transition-all"
                title={`Delete selected (${selectedIds.size})`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="px-2.5 py-1.5 rounded-lg bg-[#FF8A00] text-white text-[10.5px] font-bold hover:bg-[#e67a00] transition-all flex items-center gap-1 shadow-xs"
              >
                <CheckCircle2 className="h-3 w-3" />
                Mark all read
              </button>
            )
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 dashboard-scroll">
        {filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center">
              <BellOff className="h-5 w-5 text-slate-350" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-700">All caught up!</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
                {filter === "unread" ? "No unread alerts found" : "No notifications yet"}
              </p>
            </div>
          </div>
        ) : (
          filteredNotifications.map((notif) => {
            const cfg = getTypeConfig(notif.type);
            const isSelected = selectedIds.has(notif.id);
            return (
              <div
                key={notif.id}
                className={`group relative flex items-start gap-2.5 p-3 rounded-xl border transition-all duration-150 cursor-pointer
                  ${isSelected ? "border-[#FF8A00]/40 bg-orange-50/40 shadow-xs" : !notif.is_read ? `${cfg.bg} ${cfg.border}` : "bg-white border-slate-200/60 hover:border-slate-300/60 hover:shadow-xs"}`}
                onClick={() => toggleSelect(notif.id)}
              >
                {/* Unread indicator dot */}
                {!notif.is_read && !isSelected && (
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#FF8A00]" />
                )}

                {/* Checkbox button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(notif.id);
                  }}
                  className="mt-0.5"
                >
                  {isSelected ? (
                    <CheckSquare className="h-3.5 w-3.5 text-[#FF8A00]" />
                  ) : (
                    <Square className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-450 transition-colors" />
                  )}
                </button>

                {/* Icon wrapper */}
                <div className={`h-7.5 w-7.5 rounded-lg flex items-center justify-center shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
                  <NotifIcon type={notif.type} />
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5 font-medium">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className={`text-[12.5px] leading-snug break-words ${!notif.is_read ? "font-bold text-slate-800" : "font-medium text-slate-650"}`}>
                    {notif.title}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5 break-words">{notif.message}</p>

                  {/* Actions inside panel card */}
                  {role === "candidate" && !notif.is_read && (notif.type === "INTERVIEW_PROPOSED" || notif.type === "ASSESSMENT_REMINDER") && (
                    <div className="mt-2 flex gap-1.5">
                      {notif.type === "INTERVIEW_PROPOSED" && (
                        <button
                          onClick={() => {
                            markAsRead(notif.id);
                            handleAction(notif);
                          }}
                          className="px-2.5 py-1 rounded bg-[#FF8A00] text-white text-[10px] font-bold hover:bg-[#e67a00] transition-all"
                        >
                          Respond
                        </button>
                      )}
                      {notif.type === "ASSESSMENT_REMINDER" && (
                        <button
                          onClick={() => {
                            markAsRead(notif.id);
                            handleAction(notif);
                          }}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white text-[10px] font-bold hover:bg-blue-700 transition-all flex items-center gap-0.5"
                        >
                          <Sparkles className="h-2.5 w-2.5" />
                          Take Test
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Inline Hover Controls */}
                <div
                  className="absolute right-2 top-2 flex items-center gap-0.5 bg-white border border-slate-100 shadow-xs rounded-lg p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!notif.is_read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="p-1 rounded-md text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                      title="Mark as read"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteOne(notif.id)}
                    className="p-1 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {role === "candidate" && isModalOpen && (
        <CandidateInterviewConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          interviewId={selectedInterviewId || ""}
          onSuccess={() => {
            loadNotifications();
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
