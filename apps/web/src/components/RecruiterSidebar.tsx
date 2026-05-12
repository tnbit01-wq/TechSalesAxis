"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { useSidebar } from "@/context/SidebarContext";
import {
  LayoutDashboard,
  Briefcase,
  MessageSquare,
  Users,
  Globe,
  FileText,
  UsersRound,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Plus,
  Sparkles,
} from "lucide-react";

interface RecruiterSidebarProps {
  assessmentStatus?: string;
  teamRole?: string;
  profileScore?: number;
}

export default function RecruiterSidebar({ teamRole, profileScore = 0 }: RecruiterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, toggleSidebar } = useSidebar();

  const navGroups = [
    {
      label: "Main",
      items: [
        { label: "Dashboard", href: "/dashboard/recruiter", icon: LayoutDashboard },
        { label: "Jobs", href: "/dashboard/recruiter/hiring/jobs", icon: Briefcase },
        { label: "Applications", href: "/dashboard/recruiter/hiring/applications", icon: FileText },
      ],
    },
    {
      label: "Talent",
      items: [
        { label: "Talent Pool", href: "/dashboard/recruiter/talent-pool", icon: Globe },
        { label: "Recommendations", href: "/dashboard/recruiter/intelligence/recommendations", icon: Sparkles },
        ...(teamRole === "admin"
          ? [{ label: "Team", href: "/dashboard/recruiter/organization/team", icon: UsersRound }]
          : []),
      ],
    },
    {
      label: "Connect",
      items: [
        { label: "Messages", href: "/dashboard/recruiter/messages", icon: MessageSquare },
        { label: "Community", href: "/dashboard/recruiter/organization/community", icon: Users },
      ],
    },
  ];

  return (
    <aside
      className={`${isOpen ? "w-[240px]" : "w-[68px]"} bg-white border-r border-slate-100 flex flex-col fixed h-full z-30 transition-all duration-300 ease-in-out`}
    >
      {/* Logo — same height as header (64px) */}
      <div className={`flex items-center ${isOpen ? "px-5 gap-3" : "justify-center"} h-16 flex-shrink-0 border-b border-slate-100`}>
        <div
          className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#FF8A00] to-[#E67A00] flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm shadow-orange-200"
          onClick={() => router.push("/dashboard/recruiter")}
        >
          <span className="text-white font-bold text-[15px] tracking-tight">T</span>
        </div>
        {isOpen && (
          <div className="flex flex-col">
            <span className="font-bold text-[#0F172A] text-[15px] tracking-tight leading-tight whitespace-nowrap">
              TechSales<span className="text-[#FF8A00]">Axis</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Recruiter</span>
          </div>
        )}
      </div>

      {/* Post Job CTA */}
      <div className={`flex-shrink-0 ${isOpen ? "px-4" : "px-3"} py-4`}>
        <button
          onClick={() => router.push("/dashboard/recruiter/hiring/jobs/new")}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[13px] font-semibold transition-all duration-200 hover:shadow-md hover:shadow-orange-500/20 active:scale-[0.98]`}
          title={!isOpen ? "Post Job" : undefined}
        >
          <Plus className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
          {isOpen && <span>Post a job</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden dashboard-scroll">
        <div className="space-y-5 pb-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && isOpen && (
                <p className="px-5 mb-1.5 text-[10px] font-semibold text-slate-400 tracking-widest uppercase">
                  {group.label}
                </p>
              )}
              {gi > 0 && !isOpen && (
                <div className="mx-4 mb-3 border-t border-slate-100" />
              )}
              <div className="space-y-0.5 px-3">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard/recruiter" && pathname.startsWith(item.href));
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
          onClick={() => { awsAuth.logout(); router.replace("/login"); }}
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
