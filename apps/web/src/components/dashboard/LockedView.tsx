"use client";

import React from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";

interface LockedViewProps {
  featureName: string;
}

export default function LockedView({ featureName }: LockedViewProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-4xl border border-slate-100 shadow-sm mx-auto max-w-2xl mt-12">
      <div className="h-20 w-20 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-500 mb-8 border border-amber-100 shadow-sm shadow-amber-50">
        <Lock size={40} />
      </div>

      <h2 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight italic">
        {featureName} Locked
      </h2>

      <p className="text-slate-500 font-medium mb-10 leading-relaxed max-w-md">
        This high-impact transmission channel is currently disabled. To unlock{" "}
        <span className="text-slate-900 font-bold">{featureName}</span> and
        other advanced recruiter features, your company must complete the
        TechSales Axis DNA Assessment.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
        <button
          onClick={() => router.push("/onboarding/recruiter")}
          className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
        >
          Complete Assessment
        </button>
        <button
          onClick={() => router.push("/dashboard/recruiter")}
          className="px-10 py-4 bg-slate-50 text-slate-400 border border-slate-100 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-100 hover:text-slate-600 transition-all"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
