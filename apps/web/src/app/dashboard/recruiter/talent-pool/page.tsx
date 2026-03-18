"use client";

import React, { useState, useEffect, useMemo } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import TalentBubbleChart from "@/components/TalentBubbleChart";
import { 
  Users, 
  Briefcase, 
  IndianRupee, 
  MapPin, 
  Zap, 
  Search,
  TrendingUp,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  MousePointer2
} from "lucide-react";

interface CandidateData {
  user_id: string;
  full_name: string;
  experience: string;
  years_of_experience: number;
  skills: string[];
  location: string;
  location_tier: string | null;
  expected_salary: number | null;
  target_role: string | null;
  current_role: string | null;
}

const TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];
const TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi'];

function getCityTier(location: string): string {
  if (!location) return "Unspecified";
  const loc = location.toLowerCase();
  if (TIER_1_CITIES.some(city => loc.includes(city))) return "Tier 1";
  if (TIER_2_CITIES.some(city => loc.includes(city))) return "Tier 2";
  return "Tier 3";
}

export default function TalentPoolPage() {
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    experience: "all",
    tier: "all",
    salary: "all",
    search: ""
  });

  useEffect(() => {
    async function fetchPool() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          console.warn("No token found for talent-pool fetch");
          return;
        }
        console.log("Fetching talent-pool with token...");
        const data = await apiClient.get("/recruiter/talent-pool", token);
        console.log("Talent-pool data received:", data);
        setCandidates(data || []);
      } catch (err) {
        console.error("Pool fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPool();
  }, []);

  const filteredCandidates = useMemo(() => {
    console.log("Filtering candidates...", candidates.length);
    const filtered = candidates.filter(c => {
      const matchesExp = filters.experience === "all" || (c.experience || "").toLowerCase() === filters.experience.toLowerCase();
      const actualTier = c.location_tier || getCityTier(c.location);
      const matchesTier = filters.tier === "all" || actualTier === filters.tier;
      
      const sal = (c.expected_salary || 0) / 100000;
      let matchesSalary = true;
      if (filters.salary === "low") matchesSalary = sal < 5;
      else if (filters.salary === "mid") matchesSalary = sal >= 5 && sal < 15;
      else if (filters.salary === "high") matchesSalary = sal >= 15;

      const matchesSearch = !filters.search || 
        (c.full_name || "").toLowerCase().includes(filters.search.toLowerCase()) ||
        (c.skills || []).some(s => (s || "").toLowerCase().includes(filters.search.toLowerCase()));
      
      return matchesExp && matchesTier && matchesSalary && matchesSearch;
    });
    console.log("Filtered candidates:", filtered.length);
    return filtered;
  }, [candidates, filters]);

  const stats = useMemo(() => {
    const total = filteredCandidates.length;
    const avgExp = filteredCandidates.reduce((acc, c) => acc + (c.years_of_experience || 0), 0) / (total || 1);
    const avgSal = filteredCandidates.reduce((acc, c) => acc + (c.expected_salary || 0), 0) / (total || 1) / 100000;
    
    return {
      total,
      avgExp: avgExp.toFixed(1),
      avgSal: avgSal.toFixed(1),
      tier1Percent: Math.round((filteredCandidates.filter(c => (c.location_tier || getCityTier(c.location)) === "Tier 1").length / (total || 1)) * 100)
    };
  }, [filteredCandidates]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="h-10 w-10 border-[3px] border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] animate-pulse">Initializing Talent Matrix...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto space-y-8 font-sans">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/5 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-indigo-500 rounded-full shadow-[0_0_10px_#6366f1]" />
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Hiring Intelligence</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
              Talent <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-500">Universe</span>
            </h1>
            <p className="text-slate-400 text-sm max-w-xl font-medium">
              A high-precision visual exploration of global talent density across experience bands, geographic tiers, and economic expectations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text"
                placeholder="QUERY CLOUD..."
                className="pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 outline-none w-64 transition-all placeholder:text-slate-600 uppercase tracking-widest"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>
            <button className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
              <Filter className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Live Talent Signal" value={stats.total} unit="Profiles" icon={<Users className="text-indigo-400" />} />
          <StatCard label="Avg Experience" value={stats.avgExp} unit="Years" icon={<Briefcase className="text-blue-400" />} />
          <StatCard label="Market Salary" value={`₹${stats.avgSal}L`} unit="Median PA" icon={<IndianRupee className="text-violet-400" />} />
          <StatCard label="Tier 1 Density" value={`${stats.tier1Percent}%`} unit="Geographic" icon={<MapPin className="text-emerald-400" />} />
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-[32px] p-8 relative shadow-2xl overflow-hidden group">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10 relative z-20">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                <Zap className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Experience Cluster</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Aggregate talent density by experience bands</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 bg-[#0a1122] p-1.5 rounded-2xl border border-white/10 shadow-xl">
              <FilterOption 
                label="Bands" 
                value={filters.experience} 
                options={["all", "fresher", "mid", "senior", "leadership"]}
                onChange={(v: string) => setFilters(f => ({ ...f, experience: v }))}
              />
              <FilterOption 
                label="Region" 
                value={filters.tier} 
                options={["all", "Tier 1", "Tier 2", "Tier 3"]}
                onChange={(v: string) => setFilters(f => ({ ...f, tier: v }))}
              />
              <FilterOption 
                label="Economy" 
                value={filters.salary} 
                options={["all", "low", "mid", "high"]}
                onChange={(v: string) => setFilters(f => ({ ...f, salary: v }))}
              />
            </div>
          </div>
          <div className="h-[550px] w-full relative z-10 transition-all duration-700 hover:scale-[1.01] origin-center">
            <TalentBubbleChart data={filteredCandidates} />
            <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
              <MousePointer2 className="h-3 w-3 text-indigo-400" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hover to see counts</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-slate-500 px-2 pb-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 bg-[#6366f1] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Fresher</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 bg-[#3b82f6] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Mid-Level</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 bg-[#8b5cf6] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Senior</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 bg-[#ec4899] rounded-full" />
              <span className="text-[10px] font-bold uppercase tracking-tighter">Leadership</span>
            </div>
          </div>
          <span className="text-[9px] font-black tracking-[0.2em] uppercase opacity-40 italic">Global Intelligence Core v3.1</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, icon }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[24px] group hover:border-indigo-500/30 transition-all duration-500">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2.5 rounded-xl bg-white/5 group-hover:bg-indigo-500/10 transition-colors">
          {React.cloneElement(icon, { size: 18 })}
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-indigo-400 transition-colors" />
      </div>
      <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-white italic tracking-tighter">{value}</span>
          <span className="text-[10px] font-bold text-slate-500 uppercase">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function FilterOption({ label, value, options, onChange }: any) {
  return (
    <div className="flex items-center">
      <span className="text-[8px] font-black text-slate-600 uppercase pl-3 tracking-widest">{label}:</span>
      <select 
        className="bg-transparent text-[10px] font-black uppercase tracking-widest px-3 py-2 outline-none text-slate-300 cursor-pointer min-w-[100px] hover:text-indigo-400 transition-colors"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt: string) => (
          <option key={opt} value={opt} className="bg-[#0a1122] text-slate-300">
            {opt === "all" ? "GLOBAL" : opt}
          </option>
        ))}
      </select>
    </div>
  );
}
