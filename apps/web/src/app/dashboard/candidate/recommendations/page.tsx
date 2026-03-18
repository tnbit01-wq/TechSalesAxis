"use client";

import { useEffect, useState, useCallback } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  Building2, 
  MapPin, 
  ChevronRight, 
  Sparkles,
  ShieldCheck,
  TrendingUp,
  BrainCircuit,
  Zap,
  Target,
  Search,
  Briefcase,
  Layers,
  Heart
} from "lucide-react";
import Link from "next/link";

interface Recommendation {
  id?: string;
  job_id?: string;
  company_name: string;
  job_title?: string;
  company_description?: string;
  location: string;
  match_score: number;
  reasoning: string;
  primary_signal?: string;
}

export default function CandidateRecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"companies" | "jobs">("jobs");
  const [priority, setPriority] = useState<"skills" | "culture">("skills");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterMinSalary, setFilterMinSalary] = useState<string>("");
  const [debouncedLocation, setDebouncedLocation] = useState("");
  const [debouncedMinSalary, setDebouncedMinSalary] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState<string>("$");
  const [isSyncing, setIsSyncing] = useState(false);

  // Debouncing logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocation(filterLocation);
      setDebouncedMinSalary(filterMinSalary);
    }, 600);
    return () => clearTimeout(timer);
  }, [filterLocation, filterMinSalary]);

  const handleApplyFilters = () => {
    fetchRecommendations();
  };

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setIsSyncing(true);
    setError(null);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      let url = viewMode === "companies" 
        ? `/candidate/recommendations?filter_type=culture_fit`
        : `/candidate/job-recommendations?priority=${priority}`;

      if (filterLocation) url += `&location=${encodeURIComponent(filterLocation)}`;
      if (filterMinSalary) url += `&min_salary=${filterMinSalary}`;

      const data = await apiClient.get(url, token);
      setRecommendations(data || []);
    } catch (err: any) {
      console.error("Match Protocol Error:", err);
      setError("Sync failed. Check your matching profile.");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [viewMode, priority, filterLocation, filterMinSalary]);

  useEffect(() => {
    fetchRecommendations();
  }, [viewMode, priority]);

  useEffect(() => {
    // Detect Currency based on Location
    const loc = filterLocation.toLowerCase();
    if (loc.includes("india") || loc.includes("mumbai") || loc.includes("bangalore") || loc.includes("delhi") || loc.includes("pune") || loc.includes("hyd")) {
      setCurrencySymbol("₹");
    } else if (loc.includes("uk") || loc.includes("london") || loc.includes("manchester")) {
      setCurrencySymbol("£");
    } else if (loc.includes("europe") || loc.includes("germany") || loc.includes("france") || loc.includes("dublin") || loc.includes("paris") || loc.includes("berlin")) {
      setCurrencySymbol("€");
    } else {
      setCurrencySymbol("$");
    }
  }, [filterLocation]);

  useEffect(() => {
    // Periodic fetch as replacement for real-time matches/updates
    const interval = setInterval(fetchRecommendations, 60000); // 1 minute

    return () => {
      clearInterval(interval);
    };
  }, [fetchRecommendations]); // Only on mount or when fetchRecommendations changes

  if (loading && !recommendations) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-slate-50/30">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-6" />
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] animate-pulse">Running Match Sync...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 p-6">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic mb-1">
              Best<span className="text-indigo-600 font-black">Match</span>
            </h1>
            <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-indigo-500" />
              Find roles and companies matching your preferences.
            </p>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-md border border-slate-200/60 p-5 rounded-[2.5rem] shadow-xl shadow-slate-100/50 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-4">
              {/* View Selection */}
              <div className="bg-slate-100/80 p-1 rounded-2xl flex items-center gap-1 shrink-0 border border-slate-200/30">
                <button 
                  onClick={() => setViewMode("jobs")}
                  className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    viewMode === "jobs" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Briefcase size={12} />
                  Jobs
                </button>
                <button 
                  onClick={() => setViewMode("companies")}
                  className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                    viewMode === "companies" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Building2 size={12} />
                  Companies
                </button>
              </div>

              {viewMode === "jobs" && (
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200/50">
                  <button 
                    onClick={() => setPriority("skills")}
                    className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                      priority === "skills" ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Layers size={10} />
                    Skills Priority
                  </button>
                  <button 
                    onClick={() => setPriority("culture")}
                    className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase tracking-tight transition-all flex items-center gap-1.5 ${
                      priority === "culture" ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Heart size={10} />
                    Culture Priority
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                <ShieldCheck size={10} className="text-emerald-500" />
                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">Verified</span>
              </div>
              <button
                onClick={handleApplyFilters}
                disabled={isSyncing}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                {isSyncing ? (
                  <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                {isSyncing ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-2">
            <div className="relative group">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-400" />
              <input 
                type="text"
                placeholder="TARGET REGION (E.G. LONDON, REMOTE)..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all border-dashed"
              />
            </div>

            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-400">{currencySymbol}</span>
              <input 
                type="number"
                placeholder="MINIMUM ANNUAL SALARY..."
                value={filterMinSalary}
                onChange={(e) => setFilterMinSalary(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50/50 border border-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all border-dashed"
              />
            </div>

            <div className="relative group flex items-center bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-3 border-dashed">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 flex-1">Match Quality</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className={`h-1.5 w-3 rounded-full ${i <= 4 ? "bg-indigo-500" : "bg-slate-200"}`} />)}
                </div>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="p-12 text-center bg-white rounded-[2.5rem] border border-slate-100 shadow-sm">
           <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">{error}</p>
        </div>
      ) : recommendations && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {recommendations.map((rec) => (
            <div key={rec.id || rec.job_id} className="group relative bg-white/70 backdrop-blur-sm rounded-[2.5rem] p-8 border border-slate-200/50 shadow-xl shadow-slate-200/40 hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-2 flex flex-col justify-between">
               {/* Match Gradient Background */}
               <div className="absolute inset-0 bg-linear-to-br from-indigo-50/10 via-white to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2.5rem]" />

               <div className="relative">
                  <div className="flex justify-between items-start mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-slate-900 shadow-xl shadow-slate-200 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform">
                      {viewMode === "jobs" ? <Briefcase size={28} /> : <Building2 size={28} />}
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 rounded-full shadow-lg shadow-indigo-100">
                        <Zap size={10} className="text-white fill-white" />
                        <span className="text-[10px] font-black text-white">{rec.match_score}%</span>
                      </div>
                      <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest mt-2 px-1">
                        {rec.primary_signal || "Match Score"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">
                        {rec.job_title || rec.company_name}
                      </h3>
                      {rec.job_title && (
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          @{rec.company_name}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-slate-400 mt-1">
                        <MapPin size={12} className="text-indigo-400" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">{rec.location || "Remote"}</span>
                      </div>
                    </div>

                    {/* AI REASONING */}
                    <div className="p-5 rounded-[1.5rem] bg-indigo-50/30 border border-indigo-100/20 group-hover:bg-indigo-50/50 transition-colors relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <BrainCircuit size={40} className="text-indigo-600" />
                      </div>
                      <p className="text-[11px] font-bold italic text-slate-600 uppercase tracking-tight leading-relaxed relative z-10">
                        "{rec.reasoning}"
                      </p>
                    </div>

                    {rec.company_description && (
                      <p className="text-[11px] font-medium text-slate-400 leading-relaxed line-clamp-3">
                        {rec.company_description}
                      </p>
                    )}
                  </div>
               </div>

               <div className="mt-8 pt-6 border-t border-slate-100/50 flex flex-col gap-3 relative z-10">
                  {viewMode === "jobs" ? (
                    <Link 
                      href={`/dashboard/candidate/jobs/${rec.job_id}`}
                      className="w-full h-14 rounded-2xl bg-slate-900 flex items-center justify-between px-8 hover:bg-indigo-600 group/btn transition-all shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Apply Now</span>
                      <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <Link 
                      href={"/dashboard/candidate/jobs?company=" + encodeURIComponent(rec.company_name)}
                      className="w-full h-14 rounded-2xl bg-slate-900 flex items-center justify-between px-8 hover:bg-indigo-600 group/btn transition-all shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
                    >
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">View Open Jobs</span>
                      <ChevronRight size={16} className="text-white/50 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  )}
                  
                  <button className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-indigo-500 transition-colors py-2">
                    {viewMode === "jobs" ? "Save Match" : "Request Referral"}
                  </button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] p-20 border border-dashed border-slate-200 flex flex-col items-center text-center space-y-6">
          <div className="h-20 w-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-300">
            <ShieldCheck size={40} />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 uppercase italic">
              No Matches Found
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-sm mx-auto mt-3">
              Try adjusting your priority or region filters.
            </p>
          </div>
        </div>
      )}

      {/* Matching Criteria Explainer */}
      <footer className="mt-20 pt-10 border-t border-slate-100">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-10 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            <div className="space-y-3">
               <TrendingUp className="text-indigo-600" size={20} />
               <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Career Growth</h4>
               <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Matches roles with your growth goals and preferred work styles.</p>
            </div>
            <div className="space-y-3">
               <BrainCircuit className="text-indigo-600" size={20} />
               <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Personality Match</h4>
               <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Finds teams where your personality and values fit naturally.</p>
            </div>
            <div className="space-y-3">
               <Target className="text-indigo-600" size={20} />
               <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-900">Simple Search</h4>
               <p className="text-[9px] font-bold text-slate-400 uppercase leading-relaxed">Choose what matters most to you—skills or culture—to see the best roles.</p>
            </div>
         </div>
      </footer>
    </div>
  );
}
