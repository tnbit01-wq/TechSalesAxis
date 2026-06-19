"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import Image from "next/image";
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle2,
  DollarSign,
  Globe,
  GraduationCap,
  Linkedin,
  MapPin,
  Phone,
  PlusCircle,
  Share2,
  ShieldCheck,
  Target,
  Trash2,
  Users,
  User,
} from "lucide-react";

interface EducationEntry {
  degree: string;
  field: string;
  institution: string;
  start_date: string;
  end_date: string;
  gpa_score: number | null | string;
}

interface ExperienceEntry {
  role: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  descriptions: string[];
}

interface CareerGapReport {
  has_gap_exceeding_6mo?: boolean;
  has_gap_exceeding_12mo?: boolean;
  total_gap_months?: number;
  explanation?: string;
  confidence_score?: number;
}

interface ProfileData {
  full_name?: string;
  phone_number?: string;
  bio?: string;
  profile_photo_url?: string;
  current_role?: string;
  target_role?: string;
  long_term_goal?: string;
  years_of_experience?: number;
  primary_industry_focus?: string;
  current_employment_status?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  job_type?: string;
  expected_salary?: number;
  assessment_status?: string;
  completion_score?: number;
  experience?: string;
  gender?: string;
  birthdate?: string;
  referral?: string;
  location?: string;
  education_history?: EducationEntry[];
  experience_history?: ExperienceEntry[];
  career_gap_report?: CareerGapReport;
}

