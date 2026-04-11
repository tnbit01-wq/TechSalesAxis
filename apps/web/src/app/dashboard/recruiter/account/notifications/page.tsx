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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, any>;
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

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      
      const idsArray = Array.from(selectedIds);
      await Promise.all(idsArray.map(id => apiClient.patch(`/notifications/${id}/read`, {}, token)));
      
      setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, is_read: true } : n));
      setSelectedIds(new Set());
    } catch (err) {
      console.error("Bulk mark read failed:", err);
    }
  };

  const filteredNotifications = filter === "all" 
    ? notifications 
    : notifications.filter((n) => !n.is_read);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">Manage alerts from your hiring activity and recruiting updates.</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <>
                <button
                  onClick={markSelectedAsRead}
                  className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Mark Read ({selectedIds.size})
                </button>
                <button
                  onClick={deleteSelected}
                  className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete ({selectedIds.size})
                </button>
              </>
            )}
            <button
              onClick={markAllRead}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Mark All Read
            </button>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Filter</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as "all" | "unread")}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer font-medium text-slate-900"
              >
                <option value="all">All Notifications</option>
                <option value="unread">Unread Only</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <Bell className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No notifications</h3>
            <p className="text-slate-500 text-sm">You're all caught up!</p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`group bg-white p-4 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-start gap-3 cursor-pointer ${
                !notif.is_read ? "bg-blue-100" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => toggleSelect(notif.id)}
                className="flex-shrink-0 mt-1 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                title="Select notification"
              >
                {selectedIds.has(notif.id) ? (
                  <CheckSquare className="h-5 w-5 text-blue-600" />
                ) : (
                  <Square className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                )}
              </button>

              {/* Icon */}
              <div className={`h-10 w-10 rounded-xl flex-shrink-0 flex items-center justify-center border transition-colors ${
                notif.type === "APPLICATION_SUBMITTED"
                  ? "bg-blue-50 border-blue-100"
                  : notif.type === "INTERVIEW_SCHEDULED"
                    ? "bg-amber-50 border-amber-100"
                    : notif.type === "CANDIDATE_REJECTED"
                    ? "bg-red-50 border-red-100"
                    : "bg-slate-50 border-slate-100"
              }`}
              >
                {notif.type === "APPLICATION_SUBMITTED" ? (
                  <CheckCircle2 className="h-5 w-5 text-blue-600" />
                ) : notif.type === "INTERVIEW_SCHEDULED" ? (
                  <Clock className="h-5 w-5 text-amber-600" />
                ) : notif.type === "CANDIDATE_REJECTED" ? (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                ) : (
                  <Bell className="h-5 w-5 text-blue-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[7px] font-bold text-blue-600 uppercase tracking-wider bg-blue-100 px-1.5 py-0.5 rounded-md border border-blue-100">
                    {notif.type?.replace(/_/g, " ")}
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {notif.title}
                </h3>
                <p className="text-slate-600 text-xs line-clamp-2">
                  {notif.message}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {!notif.is_read && (
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"
                    title="Mark as Read"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={() => deleteOne(notif.id)}
                  className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

