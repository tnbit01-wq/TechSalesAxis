"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { useSidebar } from "@/context/SidebarContext";
import {
  LayoutDashboard,
  Briefcase,
  MessageSquare,
  Radio,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Compass,
  Sparkles,
  Bell,
} from "lucide-react";

interface CandidateSidebarProps {
  assessmentStatus?: string;
  profileScore?: number;
}

const navGroups = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", href: "/dashboard/candidate", icon: LayoutDashboard },
      { label: "Recommendations", href: "/dashboard/candidate/recommendations", icon: Sparkles },
      { label: "Jobs", href: "/dashboard/candidate/jobs", icon: Compass },
      { label: "Applications", href: "/dashboard/candidate/applications", icon: Briefcase },
      { label: "Career GPS", href: "/dashboard/candidate/gps", icon: MapPin },
    ],
  },
  {
    label: "Connect",
    items: [
      { label: "Messages", href: "/dashboard/candidate/messages", icon: MessageSquare },
      { label: "Community", href: "/dashboard/candidate/community", icon: Radio },
      { label: "Notifications", href: "/dashboard/candidate/notifications", icon: Bell },
    ],
  },
];

export default function CandidateSidebar({ assessmentStatus, profileScore }: CandidateSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, toggleSidebar } = useSidebar();

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

  return (
    <aside
      className={`${isOpen ? "w-[240px]" : "w-[68px]"} bg-white border-r border-slate-100 flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out`}
    >
      {/* Logo — same height as header (64px) */}
      <div className={`flex items-center ${isOpen ? "px-5 gap-3" : "justify-center"} h-16 flex-shrink-0 border-b border-slate-100`}>
        <div
          className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#E67A00] flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm shadow-orange-200"
          onClick={() => router.push("/dashboard/candidate")}
        >
          <span className="text-white font-bold text-[15px] tracking-tight">T</span>
        </div>
        {isOpen && (
          <div className="flex flex-col">
            <span className="font-bold text-[#0F172A] text-[15px] tracking-tight leading-tight whitespace-nowrap">
              TechSales<span className="text-[#FF8A00]">Axis</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Candidate</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden dashboard-scroll">
        <div className="space-y-5">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && isOpen && (
                <p className="px-5 mb-1.5 text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
                  {group.label}
                </p>
              )}
              {group.label && !isOpen && gi > 0 && (
                <div className="mx-4 mb-3 border-t border-slate-100" />
              )}
              <div className="space-y-0.5 px-3">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard/candidate" && pathname.startsWith(item.href));
                  const Icon = item.icon;

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={`relative flex items-center gap-3 ${isOpen ? "px-3" : "justify-center px-0"} py-2.5 rounded-xl transition-all duration-200 group cursor-pointer ${
                          isActive
                            ? "bg-[#FFF3E8] text-[#FF8A00]"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                        title={!isOpen ? item.label : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#FF8A00] rounded-r-full" />
                        )}
                        <Icon
                          className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${isActive ? "text-[#FF8A00]" : "text-slate-400 group-hover:text-slate-600"}`}
                          strokeWidth={isActive ? 2 : 1.8}
                        />
                        {isOpen && (
                          <span className={`text-[13.5px] ${isActive ? "font-semibold text-[#FF8A00]" : "font-medium"}`}>
                            {item.label}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      {/* Bottom Controls */}
      <div className="flex-shrink-0 border-t border-slate-100 p-3 space-y-1">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 ${isOpen ? "px-3" : "justify-center"} py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50/60 rounded-xl transition-all duration-200 group`}
          title={!isOpen ? "Logout" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0 group-hover:-translate-x-0.5 transition-transform" strokeWidth={1.8} />
          {isOpen && <span className="text-[13px] font-medium">Logout</span>}
        </button>
        <button
          onClick={toggleSidebar}
          className={`w-full flex items-center gap-3 ${isOpen ? "px-3" : "justify-center"} py-2.5 text-slate-300 hover:text-slate-500 hover:bg-slate-50 rounded-xl transition-all duration-200`}
          title={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <ChevronRight className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          {isOpen && <span className="text-[13px] font-medium text-slate-400">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
