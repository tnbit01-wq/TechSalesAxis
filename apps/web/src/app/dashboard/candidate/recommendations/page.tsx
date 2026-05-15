"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  Briefcase,
  CheckCircle2,
  ExternalLink,
  Flame,
  Globe,
  MapPin,
  Search,
  Sparkles,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react";

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

  const normalizeList = <T,>(response: any, keys: string[]): T[] => {
    const candidates = [response, response?.data, ...keys.map((key) => response?.[key])];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
    return [];
  };

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

      setJobs(normalizeList<JobRecommendation>(response, ["recommended_jobs", "recommendations", "jobs"]));
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

      setCompanies(normalizeList<CompanyRecommendation>(response, ["recommended_companies", "recommendations", "companies", "matches"]));
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

  const updateIndustryInput = (value: string) => {
    setSelectedIndustries(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
  };

  return (
    <div className="h-[calc(100vh-5rem)] min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.12),_transparent_28%),linear-gradient(180deg,#fffaf5_0%,#f8fafc_42%,#f8fafc_100%)]">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
        <section className="overflow-hidden rounded-[32px] border border-orange-100/70 bg-[#111827] text-white shadow-[0_20px_60px_rgba(17,24,39,0.18)]">
          <div className="relative overflow-hidden px-6 py-6 lg:px-8 lg:py-7">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#FF8A00]/15 blur-3xl" />
            <div className="absolute -bottom-10 right-24 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/70">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF8A00]" />
                  Career recommendations
                </div>
                <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">My Opportunities</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
                  Explore jobs and companies matched to your profile, then save the ones worth tracking.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:min-w-[340px]">
                <MiniStat label="Jobs" value={jobs.length} />
                <MiniStat label="Companies" value={companies.length} />
              </div>
            </div>
          </div>
        </section>

        {jobsError && activeTab === "jobs" && <AlertBox title="Could not load jobs" text={jobsError} />}
        {companiesError && activeTab === "companies" && <AlertBox title="Could not load companies" text={companiesError} />}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <TabButton active={activeTab === "jobs"} onClick={() => setActiveTab("jobs")} label={`Jobs for you (${jobs.length})`} icon={Briefcase} />
            <TabButton active={activeTab === "companies"} onClick={() => setActiveTab("companies")} label={`Companies hiring you (${companies.length})`} icon={Building2} />
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Target className="h-4 w-4 text-[#FF8A00]" />
            Personalized based on your profile score and assessment signals
          </div>
        </div>

        {activeTab === "jobs" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <FilterPanel
                title="Filter opportunities"
                icon={SlidersHorizontal}
                action={
                  <button onClick={() => { setJobLocation(""); setMinSalary(""); setMaxSalary(""); setJobFilterType("role_match"); }} className="text-xs font-bold text-[#FF8A00] hover:text-[#E67A00]">
                    Reset
                  </button>
                }
              >
                <Field label="Recommendation type" icon={Target}>
                  <SelectInput value={jobFilterType} onChange={(e) => setJobFilterType(e.target.value as JobFilterType)} options={["role_match", "skills_focus", "opportunity_explorer"]} labels={["Role Match", "Skills Focus", "Opportunity Explorer"]} />
                </Field>
                <Field label="Location" icon={MapPin}>
                  <TextInput value={jobLocation} onChange={(e) => setJobLocation(e.target.value)} placeholder="City name..." />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Min salary" icon={Flame}><TextInput type="number" value={minSalary} onChange={(e) => setMinSalary(e.target.value)} placeholder="0" /></Field>
                  <Field label="Max salary" icon={Flame}><TextInput type="number" value={maxSalary} onChange={(e) => setMaxSalary(e.target.value)} placeholder="0" /></Field>
                </div>
                <button onClick={fetchJobRecommendations} disabled={jobsLoading} className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#E67A00] disabled:opacity-60">
                  {jobsLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" /> : <Search className="h-4 w-4" />}
                  Refresh matches
                </button>
              </FilterPanel>

              <FilterPanel title="Search snapshot" icon={Search}>
                <div className="grid grid-cols-2 gap-3">
                  <MiniChip label="Saved" value={jobs.filter((job) => job.is_saved).length} />
                  <MiniChip label="Applied" value={jobs.filter((job) => job.is_applied).length} />
                </div>
              </FilterPanel>
            </aside>

            <section className="space-y-4 min-w-0">
              {jobsLoading ? (
                <LoadingState label="Loading job matches..." />
              ) : jobs.length === 0 ? (
                <EmptyState
                  title="No matching opportunities yet"
                  text="Complete more of your profile or widen the filters to surface additional roles."
                  actionLabel="Edit profile"
                  onAction={() => router.push("/dashboard/candidate/profile")}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {jobs.map((job) => (
                    <OpportunityCard
                      key={job.job_id}
                      badge={`${Math.round(job.match_score)}% match`}
                      badgeTone={job.match_score >= 85 ? "emerald" : job.match_score >= 70 ? "blue" : "amber"}
                      title={job.title}
                      subtitle={`${job.company_name} • ${job.location}`}
                      description={job.match_reasoning}
                      meta={[
                        job.salary_range,
                        job.experience_band,
                        new Date(job.job_posted_date).toLocaleDateString(),
                      ]}
                      tags={job.skills_required.slice(0, 5)}
                      footer={
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => handleSaveJob(job.job_id)} disabled={job.is_saved} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-[#FF8A00] hover:text-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-60">
                            {job.is_saved ? <BookmarkCheck className="h-4 w-4 text-[#FF8A00]" /> : <Bookmark className="h-4 w-4" />}
                            {job.is_saved ? "Saved" : "Save"}
                          </button>
                          <button onClick={() => handleApplyJob(job.job_id)} disabled={job.is_applied} className="inline-flex items-center gap-2 rounded-xl bg-[#FF8A00] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#E67A00] disabled:cursor-not-allowed disabled:opacity-60">
                            {job.is_applied ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                            {job.is_applied ? "Applied" : "Apply now"}
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "companies" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
              <FilterPanel
                title="Filter companies"
                icon={SlidersHorizontal}
                action={
                  <button onClick={() => { setCompanyFilterType("culture_fit"); setCompanyLocation(""); setCompanySize(""); setSelectedIndustries([]); }} className="text-xs font-bold text-[#FF8A00] hover:text-[#E67A00]">
                    Reset
                  </button>
                }
              >
                <Field label="Recommendation type" icon={Target}>
                  <SelectInput value={companyFilterType} onChange={(e) => setCompanyFilterType(e.target.value as CompanyFilterType)} options={["culture_fit", "hiring_intent", "growth_hub"]} labels={["Culture Fit", "Hiring Intent", "Growth Hub"]} />
                </Field>
                <Field label="Location" icon={MapPin}><TextInput value={companyLocation} onChange={(e) => setCompanyLocation(e.target.value)} placeholder="City name..." /></Field>
                <Field label="Company size" icon={Users}><SelectInput value={companySize} onChange={(e) => setCompanySize(e.target.value)} options={["", "10-50", "50-200", "200+"]} labels={["All sizes", "10-50", "50-200", "200+"]} /></Field>
                <Field label="Industries" icon={Globe}><TextInput value={selectedIndustries.join(", ")} onChange={(e) => updateIndustryInput(e.target.value)} placeholder="Tech, FinTech, AI" /></Field>
                <button onClick={fetchCompanyRecommendations} disabled={companiesLoading} className="mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#E67A00] disabled:opacity-60">
                  {companiesLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" /> : <Search className="h-4 w-4" />}
                  Refresh matches
                </button>
              </FilterPanel>

              <FilterPanel title="Opportunity pulse" icon={Sparkles}>
                <div className="grid grid-cols-2 gap-3">
                  <MiniChip label="Open roles" value={companies.reduce((sum, company) => sum + (company.job_openings_count || 0), 0)} />
                  <MiniChip label="Avg score" value={companies.length ? Math.round(companies.reduce((sum, company) => sum + company.match_score, 0) / companies.length) : 0} />
                </div>
              </FilterPanel>
            </aside>

            <section className="space-y-4 min-w-0">
              {companiesLoading ? (
                <LoadingState label="Loading company matches..." />
              ) : companies.length === 0 ? (
                <EmptyState
                  title="No matching companies yet"
                  text="Tighten your filters or update your profile to surface more hiring companies."
                  actionLabel="Browse jobs"
                  onAction={() => router.push("/dashboard/candidate/jobs")}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {companies.map((company) => (
                    <OpportunityCard
                      key={company.company_id}
                      badge={`${Math.round(company.match_score)}% match`}
                      badgeTone={company.match_score >= 85 ? "emerald" : company.match_score >= 70 ? "blue" : "amber"}
                      title={company.company_name}
                      subtitle={`${company.industry} • ${company.stage}`}
                      description={company.match_reasoning}
                      meta={[company.size, company.location, `${company.job_openings_count} open roles`]}
                      tags={company.culture_keywords.split(",").slice(0, 4).map((item) => item.trim()).filter(Boolean)}
                      footer={
                        <div className="flex flex-wrap gap-2">
                          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-all hover:border-[#FF8A00] hover:text-[#FF8A00]">
                            View roles
                          </button>
                          <button className="inline-flex items-center gap-2 rounded-xl bg-[#FF8A00] px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-[#E67A00]">
                            Connect
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: React.ElementType }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${active ? "bg-[#FF8A00] text-white shadow-lg shadow-orange-200" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}>
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function MiniChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function FilterPanel({ title, icon: Icon, action, children }: { title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-orange-100/70 bg-white p-5 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[#FFE0BF] bg-[#FFF5E8] p-3 text-[#FF8A00]">
            <Icon className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 ${className}`} />;
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; labels: string[] }) {
  const { options, labels, className = "", ...rest } = props;
  return (
    <select {...rest} className={`w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 ${className}`}>
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="rounded-[28px] border border-orange-100/70 bg-white p-12 text-center shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
      <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-orange-100 border-t-[#FF8A00]" />
      <p className="text-sm font-semibold text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({ title, text, actionLabel, onAction }: { title: string; text: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="rounded-[28px] border border-orange-100/70 bg-white p-12 text-center shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF5E8] text-[#FF8A00]">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="text-xl font-black text-slate-900">{title}</h3>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">{text}</p>
      <button onClick={onAction} className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#FF8A00] px-5 py-3 text-sm font-bold text-white transition-all hover:bg-[#E67A00]">
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function AlertBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-rose-100 bg-rose-50 px-5 py-4 text-rose-800 shadow-sm">
      <p className="text-sm font-black uppercase tracking-[0.18em]">{title}</p>
      <p className="mt-2 text-sm font-medium">{text}</p>
    </div>
  );
}

function OpportunityCard({
  badge,
  badgeTone,
  title,
  subtitle,
  description,
  meta,
  tags,
  footer,
}: {
  badge: string;
  badgeTone: "emerald" | "blue" | "amber";
  title: string;
  subtitle: string;
  description: string;
  meta: string[];
  tags: string[];
  footer: React.ReactNode;
}) {
  const toneClass =
    badgeTone === "emerald"
      ? "bg-emerald-100 text-emerald-800"
      : badgeTone === "blue"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-800";

  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${toneClass}`}>{badge}</span>
          </div>
          <h3 className="truncate text-lg font-black text-slate-900">{title}</h3>
          <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {meta.map((item) => (
          <div key={item} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            {item}
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-600">{description}</p>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#FFF5E8] px-3 py-1 text-[11px] font-semibold text-[#FF8A00]">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-slate-100 pt-4">{footer}</div>
    </article>
  );
}
