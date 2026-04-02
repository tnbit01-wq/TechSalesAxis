"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { Building2, TrendingUp, ExternalLink, Sparkles } from "lucide-react";

interface CompanyMatch {
  company_id: string;
  company_name: string;
  logo_url?: string;
  website?: string;
  industry: string;
  size: string;
  location: string;
  description: string;
  culture_keywords: string;
  match_score: number;
  match_reasoning: string;
  job_openings_count: number;
  rating?: number;
}

export function RecommendedCompaniesCard() {
  const [recommendations, setRecommendations] = useState<CompanyMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      console.log("[COMPANY_WIDGET] Fetching company recommendations...");
      const response = await apiClient.get(
        "/candidate/recommended-companies?limit=3",
        token
      );

      console.log("[COMPANY_WIDGET] Recommendations loaded:", response);
      setRecommendations(response.data || response.recommended_companies || response.matches || response.recommendations || []);
      setError(null);
    } catch (err) {
      console.error("[COMPANY_WIDGET] Error loading recommendations:", err);
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
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-100 rounded-lg">
            <Sparkles className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Recommended Companies
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Culture-fit career opportunities
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/candidate/recommendations"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors flex items-center gap-1"
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
          <div className="text-center py-8 text-slate-600 text-sm bg-slate-50 rounded-lg">
            <Building2 className="h-6 w-6 text-slate-300 mx-auto mb-2 opacity-50" />
            {error}
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-slate-600 text-sm bg-slate-50 rounded-lg">
            <Building2 className="h-6 w-6 text-slate-300 mx-auto mb-2 opacity-50" />
            No company matches found. Complete your profile to get recommendations.
          </div>
        ) : (
          recommendations.map((match) => (
            <Link
              key={match.company_id}
              href="/dashboard/candidate/recommendations"
              className="block p-4 rounded-lg border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all group/item"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0 group-hover/item:bg-blue-200 transition-colors">
                      <Building2 className="h-4 w-4 text-blue-600" />
                    </div>
                    <h4 className="font-bold text-slate-900 group-hover/item:text-blue-600 transition-colors truncate">
                      {match.company_name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                    <span className="text-[11px] font-medium">{match.industry}</span>
                    {match.size && (
                      <>
                        <span>•</span>
                        <span className="capitalize text-[11px]">{match.size}</span>
                      </>
                    )}
                    {match.job_openings_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-[11px]">{match.job_openings_count} opening{match.job_openings_count !== 1 ? "s" : ""}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className={`px-3 py-1 rounded-lg text-xs font-bold text-center flex-shrink-0 ${getMatchBadgeColor(match.match_score)}`}>
                  {Math.round(match.match_score)}%
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                {match.match_reasoning}
              </p>

              {match.culture_keywords && match.culture_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {match.culture_keywords.split(",").slice(0, 3).map((keyword, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[11px] text-blue-700 font-medium"
                    >
                      {keyword.trim()}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      {!loading && !error && recommendations.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-100 relative z-10">
          <Link
            href="/dashboard/candidate/company-matches"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition-all text-sm"
          >
            Explore 10+ More <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
