"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { Briefcase, TrendingUp, ExternalLink, Sparkles } from "lucide-react";

interface JobRecommendation {
  job_id: string;
  title: string;
  company_name: string;
  company_logo_url?: string;
  job_description: string;
  salary_range: string;
  location: string;
  experience_band: string;
  skills_required: string[];
  match_score: number;
  match_reasoning: string;
  is_saved: boolean;
  is_applied: boolean;
  job_posted_date?: string;
}

export function RecommendedJobsCard() {
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      console.log("[WIDGET] Fetching job recommendations...");
      const response = await apiClient.get(
        "/candidate/recommended-jobs?limit=3",
        token
      );

      console.log("[WIDGET] Recommendations loaded:", response);
      setRecommendations(response.data || response.recommended_jobs || response.recommendations || []);
      setError(null);
    } catch (err) {
      console.error("[WIDGET] Error loading recommendations:", err);
      setError("Unable to load recommendations");
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecommendations();
    const interval = setInterval(loadRecommendations, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, [loadRecommendations]);

  const getMatchColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-50";
    if (score >= 70) return "text-amber-600 bg-amber-50";
    return "text-slate-600 bg-slate-100";
  };

  const getMatchBadgeColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-700";
    if (score >= 70) return "bg-amber-100 text-amber-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-8 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-light rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-light rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Recommended Jobs
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              AI-matched opportunities for your skills
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/candidate/recommendations"
          className="text-xs font-bold text-primary hover:text-primary-dark hover:underline transition-colors flex items-center gap-1"
        >
          View All <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3 relative z-10">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-lg">
            <Briefcase className="h-6 w-6 text-slate-300 mx-auto mb-2 opacity-50" />
            {error}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm bg-slate-50 rounded-lg">
            <Briefcase className="h-6 w-6 text-slate-300 mx-auto mb-2 opacity-50" />
            No recommendations yet. Complete your profile to get personalized jobs.
          </div>
        ) : (
          <>
            {recommendations.map((rec) => (
              <Link
                key={rec.job_id}
                href={`/dashboard/candidate/jobs/${rec.job_id}`}
                className="block p-4 border border-slate-100 rounded-lg hover:border-primary-light hover:bg-primary-light/30 hover:shadow-md transition-all duration-200 group/item"
              >
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-2">
                      <div className="p-2 bg-slate-100 rounded-lg shrink-0 group-hover/item:bg-primary-light transition-colors mt-0.5">
                        <Briefcase className="h-4 w-4 text-slate-600 group-hover/item:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-900 text-sm group-hover/item:text-primary transition-colors truncate">
                          {rec.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {rec.company_name} • {rec.location}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-600 mb-2 flex-wrap">
                      {rec.experience_band && (
                        <>
                          <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium">
                            {rec.experience_band}
                          </span>
                        </>
                      )}
                      {rec.salary_range && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-bold">
                          {rec.salary_range}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {rec.match_reasoning}
                    </p>
                    
                    {rec.skills_required && rec.skills_required.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <span className="text-[10px] font-medium text-slate-600">
                          Skills:
                        </span>
                        {rec.skills_required.slice(0, 2).map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                          >
                            {skill}
                          </span>
                        ))}
                        {rec.skills_required.length > 2 && (
                          <span className="text-[10px] text-slate-500">+{rec.skills_required.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div
                      className={`px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap ${getMatchBadgeColor(
                        rec.match_score
                      )}`}
                    >
                      {Math.round(rec.match_score)}%
                    </div>
                    {rec.is_saved && (
                      <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </>
        )}
      </div>

      {!loading && !error && recommendations.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-100 relative z-10">
          <Link
            href="/dashboard/candidate/recommendations"
            className="w-full py-2.5 bg-slate-100 text-slate-900 hover:bg-primary hover:text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
          >
            <TrendingUp className="h-4 w-4" />
            View 10+ More Jobs
          </Link>
        </div>
      )}
    </div>
  );
}
