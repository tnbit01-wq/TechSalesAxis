"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Check,
  Sparkles,
  User,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  Search,
  Briefcase,
  MessageSquare,
  Users,
  Globe,
  FileText,
  UsersRound,
  LayoutDashboard,
  Menu,
  X,
  Coins,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useChatViewStore } from "@/hooks/useChatViewStore";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

const navPages = [
  { label: "Dashboard", href: "/dashboard/recruiter", icon: LayoutDashboard },
  { label: "Jobs", href: "/dashboard/recruiter/hiring/jobs", icon: Briefcase },
  { label: "Post a Job", href: "/dashboard/recruiter/hiring/jobs/new", icon: FileText },
  { label: "Applications", href: "/dashboard/recruiter/hiring/applications", icon: FileText },
  { label: "Talent Pool", href: "/dashboard/recruiter/talent-pool", icon: Globe },
  { label: "Recommendations", href: "/dashboard/recruiter/intelligence/recommendations", icon: Sparkles },
  { label: "Messages", href: "/dashboard/recruiter/messages", icon: MessageSquare },
  { label: "Community", href: "/dashboard/recruiter/organization/community", icon: Users },
  { label: "Settings", href: "/dashboard/recruiter/account/settings", icon: SettingsIcon },
];

export default function RecruiterHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { toggleChatMode } = useChatViewStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{
    full_name?: string;
    team_role?: string;
    profile_photo_url?: string;
    credits?: number;
  } | null>(null);

  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const [sq, setSq] = useState("");
  const [sf, setSf] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered =
    sq.length > 0
      ? navPages.filter((p) => p.label.toLowerCase().includes(sq.toLowerCase()))
      : [];

  useEffect(() => {
    async function load() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const [notifs, prof] = await Promise.all([
          apiClient.get("/notifications", token).catch(() => []),
          apiClient.get("/recruiter/profile", token).catch(() => null),
        ]);
        if (Array.isArray(notifs)) {
          setNotifications(notifs);
          setUnreadCount(notifs.filter((n: Notification) => !n.is_read).length);
        }
        if (prof) {
          setProfile({
            full_name: prof.full_name,
            team_role: prof.team_role,
            profile_photo_url: prof.profile_photo_url,
            credits: prof.credits,
          });
        }
      } catch {}
    }
    load();
    const iv = setInterval(load, 60000);
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSf(false);
      }
    };
    const kb = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSf(true);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", kb);
    return () => {
      clearInterval(iv);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", kb);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const markAsRead = async (id: string) => {
    try {
      const t = awsAuth.getToken();
      if (!t) return;
      await apiClient.patch(`/notifications/${id}/read`, {}, t);
      setNotifications((p) =>
        p.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((p) => Math.max(0, p - 1));
    } catch {}
  };

  const categories = [
    {
      label: "Jobs",
      href: "/dashboard/recruiter/hiring/jobs",
      children: [
        { label: "All Jobs", href: "/dashboard/recruiter/hiring/jobs" },
        { label: "Post a Job", href: "/dashboard/recruiter/hiring/jobs/new" },
        { label: "Applications", href: "/dashboard/recruiter/hiring/applications" },
      ],
    },
    {
      label: "Talent",
      href: "/dashboard/recruiter/talent-pool",
      children: [
        { label: "Talent Pool", href: "/dashboard/recruiter/talent-pool" },
        { label: "Recommendations", href: "/dashboard/recruiter/intelligence/recommendations" },
      ],
    },
    {
      label: "Community",
      href: "/dashboard/recruiter/organization/community",
      children: [
        { label: "Messages", href: "/dashboard/recruiter/messages" },
        { label: "Community Hub", href: "/dashboard/recruiter/organization/community" },
      ],
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-45 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300">
      <div className="h-16 flex items-center px-6 md:px-8 justify-between gap-6 w-full">
        {/* Left Side: Brand Logo & Navigation */}
        <div className="flex items-center gap-6 h-full">
          {/* Hamburger Menu Icon (Mobile Only) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl hover:bg-slate-100/80 transition-all text-slate-500"
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer flex-shrink-0"
            onClick={() => {
              router.push("/dashboard/recruiter");
              setIsMobileMenuOpen(false);
            }}
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#E67A00] flex items-center justify-center flex-shrink-0 shadow-sm shadow-orange-200">
              <span className="text-white font-bold text-[15px] tracking-tight">T</span>
            </div>
            <div className="flex flex-col hidden sm:flex">
              <span className="font-bold text-[#0F172A] text-[14px] tracking-tight leading-tight whitespace-nowrap">
                TechSales<span className="text-[#FF8A00]">Axis</span>
              </span>
              <span className="text-[9px] text-slate-400 font-semibold tracking-wide uppercase leading-none mt-0.5">
                Recruiter
              </span>
            </div>
          </div>

          <div className="hidden lg:block h-6 w-px bg-slate-200/80 mx-1" />

          {/* Horizontal Desktop Navigation with Category Hover Dropdowns */}
          <nav className="hidden lg:flex items-center gap-2.5 h-full">
            {categories.map((category) => {
              const isChildActive = category.children.some(
                (child) =>
                  pathname === child.href ||
                  (child.href !== "/dashboard/recruiter" && pathname.startsWith(child.href))
              );
              const isActive = pathname === category.href || isChildActive;

              return (
                <div key={category.label} className="relative group h-full flex items-center">
                  <Link href={category.href}>
                    <span
                      className={`px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                        isActive
                          ? "bg-[#FFF3E8] text-[#FF8A00]"
                          : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {category.label}
                    </span>
                  </Link>

                  {/* Dropdown Menu on Hover */}
                  <div className="absolute top-[80%] left-0 hidden group-hover:block w-48 bg-white border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] py-2 z-50 animate-in fade-in slide-in-from-top-1.5 duration-100">
                    {/* Bridge overlay to prevent losing hover between active area */}
                    <div className="absolute -top-3 left-0 right-0 h-3 bg-transparent" />
                    
                    {category.children.map((child) => {
                      const isSubActive = pathname === child.href;
                      return (
                        <Link key={child.href} href={child.href} className="block">
                          <span
                            className={`flex items-center px-4 py-2 text-[13px] font-semibold rounded-xl mx-1.5 my-0.5 transition-all duration-150 ${
                              isSubActive
                                ? "bg-orange-50 text-[#FF8A00]"
                                : "text-slate-650 hover:text-slate-900 hover:bg-slate-50"
                            }`}
                          >
                            {child.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Center: Search Bar (Desktop Only) */}
        <div className="hidden md:flex flex-1 max-w-xs xl:max-w-md relative" ref={searchRef}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            ref={inputRef}
            value={sq}
            onChange={(e) => {
              setSq(e.target.value);
              setSf(true);
            }}
            onFocus={() => setSf(true)}
            placeholder="Search pages…"
            className="w-full pl-10 pr-16 py-2 bg-[#F1F5F9] hover:bg-[#E8ECF1] focus:bg-white rounded-xl text-[13px] text-slate-700 placeholder:text-slate-400 outline-none border border-transparent focus:border-slate-200 focus:ring-2 focus:ring-orange-100 transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md px-1.5 py-0.5 hidden xl:inline">
            ⌘K
          </kbd>
          {sf && filtered.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-white rounded-xl border border-slate-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
              {filtered.map((item) => {
                const IC = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setSf(false);
                      setSq("");
                    }}
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                      <IC className="h-4 w-4 text-slate-400" strokeWidth={1.8} />
                      <span className="text-[13px] font-medium text-[#0F172A]">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3.5 flex-shrink-0">
          {/* Credits Badge */}
          {profile?.credits !== undefined && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1.5 select-none" title="Remaining Credits">
              <Coins className="h-4 w-4 text-[#FF8A00]" />
              <span className="text-[11px] font-bold text-slate-650">{profile.credits} credits</span>
            </div>
          )}

          <button
            onClick={toggleChatMode}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-[#FF8A00] to-[#FF6B00] text-white rounded-xl text-[13px] font-semibold hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.97] transition-all"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">AI Agent</span>
          </button>

          <div className="h-6 w-px bg-slate-200/80 mx-0.5 hidden sm:block" />

          {/* Messages Icon Button */}
          <button
            onClick={() => {
              router.push("/dashboard/recruiter/messages");
            }}
            className="relative h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-100/80 transition-all"
            title="Messages"
          >
            <MessageSquare
              className={`h-[18px] w-[18px] ${
                pathname === "/dashboard/recruiter/messages"
                  ? "text-[#FF8A00]"
                  : "text-slate-400"
              }`}
              strokeWidth={1.8}
            />
          </button>

          {/* Notifications Bell - Direct link redirect on click */}
          <button
            onClick={() => {
              router.push("/dashboard/recruiter/account/notifications");
            }}
            className="relative h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-100/80 transition-all"
            title="Notifications"
          >
            <Bell
              className={`h-[18px] w-[18px] ${
                pathname === "/dashboard/recruiter/account/notifications"
                  ? "text-[#FF8A00]"
                  : unreadCount > 0
                  ? "text-[#FF8A00]"
                  : "text-slate-400"
              }`}
              strokeWidth={1.8}
            />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-4 px-1 bg-[#FF8A00] rounded-full flex items-center justify-center ring-2 ring-white">
                <span className="text-white text-[10px] font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </span>
            )}
          </button>

          {/* Profile Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 hover:bg-slate-100/80 rounded-xl px-2 py-2 transition-all"
            >
              {profile?.profile_photo_url ? (
                <img
                  src={profile.profile_photo_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#FF8A00] to-[#e67a00] flex items-center justify-center ring-2 ring-orange-100">
                  <User className="h-4 w-4 text-white" />
                </div>
              )}
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden z-50">
                {profile && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[14px] font-semibold text-slate-800 truncate">
                      {profile.full_name || "Recruiter"}
                    </p>
                    <p className="text-[12px] text-slate-400 capitalize truncate">
                      {profile.team_role || "Recruiter"}
                    </p>
                  </div>
                )}
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      router.push("/dashboard/recruiter");
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-medium"
                  >
                    <LayoutDashboard className="h-4 w-4" strokeWidth={1.8} />
                    Dashboard
                  </button>
                  <button
                    onClick={() => {
                      router.push("/dashboard/recruiter/account/profile");
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-medium"
                  >
                    <User className="h-4 w-4" strokeWidth={1.8} />
                    Profile
                  </button>
                  <button
                    onClick={() => {
                      router.push("/dashboard/recruiter/account/settings");
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-lg text-[13px] font-medium"
                  >
                    <SettingsIcon className="h-4 w-4" strokeWidth={1.8} />
                    Settings
                  </button>
                  <div className="mx-2 my-1 border-t border-slate-100" />
                  <button
                    onClick={async () => {
                      await awsAuth.logout();
                      router.replace("/login");
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-[13px] font-medium"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.8} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-white z-40 border-t border-slate-100 flex flex-col animate-in slide-in-from-top-4 duration-200">
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="space-y-4">
              {/* Dashboard Link */}
              <div className="space-y-1">
                <Link
                  href="/dashboard/recruiter"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      pathname === "/dashboard/recruiter"
                        ? "bg-orange-50 text-[#FF8A00] font-bold"
                        : "text-slate-700 hover:bg-slate-55 font-semibold text-[14px]"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4 shrink-0" />
                    <span>Dashboard</span>
                  </div>
                </Link>
              </div>

              {/* Categorized Groups */}
              {categories.map((category) => (
                <div key={category.label} className="space-y-1">
                  <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                    {category.label}
                  </p>
                  {category.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <div
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                            isActive
                              ? "bg-orange-50 text-[#FF8A00] font-semibold"
                              : "text-slate-650 hover:bg-slate-50 font-medium"
                          }`}
                        >
                          <span className="text-[13.5px] pl-1">{child.label}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Account & System
              </p>
              <Link
                href="/dashboard/recruiter/account/profile"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-650 hover:bg-slate-50 font-medium">
                  <span className="text-[14px]">Profile</span>
                </div>
              </Link>
              <Link
                href="/dashboard/recruiter/account/settings"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-650 hover:bg-slate-50 font-medium">
                  <span className="text-[14px]">Settings</span>
                </div>
              </Link>
              <Link
                href="/dashboard/recruiter/account/notifications"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-650 hover:bg-slate-50 font-medium">
                  <span className="text-[14px]">Notifications</span>
                </div>
              </Link>
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={async () => {
                setIsMobileMenuOpen(false);
                await awsAuth.logout();
                router.replace("/login");
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[14px] font-semibold transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
