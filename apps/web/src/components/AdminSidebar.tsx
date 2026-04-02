"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import {
  LayoutDashboard,
  UploadCloud,
  Layers,
  Settings,
  ShieldCheck,
  LogOut,
  Users
} from "lucide-react";

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

export default function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

  const groups: SidebarGroup[] = [
    {
      label: "Platform Command",
      items: [
        {
          label: "Admin Dashboard",
          href: "/admin/dashboard",
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
      ],
    },
    {
      label: "Data Operations",
      items: [
        {
          label: "Upload Data",
          href: "/admin/bulk-upload",
          icon: <UploadCloud className="h-4 w-4" />,
          description: "Ingest new records",
        },
        {
          label: "Batches",
          href: "/admin/bulk-uploads",
          icon: <Layers className="h-4 w-4 text-indigo-400" />,
          description: "Manage uploaded groups",
        },
        {
          label: "All Candidates",
          href: "/admin/unified-candidates",
          icon: <Users className="h-4 w-4 text-purple-400" />,
          description: "Unified candidate pool",
        },
        {
          label: "Review Matches",
          href: "/admin/bulk-upload/review",
          icon: <Users className="h-4 w-4 text-emerald-400" />,
          description: "Candidate resolution",
        },
      ],
    },
    {
      label: "System",
      items: [
        {
          label: "Settings",
          href: "/admin/settings",
          icon: <Settings className="h-4 w-4" />,
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0f172a] border-r border-slate-800 flex flex-col fixed h-full z-30 transition-all duration-300 shadow-2xl">
      <div className="p-8">
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => router.push("/admin/dashboard")}
        >
          <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
            <div className="h-4 w-4 rounded-sm bg-white rotate-45 group-hover:rotate-0 transition-transform duration-500" />
          </div>
          <span className="font-bold text-white tracking-tight text-xl">
            Techsales<span className="text-indigo-400">Axis</span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest ml-2 align-top">ADMN</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-6 overflow-y-auto scrollbar-hide hover:scrollbar-default transition-all duration-300">
        <style jsx global>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-hide {
            -ms-overflow-style: none; /* IE and Edge */
            scrollbar-width: none; /* Firefox */
          }
          .hover\\:scrollbar-default:hover::-webkit-scrollbar {
            display: block;
            width: 4px;
          }
          .hover\\:scrollbar-default:hover::-webkit-scrollbar-track {
            background: transparent;
          }
          .hover\\:scrollbar-default:hover::-webkit-scrollbar-thumb {
            background: #1e293b;
            border-radius: 10px;
          }
        `}</style>
        {groups.map((group, idx) => (
          <div key={idx} className="space-y-2">
            <h3 className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item, itemIdx) => (
                <SidebarLink
                  key={itemIdx}
                  label={item.label}
                  href={item.href}
                  icon={item.icon}
                  active={pathname?.startsWith(item.href) && (item.href !== "/admin/bulk-upload" || pathname === "/admin/bulk-upload")}
                  locked={item.locked}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-slate-800/50 space-y-3">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-all duration-200 group"
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            <LogOut className="h-4 w-4 text-slate-500 group-hover:text-red-400 transition-colors" />
            Sign Out
          </div>
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
}: {
  label: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
  locked?: boolean;
  description?: string;
}) {
  if (locked) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl opacity-40 cursor-not-allowed group scale-95 origin-left"
        title="Locked"
      >
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
      </div>
    );
  }

  return (
    <Link href={href}>
      <div
        className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
        ${
          active
            ? "bg-indigo-600/10 text-indigo-400 shadow-[inset_0_0_10px_rgba(79,70,229,0.05)]"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
        }
      `}
      >
        <div
          className={`transition-colors duration-200 ${active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`}
        >
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label}</span>
          {description && (
            <span
              className={`text-[10px] ${active ? "text-indigo-400/70" : "text-slate-500 group-hover:text-slate-400"} font-medium transition-colors`}
            >
              {description}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
