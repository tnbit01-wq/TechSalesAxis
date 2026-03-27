"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import ChatCenter from "@/components/ChatCenter";
import { User } from "lucide-react";

export default function RecruiterMessagesPage() {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getInitialData = async () => {
      const userData = awsAuth.getUser();
      setUser(userData || null);
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
          <p className="text-slate-500 text-sm mt-1">Communicate directly with candidates about opportunities.</p>
        </div>
      </header>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[70vh]">
        {user?.id ? (
          <ChatCenter userId={user.id} role="recruiter" />
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <User className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-slate-900 font-bold mb-1">Authentication Required</h3>
            <p className="text-slate-500 text-sm">Please log in to view your messages.</p>
          </div>
        )}
      </div>
    </div>
  );
}
