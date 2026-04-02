"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  Settings,
  Building2,
  Globe,
  MapPin,
  Tag,
  Target,
  DollarSign,
  User,
  Linkedin,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface Company {
  id: string;
  name: string;
  website: string;
  location: string;
  description: string;
  domain: string;
  industry_category: string;
  sales_model: string;
  avg_deal_size_range: string;
  hiring_focus_areas: string[];
}

interface RecruiterProfile {
  full_name: string;
  job_title: string;
  linkedin_url: string;
  bio: string;
  company_id: string;
  companies: Company;
  is_verified?: boolean;
  assessment_status?: string;
  completion_score?: number;
  team_role?: string;
  professional_persona?: {
    focus_areas: string[];
    years_experience: number;
    preferred_hiring_style: string;
    languages: string[];
  };
}

export default function RecruiterProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  useEffect(() => {
    async function loadData() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get(
          "/recruiter/profile",
          token,
        );
        setProfile(data);
      } catch (err) {
        console.error("Failed to load recruiter profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleSuggestBio = async () => {
    if (!profile?.companies?.website) {
      setMessage({
        type: "error",
        text: "Add a website first to generate a bio.",
      });
      return;
    }

    setGeneratingBio(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const res = await apiClient.post(
        "/recruiter/generate-bio",
        { website: profile.companies.website },
        token,
      );

      if (res.bio) {
        setProfile((p) =>
          p
            ? {
                ...p,
                companies: { ...p.companies, description: res.bio },
              }
            : null,
        );
        setMessage({
          type: "success",
          text: "AI has synthesized a new mission statement.",
        });
      } else {
        setMessage({
          type: "error",
          text: "Unable to synthesize bio. Ensure the website content is public.",
        });
      }
    } catch (err: any) {
      console.error("Failed to generate bio:", err);
      setMessage({
        type: "error",
        text: err.message || "Synthesis engine failed. Please try again.",
      });
    } finally {
      setGeneratingBio(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      // Update Recruiter Info
      await apiClient.patch(
        "/recruiter/profile",
        {
          full_name: profile.full_name,
          job_title: profile.job_title,
          linkedin_url: profile.linkedin_url,
          bio: profile.bio,
          professional_persona: profile.professional_persona,
        },
        token,
      );

      // Update Company Info
      await apiClient.patch(
        "/recruiter/company",
        {
          name: profile.companies.name,
          website: profile.companies.website,
          location: profile.companies.location,
          description: profile.companies.description,
          domain: profile.companies.domain,
          industry_category: profile.companies.industry_category,
          sales_model: profile.companies.sales_model,
          avg_deal_size_range: profile.companies.avg_deal_size_range,
          hiring_focus_areas: profile.companies.hiring_focus_areas,
        },
        token,
      );

      setMessage({
        type: "success",
        text: "Profile settings saved successfully.",
      });
    } catch (err) {
      console.error("Failed to update profile:", err);
      setMessage({
        type: "error",
        text: "Failed to save changes. Please check your connection.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Loading Profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <main className="flex flex-col">
        <div className="p-8 max-w-5xl mx-auto w-full">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Profile Settings</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your professional profile and visibility settings.</p>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-8 pb-32">
            {message.text && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm transition-all animate-in fade-in slide-in-from-top-4 ${
                  message.type === "success"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-rose-50 border-rose-100 text-rose-800"
                }`}
              >
                <CheckCircle2
                  className={`w-5 h-5 ${message.type === "success" ? "text-emerald-500" : "text-rose-500"}`}
                />
                <p className="text-sm font-bold tracking-tight">
                  {message.text}
                </p>
              </div>
            )}

            {/* Recruiter Details */}
            <Section
              title="Profile"
              description="Personal professional identifiers"
              icon={User}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Full Name" icon={User}>
                  <input
                    type="text"
                    value={profile?.full_name || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p ? { ...p, full_name: e.target.value } : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Job Title" icon={Briefcase}>
                  <input
                    type="text"
                    value={profile?.job_title || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p ? { ...p, job_title: e.target.value } : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="LinkedIn Profile" icon={Linkedin}>
                  <div className="relative">
                    <input
                      type="text"
                      value={profile?.linkedin_url || ""}
                      onChange={(e) =>
                        setProfile((p) =>
                          p ? { ...p, linkedin_url: e.target.value } : null,
                        )
                      }
                      placeholder="linkedin.com/in/username"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                    <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  </div>
                </Field>
                <Field label="Professional Pitch" icon={FileText} fullWidth>
                  <textarea
                    rows={4}
                    value={profile?.bio || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p ? { ...p, bio: e.target.value } : null,
                      )
                    }
                    placeholder="Brief professional intro..."
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  />
                </Field>
              </div>
            </Section>

            {/* Company Details */}
            <Section
              title="Company profile"
              description="Company intelligence & market positioning"
              icon={Building2}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Company Name" icon={Building2}>
                  <input
                    type="text"
                    value={profile?.companies?.name || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                name: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Official Website" icon={Globe}>
                  <input
                    type="url"
                    value={profile?.companies?.website || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                website: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Headquarters" icon={MapPin}>
                  <input
                    type="text"
                    value={profile?.companies?.location || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                location: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Industry / Domain" icon={Tag}>
                  <input
                    type="text"
                    value={profile?.companies?.industry_category || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                industry_category: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    placeholder="e.g. Fintech, SaaS, HealthTech"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Core Sales Model" icon={Target}>
                  <select
                    value={profile?.companies?.sales_model || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                sales_model: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                  >
                    <option value="">Select Model</option>
                    <option value="Inbound">Inbound Intelligence</option>
                    <option value="Outbound">Outbound Strategy</option>
                    <option value="Hybrid">Hybrid Ecosystem</option>
                  </select>
                </Field>
                <Field label="Avg. Deal Size" icon={DollarSign}>
                  <select
                    value={profile?.companies?.avg_deal_size_range || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              companies: {
                                ...p.companies,
                                avg_deal_size_range: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none"
                  >
                    <option value="">Range Configuration</option>
                    <option value="< $10k">Under $10k</option>
                    <option value="$10k - $50k">$10k - $50k</option>
                    <option value="$50k - $150k">$50k - $150k</option>
                    <option value="$150k+">$150k Enterprise</option>
                  </select>
                </Field>
                <Field label="Company Mission" icon={FileText} fullWidth>
                  <div className="relative group">
                    <textarea
                      rows={4}
                      value={profile?.companies?.description || ""}
                      onChange={(e) =>
                        setProfile((p) =>
                          p
                            ? {
                                ...p,
                                companies: {
                                  ...p.companies,
                                  description: e.target.value,
                                },
                              }
                            : null,
                        )
                      }
                      placeholder="What makes your company a great place for sales talent?"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                    />
                    <button
                      type="button"
                      onClick={handleSuggestBio}
                      disabled={generatingBio}
                      className="absolute right-4 top-4 px-3 py-1.5 bg-primary-light text-primary rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary hover:text-white transition-all shadow-sm border border-primary-light disabled:opacity-50"
                    >
                      {generatingBio ? (
                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      {generatingBio ? "SYNTHESIZING..." : "AI SUGGEST"}
                    </button>
                  </div>
                </Field>
              </div>
            </Section>

            {/* Professional Persona - AI Enhanced */}
            <Section title="Professional Persona" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Years Recruiting" icon={Briefcase}>
                  <input
                    type="number"
                    value={profile?.professional_persona?.years_experience || 0}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              professional_persona: {
                                ...(p.professional_persona || {
                                  focus_areas: [],
                                  years_experience: 0,
                                  preferred_hiring_style: "",
                                  languages: [],
                                }),
                                years_experience: parseInt(e.target.value),
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none"
                  />
                </Field>
                <Field label="Hiring Style" icon={Target}>
                  <select
                    value={profile?.professional_persona?.preferred_hiring_style || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              professional_persona: {
                                ...(p.professional_persona || {
                                  focus_areas: [],
                                  years_experience: 0,
                                  preferred_hiring_style: "",
                                  languages: [],
                                }),
                                preferred_hiring_style: e.target.value,
                              },
                            }
                          : null,
                      )
                    }
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none appearance-none"
                  >
                    <option value="">Select Style</option>
                    <option value="Aggressive">Aggressive Growth</option>
                    <option value="Measured">Measured Quality</option>
                    <option value="Data-Driven">Data-Driven Precision</option>
                    <option value="Relationship">Relationship Centric</option>
                  </select>
                </Field>
                <Field label="Primary Language" icon={Globe}>
                  <input
                    type="text"
                    value={profile?.professional_persona?.languages?.[0] || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              professional_persona: {
                                ...(p.professional_persona || {
                                  focus_areas: [],
                                  years_experience: 0,
                                  preferred_hiring_style: "",
                                  languages: [],
                                }),
                                languages: [e.target.value],
                              },
                            }
                          : null,
                      )
                    }
                    placeholder="e.g. English, Spanish"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Recruitment Specialization" icon={Tag}>
                  <input
                    type="text"
                    value={profile?.professional_persona?.focus_areas?.join(", ") || ""}
                    onChange={(e) =>
                      setProfile((p) =>
                        p
                          ? {
                              ...p,
                              professional_persona: {
                                ...(p.professional_persona || {
                                  focus_areas: [],
                                  years_experience: 0,
                                  preferred_hiring_style: "",
                                  languages: [],
                                }),
                                focus_areas: e.target.value.split(",").map(s => s.trim()),
                              },
                            }
                          : null,
                      )
                    }
                    placeholder="e.g. Technical Sales, Account Management"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all outline-none"
                  />
                </Field>
              </div>
            </Section>

            {/* Sticky Actions */}
            <div className="fixed bottom-0 left-64 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-6 z-30 flex justify-center shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
              <div className="max-w-5xl w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/recruiter")}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Discard changes
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="relative group overflow-hidden px-10 py-2.5 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-primary-light active:scale-95 disabled:opacity-70"
                >
                  <span className="relative z-10">
                    {saving ? "SAVING..." : "UPDATE"}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-4xl border border-slate-200 p-10 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
      <div className="mb-10">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4 mb-2">
          <div className="p-3 bg-primary-light rounded-2xl text-primary shadow-sm border border-primary-light/50">
            <Icon className="w-6 h-6" />
          </div>
          {title}
        </h2>
        {description && (
          <p className="text-slate-500 font-medium ml-16">{description}</p>
        )}
      </div>
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
    <div className={fullWidth ? "md:col-span-2" : "group"}>
      <label className="flex items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
        <Icon className="w-3.5 h-3.5 mr-2 opacity-70" />
        {label}
      </label>
      {children}
    </div>
  );
}

