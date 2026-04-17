"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { useSidebar } from "@/context/SidebarContext";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  Settings,
  Bell,
  UsersRound,
  Zap,
  Globe,
  LogOut,
  ShieldCheck,
  Building2,
  FileText,
  Menu,
} from "lucide-react";

interface RecruiterSidebarProps {
  assessmentStatus?: string;
  teamRole?: string;
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
  icon: React.ReactNode;
  items: SidebarItem[];
}

export default function RecruiterSidebar({
  assessmentStatus,
  teamRole,
  profileScore = 0,
}: RecruiterSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isOpen, toggleSidebar, closeSidebar } = useSidebar();

  const isLocked = profileScore === 0;

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const groups: SidebarGroup[] = [
    {
      label: "Overview",
      icon: <LayoutDashboard className="h-4 w-4" />,
      items: [
        {
          label: "Dashboard",
          href: "/dashboard/recruiter",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          label: "Notifications",
          href: "/dashboard/recruiter/account/notifications",
          icon: <Bell className="h-4 w-4" />,
        },
        {
          label: "Messages",
          href: "/dashboard/recruiter/messages",
          icon: <MessageSquare className="h-4 w-4" />,
          locked: isLocked,
        },
        {
          label: "Community Feed",
          href: "/dashboard/recruiter/organization/community",
          icon: <Users className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "Hiring Hub",
      icon: <Briefcase className="h-4 w-4" />,
      items: [
        {
          label: "Post a Job",
          href: "/dashboard/recruiter/hiring/jobs/new",
          icon: <Zap className="h-4 w-4" />,
          locked: isLocked,
          description: "Strategic role creation with AI alignment",
        },
        {
          label: "Jobs Posted",
          href: "/dashboard/recruiter/hiring/jobs",
          icon: <Briefcase className="h-4 w-4" />,
          description:
            "Management interface for active, paused, and archived roles",
        },
        {
          label: "Applied",
          href: "/dashboard/recruiter/hiring/applications",
          icon: <FileText className="h-4 w-4" />,
          description: "An end-to-end tracking system for candidates",
        },
      ],
    },
    {
      label: "Talent Hub",
      icon: <Users className="h-4 w-4" />,
      items: [
        {
          label: "Talent Pool",
          href: "/dashboard/recruiter/talent-pool",
          icon: <Globe className="h-4 w-4" />,
          locked: isLocked,
          description: "Visualized view of total verified candidates",
        },
        {
          label: "Candidate Pool",
          href: "/dashboard/recruiter/hiring/pool",
          icon: <UsersRound className="h-4 w-4" />,
          locked: isLocked,
          description: "Access to the global database of verified talent",
        },
        {
          label: "Recommended",
          href: "/dashboard/recruiter/intelligence/recommendations",
          icon: <Zap className="h-4 w-4" />,
          locked: isLocked,
        },
      ],
    },
    {
      label: "Organization",
      icon: <Building2 className="h-4 w-4" />,
      items: [
        teamRole === "admin"
          ? {
              label: "Team",
              href: "/dashboard/recruiter/organization/team",
              icon: <UsersRound className="h-4 w-4" />,
            }
          : null,
      ].filter(Boolean) as {
        label: string;
        href: string;
        icon: React.ReactNode;
        locked?: boolean;
      }[],
    },
    {
      label: "Account",
      icon: <Settings className="h-4 w-4" />,
      items: [
        {
          label: "Profile",
          href: "/dashboard/recruiter/account/profile",
          icon: <Users className="h-4 w-4" />,
        },
        {
          label: "Settings",
          href: "/dashboard/recruiter/account/settings",
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
  ];

  return (
    <aside className={`${isOpen ? "w-64" : "w-20"} bg-[#0f172a] border-r border-slate-800 flex flex-col fixed h-full z-30 transition-all duration-300`}>
      {isOpen && (
        <div className="p-6 flex items-center gap-2">
          <div
            className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300 cursor-pointer flex-shrink-0"
            onClick={() => router.push("/dashboard/recruiter")}
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
                  onClick={() => router.push("/onboarding/recruiter")}
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
        className="flex items-center justify-between px-4 py-3 rounded-xl opacity-40 cursor-not-allowed group"
        title="Complete company assessment to unlock"
      >
        {!isCollapsed && (
          <>
            <div className="flex items-center gap-3">
              <div className="text-slate-500">{icon}</div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-500">{label}</span>
                {description && (
                  <span className="text-[10px] text-slate-600 line-clamp-1">
                    {description}
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
            ? "bg-indigo-600/10 text-indigo-400 shadow-sm"
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
            <span className="text-sm font-medium transition-colors duration-200">
              {label}
            </span>
            {description && (
              <span
                className={`text-[10px] leading-tight transition-colors duration-200 ${active ? "text-indigo-400/70" : "text-slate-500 group-hover:text-slate-400"}`}
              >
                {description}
              </span>
            )}
          </div>
        )}
        {active && !isCollapsed && (
          <div className="ml-auto w-1 h-4 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
        )}
      </div>
    </Link>
  );
}
