"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Grid3X3,
  Lock,
  MapPin,
  Briefcase,
  Send,
  Search,
  SlidersHorizontal,
  X,
  Share2,
} from "lucide-react";
import CompanyCultureGallery from "@/components/CompanyCultureGallery";
import ShareJobModal from "@/components/ShareJobModal";

interface Job {
  id: string;
  title: string;
  description: string;
  experience_band: string;
  location: string;
  salary_range: string;
  job_type: string;
  company_name: string;
  company_website?: string;
  life_at_photo_urls?: string[];
  brand_colors?: {
    primary?: string;
    secondary?: string;
  };
  created_at: string;
  has_applied: boolean;
  is_saved: boolean;
}

export default function CandidateJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [assessmentStatus, setAssessmentStatus] = useState<string>("not_started");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [sharingJob, setSharingJob] = useState<Job | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "saved" | "applied">("all");
  const [filterJobType, setFilterJobType] = useState<string>("all");
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.push("/login");
          return;
        }

        const [jobsData, statsData] = await Promise.all([
          apiClient.get("/candidate/jobs", token),
          apiClient.get("/candidate/stats", token),
        ]);

        setJobs(jobsData);
        setAssessmentStatus(statsData.assessment_status);
      } catch (err) {
        console.error("Failed to load jobs:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [router]);

  // Track job view when a job is selected
  useEffect(() => {
    if (selectedJob) {
      const trackJobView = async () => {
        try {
          const token = awsAuth.getToken();
          if (!token) return;

          await apiClient.post(
            `/analytics/jobs/${selectedJob.id}/view`,
            {},
            token
          );
          console.log("✓ Job view tracked:", selectedJob.id);
        } catch (err) {
          console.error("Failed to track job view:", err);
        }
      };

      trackJobView();
    }
  }, [selectedJob?.id]);

  const handleApply = async (jobId: string) => {
    setApplying(jobId);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const response = await apiClient.post(`/candidate/jobs/${jobId}/apply`, {}, token);
      
      // Check for limit_reached status
      if (response?.status === "limit_reached") {
        toast.error("Daily Limit Reached", {
          description: response.message || "You have reached your daily application limit of 5 jobs. Try again tomorrow."
        });
        return;
      }
      
      // Check for already_applied status
      if (response?.status === "already_applied") {
        toast.info("Already Applied", {
          description: "You have already applied for this job."
        });
        return;
      }
      
      // Success case
      setJobs(jobs.map((j) => (j.id === jobId ? { ...j, has_applied: true } : j)));
      if (selectedJob?.id === jobId) {
        setSelectedJob({ ...selectedJob, has_applied: true });
      }
      toast.success("Application Sent", { description: "You have successfully applied for this job." });
    } catch (err) {
      toast.error("Application Failed", { description: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setApplying(null);
    }
  };

  const handleToggleSave = async (job: Job) => {
    setSaving(job.id);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      if (job.is_saved) {
        await apiClient.delete(`/candidate/jobs/${job.id}/unsave`, token);
        setJobs(jobs.map((j) => (j.id === job.id ? { ...j, is_saved: false } : j)));
        toast.info("Job Unsaved");
      } else {
        await apiClient.post(`/candidate/jobs/${job.id}/save`, {}, token);
        setJobs(jobs.map((j) => (j.id === job.id ? { ...j, is_saved: true } : j)));
        toast.success("Job Saved");
      }
    } catch (err) {
      toast.error("Action Failed");
    } finally {
      setSaving(null);
    }
  };

  const savedCount = jobs.filter((job) => job.is_saved).length;
  const appliedCount = jobs.filter((job) => job.has_applied).length;

  const tabJobs = useMemo(() => {
    if (activeTab === "saved") return jobs.filter((job) => job.is_saved);
    if (activeTab === "applied") return jobs.filter((job) => job.has_applied);
    return jobs;
  }, [jobs, activeTab]);

  const jobTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const job of jobs) {
      if (job.job_type) values.add(job.job_type.toLowerCase());
    }
    return Array.from(values);
  }, [jobs]);

  // Filter jobs based on search term and selected filters
  const filteredJobs = tabJobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesJobType =
      filterJobType === "all" || job.job_type.toLowerCase() === filterJobType;
    const matchesExperience = filterExperience === "all" || job.experience_band === filterExperience;
    const matchesLocation =
      !filterLocation || job.location.toLowerCase().includes(filterLocation.toLowerCase());
    
    return matchesSearch && matchesJobType && matchesExperience && matchesLocation;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_40%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)]">
        <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00] mb-4"></div>
        <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">Loading jobs...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <style>{`
        .jobs-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .jobs-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .jobs-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .jobs-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .jobs-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1700px] flex-col gap-4 px-4 py-4">
        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white/90 shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex-shrink-0 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Filters</p>
              <p className="mt-1 text-sm text-slate-500">Refine roles quickly</p>
            </div>

            <div className="jobs-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Title, company, keywords"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Work mode</label>
                  <select
                    value={filterJobType}
                    onChange={(e) => setFilterJobType(e.target.value)}
                    className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                  >
                    <option value="all">All</option>
                    {jobTypeOptions.length === 0 ? (
                      <>
                        <option value="remote">Remote</option>
                        <option value="hybrid">Hybrid</option>
                        <option value="onsite">On-site</option>
                      </>
                    ) : (
                      jobTypeOptions.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Experience</label>
                  <select
                    value={filterExperience}
                    onChange={(e) => setFilterExperience(e.target.value)}
                    className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                  >
                    <option value="all">All</option>
                    <option value="fresher">0-1 years</option>
                    <option value="mid">1-5 years</option>
                    <option value="senior">5-10 years</option>
                    <option value="leadership">10+ years</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-slate-600">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="City or region"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-[#FFF8F1] p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C96B00]">Quick stats</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white px-2 py-2">
                    <p className="font-black text-slate-900">{jobs.length}</p>
                    <p className="text-[10px] text-slate-500">All</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-2">
                    <p className="font-black text-slate-900">{savedCount}</p>
                    <p className="text-[10px] text-slate-500">Saved</p>
                  </div>
                  <div className="rounded-xl bg-white px-2 py-2">
                    <p className="font-black text-slate-900">{appliedCount}</p>
                    <p className="text-[10px] text-slate-500">Applied</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white/85 shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex-shrink-0 border-b border-orange-100/70 px-5 py-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1">
                    <button
                      onClick={() => setActiveTab("all")}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        activeTab === "all" ? "bg-[#FF8A00] text-white" : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                      }`}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" /> All Jobs ({jobs.length})
                    </button>
                    <button
                      onClick={() => setActiveTab("saved")}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        activeTab === "saved" ? "bg-[#FF8A00] text-white" : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                      }`}
                    >
                      <Bookmark className="h-3.5 w-3.5" /> Saved ({savedCount})
                    </button>
                    <button
                      onClick={() => setActiveTab("applied")}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                        activeTab === "applied" ? "bg-[#FF8A00] text-white" : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                      }`}
                    >
                      <Send className="h-3.5 w-3.5" /> Applied ({appliedCount})
                    </button>
                  </div>

                  <p className="text-sm font-semibold text-slate-600">{filteredJobs.length} role{filteredJobs.length !== 1 ? "s" : ""} available</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/candidate/applications"
                    className="inline-flex items-center gap-1 rounded-full border border-orange-100 bg-[#FFF6ED] px-3 py-2 text-xs font-bold text-[#FF8A00] transition-all hover:bg-[#FFEFD8]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Applications
                  </Link>
                </div>
              </div>
            </div>

            <div className="jobs-scroll flex-1 min-h-0 overflow-y-auto p-5">
              {filteredJobs.length === 0 && jobs.length > 0 ? (
                <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                  <SlidersHorizontal className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900">No roles match these filters</h3>
                  <p className="text-slate-500 text-sm">Try changing filters or searching different terms.</p>
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
                  <Briefcase className="h-10 w-10 text-slate-200 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900">No jobs yet</h3>
                  <p className="text-slate-500 text-sm">Check again later for fresh opportunities.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {filteredJobs.map((job) => (
                    <article
                      key={job.id}
                      className="group cursor-pointer overflow-hidden rounded-[26px] border border-orange-100/80 bg-white shadow-[0_10px_24px_rgba(255,138,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(255,138,0,0.14)]"
                      onClick={() => setSelectedJob(job)}
                    >
                      <div className="h-1.5 bg-gradient-to-r from-[#FF8A00] via-[#FFB366] to-[#FFE3BF]" />

                      <div className="flex items-start justify-between gap-3 px-5 pt-5">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#C96B00] line-clamp-1">{job.company_name}</p>
                          <h2 className="mt-1.5 line-clamp-2 text-[15px] font-black leading-snug text-slate-900 group-hover:text-[#FF8A00]">
                            {job.title}
                          </h2>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSave(job);
                          }}
                          disabled={saving === job.id}
                          className={`rounded-xl border p-2.5 transition-all ${
                            job.is_saved
                              ? "border-orange-100 bg-[#FFF6ED] text-[#FF8A00]"
                              : "border-slate-200 bg-white text-slate-400 hover:border-orange-100 hover:text-[#FF8A00]"
                          }`}
                        >
                          {job.is_saved ? (
                            <BookmarkCheck className="h-4.5 w-4.5" />
                          ) : (
                            <Bookmark className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </div>

                      <div className="px-5 py-4">
                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Location</p>
                            <p className="mt-1 text-[12px] line-clamp-1 font-semibold text-slate-800">{job.location || "Remote"}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Work Mode</p>
                            <p className="mt-1 text-[12px] line-clamp-1 font-semibold text-slate-800 capitalize">{job.job_type}</p>
                          </div>
                          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Experience</p>
                            <p className="mt-1 text-[12px] line-clamp-1 font-semibold text-slate-800">{job.experience_band}</p>
                          </div>
                          <div className="rounded-xl border border-orange-100 bg-[#FFF8F1] px-3 py-2.5">
                            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#C96B00]">Budget</p>
                            <p className="mt-1 text-[12px] line-clamp-1 font-semibold text-slate-800">{job.salary_range || "Discussable"}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2.5">
                          <button
                            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedJob(job);
                            }}
                          >
                            View
                          </button>

                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                              job.has_applied
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                                : "bg-[#FFF6ED] text-[#FF8A00] border border-orange-100 hover:bg-[#FFEFD8]"
                            }`}
                            disabled={job.has_applied || applying === job.id || assessmentStatus !== "completed"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApply(job.id);
                            }}
                          >
                            {job.has_applied ? "Applied" : applying === job.id ? "Applying..." : "Apply"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </main>

      {/* Detail Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="jobs-scroll bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[#FF8A00] font-bold text-sm">
                    <Building2 className="h-4 w-4" />
                    {selectedJob.company_name}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedJob.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold capitalize">{selectedJob.job_type}</span>
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">{selectedJob.experience_band}</span>
                    <span className="px-3 py-1.5 bg-[#FFF6ED] text-[#C96B00] rounded-xl text-xs font-bold">{selectedJob.salary_range}</span>
                    {selectedJob.company_website && (
                      <a
                        href={selectedJob.company_website}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold inline-flex items-center gap-1 hover:text-[#FF8A00] hover:border-orange-100"
                      >
                        Company site <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">About this role</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedJob.description}
                </p>
              </div>

              {/* Company Culture Gallery */}
              {selectedJob.life_at_photo_urls && selectedJob.life_at_photo_urls.length > 0 && (
                <div className="pt-8 border-t border-slate-100">
                  <CompanyCultureGallery 
                    urls={selectedJob.life_at_photo_urls} 
                    companyName={selectedJob.company_name} 
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-8 border-y border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Location</p>
                    <p className="text-sm font-bold text-slate-900">{selectedJob.location || "Remote"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Posted on</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(selectedJob.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  disabled={selectedJob.has_applied || applying === selectedJob.id || assessmentStatus !== "completed"}
                  onClick={() => handleApply(selectedJob.id)}
                  className={`flex-1 h-14 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
                    selectedJob.has_applied
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      : assessmentStatus !== "completed"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                        : "bg-[#FF8A00] text-white hover:bg-[#E67A00] shadow-xl shadow-orange-200"
                  }`}
                >
                  {applying === selectedJob.id ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white/20 border-b-white rounded-full" />
                  ) : selectedJob.has_applied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Applied
                    </>
                  ) : assessmentStatus !== "completed" ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Complete profile first
                    </>
                  ) : (
                    "Apply Now"
                  )}
                </button>
                <button
                  onClick={() => handleToggleSave(selectedJob)}
                  disabled={saving === selectedJob.id}
                  className={`h-14 px-8 rounded-2xl font-bold uppercase tracking-widest text-xs border transition-all flex items-center justify-center gap-2 ${
                    selectedJob.is_saved
                      ? "bg-[#FFF6ED] border-orange-100 text-[#FF8A00]"
                      : "border-slate-200 hover:bg-slate-50 text-slate-500"
                  }`}
                >
                  {selectedJob.is_saved ? (
                    <BookmarkCheck className="h-4 w-4" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                  {selectedJob.is_saved ? "Saved" : "Save Job"}
                </button>
                <button
                  onClick={() => setSharingJob(selectedJob)}
                  className="h-14 px-8 rounded-2xl font-bold uppercase tracking-widest text-xs border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all flex items-center justify-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {sharingJob && (
        <ShareJobModal
          job={sharingJob}
          onClose={() => setSharingJob(null)}
        />
      )}
    </div>
  );
}


