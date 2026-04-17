"use client";

import { useState, useEffect, use } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Target,
  Layers,
  MapPin,
  Users,
  DollarSign,
  Zap,
  X,
  Workflow,
  Loader2,
  Send,
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

  const [skillsInput, setSkillsInput] = useState("");
  const [positionsInput, setPositionsInput] = useState("1");

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
          setPositionsInput((job.number_of_positions || 1).toString());
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

      // Ensure positions has a valid value
      let finalPositions = formData.number_of_positions;
      if (!positionsInput || parseInt(positionsInput, 10) < 1) {
        finalPositions = 1;
      }

      await apiClient.patch(
        `/recruiter/jobs/${id}`,
        {
          ...formData,
          number_of_positions: finalPositions,
        },
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="p-12 min-h-screen bg-slate-50">
        <LockedView featureName="Job Editor" />
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
              Edit Role
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateJob}
              disabled={loading}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-8 py-8 pb-20">
        <form onSubmit={handleUpdateJob} className="space-y-6">
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
            <Field label="Description" icon={Layers} fullWidth>
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
          <Section title="Requirements & Skills" icon={Target}>
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
              </Field>
            </div>
          </Section>

          {/* Section: Market Details */}
          <Section title="Market Details" icon={Workflow}>
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
                <input
                  value={formData.salary_range}
                  onChange={(e) =>
                    setFormData({ ...formData, salary_range: e.target.value })
                  }
                  className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. $120k - $160k"
                />
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
    <div className={fullWidth ? "md:col-span-3" : ""}>
      <label className="flex items-center text-[10px] font-black text-slate-600 uppercase tracking-wider mb-2">
        <Icon className="w-3 h-3 mr-2 text-slate-400" />
        {label}
      </label>
      {children}
    </div>
  );
}
