"use client";

import { useEffect, useState, useCallback } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { 
  Building2, 
  MapPin, 
  ChevronRight, 
  Sparkles,
  Search,
  Briefcase,
  AlertCircle,
  Zap
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
  const [viewMode, setViewMode] = useState<"jobs" | "companies">("jobs");
  const [priority, setPriority] = useState<"skills" | "culture">("skills");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterMinSalary, setFilterMinSalary] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
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
      setError("Failed to load recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [viewMode, priority, filterLocation, filterMinSalary]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  // Filter recommendations based on search term
  const filteredRecommendations = recommendations?.filter((rec) => {
    const matchesSearch =
      (rec.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (rec.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
      (rec.location?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    return matchesSearch;
  }) || [];

  if (loading && !recommendations) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Recommendations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Recommendations</h1>
          <p className="text-slate-500 text-sm mt-1">Discover roles and companies matched to your profile.</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, company, location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            {/* View Mode Selector */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">View</label>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as "jobs" | "companies")}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer font-medium text-slate-900"
              >
                <option value="jobs">Jobs</option>
                <option value="companies">Companies</option>
              </select>
            </div>

            {/* Priority Selector (only for jobs) */}
            {viewMode === "jobs" && (
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "skills" | "culture")}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm cursor-pointer font-medium text-slate-900"
                >
                  <option value="skills">Skills Match</option>
                  <option value="culture">Culture Fit</option>
                </select>
              </div>
            )}

            {/* Location Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Location</label>
              <input
                type="text"
                placeholder="E.g., London, Remote..."
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>

            {/* Salary Filter */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Min Salary</label>
              <input
                type="number"
                placeholder="E.g., 50000..."
                value={filterMinSalary}
                onChange={(e) => setFilterMinSalary(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
              />
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{error}</p>
        </div>
      ) : filteredRecommendations.length === 0 && recommendations && recommendations.length > 0 ? (
        <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
          <Search className="h-10 w-10 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No matching recommendations found</h3>
          <p className="text-slate-500 text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : recommendations && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecommendations.map((rec) => (
            <div
              key={rec.id || rec.job_id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col h-full group"
            >
              {/* Header with Icon and Match Score */}
              <div className="flex justify-between items-start mb-3">
                <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                  {viewMode === "jobs" ? (
                    <Briefcase className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                  ) : (
                    <Building2 className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" />
                  )}
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-indigo-50 rounded-lg">
                  <Zap className="h-3 w-3 text-indigo-600 fill-current" />
                  <span className="text-[11px] font-bold text-indigo-600">{rec.match_score}%</span>
                </div>
              </div>

              {/* Title and Company */}
              <div className="flex-1">
                <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 mb-1">
                  {rec.job_title || rec.company_name}
                </h2>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-indigo-600 uppercase tracking-wider">{rec.company_name}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-slate-300" />
                  <span className="text-slate-500">{rec.location || "Remote"}</span>
                </div>

                {/* Match Reasoning */}
                <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                  <p className="text-[10px] text-slate-600 italic line-clamp-2">"{rec.reasoning}"</p>
                </div>
              </div>

              {/* CTA Button */}
              <div className="mt-3 pt-3 border-t border-slate-100">
                {viewMode === "jobs" ? (
                  <Link
                    href={`/dashboard/candidate/jobs/${rec.job_id}`}
                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    View Job
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link
                    href={`/dashboard/candidate/jobs?company=${encodeURIComponent(rec.company_name || '')}`}
                    className="w-full px-3 py-2 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
                  >
                    View Open Jobs
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
          <Sparkles className="h-10 w-10 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">No recommendations yet</h3>
          <p className="text-slate-500 text-sm">Check back later for personalized matches.</p>
        </div>
      )}
    </div>
  );
}
