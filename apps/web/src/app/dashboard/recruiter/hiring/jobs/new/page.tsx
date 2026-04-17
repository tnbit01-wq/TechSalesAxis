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
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 sticky top-0 z-20 w-full bg-white">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Create New Role
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAiAssistant(!showAiAssistant)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${
                showAiAssistant
                  ? "bg-blue-600 text-white shadow-lg"
                  : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
              }`}
            >
              Generate with AI
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <button
              onClick={handleCheckMatchPotential}
              disabled={checkingPotential || formData.skills_required.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Preview matching candidates after adding skills"
            >
              {checkingPotential ? (
                <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              Preview Talent
            </button>
            <div className="w-px h-6 bg-slate-200" />
            <button
              onClick={handleCreateJob}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Publishing
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Publish
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* AI Assistant Modal - Clean & Professional */}
      {showAiAssistant && (
        <div className="fixed top-20 left-0 right-0 z-30 animate-in slide-in-from-top duration-300 px-8 flex justify-center">
          <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden w-full max-w-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                  Generate Role with AI
                </h2>
                <p className="text-[11px] text-slate-500 font-medium mt-1">Describe the role in detail, and AI will generate job description, requirements, and skills</p>
              </div>
              <button
                onClick={() => setShowAiAssistant(false)}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block mb-2.5">Your Description</label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., Senior Frontend Engineer for our DeFi platform. Expertise in React, TypeScript, and Web3. Must have 5+ years experience..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-14"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAiAssistant(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIGenerate}
                  disabled={aiLoading || !aiPrompt}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

      {/* Main Content */}
      <main className="w-full px-8 py-8 pb-20">
        {/* Talent Match Alert */}
        {matchPotential && (
          <div className={`mb-8 rounded-xl p-5 border flex items-start gap-4 animate-in fade-in slide-in-from-top-4 ${
            matchPotential.count === 0 
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50 border-emerald-200"
          }`}>
            <div className={`p-2.5 rounded-lg flex-shrink-0 ${
              matchPotential.count === 0 
                ? "bg-amber-100 text-amber-600"
                : "bg-emerald-100 text-emerald-600"
            }`}>
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-sm font-black uppercase tracking-tight ${
                matchPotential.count === 0 
                  ? "text-amber-900"
                  : "text-emerald-900"
              }`}>
                {matchPotential.message}
              </h3>
              {matchPotential.count > 0 && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {matchPotential.count} Matching Candidates
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const skillsParam = encodeURIComponent(formData.skills_required.join(","));
                      const locParam = encodeURIComponent(formData.location || "");
                      router.push(`/dashboard/recruiter/talent-pool?filter=skill_match&skills=${skillsParam}&location=${locParam}`);
                    }}
                    className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 uppercase tracking-wider underline"
                  >
                    View in Talent Pool →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Sections */}
        <form onSubmit={handleCreateJob} className="space-y-6">
          {/* Section: Role Architecture */}
          <Section title="Role Architecture" icon={Briefcase}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Job Title" icon={Target}>
                <input
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer"
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
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none cursor-pointer"
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
                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="Describe the mission and daily impact of this role..."
              />
            </Field>
          </Section>

          {/* Section: Requirements & Skills */}
          <Section title="Requirements & Skills" icon={Sparkles}>
            <div className="space-y-5">
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
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  placeholder="Define technical or professional prerequisites (one per line)..."
                />
              </Field>
              <Field label="Technical Skills" icon={Zap} fullWidth>
                <div className="space-y-3">
                  <input
                    value={skillsInput}
                    onChange={(e) => {
                      const input = e.target.value;
                      const lastChar = input[input.length - 1];
                      
                      // Check if user added comma or space
                      if ((lastChar === "," || lastChar === " ") && input.length > 1) {
                        // Extract the skill (remove comma/space)
                        const skill = input.slice(0, -1).trim();
                        
                        if (skill && !formData.skills_required.includes(skill)) {
                          // Add to skills array
                          setFormData({
                            ...formData,
                            skills_required: [...formData.skills_required, skill],
                          });
                        }
                        // Clear input for next skill
                        setSkillsInput("");
                      } else {
                        // Just update the input value
                        setSkillsInput(input);
                      }
                    }}
                    onKeyDown={(e) => {
                      // Handle Enter key as well
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
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Type a skill and press space, comma, or Enter to add"
                  />
                  {formData.skills_required.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {formData.skills_required.map((skill, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
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
                            className="ml-1 hover:text-blue-900 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 font-medium mt-2">💡 Add skills to unlock the "Preview Talent" feature above</p>
              </Field>
            </div>
          </Section>

          {/* Section: Market Alignment */}
          <Section title="Market Details" icon={Globe}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <Field label="Location" icon={MapPin}>
                <input
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="City, Country"
                />
              </Field>
              <Field label="Open Positions" icon={Users}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={positionsInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Allow only numbers, empty string, or clear it completely
                    if (value === "") {
                      setPositionsInput("");
                    } else if (/^\d+$/.test(value)) {
                      // Only allow digits
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
                  onBlur={(e) => {
                    // When user leaves the field, ensure we have a valid number
                    if (positionsInput === "" || parseInt(positionsInput, 10) < 1) {
                      setPositionsInput("1");
                      setFormData({
                        ...formData,
                        number_of_positions: 1,
                      });
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Enter number of positions"
                />
              </Field>
              <Field label="Salary Range" icon={DollarSign}>
                <div className="space-y-2">
                  <input
                    value={formData.salary_range}
                    onChange={(e) =>
                      setFormData({ ...formData, salary_range: e.target.value })
                    }
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="e.g. $120k - $160k"
                  />
                  <button
                    type="button"
                    onClick={handleRecalculateSalary}
                    disabled={salaryLoading || !formData.location}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    title="Auto-detect salary range based on your location and experience level"
                  >
                    {salaryLoading ? (
                      <>
                        <div className="w-3 h-3 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
                        Detecting...
                      </>
                    ) : (
                      "Auto-Detect Salary"
                    )}
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

// Reusable UI Components
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
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <h2 className="text-sm font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-tight">
        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
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
      <label className="flex items-center text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">
        <Icon className="w-3 h-3 mr-2 text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  );
}

