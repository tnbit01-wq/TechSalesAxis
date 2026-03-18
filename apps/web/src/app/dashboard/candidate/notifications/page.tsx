"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  Check, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Square, 
  CheckSquare,
  AlertCircle
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import CandidateInterviewConfirmModal from "@/components/CandidateInterviewConfirmModal";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, any>;
}

export default function CandidateNotificationsPage() {
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

  const toggleSelectAll = () => {
    const visibleNotifs = filter === "all" ? notifications : notifications.filter(n => !n.is_read);
    if (selectedIds.size === visibleNotifs.length && visibleNotifs.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleNotifs.map(n => n.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const markAsRead = async (id: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/notifications/${id}/read`, {}, token);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  };

  const markAllRead = async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.patch(`/notifications/read-all`, {}, token);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Mark all read failed:", err);
    }
  };

  const deleteOne = async (id: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.delete(`/notifications/${id}`, token);
      setNotifications(prev => prev.filter(n => n.id !== id));
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
      
      const idsArray = Array.from(selectedIds);
      await apiClient.request('DELETE', '/notifications/bulk', { notification_ids: idsArray }, token);
      
      setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk delete failed:", err);
    }
  };

  const handleAction = (notif: Notification) => {
    if (notif.type === "INTERVIEW_PROPOSED") {
      setSelectedInterviewId(notif.metadata?.interview_id as string);
      setIsModalOpen(true);
    } else if (notif.type === "ASSESSMENT_REMINDER") {
      router.push("/dashboard/candidate/assessments");
    }
  };

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter((n) => !n.is_read);

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
              Stay updated with your latest alerts.
            </p>
          </div>

          <div className="flex gap-3 mb-1">
            {selectedIds.size > 0 && (
              <button
                onClick={deleteSelected}
                className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] text-red-600 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 animate-in fade-in slide-in-from-right-2"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete ({selectedIds.size})
              </button>
            )}
            <button
              onClick={markAllRead}
              className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-black text-[10px] uppercase tracking-[0.15em] text-slate-600 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark All Read
            </button>
          </div>
        </header>

        <div className="flex justify-between items-center mb-8">
          <div className="flex gap-3">
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

          {filteredNotifications.length > 0 && (
            <button 
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {selectedIds.size === filteredNotifications.length ? (
                <CheckSquare className="h-4 w-4 text-indigo-600" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Select All
            </button>
          )}
        </div>

        <div className="space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-dashed border-slate-200 p-20 text-center">
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
                } ${selectedIds.has(notif.id) ? "ring-2 ring-indigo-600 ring-offset-2" : ""}`}
              >
                <div className="p-5 flex items-start gap-4">
                  <button 
                    onClick={() => toggleSelect(notif.id)}
                    className={`mt-3 shrink-0 rounded transition-colors ${
                      selectedIds.has(notif.id) ? "text-indigo-600" : "text-slate-200 group-hover:text-slate-300"
                    }`}
                  >
                    {selectedIds.has(notif.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                  </button>

                  <div
                    className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105 ${
                      notif.type === "INTERVIEW_PROPOSED"
                        ? "bg-amber-50 border-amber-100"
                        : notif.type === "ASSESSMENT_REMINDER"
                          ? "bg-indigo-50 border-indigo-100"
                          : "bg-slate-50 border-white shadow-sm"
                    }`}
                  >
                    {notif.type === "ASSESSMENT_REMINDER" ? (
                      <AlertCircle className="h-5 w-5 text-indigo-600" />
                    ) : (
                      <Bell
                        className={`h-5 w-5 ${
                          notif.type === "INTERVIEW_PROPOSED"
                            ? "text-amber-500"
                            : "text-indigo-600"
                        }`}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
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
                      className={`text-sm font-black tracking-tight mb-1 truncate ${!notif.is_read ? "text-slate-900" : "text-slate-600"}`}
                    >
                      {notif.title}
                    </h3>
                    <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-2xl line-clamp-2">
                      {notif.message}
                    </p>
                    
                    {notif.type === "INTERVIEW_PROPOSED" && !notif.is_read && (
                      <button 
                        onClick={() => handleAction(notif)}
                        className="mt-3 px-3 py-1.5 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        Respond Now
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-center">
                    {!notif.is_read && (
                      <button
                        onClick={() => markAsRead(notif.id)}
                        className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all lg:opacity-0 group-hover:opacity-100"
                        title="Mark as Read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteOne(notif.id)}
                      className="p-2.5 bg-slate-50 text-slate-400 rounded-lg hover:text-red-500 hover:bg-red-50 transition-all lg:opacity-0 group-hover:opacity-100"
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

      <CandidateInterviewConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        interviewId={selectedInterviewId || ""}
        onSuccess={() => {
          loadNotifications();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
}
