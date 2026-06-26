"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Sparkles, Search, MessageSquare, Radio } from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useChatViewStore } from "@/hooks/useChatViewStore";
import { useSidePanelStore } from "@/hooks/useSidePanelStore";

interface Notification { id: string; title: string; message: string; is_read: boolean; created_at: string; }
interface ProfileData { full_name?: string; current_role?: string; profile_photo_url?: string; }

const pageTitles: Record<string, { title: string; sub: string }> = {
  "/dashboard/candidate": { title: "Dashboard", sub: "Track your job search progress" },
  "/dashboard/candidate/jobs": { title: "Jobs", sub: "Browse open positions" },
  "/dashboard/candidate/recommendations": { title: "Recommendations", sub: "AI-matched jobs" },
  "/dashboard/candidate/applications": { title: "Applications", sub: "Track your applications" },
  "/dashboard/candidate/gps": { title: "Career GPS", sub: "Plan your career path" },
  "/dashboard/candidate/messages": { title: "Messages", sub: "Chat with recruiters" },
  "/dashboard/candidate/community": { title: "Community", sub: "Connect with peers" },
  "/dashboard/candidate/notifications": { title: "Notifications", sub: "Your latest alerts and updates" },
  "/dashboard/candidate/profile": { title: "Profile", sub: "Manage your profile" },
  "/dashboard/candidate/settings": { title: "Settings", sub: "Account preferences" },
};

