"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import ChatCenter from "@/components/ChatCenter";
import LockedView from "@/components/dashboard/LockedView";
import { MessageSquare } from "lucide-react";

export default function RecruiterMessagesPage() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const getInitialData = async () => {
      const token = awsAuth.getToken();
      if (token) {
        const userData = awsAuth.getUser();
        setUser(userData);
        
        // Check lock status
        try {
          const profile = await apiClient.get("/recruiter/profile", token);
          if ((profile?.companies?.profile_score ?? 0) === 0) {
            setIsLocked(true);
          }
        } catch (err) {
          console.error("Lock check failed:", err);
        }
      }
      setLoading(false);
    };
    getInitialData();
  }, []);

  if (loading) return null;

  if (isLocked) {
    return (
      <div className="p-8">
        <LockedView featureName="Discovery Messaging" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
              Your <span className="text-indigo-600">Messages</span>
            </h1>
            <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-md border border-indigo-200">
              Encrypted
            </div>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
            <MessageSquare className="h-3 w-3 text-indigo-500" />
            Communicate with candidates directly.
          </p>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden min-h-[70vh]">
        {user?.id ? (
          <ChatCenter userId={user.id} role="recruiter" />
        ) : (
          !loading && <div className="p-8 text-slate-400">Please log in to view messages.</div>
        )}
      </div>
    </div>
  );
}
