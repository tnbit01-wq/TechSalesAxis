"use client";

import { useState, useEffect } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Plus,
  Sparkles,
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
  Send,
  Workflow,
} from "lucide-react";
import LockedView from "@/components/dashboard/LockedView";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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
    is_ai_generated: false,
  });

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [matchPotential, setMatchPotential] = useState<{ count: number; message: string } | null>(null);
  const [checkingPotential, setCheckingPotential] = useState(false);

  useEffect(() => {
    async function checkAccess() {
      try {
        const token = awsAuth.getToken();
        if (!token) return;
        const profile = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        if ((profile?.companies?.profile_score ?? 0) === 0) {
          setIsLocked(true);
        }
      } catch (err) {
        console.error("Lock check failed:", err);
      } finally {
        setCheckingLock(false);
      }
    }
    checkAccess();
  }, []);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post("/recruiter/jobs", formData, token);
      router.push("/dashboard/recruiter/hiring/jobs");
    } catch (err) {
      console.error("Failed to create job:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const aiResult = await apiClient.post(
        "/recruiter/jobs/generate-ai",
        {
          prompt: aiPrompt,
          experience_band: formData.experience_band,
          location: formData.location, // Passing location for localized salary
        },
        token,
      );

      setFormData({
        ...formData,
        ...aiResult,
        is_ai_generated: true,
      });
      setShowAiAssistant(false); // Close on success
    } catch (err) {
      console.error("AI Generation failed:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleRecalculateSalary = async () => {
    if (!formData.title || !formData.location) return;
    setSalaryLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const aiResult = await apiClient.post(
        "/recruiter/jobs/generate-ai",
        {
          prompt: `Recalculate ONLY salary for role "${formData.title}" in location "${formData.location}" for ${formData.experience_band} level.`,
          experience_band: formData.experience_band,
          location: formData.location,
        },
        token,
      );

      if (aiResult.salary_range) {
        setFormData({
          ...formData,
          salary_range: aiResult.salary_range,
        });
      }
    } catch (err) {
      console.error("Salary recalculation failed:", err);
    } finally {
      setSalaryLoading(false);
    }
  };

  const handleCheckMatchPotential = async () => {
    if (!formData.skills_required.length) return;
    setCheckingPotential(true);
    setMatchPotential(null);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const bandToYears: Record<string, number> = {
        'fresher': 0,
        'mid': 3,
        'senior': 7,
        'leadership': 12
      };

      const result = await apiClient.post(
        "/recruiter/check-job-potential",
        {
          skills: formData.skills_required,
          experience_years: bandToYears[formData.experience_band] || 2,
          location: formData.location,
          salary_range: formData.salary_range
        },
        token
      );

      setMatchPotential(result);
    } catch (err) {
      console.error("Match potential check failed:", err);
    } finally {
      setCheckingPotential(false);
    }
  };

  if (checkingLock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-12 min-h-screen bg-slate-50">
        <LockedView featureName="Job Creator" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/30">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20 w-full backdrop-blur-md bg-white/80">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard/recruiter/hiring/jobs")}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
            Create New Role
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowAiAssistant(!showAiAssistant)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              showAiAssistant
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Architect
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <button
            onClick={handleCheckMatchPotential}
            disabled={checkingPotential || formData.skills_required.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100 transition-all disabled:opacity-50"
          >
            {checkingPotential ? (
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Target className="w-3.5 h-3.5" />
            )}
            Preview Talent
          </button>
          <div className="h-4 w-px bg-slate-200" />
          <button
            onClick={handleCreateJob}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              "Publishing..."
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Publish
              </>
            )}
          </button>
        </div>
      </header>

      {/* AI Assistant Overlay */}
      {showAiAssistant && (
        <div className="fixed inset-x-0 top-16 z-30 animate-in slide-in-from-top duration-300">
          <div className="max-w-4xl mx-auto p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 relative overflow-hidden ring-1 ring-slate-200/50">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Sparkles className="w-32 h-32 text-indigo-600" />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Smart Role Architect
                    </h2>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">
                      Describe the mission, AI will handle the details
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAiAssistant(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex gap-4">
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer for our DeFi platform. Expertise in React and Web3..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none h-24"
                  />
                  <button
                    onClick={handleAIGenerate}
                    disabled={aiLoading || !aiPrompt}
                    className="bg-indigo-600 text-white px-8 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100 self-end h-16"
                  >
                    {aiLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Thinking
                      </div>
                    ) : (
                      "Generate"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-8 max-w-4xl mx-auto w-full pb-20">
        {matchPotential && (
          <div className="mb-8 bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl text-emerald-600 shadow-sm border border-emerald-50">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{matchPotential.message}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">Verified via AI Assessment</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const skillsParam = encodeURIComponent(formData.skills_required.join(","));
                router.push(`/dashboard/recruiter/intelligence/recommendations?filter=skill_match&skills=${skillsParam}`);
              }}
              className="px-6 py-2.5 bg-white border border-emerald-200 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-sm flex items-center gap-2"
            >
              Exposed Candidates
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </button>
          </div>
        )}
        <form onSubmit={handleCreateJob} className="space-y-8">
          {/* Section: Role Identity */}
          <Section title="Role Architecture" icon={Briefcase}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Job Title" icon={Target} fullWidth>
                <input
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="e.g. Lead Software Architect"
                />
              </Field>
              <Field label="Experience Band" icon={Layers}>
                <select
                  value={formData.experience_band}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      experience_band: e.target.value,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="fresher">Fresher (0-1y)</option>
                  <option value="mid">Mid-Level (1-5y)</option>
                  <option value="senior">Senior (5-10y)</option>
                  <option value="leadership">Leadership (10y+)</option>
                </select>
              </Field>
              <Field label="Engagement Type" icon={Workflow}>
                <select
                  value={formData.job_type}
                  onChange={(e) =>
                    setFormData({ ...formData, job_type: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="onsite">On-site</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* Section: Mission & Details */}
          <Section title="Mission & Impact" icon={Zap}>
            <Field label="Description" icon={Zap} fullWidth>
              <textarea
                required
                rows={6}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                placeholder="Describe the mission and daily impact of this role..."
              />
            </Field>
          </Section>

          {/* Section: Requirements & Skills */}
          <Section title="Signal Alignment" icon={Sparkles}>
            <div className="space-y-6">
              <Field label="Core Requirements" icon={Target} fullWidth>
                <textarea
                  rows={4}
                  value={formData.requirements?.join("\n") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requirements: e.target.value.split("\n").filter(Boolean),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                  placeholder="Define technical or professional prerequisites (one per line)..."
                />
              </Field>
              <Field label="Technical Skills" icon={Zap} fullWidth>
                <input
                  value={formData.skills_required?.join(", ") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      skills_required: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="e.g. Next.js, TypeScript, PostgreSQL (comma separated)"
                />
              </Field>
            </div>
          </Section>

          {/* Section: Market Alignment */}
          <Section title="Market Logistics" icon={Globe}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="Location" icon={MapPin}>
                <input
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                  placeholder="City, Country"
                />
              </Field>
              <Field label="Openings" icon={Users}>
                <input
                  type="number"
                  min="1"
                  value={formData.number_of_positions}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      number_of_positions: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </Field>
              <Field label="Salary Range" icon={DollarSign}>
                <div className="relative group">
                  <input
                    value={formData.salary_range}
                    onChange={(e) =>
                      setFormData({ ...formData, salary_range: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all outline-none pr-10"
                    placeholder="e.g. $120k - $160k"
                  />
                  <button
                    type="button"
                    onClick={handleRecalculateSalary}
                    disabled={salaryLoading || !formData.location}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-30 disabled:grayscale group-hover:scale-110 active:scale-95 border border-transparent hover:border-slate-100"
                    title="Recalculate salary based on location & experience"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${salaryLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </Field>
            </div>
          </Section>
        </form>
      </main>
    </div>
  );
}

// Reusable UI Components based on Profile Style
function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm hover:shadow-md transition-shadow">
      <h2 className="text-sm font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-widest">
        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
          <Icon className="w-4 h-4" />
        </div>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  children,
  fullWidth = false,
}: {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "md:col-span-2" : ""}>
      <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">
        <Icon className="w-3.5 h-3.5 mr-2 text-slate-300" />
        {label}
      </label>
      {children}
    </div>
  );
}
