"use client";

import { useEffect, useState, useRef } from "react";
import { X, Bell, MessageSquare } from "lucide-react";
import { useSidePanelStore } from "@/hooks/useSidePanelStore";
import { awsAuth } from "@/lib/awsAuth";
import NotificationsPanel from "./NotificationsPanel";
import MessagesPanel from "./MessagesPanel";

interface SidePanelProps {
  role: "candidate" | "recruiter";
}

export default function SidePanel({ role }: SidePanelProps) {
  const { isOpen, panelType, closePanel } = useSidePanelStore();
  const [userId, setUserId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = awsAuth.getUser();
    if (user?.id) {
      setUserId(user.id);
    }
  }, []);

  // Handle Escape key to close panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closePanel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closePanel]);

  // Prevent scroll propagation on body when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
      {/* Glassmorphic Backdrop overlay */}
      <div
        className="absolute inset-0 bg-[#0F172A]/20 backdrop-blur-[3px] transition-opacity duration-300 ease-out"
        onClick={closePanel}
      />

      {/* Sliding Side Panel container */}
      <div
        ref={panelRef}
        className="relative w-full max-w-[420px] h-full bg-white rounded-l-3xl shadow-[-8px_0_24px_-4px_rgba(15,23,42,0.1)] flex flex-col transition-transform duration-305 ease-in-out border-l border-slate-100 overflow-hidden"
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 h-16 border-b border-slate-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-orange-50 text-[#FF8A00] flex items-center justify-center border border-orange-100/60">
              {panelType === "notifications" ? (
                <Bell className="h-[17px] w-[17px]" strokeWidth={2} />
              ) : (
                <MessageSquare className="h-[17px] w-[17px]" strokeWidth={2} />
              )}
            </div>
            <div>
              <h2 className="text-[15px] font-black text-slate-800 tracking-tight leading-tight">
                {panelType === "notifications" ? "Notifications" : "Messages"}
              </h2>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {role} Panel
              </span>
            </div>
          </div>
          <button
            onClick={closePanel}
            className="p-1.5 rounded-lg hover:bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Panel Contents */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {panelType === "notifications" && (
            <NotificationsPanel role={role} />
          )}
          {panelType === "messages" && userId && (
            <MessagesPanel userId={userId} role={role} />
          )}
        </div>
      </div>
    </div>
  );
}
