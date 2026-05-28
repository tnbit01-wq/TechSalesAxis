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
  const [skillsInput, setSkillsInput] = useState("");
  const [positionsInput, setPositionsInput] = useState("1");
  const [matchPotential, setMatchPotential] = useState<{ count: number; message: string } | null>(null);
  const [checkingPotential, setCheckingPotential] = useState(false);

  const getExperienceBandLabel = (band: string) => {
    switch (band) {
      case "fresher":
        return "0-1 (Fresher)";
      case "mid":
        return "1-5 (Mid-level)";
      case "senior":
        return "5-10 (Senior)";
      case "leadership":
        return "10+ (Leadership)";
      default:
        return band;
    }
  };

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

      // Add any remaining skill in input
      let finalSkills = [...formData.skills_required];
      if (skillsInput.trim()) {
        const skill = skillsInput.trim();
        if (!finalSkills.includes(skill)) {
          finalSkills = [...finalSkills, skill];
        }
      }

      // Ensure positions has a valid default value
      let finalPositions = formData.number_of_positions;
      if (!positionsInput || parseInt(positionsInput, 10) < 1) {
        finalPositions = 1;
      }

      await apiClient.post("/recruiter/jobs", { 
        ...formData, 
        skills_required: finalSkills,
        number_of_positions: finalPositions,
      }, token);
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
    if (!formData.skills_required.length && !formData.title) {
      alert("Please add at least a job title or skills before checking match potential");
      return;
    }
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

      console.log("🎯 Checking job potential with data:", {
        skills: formData.skills_required,
        experience_years: bandToYears[formData.experience_band],
        location: formData.location,
        title: formData.title
      });

      const result = await apiClient.post(
        "/recruiter/check-job-potential",
        {
          skills: formData.skills_required,
          experience_years: bandToYears[formData.experience_band] || 2,
          location: formData.location,
          salary_range: formData.salary_range,
          title: formData.title
        },
        token
      );

      console.log("✅ Match potential result:", result);

      // Generate appropriate message based on count
      let message = "";
      if (result.count === 0) {
        message = "No candidates found yet. Consider broadening your criteria or adjusting requirements.";
      } else if (result.count === 1) {
        message = `Perfect match! Found 1 candidate with your exact requirements.`;
      } else if (result.count <= 5) {
        message = `Great talent pool! Found ${result.count} highly qualified candidates.`;
      } else if (result.count <= 10) {
        message = `Excellent response! Found ${result.count} matching candidates in talent pool.`;
      } else {
        message = `Strong talent pool! Found ${result.count}+ candidates matching your requirements.`;
      }

      setMatchPotential({
        ...result,
        message: message,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("Match potential check failed:", err);
      setMatchPotential({
        count: 0,
        message: "Unable to check match potential. Please try again."
      });
    } finally {
      setCheckingPotential(false);
    }
  };

  if (checkingLock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.12),_transparent_38%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900">
      <style>{`
        .job-form-scroll {
          scrollbar-width: thin;
          scrollbar-color: #d6d3d1 transparent;
        }
        .job-form-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .job-form-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .job-form-scroll::-webkit-scrollbar-thumb {
          background: #d6d3d1;
          border-radius: 999px;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1680px] flex-col gap-4 px-4 py-4">
        <section className="flex flex-col gap-3 rounded-[28px] border border-orange-100/80 bg-white px-5 py-4 shadow-[0_10px_26px_rgba(255,138,0,0.08)] lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard/recruiter/hiring/jobs")}
              className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-orange-100 bg-[#FFF7EE] text-[#C96B00] transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
              aria-label="Back to jobs"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Role Builder</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Create a new job</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Keep the publishing flow compact, readable, and branded so recruiters can draft faster without losing context.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button
              onClick={() => setShowAiAssistant(!showAiAssistant)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 transition-all ${
                showAiAssistant
                  ? "border-blue-200 bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.24)]"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI Assist
            </button>
            <button
              onClick={handleCheckMatchPotential}
              disabled={checkingPotential || formData.skills_required.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Preview matching candidates after adding skills"
            >
              {checkingPotential ? (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-emerald-700 border-t-transparent animate-spin" />
              ) : (
                <Target className="h-3.5 w-3.5" />
              )}
              Preview Talent
            </button>
            <button
              onClick={handleCreateJob}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] transition hover:bg-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Publishing
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Publish Role
                </>
              )}
            </button>
          </div>
        </section>

        {matchPotential && (
          <div
            className={`rounded-2xl border p-4 shadow-[0_8px_20px_rgba(15,23,42,0.05)] ${
              matchPotential.count === 0
                ? "border-amber-200 bg-amber-50"
                : "border-emerald-200 bg-emerald-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  matchPotential.count === 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                }`}
              >
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  className={`text-sm font-black uppercase tracking-tight ${
                    matchPotential.count === 0 ? "text-amber-900" : "text-emerald-900"
                  }`}
                >
                  {matchPotential.message}
                </h2>
                {matchPotential.count > 0 && (
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    <span>{matchPotential.count} matching candidates</span>
                    <button
                      type="button"
                      onClick={() => {
                        const skillsParam = encodeURIComponent(formData.skills_required.join(","));
                        const locParam = encodeURIComponent(formData.location || "");
                        router.push(`/dashboard/recruiter/talent-pool?filter=skill_match&skills=${skillsParam}&location=${locParam}`);
                      }}
                      className="text-emerald-700 underline decoration-emerald-400 underline-offset-4 hover:text-emerald-800"
                    >
                      Open talent pool
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="job-form-scroll min-h-0 overflow-y-auto rounded-[28px] border border-orange-100/80 bg-white p-4 shadow-[0_10px_26px_rgba(255,138,0,0.08)] lg:p-5">
            <form onSubmit={handleCreateJob} className="space-y-4">
              <Section title="Role Architecture" icon={Briefcase} tone="orange">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Job title" icon={Target}>
                    <input
                      required
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      placeholder="Lead Software Architect"
                    />
                  </Field>
                  <Field label="Experience band" icon={Layers}>
                    <select
                      value={formData.experience_band}
                      onChange={(e) => setFormData({ ...formData, experience_band: e.target.value })}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                    >
                      <option value="fresher">0-1 (Fresher)</option>
                      <option value="mid">1-5 (Mid-level)</option>
                      <option value="senior">5-10 (Senior)</option>
                      <option value="leadership">10+ (Leadership)</option>
                    </select>
                  </Field>
                  <Field label="Work model" icon={Workflow}>
                    <select
                      value={formData.job_type}
                      onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                      className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                    >
                      <option value="onsite">On-site</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="remote">Remote</option>
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="Mission & Impact" icon={Zap} tone="amber">
                <Field label="Role description" icon={Zap} fullWidth>
                  <textarea
                    required
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                    placeholder="Describe the mission, responsibilities, and daily impact of the role..."
                  />
                </Field>
              </Section>

              <Section title="Requirements & Skills" icon={Sparkles} tone="blue">
                <div className="space-y-4">
                  <Field label="Core requirements" icon={Target} fullWidth>
                    <textarea
                      rows={4}
                      value={formData.requirements?.join("\n") || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          requirements: e.target.value.split("\n").filter(Boolean),
                        })
                      }
                      className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      placeholder="One requirement per line"
                    />
                  </Field>
                  <Field label="Technical skills" icon={Zap} fullWidth>
                    <div className="space-y-3">
                      <input
                        value={skillsInput}
                        onChange={(e) => {
                          const input = e.target.value;
                          const lastChar = input[input.length - 1];

                          if ((lastChar === "," || lastChar === " ") && input.length > 1) {
                            const skill = input.slice(0, -1).trim();

                            if (skill && !formData.skills_required.includes(skill)) {
                              setFormData({
                                ...formData,
                                skills_required: [...formData.skills_required, skill],
                              });
                            }
                            setSkillsInput("");
                          } else {
                            setSkillsInput(input);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const skill = skillsInput.trim();
                            if (skill && !formData.skills_required.includes(skill)) {
                              setFormData({
                                ...formData,
                                skills_required: [...formData.skills_required, skill],
                              });
                              setSkillsInput("");
                            }
                          }
                        }}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="Type a skill, then press space, comma, or Enter"
                      />
                      {formData.skills_required.length > 0 && (
                        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                          {formData.skills_required.map((skill, index) => (
                            <div
                              key={index}
                              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-700"
                            >
                              {skill}
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = formData.skills_required.filter((_, i) => i !== index);
                                  setFormData({
                                    ...formData,
                                    skills_required: updated,
                                  });
                                }}
                                className="rounded-full p-0.5 hover:bg-blue-100 hover:text-blue-900"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-slate-500">
                      Skills unlock the talent preview action in the header.
                    </p>
                  </Field>
                </div>
              </Section>

              <Section title="Market Details" icon={Globe} tone="green">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Location" icon={MapPin}>
                    <input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      placeholder="City, Country"
                    />
                  </Field>
                  <Field label="Open positions" icon={Users}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={positionsInput}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setPositionsInput("");
                        } else if (/^\d+$/.test(value)) {
                          const num = parseInt(value, 10);
                          if (num >= 1) {
                            setPositionsInput(value);
                            setFormData({
                              ...formData,
                              number_of_positions: num,
                            });
                          }
                        }
                      }}
                      onBlur={() => {
                        if (positionsInput === "" || parseInt(positionsInput, 10) < 1) {
                          setPositionsInput("1");
                          setFormData({
                            ...formData,
                            number_of_positions: 1,
                          });
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                      placeholder="1"
                    />
                  </Field>
                  <Field label="Salary range" icon={DollarSign}>
                    <div className="space-y-2">
                      <input
                        value={formData.salary_range}
                        onChange={(e) => setFormData({ ...formData, salary_range: e.target.value })}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                        placeholder="$120k - $160k"
                      />
                      <button
                        type="button"
                        onClick={handleRecalculateSalary}
                        disabled={salaryLoading || !formData.location}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Auto-detect salary range based on your location and experience level"
                      >
                        {salaryLoading ? (
                          <>
                            <div className="h-3 w-3 rounded-full border-2 border-blue-700 border-t-transparent animate-spin" />
                            Detecting
                          </>
                        ) : (
                          "Auto-detect salary"
                        )}
                      </button>
                    </div>
                  </Field>
                </div>
              </Section>
            </form>
          </div>

          <aside className="job-form-scroll min-h-0 overflow-y-auto rounded-[28px] border border-orange-100/80 bg-white p-4 shadow-[0_10px_26px_rgba(255,138,0,0.08)] lg:p-5">
            <div className="space-y-4">
              <div className="rounded-[24px] bg-[linear-gradient(135deg,#FFF7EE_0%,#FFFFFF_55%,#FFF1E3_100%)] p-4 ring-1 ring-orange-100/80">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C96B00]">Draft summary</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">
                  {formData.title || "Untitled role"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {formData.location || "Location not set"} · {formData.job_type || "work model"}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Positions</p>
                    <p className="mt-1 text-slate-900">{formData.number_of_positions}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Experience</p>
                    <p className="mt-1 text-slate-900">{getExperienceBandLabel(formData.experience_band)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Skills</p>
                    <p className="mt-1 text-slate-900">{formData.skills_required.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Status</p>
                    <p className="mt-1 text-[#C96B00]">Draft</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Publishing checklist</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  <li className="rounded-2xl bg-white px-3 py-2">Use the role title and description to set the page context.</li>
                  <li className="rounded-2xl bg-white px-3 py-2">Add skills to unlock the talent preview button.</li>
                  <li className="rounded-2xl bg-white px-3 py-2">Keep salary and location aligned before publishing.</li>
                </ul>
              </div>

              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">AI assist</p>
                <p className="mt-1 text-sm text-emerald-900/80">
                  Toggle the AI assistant to draft the role from a short prompt, then refine the details here.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(!showAiAssistant)}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-emerald-700"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {showAiAssistant ? "Hide AI assistant" : "Open AI assistant"}
                </button>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* AI Assistant Modal - Clean & Professional */}
      {showAiAssistant && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-slate-950/25 px-4 pt-20 backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-[linear-gradient(135deg,#FFF7EE_0%,#FFFFFF_100%)] p-5">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Generate Role with AI
                </h2>
                <p className="mt-1 text-[11px] font-medium text-slate-500">Describe the role and generate the first draft, then refine it in the editor.</p>
              </div>
              <button
                onClick={() => setShowAiAssistant(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div>
                <label className="mb-2.5 block text-[10px] font-black uppercase tracking-wider text-slate-600">Your description</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Senior Frontend Engineer for our DeFi platform. Expertise in React, TypeScript, and Web3. Must have 5+ years experience..."
                  className="h-24 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-medium outline-none focus:border-[#FF8A00]/50 focus:ring-4 focus:ring-[#FF8A00]/10"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(false)}
                  className="rounded-full bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt}
                  className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-2 text-[11px] font-black uppercase tracking-wider text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {aiLoading ? (
                    <>
                      <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Reusable UI Components
function Section({
  title,
  icon: Icon,
  tone = "orange",
  children,
}: {
  title: string;
  icon: React.ElementType;
  tone?: "orange" | "amber" | "blue" | "green";
  children: React.ReactNode;
}) {
  const toneClasses = {
    orange: "border-orange-100 bg-[linear-gradient(180deg,#FFFDF9_0%,#FFFFFF_100%)]",
    amber: "border-amber-100 bg-[linear-gradient(180deg,#FFFDF6_0%,#FFFFFF_100%)]",
    blue: "border-blue-100 bg-[linear-gradient(180deg,#FBFDFF_0%,#FFFFFF_100%)]",
    green: "border-emerald-100 bg-[linear-gradient(180deg,#FBFFFD_0%,#FFFFFF_100%)]",
  }[tone];

  const iconClasses = {
    orange: "bg-[#FFF1E3] text-[#C96B00]",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
  }[tone];

  return (
    <div className={`rounded-[24px] border p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)] ${toneClasses}`}>
      <h2 className="mb-4 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">
        <div className={`rounded-2xl p-2 ${iconClasses}`}>
          <Icon className="h-4 w-4" />
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
      <label className="mb-2 flex items-center text-[10px] font-black uppercase tracking-wider text-slate-600">
        <Icon className="mr-2 h-3 w-3 text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  );
}

