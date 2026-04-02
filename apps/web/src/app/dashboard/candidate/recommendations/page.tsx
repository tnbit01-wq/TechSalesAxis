"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

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
  job_posted_date: string;
}

interface CompanyRecommendation {
  company_id: string;
  company_name: string;
  logo_url?: string;
  website?: string;
  industry: string;
  size: string;
  stage: string;
  location: string;
  culture_keywords: string;
  match_score: number;
  match_reasoning: string;
  job_openings_count: number;
  glassdoor_rating?: number;
}

type ActiveTab = "jobs" | "companies";
type JobFilterType = "role_match" | "skills_focus" | "opportunity_explorer";
type CompanyFilterType = "culture_fit" | "hiring_intent" | "growth_hub";

export default function RecommendationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("jobs");
  
  // Job recommendations state
  const [jobFilterType, setJobFilterType] = useState<JobFilterType>("role_match");
  const [jobLocation, setJobLocation] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [jobs, setJobs] = useState<JobRecommendation[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState("");

  // Company recommendations state
  const [companyFilterType, setCompanyFilterType] = useState<CompanyFilterType>("culture_fit");
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [companySize, setCompanySize] = useState("");
  const [companyLocation, setCompanyLocation] = useState("");
  const [companies, setCompanies] = useState<CompanyRecommendation[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");

  // Get user ID on mount
  useEffect(() => {
    const user = awsAuth.getUser();
    if (user?.id) {
      setUserId(user.id);
    } else {
      router.push("/login");
    }
  }, [router]);

  // Fetch job recommendations
  const fetchJobRecommendations = useCallback(async () => {
    if (!userId) return;
    
    setJobsLoading(true);
    setJobsError("");
    
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams({
        filter_type: jobFilterType,
        ...(jobLocation && { location: jobLocation }),
        ...(minSalary && { min_salary: minSalary }),
        ...(maxSalary && { max_salary: maxSalary }),
      });

      const response = await apiClient.get(
        `/candidate/recommended-jobs?${params}`,
        token
      );

      setJobs(response || []);
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : "Error fetching jobs");
      console.error(err);
    } finally {
      setJobsLoading(false);
    }
  }, [userId, jobFilterType, jobLocation, minSalary, maxSalary]);

  // Fetch company recommendations
  const fetchCompanyRecommendations = useCallback(async () => {
    if (!userId) return;
    
    setCompaniesLoading(true);
    setCompaniesError("");
    
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams({
        filter_type: companyFilterType,
        ...(companyLocation && { location: companyLocation }),
        ...(companySize && { company_size: companySize }),
        ...(selectedIndustries.length > 0 && { industry: selectedIndustries.join(",") }),
      });

      const response = await apiClient.get(
        `/candidate/recommended-companies?${params}`,
        token
      );

      setCompanies(response || []);
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "Error fetching companies");
      console.error(err);
    } finally {
      setCompaniesLoading(false);
    }
  }, [userId, companyFilterType, companyLocation, companySize, selectedIndustries]);

  // Load recommendations when tab or filters change
  useEffect(() => {
    if (activeTab === "jobs") {
      fetchJobRecommendations();
    } else {
      fetchCompanyRecommendations();
    }
  }, [activeTab, jobFilterType, jobLocation, minSalary, maxSalary, companyFilterType, companySize, companyLocation, selectedIndustries, fetchJobRecommendations, fetchCompanyRecommendations]);

  const handleSaveJob = async (jobId: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/candidate/jobs/${jobId}/save`, {}, token);
      setJobs(jobs.map(j => j.job_id === jobId ? { ...j, is_saved: true } : j));
    } catch (err) {
      console.error("Error saving job:", err);
    }
  };

  const handleApplyJob = async (jobId: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(`/candidate/jobs/${jobId}/apply`, {}, token);
      setJobs(jobs.map(j => j.job_id === jobId ? { ...j, is_applied: true } : j));
    } catch (err) {
      console.error("Error applying to job:", err);
    }
  };

  const getMatchColor = (score: number) => {
    if (score >= 85) return "bg-green-100 text-green-900";
    if (score >= 70) return "bg-blue-100 text-blue-900";
    if (score >= 50) return "bg-yellow-100 text-yellow-900";
    return "bg-gray-100 text-gray-900";
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Opportunities</h1>
          <p className="text-gray-600">Discover jobs and companies matched to your profile</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("jobs")}
            className={`px-6 py-3 font-medium border-b-2 transition ${
              activeTab === "jobs"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🎯 Jobs For You ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab("companies")}
            className={`px-6 py-3 font-medium border-b-2 transition ${
              activeTab === "companies"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            🏢 Companies Hiring You ({companies.length})
          </button>
        </div>

        {/* JOBS TAB */}
        {activeTab === "jobs" && (
          <div>
            {/* Job Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Opportunities</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Filter Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendation Type
                  </label>
                  <select
                    value={jobFilterType}
                    onChange={(e) => setJobFilterType(e.target.value as JobFilterType)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  >
                    <option value="role_match">Role Match</option>
                    <option value="skills_focus">Skills Focus</option>
                    <option value="opportunity_explorer">Opportunity Explorer</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="City name..."
                    value={jobLocation}
                    onChange={(e) => setJobLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Min Salary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Salary
                  </label>
                  <input
                    type="number"
                    placeholder="Amount..."
                    value={minSalary}
                    onChange={(e) => setMinSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Max Salary */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Salary
                  </label>
                  <input
                    type="number"
                    placeholder="Amount..."
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Loading State */}
            {jobsLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin">⏳</div>
                <p className="text-gray-600 mt-2">Loading opportunities...</p>
              </div>
            )}

            {/* Error State */}
            {jobsError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                {jobsError}
              </div>
            )}

            {/* Jobs List */}
            {!jobsLoading && jobs.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-4">Results: {jobs.length} opportunities</p>
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <div
                      key={job.job_id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-6 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchColor(job.match_score)}`}>
                              {job.match_score}%
                            </span>
                            <h3 className="text-lg font-semibold text-gray-900">{job.title}</h3>
                          </div>
                          <p className="text-gray-600">{job.company_name}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm text-gray-600">
                        <div>💰 {job.salary_range}</div>
                        <div>📍 {job.location}</div>
                        <div>📊 {job.experience_band}</div>
                        <div>⏰ {new Date(job.job_posted_date).toLocaleDateString()}</div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Why:</p>
                        <p className="text-sm text-gray-600">{job.match_reasoning}</p>
                      </div>

                      {job.skills_required.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {job.skills_required.slice(0, 5).map((skill, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveJob(job.job_id)}
                          disabled={job.is_saved}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            job.is_saved
                              ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                          }`}
                        >
                          {job.is_saved ? "💾 Saved" : "💾 Save"}
                        </button>
                        <button
                          onClick={() => handleApplyJob(job.job_id)}
                          disabled={job.is_applied}
                          className={`px-4 py-2 rounded-lg font-medium transition ${
                            job.is_applied
                              ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {job.is_applied ? "✓ Applied" : "Apply Now"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!jobsLoading && jobs.length === 0 && !jobsError && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-600">No matching opportunities found.</p>
              </div>
            )}
          </div>
        )}

        {/* COMPANIES TAB */}
        {activeTab === "companies" && (
          <div>
            {/* Company Filters */}
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter Companies</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Filter Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendation Type
                  </label>
                  <select
                    value={companyFilterType}
                    onChange={(e) => setCompanyFilterType(e.target.value as CompanyFilterType)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  >
                    <option value="culture_fit">Culture Fit</option>
                    <option value="hiring_intent">Hiring Intent</option>
                    <option value="growth_hub">Growth Hub</option>
                  </select>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    placeholder="City name..."
                    value={companyLocation}
                    onChange={(e) => setCompanyLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Company Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Size
                  </label>
                  <select
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-slate-900 border-2 border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer"
                  >
                    <option value="">All Sizes</option>
                    <option value="10-50">10-50</option>
                    <option value="50-200">50-200</option>
                    <option value="200+">200+</option>
                  </select>
                </div>

                {/* Industries (placeholder) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industry
                  </label>
                  <input
                    type="text"
                    placeholder="Tech, FinTech..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Loading State */}
            {companiesLoading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin">⏳</div>
                <p className="text-gray-600 mt-2">Loading companies...</p>
              </div>
            )}

            {/* Error State */}
            {companiesError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
                {companiesError}
              </div>
            )}

            {/* Companies List */}
            {!companiesLoading && companies.length > 0 && (
              <div>
                <p className="text-sm text-gray-600 mb-4">Results: {companies.length} companies hiring</p>
                <div className="space-y-4">
                  {companies.map((company) => (
                    <div
                      key={company.company_id}
                      className="bg-white rounded-lg shadow-sm hover:shadow-md transition p-6 border border-gray-200"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getMatchColor(company.match_score)}`}>
                              {company.match_score}%
                            </span>
                            <h3 className="text-lg font-semibold text-gray-900">{company.company_name}</h3>
                          </div>
                          <p className="text-gray-600 text-sm">{company.stage}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-sm text-gray-600">
                        <div>🏢 {company.industry}</div>
                        <div>👥 {company.size}</div>
                        <div>📍 {company.location}</div>
                        <div>💼 {company.job_openings_count} open roles</div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Culture:</p>
                        <p className="text-sm text-gray-600">{company.culture_keywords}</p>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Why:</p>
                        <p className="text-sm text-gray-600">{company.match_reasoning}</p>
                      </div>

                      {company.glassdoor_rating && (
                        <p className="text-sm text-gray-600 mb-3">⭐ Glassdoor: {company.glassdoor_rating}/5</p>
                      )}

                      <div className="flex gap-2">
                        <button className="px-4 py-2 rounded-lg font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition">
                          View Roles
                        </button>
                        <button className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition">
                          Connect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!companiesLoading && companies.length === 0 && !companiesError && (
              <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                <p className="text-gray-600">No matching companies found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
