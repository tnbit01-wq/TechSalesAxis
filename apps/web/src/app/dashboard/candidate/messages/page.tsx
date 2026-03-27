"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import ChatCenter from "@/components/ChatCenter";
import { User } from "lucide-react";

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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Messages</h1>
          <p className="text-slate-500 text-sm mt-1">Communicate with recruiters and stay updated with encrypted messaging.</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[70vh]">
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
