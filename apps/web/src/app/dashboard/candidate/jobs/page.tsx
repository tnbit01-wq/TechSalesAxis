"use client";

import { useEffect, useState } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Zap,
  Target,
  Clock,
  MapPin,
  Briefcase,
  Pin,
  Sparkles,
  ChevronRight,
  Filter,
  Search,
  CheckCircle2,
  Lock,
  Building2,
  X,
  Palette,
} from "lucide-react";
import CompanyCultureGallery from "@/components/CompanyCultureGallery";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJobType, setFilterJobType] = useState<string>("all");
  const [filterExperience, setFilterExperience] = useState<string>("all");

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

  // Filter jobs based on search term and selected filters
  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesJobType = filterJobType === "all" || job.job_type === filterJobType;
    const matchesExperience = filterExperience === "all" || job.experience_band === filterExperience;
    
    return matchesSearch && matchesJobType && matchesExperience;
  });

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
        <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Jobs...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Job Board</h1>
          <p className="text-slate-500 text-sm mt-1">Discover roles that match your profile.</p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by title, location, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              />
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Job Type</label>
              <select
                value={filterJobType}
                onChange={(e) => setFilterJobType(e.target.value)}
                className="px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer font-medium text-slate-900"
              >
                <option value="all">All Types</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Experience Level</label>
              <select
                value={filterExperience}
                onChange={(e) => setFilterExperience(e.target.value)}
                className="px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 shadow-sm cursor-pointer font-medium text-slate-900"
              >
                <option value="all">All Levels</option>
                <option value="fresher">Fresher (0-1y)</option>
                <option value="mid">Mid-level (1-5y)</option>
                <option value="senior">Senior (5-10y)</option>
                <option value="leadership">Leadership (10y+)</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredJobs.length === 0 && jobs.length > 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <Search className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No matching jobs found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search terms or filters.</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-200 rounded-3xl">
            <Briefcase className="h-10 w-10 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No jobs found</h3>
            <p className="text-slate-500 text-sm">Check back later for new opportunities.</p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer"
              onClick={() => setSelectedJob(job)}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="h-12 w-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-primary-light transition-colors">
                  <Building2 className="h-6 w-6 text-slate-400 group-hover:text-primary" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSave(job);
                  }}
                  disabled={saving === job.id}
                  className={`p-2 rounded-xl transition-all ${
                    job.is_saved
                      ? "bg-primary-light text-primary"
                      : "text-slate-400 hover:bg-slate-50 hover:text-primary"
                  }`}
                >
                  <Pin className={`h-4 w-4 ${job.is_saved ? "fill-current" : ""}`} />
                </button>
              </div>

              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                  {job.title}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{job.company_name}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-200" />
                  <span className="text-xs text-slate-500">{job.location || "Remote"}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salary</span>
                  <span className="text-xs font-bold text-slate-900">{job.salary_range || "Contact for info"}</span>
                </div>
                <button 
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedJob(job);
                  }}
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Detail Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 space-y-8">
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <Building2 className="h-4 w-4" />
                    {selectedJob.company_name}
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{selectedJob.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">{selectedJob.job_type}</span>
                    <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">{selectedJob.experience_band}</span>
                    <span className="px-3 py-1.5 bg-primary-light text-primary-dark rounded-xl text-xs font-bold">{selectedJob.salary_range}</span>
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
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">Job Description</h3>
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
                        : "bg-primary text-white hover:bg-slate-900 shadow-xl shadow-primary-light"
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
                      Complete Profile First
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
                      ? "bg-primary-light border-primary-light text-primary"
                      : "border-slate-200 hover:bg-slate-50 text-slate-500"
                  }`}
                >
                  <Pin className={`h-4 w-4 ${selectedJob.is_saved ? "fill-current" : ""}`} />
                  {selectedJob.is_saved ? "Saved" : "Save Job"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SignalBadge({
  label,
  icon,
  highlight,
}: {
  label: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
        highlight
          ? "bg-primary text-white border-primary shadow-lg shadow-primary-light"
          : "bg-slate-50 text-slate-500 border-slate-100"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}