export default function CandidateProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }
        const data = await apiClient.get("/candidate/profile", token);
        setProfile(data);
      } catch (error) {
        console.error("Fetch profile error:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let nextValue: string | number | null = value;
    if (type === "number") {
      nextValue = value === "" ? null : Number(value);
    }
    setProfile((prev) => (prev ? { ...prev, [name]: nextValue } : null));
  };

  const handleArrayInputChange = (field: "education_history" | "experience_history", index: number, name: string, value: any) => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history[index] = { ...history[index], [name]: value } as EducationEntry | ExperienceEntry;
      return { ...prev, [field]: history };
    });
  };

  const addHistoryItem = (field: "education_history" | "experience_history") => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history.push(
        field === "education_history"
          ? { degree: "", field: "", institution: "", start_date: "", end_date: "", gpa_score: null }
          : { role: "", company: "", location: "", start_date: "", end_date: "", is_current: false, descriptions: [""] },
      );
      return { ...prev, [field]: history };
    });
  };

  const removeHistoryItem = (field: "education_history" | "experience_history", index: number) => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];
      history.splice(index, 1);
      return { ...prev, [field]: history };
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post("/storage/upload/profile-photo", formData, token);
      const publicUrl = data.url;

      setProfile((prev) => (prev ? { ...prev, profile_photo_url: publicUrl } : null));
      await apiClient.patch("/candidate/profile", { profile_photo_url: publicUrl }, token);
      setMessage({ type: "success", text: "Profile photo updated." });
    } catch (error: any) {
      console.error("Upload error:", error);
      setMessage({ type: "error", text: error.message || "Failed to upload photo" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken() || undefined;
      const result = await apiClient.patch("/candidate/profile", profile, token);
      setProfile((prev) => (prev ? { ...prev, completion_score: result.completion_score } : null));
      setMessage({ type: "success", text: "Profile settings saved successfully." });
    } catch (error: any) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: error.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleRetakeAssessment = async () => {
    if (!confirm("Are you sure you want to reset your evaluation? This will permanently delete your scores and insights.")) return;
    try {
      const token = awsAuth.getToken() || undefined;
      await apiClient.post("/assessment/retake", {}, token);
      router.push("/assessment/candidate");
    } catch (error) {
      console.error("Retake error:", error);
      alert("Failed to reset evaluation. Please try again.");
    }
  };

  const experienceControl = profile?.assessment_status === "completed" ? (
    <LockedValue value={profile?.experience?.toUpperCase() || "NOT SET"} />
  ) : (
    <SelectInput name="experience" value={profile?.experience || "fresher"} onChange={handleInputChange} options={["fresher", "mid", "senior", "leadership"]} labels={["Fresher", "Mid-Level", "Senior", "Leadership"]} />
  );

  const yearsControl = profile?.assessment_status === "completed" ? (
    <LockedValue value={`${profile?.years_of_experience || 0} Years`} />
  ) : (
    <TextInput type="number" name="years_of_experience" value={profile?.years_of_experience || 0} onChange={handleInputChange} />
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/50">
      <main className="h-[calc(100vh-5rem)] min-h-0 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-6 px-4 py-6 lg:px-6">
          {message && (
            <div className={`rounded-2xl border p-4 shadow-sm ${message.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className={`h-5 w-5 ${message.type === "success" ? "text-emerald-500" : "text-rose-500"}`} />
                <p className="text-sm font-bold">{message.text}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:min-h-0">
            <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-[28px] border border-orange-100/80 bg-white p-6 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
                <div className="flex items-center gap-4">
                  <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF8A00] to-[#FFB366] text-white shadow-lg shadow-orange-200">
                    {profile?.profile_photo_url ? <Image src={profile.profile_photo_url} alt="Profile" fill sizes="64px" className="object-cover" /> : <User className="h-8 w-8" />}
                    {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF8A00] border-t-transparent" /></div>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Candidate Profile</p>
                    <h1 className="mt-1 truncate text-2xl font-black text-slate-900">Profile</h1>
                    <p className="text-sm text-slate-500">Edit your public presence and career story.</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <StatCard label="Completion" value={`${profile?.completion_score || 0}%`} />
                  <StatCard label="Assessment" value={profile?.assessment_status || "In progress"} />
                  <StatCard label="Experience" value={`${profile?.years_of_experience || 0} years`} />
                </div>
                <div className="mt-6 flex items-center gap-3">
                  <button type="button" onClick={() => router.push("/dashboard/candidate")} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-white"><ArrowLeft className="mr-2 inline-block h-4 w-4" />Dashboard</button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-[#FF8A00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#E67A00]">Upload photo</button>
                </div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
              </div>

              <div className="rounded-[28px] border border-orange-100/80 bg-white p-6 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Quick Links</p>
                <button type="button" onClick={handleRetakeAssessment} className="mt-4 w-full rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-left text-sm font-bold text-rose-600 transition-all hover:bg-rose-100">Reset evaluation</button>
              </div>
            </aside>

            <div className="space-y-8 min-w-0 pb-8">
              <form onSubmit={handleSubmit} className="space-y-8">
                <Section title="Personal details" description="Your identity and contact information" icon={User}>
                  <div className="flex flex-col gap-10 md:flex-row md:items-start">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-slate-100 transition-all hover:border-[#FF8A00] hover:bg-white">
                      {profile?.profile_photo_url ? <Image src={profile.profile_photo_url} alt="Profile" fill sizes="128px" className="object-cover" /> : <PlusCircle className="h-8 w-8 text-slate-300" />}
                    </button>
                    <div className="grid w-full grid-cols-1 gap-8 md:grid-cols-2">
                      <Field label="Full Name" icon={User}><TextInput name="full_name" value={profile?.full_name || ""} onChange={handleInputChange} /></Field>
                      <Field label="Phone Number" icon={Phone}><TextInput name="phone_number" value={profile?.phone_number || ""} onChange={handleInputChange} placeholder="+1 (555) 000-0000" /></Field>
                      <Field label="Location" icon={MapPin}><TextInput name="location" value={profile?.location || ""} onChange={handleInputChange} placeholder="e.g. New York, USA" /></Field>
                      <Field label="Birthdate" icon={Calendar}><TextInput type="date" name="birthdate" value={profile?.birthdate || ""} onChange={handleInputChange} /></Field>
                      <Field label="Gender" icon={Users}><SelectInput name="gender" value={profile?.gender || ""} onChange={handleInputChange} options={["", "male", "female", "other", "prefer_not_to_say"]} labels={["Select Gender", "Male", "Female", "Other", "Prefer Not to Say"]} /></Field>
                      <Field label="Employment Status" icon={Briefcase}><SelectInput name="current_employment_status" value={profile?.current_employment_status || ""} onChange={handleInputChange} options={["", "Employed", "Unemployed", "Student"]} labels={["Select Status", "Currently Employed", "Unemployed", "Student"]} /></Field>
                      <Field label="Referral Source" icon={Share2}><TextInput name="referral" value={profile?.referral || ""} onChange={handleInputChange} placeholder="e.g. LinkedIn, Friend" /></Field>
                    </div>
                  </div>
                  <div className="mt-8"><Field label="Professional Summary" icon={Globe} fullWidth><textarea name="bio" rows={4} value={profile?.bio || ""} onChange={handleInputChange} placeholder="Briefly describe your professional journey..." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20" /></Field></div>
                </Section>

                <Section title="Career & Preferences" description="Your professional positioning and goals" icon={Briefcase}>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <Field label="Target Role" icon={Target}><TextInput name="target_role" value={profile?.target_role || ""} onChange={handleInputChange} placeholder="e.g. Senior Product Manager" /></Field>
                    <Field label="Long-term Goal" icon={Target}><textarea name="long_term_goal" rows={1} value={profile?.long_term_goal || ""} onChange={handleInputChange} placeholder="e.g. Lead a global team at a Fortune 500 company" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20" /></Field>
                    <Field label="Current Role" icon={Briefcase}><TextInput name="current_role" value={profile?.current_role || ""} onChange={handleInputChange} placeholder="e.g. Senior Software Engineer" /></Field>
                    <Field label="Experience level" icon={Target}>{experienceControl}</Field>
                    <Field label="Job Preference" icon={Globe}><SelectInput name="job_type" value={profile?.job_type || "onsite"} onChange={handleInputChange} options={["onsite", "remote", "hybrid"]} labels={["On-Site", "Remote", "Hybrid"]} /></Field>
                    <Field label="Expected Salary" icon={DollarSign}><TextInput type="number" name="expected_salary" value={profile?.expected_salary || ""} onChange={handleInputChange} placeholder="e.g. 100000" /></Field>
                    <Field label="Primary Industry" icon={Globe}><TextInput name="primary_industry_focus" value={profile?.primary_industry_focus || ""} onChange={handleInputChange} placeholder="e.g. Fintech, E-commerce" /></Field>
                    <Field label="Years of Experience" icon={Calendar}>{yearsControl}</Field>
                  </div>
                </Section>

                <Section title="Experience history" description="Your professional track record" icon={Briefcase}>
                  <div className="space-y-6">
                    {(profile?.experience_history || []).map((exp, index) => (
                      <div key={index} className="group relative rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                        <button type="button" onClick={() => removeHistoryItem("experience_history", index)} className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-rose-500"><Trash2 className="h-5 w-5" /></button>
                        <div className="mb-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                          <Field label="Role" icon={User}><TextInput value={exp.role || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "role", e.target.value)} /></Field>
                          <Field label="Company" icon={Globe}><TextInput value={exp.company || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "company", e.target.value)} /></Field>
                        </div>
                        <div className="mb-4 grid grid-cols-1 gap-6 md:grid-cols-3">
                          <Field label="Location" icon={MapPin}><TextInput value={exp.location || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "location", e.target.value)} /></Field>
                          <Field label="Start Month/Year" icon={Calendar}><TextInput value={exp.start_date || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "start_date", e.target.value)} placeholder="MM/YYYY" /></Field>
                          <Field label="End Month/Year" icon={Calendar}><TextInput value={exp.end_date || ""} onChange={(e) => handleArrayInputChange("experience_history", index, "end_date", e.target.value)} placeholder="MM/YYYY or Present" /></Field>
                        </div>
                        <div className="mt-4">
                          <div className="mb-2 flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key achievements</label>
                            <button type="button" onClick={() => handleArrayInputChange("experience_history", index, "descriptions", [...(exp.descriptions || []), ""])} className="flex items-center gap-1 text-[10px] font-black uppercase text-[#FF8A00] hover:text-[#E67A00]"><PlusCircle className="h-3 w-3" /> Add achievement</button>
                          </div>
                          <div className="space-y-3">
                            {(exp.descriptions || []).map((desc, dIdx) => (
                              <div key={dIdx} className="group/desc relative">
                                <textarea value={desc} onChange={(e) => { const next = [...(exp.descriptions || [])]; next[dIdx] = e.target.value; handleArrayInputChange("experience_history", index, "descriptions", next); }} rows={2} className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20" placeholder="Describe your impact and results..." />
                                <button type="button" onClick={() => { const next = [...(exp.descriptions || [])]; next.splice(dIdx, 1); handleArrayInputChange("experience_history", index, "descriptions", next); }} className="absolute right-2 top-2 opacity-0 transition-opacity hover:text-rose-500 group-hover/desc:opacity-100"><Trash2 className="h-3.5 w-3.5 text-slate-300" /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addHistoryItem("experience_history")} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-[#FF8A00]"><PlusCircle className="h-4 w-4" /> Add work experience</button>
                  </div>
                </Section>

                <Section title="Academic history" description="Degrees and educational background" icon={GraduationCap}>
                  <div className="space-y-6">
                    {(profile?.education_history || []).map((edu, index) => (
                      <div key={index} className="group relative rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                        <button type="button" onClick={() => removeHistoryItem("education_history", index)} className="absolute right-4 top-4 text-slate-300 transition-colors hover:text-rose-500"><Trash2 className="h-5 w-5" /></button>
                        <div className="mb-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                          <Field label="Institution" icon={Globe}><TextInput value={edu.institution || ""} onChange={(e) => handleArrayInputChange("education_history", index, "institution", e.target.value)} placeholder="University Name" /></Field>
                          <Field label="Degree" icon={GraduationCap}><TextInput value={edu.degree || ""} onChange={(e) => handleArrayInputChange("education_history", index, "degree", e.target.value)} placeholder="e.g. Bachelor of Science" /></Field>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                          <Field label="Field of Study" icon={Target}><TextInput value={edu.field || ""} onChange={(e) => handleArrayInputChange("education_history", index, "field", e.target.value)} placeholder="e.g. Computer Science" /></Field>
                          <Field label="Start Year" icon={Calendar}><TextInput value={edu.start_date || ""} onChange={(e) => handleArrayInputChange("education_history", index, "start_date", e.target.value)} placeholder="YYYY" /></Field>
                          <Field label="End Year" icon={Calendar}><TextInput value={edu.end_date || ""} onChange={(e) => handleArrayInputChange("education_history", index, "end_date", e.target.value)} placeholder="YYYY" /></Field>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addHistoryItem("education_history")} className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-[#FF8A00]"><PlusCircle className="h-4 w-4" /> Add education</button>
                  </div>
                </Section>

                <Section title="Digital presence" description="Links to your professional profiles" icon={Globe}>
                  <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    <Field label="LinkedIn Profile" icon={Linkedin}><div className="relative"><TextInput type="url" name="linkedin_url" value={profile?.linkedin_url || ""} onChange={handleInputChange} placeholder="https://linkedin.com/in/username" className="pl-10" /><Linkedin className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div></Field>
                    <Field label="Portfolio / Website" icon={Globe}><div className="relative"><TextInput type="url" name="portfolio_url" value={profile?.portfolio_url || ""} onChange={handleInputChange} placeholder="https://yourportfolio.com" className="pl-10" /><Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div></Field>
                  </div>
                </Section>

                {profile?.career_gap_report && (profile.career_gap_report.has_gap_exceeding_6mo || profile.career_gap_report.has_gap_exceeding_12mo) && (
                  <div className="rounded-[28px] border border-amber-200/60 bg-amber-50 p-8 shadow-sm">
                    <h3 className="mb-4 flex items-center gap-3 text-xl font-black text-amber-900"><ShieldCheck className="h-6 w-6" /> AI AUDIT: WORK GAPS</h3>
                    <p className="mb-6 text-sm font-medium leading-relaxed text-amber-800">{profile.career_gap_report.has_gap_exceeding_12mo ? "A gap of more than 12 months was detected in your experience history." : "A gap of more than 6 months was detected in your experience history."} Providing context help recruiters understand your journey better.</p>
                    <div className="inline-block rounded-xl border border-amber-200 bg-white/60 p-4"><span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-amber-600">Total Gap Months</span><span className="text-lg font-black text-amber-900">{profile.career_gap_report.total_gap_months || 0} Months</span></div>
                  </div>
                )}

                <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/85 px-4 py-4 backdrop-blur-xl lg:mx-0 lg:rounded-3xl lg:border lg:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <button type="button" onClick={() => router.push("/dashboard/candidate")} className="rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800">Discard changes</button>
                    <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-[#E67A00] disabled:opacity-70">{saving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {saving ? "Saving..." : "Save"}</button>
                  </div>
                </div>
              </form>

              <div className="rounded-[28px] border border-rose-100 bg-white p-8 shadow-sm">
                <h3 className="mb-4 flex items-center gap-3 text-xl font-black uppercase text-slate-900"><Trash2 className="h-6 w-6 text-rose-500" /> Evaluation Reset</h3>
                <p className="mb-8 max-w-xl text-sm font-medium leading-relaxed text-slate-500">Want to start fresh? Resetting your evaluation will <span className="font-bold italic text-rose-600 underline">permanently delete</span> all your current scores and AI insights.</p>
                <button onClick={handleRetakeAssessment} className="rounded-xl border-2 border-rose-100 bg-white px-8 py-3 text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all duration-300 hover:border-rose-500 hover:bg-rose-500 hover:text-white">Reset My Evaluation</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function TextInput({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 ${className}`} />;
}

function SelectInput({ options, labels, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: string[]; labels: string[] }) {
  return (
    <select {...props} className={`w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20 ${className}`}>
      {options.map((option, index) => <option key={option} value={option}>{labels[index]}</option>)}
    </select>
  );
}

function LockedValue({ value }: { value: string }) {
  return <div className="flex w-full cursor-not-allowed items-center justify-between rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700"><span>{value}</span><ShieldCheck className="h-4 w-4" /></div>;
}

function Section({ title, description, icon: Icon, children }: { title: string; description?: string; icon: React.ElementType; children: React.ReactNode; }) {
  return (
    <div className="rounded-4xl border border-slate-200 bg-white p-10 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50">
      <div className="mb-10">
        <h2 className="mb-2 flex items-center gap-4 text-2xl font-black text-slate-900"><div className="rounded-2xl border border-primary-light/50 bg-primary-light p-3 text-primary shadow-sm"><Icon className="h-6 w-6" /></div>{title}</h2>
        {description && <p className="ml-16 font-medium text-slate-500">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, icon: Icon, children, fullWidth = false }: { label: string; icon: React.ElementType; children: React.ReactNode; fullWidth?: boolean; }) {
  return (
    <div className={fullWidth ? "md:col-span-2" : "group"}>
      <label className="mb-3 ml-1 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors group-focus-within:text-[#FF8A00]"><Icon className="mr-2 h-3.5 w-3.5 opacity-70" />{label}</label>
      {children}
    </div>
  );
}