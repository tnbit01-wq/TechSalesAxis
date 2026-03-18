"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import ChatCenter from "@/components/ChatCenter";
import { MessageSquare, Sparkles, User } from "lucide-react";

export default function CandidateMessagesPage() {
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialData = async () => {
      const user = awsAuth.getUser();
      if (user) {
        setUser(user);
      }
      setLoading(false);
    };
    getInitialData();
  }, []);

  if (loading) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-12">
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
            Communicate with recruiters and stay updated.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Real-time Sync Active
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden min-h-[70vh]">
        {user?.id ? (
          <ChatCenter userId={user.id} role="candidate" />
        ) : (
          !loading && (
            <div className="p-20 text-center flex flex-col items-center justify-center">
              <div className="h-16 w-16 bg-slate-50 flex items-center justify-center rounded-4xl mb-6">
                <User className="h-8 w-8 text-slate-200" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Authentication Required
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
