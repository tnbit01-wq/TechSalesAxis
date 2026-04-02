"use client";

import React from "react";
import {
  Users,
  UserCheck,
  MessageSquare,
  Award,
  CheckCircle,
  ArrowRight,
  Zap,
} from "lucide-react";

interface FunnelData {
  applied: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  hired: number;
}

interface HiringFunnelProps {
  data: FunnelData;
}

const HiringFunnel: React.FC<HiringFunnelProps> = ({ data }) => {
  const stages = [
    {
      label: "Interest",
      fullLabel: "Interest Captured",
      value: data.applied,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/5",
    },
    {
      label: "Matches",
      fullLabel: "Verified Matches",
      value: data.shortlisted,
      icon: UserCheck,
      color: "text-primary",
      bg: "bg-primary/5",
    },
    {
      label: "Dialogues",
      fullLabel: "Active Dialogues",
      value: data.interviewed,
      icon: MessageSquare,
      color: "text-purple-500",
      bg: "bg-purple-500/5",
    },
    {
      label: "Secured",
      fullLabel: "Success Secured",
      value: data.hired,
      icon: CheckCircle,
      color: "text-emerald-500",
      bg: "bg-emerald-500/5",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {stages.map((stage, idx) => (
          <React.Fragment key={stage.label}>
            <div className="flex-1 min-w-0 bg-white border border-slate-100 rounded-xl p-4 transition-all duration-300 group hover:shadow-md hover:border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-1.5 rounded-lg ${stage.bg} ${stage.color}`}>
                  <stage.icon size={16} />
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-tighter leading-none">
                  {stage.value}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black text-slate-800 tracking-tight leading-none group-hover:text-primary truncate">
                  {stage.label}
                </div>
                <div className="text-[9px] font-medium text-slate-400 opacity-60 leading-none">
                  {stage.fullLabel}
                </div>
              </div>
            </div>
            {idx < stages.length - 1 && (
              <ArrowRight className="text-slate-200 shrink-0" size={14} />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="p-4 bg-slate-900 rounded-xl flex items-center justify-between text-white overflow-hidden relative border border-white/5 shadow-lg shadow-indigo-900/10">
        <div className="absolute inset-0 bg-linear-to-r from-primary/5 to-transparent pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-8 px-2.5 bg-primary/10 rounded-lg flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300">
              Performance
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            Efficiency is <span className="text-white">12% above average.</span>
          </p>
        </div>
        <div className="text-right relative z-10 flex items-center gap-2">
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Momentum</span>
          <p className="text-2xl font-black text-white italic tracking-tighter">
            {data.applied > 0
              ? ((data.hired / data.applied) * 100).toFixed(1)
              : 0}
            %
          </p>
        </div>
      </div>
    </div>
  );
};

export default HiringFunnel;

