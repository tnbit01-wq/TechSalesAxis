"use client";

import { useEffect, useState } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { awsAuth } from "@/lib/awsAuth";
import { useRouter } from "next/navigation";
import ChatCenter from "@/components/ChatCenter";
import { MessageSquare } from "lucide-react";

export default function CandidateMessagesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userData = awsAuth.getUser();
    if (!userData) { router.replace("/login"); return; }
    setUser(userData);
    setLoading(false);
  }, [router]);

  if (loading) return <LoadingScreen label="Loading…" />;

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-hidden p-5">
      {user?.id ? (
        <ChatCenter userId={user.id} role="candidate" />
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
