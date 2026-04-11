"use client";

import { useEffect } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function performLogout() {
      // 1. Sign out 
      awsAuth.logout();
      
      // 2. Clear all local storage
      localStorage.clear();
      
      // 3. Optional: Clear session storage
      sessionStorage.clear();
      
      // 4. Redirect to landing
      router.replace("/");
    }
    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <h1 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          Clearing Sessions...
        </h1>
      </div>
    </div>
  );
}

