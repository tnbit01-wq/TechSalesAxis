"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { useSidebar } from "@/context/SidebarContext";
import {
  LayoutDashboard,
  Briefcase,
  MessageSquare,
  Settings,
  Bell,
  Compass,
  LogOut,
  ShieldCheck,
  User,
  Radio,
  Menu,
} from "lucide-react";

interface CandidateSidebarProps {
  assessmentStatus?: string;
  profileScore?: number;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  locked?: boolean;
  description?: string;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

export default function CandidateSidebar({
  assessmentStatus,
}: CandidateSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, toggleSidebar, closeSidebar } = useSidebar();

  // Basic verification check
  const isVerified = assessmentStatus === "completed";

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const groups: SidebarGroup[] = [
    {
      label: "Signal Center",
      items: [
        {
          label: "Dashboard",
          href: "/dashboard/candidate",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Notifications",
          href: "/dashboard/candidate/notifications",
          icon: <Bell className="h-4 w-4" />,
        },
        {
          label: "Messages",
          href: "/dashboard/candidate/messages",
          icon: <MessageSquare className="h-4 w-4" />,
          locked: !isVerified,
        },
        {
          label: "Community Feed",
          href: "/dashboard/candidate/community",
          icon: <Radio className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "Career Discovery",
      items: [
        {
          label: "Job Board",
          href: "/dashboard/candidate/jobs",
          icon: <Compass className="h-4 w-4" />,
          description: "Global role inventory",
        },
        {
          label: "Applications",
          href: "/dashboard/candidate/applications",
          icon: <Briefcase className="h-4 w-4" />,
          description: "Active hiring pipelines",
        },
        {
          label: "Career GPS",
          href: "/dashboard/candidate/gps",
          icon: <Compass className="h-4 w-4 text-indigo-400" />,
          description: "Professional pathing",
        },
        {
          label: "Recommended",
          href: "/dashboard/candidate/recommendations",
          icon: <Radio className="h-4 w-4 text-emerald-400" />,
          description: "AI-matched corporate roles",
          locked: !isVerified,
        },
      ],
    },
    {
      label: "Account",
      items: [
        {
          label: "Profile",
          href: "/dashboard/candidate/profile",
          icon: <User className="h-4 w-4" />,
        },
        {
          label: "Settings",
          href: "/dashboard/candidate/settings",
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
  ];

  return (
    <aside className={`${isOpen ? "w-64" : "w-20"} bg-[#0f172a] border-r border-slate-800 flex flex-col fixed h-full z-30 transition-all duration-300 shadow-2xl`}>
      {isOpen && (
        <div className="p-6 flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300 cursor-pointer flex-shrink-0"
            onClick={() => router.push("/dashboard/candidate")}
          >
            <div className="h-4 w-4 rounded-sm bg-white rotate-45 group-hover:rotate-0 transition-transform duration-500" />
          </div>
          <span className="font-bold text-white tracking-tight text-xl whitespace-nowrap flex-1">
            Techsales<span className="text-indigo-400">Axis</span>
          </span>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
            title="Collapse sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}
      {!isOpen && (
        <div className="p-4 flex justify-center">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-400 hover:text-white flex-shrink-0"
            title="Expand sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto transition-all duration-300"
           style={{
             scrollbarWidth: 'thin',
             scrollbarColor: '#64748b transparent'
           }}>
        <style jsx>{`
          nav::-webkit-scrollbar {
            width: 4px;
          }
          nav::-webkit-scrollbar-track {
            background: transparent;
          }
          nav::-webkit-scrollbar-thumb {
            background: #64748b;
            border-radius: 10px;
          }
          nav::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}</style>
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {isOpen && (
              <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
                {group.label}
              </h3>
            )}
            <div className="space-y-1">
              {group.items.map((item, itemIdx) => (
                <SidebarLink
                  key={itemIdx}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  active={pathname === item.href}
                  locked={item.locked}
                  description={item.description}
                  isCollapsed={!isOpen}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800/50 space-y-3">
        {isOpen && assessmentStatus && (
          <div className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck
                className={`h-4 w-4 ${assessmentStatus === "completed" ? "text-emerald-400" : "text-amber-400"}`}
              />
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                Verification Hub
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {assessmentStatus.charAt(0).toUpperCase() +
                  assessmentStatus.slice(1)}
              </span>
              {assessmentStatus !== "completed" && (
                <button
                  onClick={() => router.push("/onboarding/candidate")}
                  className="px-2 py-1 bg-amber-500/10 text-amber-500 text-[10px] font-bold rounded-md hover:bg-amber-500/20 transition-colors"
                >
                  Verify
                </button>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          className={`w-full flex items-center ${isOpen ? "gap-3" : "gap-0"} px-4 py-3 text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all group font-medium`}
        >
          <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1 flex-shrink-0" />
          {isOpen && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({
  label,
  href,
  icon,
  active = false,
  locked = false,
  description,
  isCollapsed = false,
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  locked?: boolean;
  description?: string;
  isCollapsed?: boolean;
}) {
  if (locked) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl opacity-40 cursor-not-allowed group scale-95 origin-left"
        title="Complete assessment to unlock this signal"
      >
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-3">
              <div className="text-slate-500">{icon}</div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500">{label}</span>
                {description && (
                  <span className="text-[10px] text-slate-700 font-bold line-clamp-1">
                    LOCKED
                  </span>
                )}
              </div>
            </div>
            <ShieldCheck className="h-3 w-3 text-slate-600" />
          </>
        )}
        {isCollapsed && (
          <div className="text-slate-500 mx-auto">{icon}</div>
        )}
      </div>
    );
  }

  return (
    <Link href={href}>
      <div
        className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
        ${
          active
            ? "bg-indigo-600/10 text-indigo-400 shadow-[inset_0_0_10px_rgba(79,70,229,0.05)]"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }
      `}
        title={isCollapsed ? label : undefined}
      >
        <div
          className={`transition-colors duration-200 flex-shrink-0 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`}
        >
          {icon}
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <span
              className={`text-sm font-medium transition-colors duration-200 leading-tight ${active ? "text-indigo-300" : "text-slate-400"}`}
            >
              {label}
            </span>
            {description && (
              <span
                className={`text-[9px] font-bold uppercase tracking-tight transition-colors duration-200 leading-tight ${active ? "text-indigo-400/70" : "text-slate-600 group-hover:text-slate-500"}`}
              >
                {description}
              </span>
            )}
          </div>
        )}
        {active && !isCollapsed && (
          <div className="ml-auto w-1 h-3 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
        )}
      </div>
    </Link>
  );
}
