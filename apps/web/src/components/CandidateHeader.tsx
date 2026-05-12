"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Check, Sparkles, User, LogOut, Settings as SettingsIcon, ChevronDown, Search, Briefcase, MapPin, MessageSquare, Radio, Compass, LayoutDashboard } from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useChatViewStore } from "@/hooks/useChatViewStore";
import { useSidebar } from "@/context/SidebarContext";

interface Notification { id: string; title: string; message: string; is_read: boolean; created_at: string; }
interface ProfileData { full_name?: string; current_role?: string; profile_photo_url?: string; }

const pageTitles: Record<string, { title: string; sub: string }> = {
  "/dashboard/candidate": { title: "Dashboard", sub: "Track your job search progress" },
  "/dashboard/candidate/jobs": { title: "Jobs", sub: "Browse open positions" },
  "/dashboard/candidate/applications": { title: "Applications", sub: "Track your applications" },
  "/dashboard/candidate/gps": { title: "Career GPS", sub: "Plan your career path" },
  "/dashboard/candidate/messages": { title: "Messages", sub: "Chat with recruiters" },
  "/dashboard/candidate/community": { title: "Community", sub: "Connect with peers" },
  "/dashboard/candidate/profile": { title: "Profile", sub: "Manage your profile" },
  "/dashboard/candidate/settings": { title: "Settings", sub: "Account preferences" },
};

const resolvePageMeta = (pathname: string): { title: string; sub: string } => {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  if (/^\/dashboard\/candidate\/applications\/[^/]+$/.test(pathname)) {
    return { title: "Application Details", sub: "View and track your application progress" };
  }

  return {
    title: pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") || "Dashboard",
    sub: "",
  };
};

const navPages = [
  { label: "Dashboard", href: "/dashboard/candidate", icon: LayoutDashboard },
  { label: "Browse Jobs", href: "/dashboard/candidate/jobs", icon: Compass },
  { label: "Applications", href: "/dashboard/candidate/applications", icon: Briefcase },
  { label: "Career GPS", href: "/dashboard/candidate/gps", icon: MapPin },
  { label: "Messages", href: "/dashboard/candidate/messages", icon: MessageSquare },
  { label: "Community", href: "/dashboard/candidate/community", icon: Radio },
  { label: "Profile", href: "/dashboard/candidate/profile", icon: User },
  { label: "Settings", href: "/dashboard/candidate/settings", icon: SettingsIcon },
];

