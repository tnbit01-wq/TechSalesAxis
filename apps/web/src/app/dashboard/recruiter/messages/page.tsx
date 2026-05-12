"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { useRouter } from "next/navigation";
import ChatCenter from "@/components/ChatCenter";
import { MessageSquare } from "lucide-react";

export default function RecruiterMessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = awsAuth.getUser();
    if (!userData) { router.replace("/login"); return; }
    setUser(userData);
    setLoading(false);
  }, [router]);

  if (loading) return (
    <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" />
        <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading…</p>
      </div>
    </div>
  );

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-hidden p-5">
      {user?.id ? (
        <ChatCenter userId={user.id} role="recruiter" />
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-7 w-7 text-slate-300" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-bold text-[#0F172A]">Authentication Required</p>
            <p className="text-[12px] text-slate-400 mt-1">Sign in to access your messages</p>
          </div>
        </div>
      )}
    </div>
  );
}
