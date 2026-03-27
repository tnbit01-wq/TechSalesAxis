"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Sparkles, LogOut, User, Settings as SettingsIcon } from "lucide-react";
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

interface ProfileData {
  full_name?: string;
  current_role?: string;
  profile_photo_url?: string;
  team_role?: string;
}

export default function RecruiterHeader() {
  const router = useRouter();
  const { toggleChatMode } = useChatViewStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);

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

    async function fetchProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;

        const profileData = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        if (profileData) {
          setProfile({
            full_name: profileData.full_name,
            current_role: profileData.current_role,
            profile_photo_url: profileData.profile_photo_url,
            team_role: profileData.team_role,
          });
        }
      } catch (err) {
        console.error("Failed to load recruiter profile:", err);
      }
    }

    fetchNotifications();
    fetchProfile();
    const interval = setInterval(fetchNotifications, 60000);

    // Close dropdowns on outside click
    function handleClickOutside(event: MouseEvent) {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
      if (
        notificationDropdownRef.current &&
        !notificationDropdownRef.current.contains(event.target as Node)
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

  const handleLogout = async () => {
    try {
      setIsProfileOpen(false);
      await awsAuth.logout();
      router.replace("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="flex items-center gap-3 p-4 absolute top-4 left-8 right-8 z-50">
      <button
        onClick={toggleChatMode}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl border border-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 active:scale-95 group"
      >
        <Sparkles className="h-4 w-4 text-blue-100 group-hover:rotate-12 transition-transform" />
        <span className="text-sm font-semibold tracking-wide uppercase">AI Chat Mode</span>
      </button>

      <div className="ml-auto flex items-center gap-3">
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

      {/* Profile Dropdown */}
      <div className="relative" ref={profileDropdownRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-white rounded-2xl border border-slate-200 hover:bg-slate-50 transition-all shadow-sm group active:scale-95"
        >
          {profile?.profile_photo_url ? (
            <img
              src={profile.profile_photo_url}
              alt={profile.full_name || "Profile"}
              className="h-6 w-6 rounded-xl object-cover"
            />
          ) : (
            <div className="h-6 w-6 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          <span className="text-xs font-bold text-slate-700 hidden sm:block max-w-32 truncate">
            {profile?.full_name || "Profile"}
          </span>
        </button>

        {isProfileOpen && (
          <div className="absolute right-0 mt-3 w-64 bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 origin-top-right">
            {profile && (
              <>
                <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-indigo-50 to-white">
                  <div className="flex items-center gap-3">
                    {profile.profile_photo_url ? (
                      <img
                        src={profile.profile_photo_url}
                        alt={profile.full_name || "Profile"}
                        className="h-12 w-12 rounded-2xl object-cover border-2 border-white"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center border-2 border-white">
                        <User className="h-5 w-5 text-white" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {profile.full_name || "Recruiter"}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {profile.team_role || profile.current_role || "Team Member"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2 space-y-1">
                  <button
                    onClick={() => {
                      router.push("/dashboard/recruiter/account/profile");
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors rounded-xl text-sm font-medium"
                  >
                    <User className="h-4 w-4 text-indigo-600" />
                    View Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push("/dashboard/recruiter/account/settings");
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors rounded-xl text-sm font-medium"
                  >
                    <SettingsIcon className="h-4 w-4 text-slate-500" />
                    Settings
                  </button>
                </div>

                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors rounded-xl text-sm font-medium"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