export default function CandidateHeader({ profile: initialProfile }: { profile?: ProfileData | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleChatMode } = useChatViewStore();
  const { isOpen } = useSidebar();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile || null);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState("");
  const [sf, setSf] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = sq.length > 0 ? navPages.filter(p => p.label.toLowerCase().includes(sq.toLowerCase())) : [];

  useEffect(() => {
    async function load() {
      try {
        const token = awsAuth.getToken(); if (!token) return;
        const [notifs, prof] = await Promise.all([
          apiClient.get("/notifications", token).catch(() => []),
          apiClient.get("/candidate/profile", token).catch(() => null),
        ]);
        if (Array.isArray(notifs)) { setNotifications(notifs); setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length); }
        if (prof) setProfile({ full_name: prof.full_name, current_role: prof.current_role, profile_photo_url: prof.profile_photo_url });
      } catch {}
    }
    load();
    const iv = setInterval(load, 60000);
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setIsBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSf(false);
    };
    const kb = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setSf(true); } };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", kb);
    return () => { clearInterval(iv); document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", kb); };
  }, []);

  const markAsRead = async (id: string) => {
    try { const t = awsAuth.getToken(); if (!t) return; await apiClient.patch(`/notifications/${id}/read`, {}, t); setNotifications(p => p.map(n => n.id === id ? { ...n, is_read: true } : n)); setUnreadCount(p => Math.max(0, p - 1)); } catch {}
  };

  const page = resolvePageMeta(pathname);

  return (
    <header className={`fixed top-0 right-0 ${isOpen ? "left-[240px]" : "left-[68px]"} z-20 transition-all duration-300`}>
      <div className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center px-6 gap-4">
        <div className="flex-shrink-0 min-w-[140px]">
          <h1 className="text-[17px] font-semibold text-[#0F172A] leading-tight capitalize tracking-[-0.01em]">{page.title}</h1>
          {page.sub && <p className="text-[12px] text-[#94A3B8] font-medium mt-0.5">{page.sub}</p>}
        </div>
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-lg relative" ref={searchRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input ref={inputRef} value={sq} onChange={e => { setSq(e.target.value); setSf(true); }} onFocus={() => setSf(true)}
              placeholder="Search pages, jobs…"
              className="w-full pl-10 pr-16 py-2.5 bg-[#F1F5F9] hover:bg-[#E8ECF1] focus:bg-white rounded-xl text-[13px] text-slate-700 placeholder:text-slate-400 outline-none border border-transparent focus:border-slate-200 focus:ring-2 focus:ring-orange-100 transition-all" />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 hidden sm:inline">⌘K</kbd>
            {sf && filtered.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                {filtered.map(item => { const IC = item.icon; return (
                  <Link key={item.href} href={item.href} onClick={() => { setSf(false); setSq(""); }}>
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <IC className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                      <span className="text-[13px] font-medium text-[#0F172A]">{item.label}</span>
                    </div>
                  </Link>); })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={toggleChatMode} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] text-white rounded-xl text-[13px] font-semibold hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.97] transition-all">
            <Sparkles className="h-4 w-4" strokeWidth={2} /><span className="hidden sm:inline">AI Assistant</span>
          </button>
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <div className="relative" ref={bellRef}>
            <button onClick={() => setIsBellOpen(!isBellOpen)} className="relative h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-100/80 transition-all">
              <Bell className={`h-[18px] w-[18px] ${unreadCount > 0 ? "text-[#FF8A00]" : "text-slate-400"}`} strokeWidth={1.8} />
              {unreadCount > 0 && <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-[#FF8A00] rounded-full flex items-center justify-center ring-2 ring-white"><span className="text-white text-[10px] font-bold">{unreadCount > 9 ? "9+" : unreadCount}</span></span>}
            </button>
            {isBellOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <h3 className="text-[14px] font-semibold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && <button onClick={async () => { try { const t = awsAuth.getToken(); if (t) await apiClient.patch("/notifications/read-all", {}, t); setNotifications(p => p.map(n => ({ ...n, is_read: true }))); setUnreadCount(0); } catch {} }} className="text-[12px] font-medium text-[#FF8A00]"><Check className="h-3 w-3 inline mr-1" />Mark all read</button>}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                  {notifications.length === 0 ? <div className="py-8 text-center"><Bell className="h-5 w-5 text-slate-200 mx-auto mb-2" /><p className="text-[13px] text-slate-400">All caught up</p></div>
                  : notifications.slice(0, 6).map(n => <div key={n.id} className={`px-4 py-3 hover:bg-slate-50 cursor-pointer ${!n.is_read ? "bg-orange-50/30" : ""}`} onClick={() => !n.is_read && markAsRead(n.id)}><p className={`text-[13px] ${!n.is_read ? "font-semibold text-slate-800" : "text-slate-600"}`}>{n.title}</p><p className="text-[12px] text-slate-400 mt-0.5 truncate">{n.message}</p></div>)}
                </div>
              </div>
            )}
          </div>
          <div className="relative" ref={profileRef}>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center gap-2 hover:bg-slate-100/80 rounded-xl px-2 py-2 transition-all">
              {profile?.profile_photo_url ? <img src={profile.profile_photo_url} alt="" className="h-9 w-9 rounded-xl object-cover ring-2 ring-slate-100" />
              : <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#e67a00] flex items-center justify-center ring-2 ring-orange-100"><User className="h-4 w-4 text-white" /></div>}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                {profile && <div className="px-4 py-3 border-b border-slate-100"><p className="text-[14px] font-semibold text-slate-800 truncate">{profile.full_name || "Candidate"}</p><p className="text-[12px] text-slate-400 capitalize truncate">{profile.current_role || "Job seeker"}</p></div>}
                <div className="p-1.5">
                  <button onClick={() => { router.push("/dashboard/candidate/profile"); setIsProfileOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-medium"><User className="h-4 w-4" strokeWidth={1.8} />Profile</button>
                  <button onClick={() => { router.push("/dashboard/candidate/settings"); setIsProfileOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-medium"><SettingsIcon className="h-4 w-4" strokeWidth={1.8} />Settings</button>
                  <div className="mx-2 my-1 border-t border-slate-100" />
                  <button onClick={async () => { await awsAuth.logout(); router.replace("/login"); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-[13px] font-medium"><LogOut className="h-4 w-4" strokeWidth={1.8} />Sign out</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