export default function CandidateHeader({ profile: initialProfile }: { profile?: ProfileData | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleChatMode } = useChatViewStore();
  const { isOpen, panelType, openPanel } = useSidePanelStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile || null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState("");
  const [sf, setSf] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const navPages = [
    { label: "Dashboard", href: "/dashboard/candidate" },
    { label: "Browse Jobs", href: "/dashboard/candidate/jobs" },
    { label: "Recommendations", href: "/dashboard/candidate/recommendations" },
    { label: "Applications", href: "/dashboard/candidate/applications" },
    { label: "Career GPS", href: "/dashboard/candidate/gps" },
    { label: "Messages", href: "/dashboard/candidate/messages" },
    { label: "Community", href: "/dashboard/candidate/community" },
    { label: "Settings", href: "/dashboard/candidate/settings" },
  ];

  const filtered = sq.length > 0 ? navPages.filter(p => p.label.toLowerCase().includes(sq.toLowerCase())) : [];

  useEffect(() => {
    async function load() {
      try {
        const token = awsAuth.getToken(); if (!token) return;
        const [notifs, prof] = await Promise.all([
          apiClient.get("/notifications", token).catch(() => []),
          apiClient.get("/candidate/profile", token).catch(() => null),
        ]);
        if (Array.isArray(notifs)) { setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length); }
        if (prof) setProfile({ full_name: prof.full_name, current_role: prof.current_role, profile_photo_url: prof.profile_photo_url });
      } catch {}
    }
    load();
    const iv = setInterval(load, 60000);
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setIsProfileOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSf(false);
    };
    const kb = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); inputRef.current?.focus(); setSf(true); } };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", kb);
    return () => { clearInterval(iv); document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", kb); };
  }, []);

  const page = pageTitles[pathname] || { title: pathname.split("/").filter(Boolean).slice(-1)[0]?.replace(/-/g, " ") || "Dashboard", sub: "" };

  const isJobsActive = pathname.includes("/jobs") || pathname.includes("/recommendations") || pathname.includes("/applications");
  const isGpsActive = pathname.includes("/gps");

  return (
    <header className="fixed top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300 w-full">
      <div className="h-16 flex items-center px-6 justify-between gap-4">
        
        {/* Left Section: Logo & Page Title */}
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => router.push("/dashboard/candidate")}>
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#E67A00] flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-200">
              <span className="text-white font-bold text-[15px] tracking-tight">T</span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className="font-bold text-[#0F172A] text-[15px] tracking-tight leading-tight whitespace-nowrap">
                TechSales<span className="text-[#FF8A00]">Axis</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase leading-none mt-0.5">Candidate</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden lg:block" />
          <div className="hidden lg:block min-w-[120px]">
            <h1 className="text-[15px] font-semibold text-[#0F172A] leading-tight capitalize tracking-[-0.01em]">{page.title}</h1>
          </div>
        </div>

        {/* Center Section: Navigation Menu */}
        <div className="flex-1 flex justify-center items-center gap-3">
          {/* Jobs Dropdown */}
          <div className="relative group py-2">
            <button className={`px-4 py-2 text-[13px] rounded-lg transition-all duration-200 cursor-pointer ${
              isJobsActive 
                ? "bg-[#FFF3E8] text-[#FF8A00] font-bold" 
                : "bg-slate-50 hover:bg-slate-100/80 text-slate-700 font-semibold"
            }`}>
              Jobs
            </button>
            <div className="absolute left-1/2 -translate-x-1/2 top-full pt-1 w-44 hidden group-hover:block z-50">
              <div className="bg-white border border-slate-200/85 rounded-xl shadow-lg py-1.5 overflow-hidden">
                <Link href="/dashboard/candidate/jobs" className="block px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors">
                  Browse Jobs
                </Link>
                <Link href="/dashboard/candidate/recommendations" className="block px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors">
                  Recommendations
                </Link>
                <Link href="/dashboard/candidate/applications" className="block px-4 py-2 text-[13px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium transition-colors">
                  Applications
                </Link>
              </div>
            </div>
          </div>

          {/* Career GPS Link Button */}
          <Link href="/dashboard/candidate/gps">
            <button className={`px-4 py-2 text-[13px] rounded-lg transition-all duration-200 cursor-pointer ${
              isGpsActive 
                ? "bg-[#FFF3E8] text-[#FF8A00] font-bold" 
                : "bg-slate-50 hover:bg-slate-100/80 text-slate-700 font-semibold"
            }`}>
              Career GPS
            </button>
          </Link>
        </div>

        {/* Right Section: Compact Search, AI, Combined Communication, & Profile */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Search bar */}
          <div className="relative w-48 hidden xl:block" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input ref={inputRef} value={sq} onChange={e => { setSq(e.target.value); setSf(true); }} onFocus={() => setSf(true)}
              placeholder="Search..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#F1F5F9] hover:bg-[#E8ECF1] focus:bg-white rounded-lg text-[12px] text-slate-700 placeholder:text-slate-400 outline-none border border-transparent focus:border-slate-200 focus:ring-2 focus:ring-orange-100 transition-all" />
            {sf && filtered.length > 0 && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                {filtered.map(item => (
                  <Link key={item.href} href={item.href} onClick={() => { setSf(false); setSq(""); }}>
                    <div className="flex items-center px-4 py-2 hover:bg-slate-50 cursor-pointer">
                      <span className="text-[12px] font-medium text-[#0F172A]">{item.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleChatMode} className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] text-white rounded-lg text-[12px] font-semibold hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.97] transition-all cursor-pointer">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">TechSalesAxis AI</span>
          </button>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          {/* Messages Link */}
          <button onClick={() => openPanel("messages")} className={`relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100/80 transition-all cursor-pointer ${(isOpen && panelType === "messages") ? "text-[#FF8A00] bg-orange-50/50" : "text-slate-400"}`} title="Messages">
            <MessageSquare className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>

          {/* Community Link */}
          <button onClick={() => router.push("/dashboard/candidate/community")} className={`relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100/80 transition-all cursor-pointer ${pathname.includes("/community") ? "text-[#FF8A00] bg-orange-50/50" : "text-slate-400"}`} title="Community">
            <Radio className="h-[17px] w-[17px]" strokeWidth={1.8} />
          </button>

          {/* Notifications Link */}
          <button onClick={() => openPanel("notifications")} className={`relative h-9 w-9 flex items-center justify-center rounded-lg hover:bg-slate-100/80 transition-all cursor-pointer ${(isOpen && panelType === "notifications") ? "text-[#FF8A00] bg-orange-50/50" : "text-slate-400"}`} title="Notifications">
            <Bell className="h-[17px] w-[17px]" strokeWidth={1.8} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-[#FF8A00] rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="flex items-center hover:bg-slate-100/80 rounded-xl p-1 transition-all cursor-pointer">
              {profile?.profile_photo_url ? (
                <img src={profile.profile_photo_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#e67a00] flex items-center justify-center ring-2 ring-orange-100 text-white font-bold text-xs">
                  {profile?.full_name?.charAt(0) || "C"}
                </div>
              )}
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                {profile && (
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{profile.full_name || "Candidate"}</p>
                    <p className="text-[11px] text-slate-400 capitalize truncate">{profile.current_role || "Job seeker"}</p>
                  </div>
                )}
                <div className="p-1">
                  <button onClick={() => { router.push("/dashboard/candidate"); setIsProfileOpen(false); }} className="w-full text-left px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-[12.5px] font-medium transition-colors">
                    Dashboard
                  </button>
                  <button onClick={() => { router.push("/dashboard/candidate/profile"); setIsProfileOpen(false); }} className="w-full text-left px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-[12.5px] font-medium transition-colors">
                    Profile
                  </button>
                  <button onClick={() => { router.push("/dashboard/candidate/settings"); setIsProfileOpen(false); }} className="w-full text-left px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-[12.5px] font-medium transition-colors">
                    Settings
                  </button>
                  <div className="mx-2 my-1 border-t border-slate-100" />
                  <button onClick={async () => { await awsAuth.logout(); router.replace("/login"); }} className="w-full text-left px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-[12.5px] font-semibold transition-colors">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
