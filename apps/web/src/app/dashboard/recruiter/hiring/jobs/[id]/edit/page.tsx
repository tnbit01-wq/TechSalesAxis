"use client";

import { useState, useEffect, use } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Save,
  Briefcase,
  Target,
  Layers,
  MapPin,
  Users,
  DollarSign,
  Zap,
  ArrowLeft,
  Globe,
  X,
  Workflow,
  Loader2,
} from "lucide-react";
import LockedView from "@/components/dashboard/LockedView";

interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string[];
  skills_required: string[];
  experience_band: string;
  job_type: string;
  location: string;
  salary_range: string;
  number_of_positions: number;
  status: "active" | "paused" | "closed";
}

export default function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [checkingLock, setCheckingLock] = useState(true);

  // Job Form Data
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: [] as string[],
    skills_required: [] as string[],
    experience_band: "mid",
    job_type: "onsite",
    location: "",
    salary_range: "",
    number_of_positions: 1,
    status: "active" as "active" | "paused" | "closed",
  });

  useEffect(() => {
    async function loadJob() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        // Fetch profile for locking logic
        const profile = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        if ((profile?.companies?.profile_score ?? 0) === 0) {
          setIsLocked(true);
        }
        setCheckingLock(false);

        // Fetch job data
        const jobs: Job[] = await apiClient.get(
          "/recruiter/jobs",
          token,
        );
        const job = jobs.find((j) => j.id === id);

        if (job) {
          setFormData({
            title: job.title || "",
            description: job.description || "",
            requirements: job.requirements || [],
            skills_required: job.skills_required || [],
            experience_band: job.experience_band || "mid",
            job_type: job.job_type || "onsite",
            location: job.location || "",
            salary_range: job.salary_range || "",
            number_of_positions: job.number_of_positions || 1,
            status: job.status || "active",
          });
        } else {
          router.push("/dashboard/recruiter/hiring/jobs");
        }
      } catch (err) {
        console.error("Failed to load job:", err);
      } finally {
        setFetching(false);
      }
    }
    loadJob();
  }, [id, router]);

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        `/recruiter/jobs/${id}`,
        formData,
        token,
      );
      router.push("/dashboard/recruiter/hiring/jobs");
    } catch (err) {
      console.error("Failed to update job:", err);
    } finally {
      setLoading(false);
    }
  };

  if (checkingLock || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Retrieving Blueprint...
          </span>
        </div>
      </div>
    );
  }

  if (isLocked) {
    return <LockedView featureName="Role Editing" />;
  }

  return (
    <div className="min-h-screen bg-slate-50/30 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Top Navigation */}
        <div className="flex items-center justify-between mb-12">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Inventory
            </span>
          </button>

          <div className="flex items-center gap-3">
            <div className="p-1 px-3 bg-indigo-50 rounded-full border border-indigo-100 italic">
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                Architect Mode
              </span>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
              <Workflow className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">
                Edit <span className="text-indigo-600">Executive</span> Role
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em]">
                Refining the strategic blueprint for{" "}
                {formData.title || "Elite Role"}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateJob} className="space-y-8">
          {/* Core Details Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform duration-700">
              <Briefcase className="w-32 h-32" />
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="md:col-span-2 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Job Identity
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Strategic Account Executive"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold placeholder:text-slate-300 focus:bg-white focus:border-slate-900 focus:ring-8 focus:ring-slate-50 transition-all outline-none"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" /> seniority level
                </label>
                <select
                  value={formData.experience_band}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      experience_band: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-900 outline-none appearance-none cursor-pointer uppercase tracking-widest"
                >
                  <option value="fresher">Fresher (0-1y)</option>
                  <option value="mid">Mid (1-5y)</option>
                  <option value="senior">Senior (5-10y)</option>
                  <option value="leadership">Leadership (10y+)</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5" /> Work Infrastructure
                </label>
                <select
                  value={formData.job_type}
                  onChange={(e) =>
                    setFormData({ ...formData, job_type: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-900 outline-none appearance-none cursor-pointer uppercase tracking-widest"
                >
                  <option value="onsite">On-Site Office</option>
                  <option value="remote">Fully Remote</option>
                  <option value="hybrid">Dynamic Hybrid</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" /> Geographic Focus
                </label>
                <input
                  type="text"
                  placeholder="e.g. Singapore, Remote, Global"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-900 outline-none transition-all placeholder:text-slate-300"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <DollarSign className="w-3.5 h-3.5" /> Investment Range
                </label>
                <input
                  type="text"
                  placeholder="e.g. $120k - $160k"
                  value={formData.salary_range}
                  onChange={(e) =>
                    setFormData({ ...formData, salary_range: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold focus:bg-white focus:border-slate-900 outline-none transition-all placeholder:text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Strategic Intent (Description) */}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Strategic Role Intent
              </label>
              <textarea
                required
                rows={8}
                placeholder="Describe the mission-critical objectives for this role..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-8 py-6 text-sm font-medium leading-relaxed focus:bg-white focus:border-slate-900 outline-none transition-all"
              />
            </div>
          </div>

          {/* Skills & Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Skills */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" /> Core Competencies
                </label>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {formData.skills_required.map((skill, idx) => (
                  <div
                    key={idx}
                    className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 border border-white/5"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          skills_required: formData.skills_required.filter(
                            (_, i) => i !== idx,
                          ),
                        })
                      }
                    >
                      <X className="w-3 h-3 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Press enter to add skill..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const val = e.currentTarget.value.trim();
                    if (val) {
                      setFormData({
                        ...formData,
                        skills_required: [...formData.skills_required, val],
                      });
                      e.currentTarget.value = "";
                    }
                  }
                }}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs placeholder:text-slate-600 focus:bg-white/10 outline-none"
              />
            </div>

            {/* Positions */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-3.5 h-3.5" /> Headcount Allocation
                </label>
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      number_of_positions: Math.max(
                        1,
                        formData.number_of_positions - 1,
                      ),
                    })
                  }
                  className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-bold hover:bg-slate-900 hover:text-white transition-all"
                >
                  {" "}
                  -{" "}
                </button>
                <div className="flex-1 text-center text-2xl font-black text-slate-900 underline decoration-indigo-500 decoration-4">
                  {formData.number_of_positions}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      number_of_positions: formData.number_of_positions + 1,
                    })
                  }
                  className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xl font-bold hover:bg-slate-900 hover:text-white transition-all"
                >
                  {" "}
                  +{" "}
                </button>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-10 flex items-center justify-end gap-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-slate-900 transition-colors"
            >
              {" "}
              Cancel Changes{" "}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center px-12 py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-2xl shadow-indigo-100 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Deploy Updates
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
