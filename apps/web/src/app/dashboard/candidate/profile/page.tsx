"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import Image from "next/image";
import CandidateHeader from "@/components/CandidateHeader";
import { 
  ShieldCheck, 
  User, 
  Briefcase, 
  GraduationCap, 
  Linkedin, 
  Globe, 
  MapPin, 
  DollarSign, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  ArrowLeft,
  Trash2,
  PlusCircle,
  Target,
  Users,
  Share2
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
  years_of_experience?: number;
  primary_industry_focus?: string;
  current_employment_status?: string;
  linkedin_url?: string;
  portfolio_url?: string;
  job_type?: string;
  expected_salary?: number;
  location_tier?: string;
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
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get(
          "/candidate/profile",
          token,
        );
        setProfile(data);
      } catch (err) {
        console.error("Fetch profile error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value, type } = e.target;
    let finalValue: string | number | null = value;

    if (type === "number") {
      finalValue = value === "" ? null : Number(value);
    }

    setProfile((prev) => (prev ? { ...prev, [name]: finalValue } : null));
  };

  const handleArrayInputChange = (
    field: "education_history" | "experience_history",
    index: number,
    name: string,
    value: any,
  ) => {
    setProfile((prev) => {
      if (!prev) return null;
      if (field === "education_history") {
        const history = [...(prev.education_history || [])];
        history[index] = { ...history[index], [name]: value } as EducationEntry;
        return { ...prev, education_history: history };
      } else {
        const history = [...(prev.experience_history || [])];
        history[index] = {
          ...history[index],
          [name]: value,
        } as ExperienceEntry;
        return { ...prev, experience_history: history };
      }
    });
  };

  const addHistoryItem = (
    field: "education_history" | "experience_history",
  ) => {
    setProfile((prev) => {
      if (!prev) return null;
      const history = [...(prev[field] || [])];

      const newItem =
        field === "education_history"
          ? {
              degree: "",
              field: "",
              institution: "",
              start_date: "",
              end_date: "",
              gpa_score: null,
            }
          : {
              role: "",
              company: "",
              location: "",
              start_date: "",
              end_date: "",
              is_current: false,
              descriptions: [""],
            };

      history.push(newItem as any);
      return { ...prev, [field]: history };
    });
  };

  const removeHistoryItem = (
    field: "education_history" | "experience_history",
    index: number,
  ) => {
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
      const user = awsAuth.getUser();
      if (!user) throw new Error("Not authenticated");
      const token = awsAuth.getToken();
      if (!token) throw new Error("No session found");

      const formData = new FormData();
      formData.append("file", file);

      const data = await apiClient.post(
        "/storage/upload/profile-photo",
        formData,
        token,
      );

      const publicUrl = data.url;

      setProfile((prev) =>
        prev ? { ...prev, profile_photo_url: publicUrl } : null,
      );

      await apiClient.patch(
        "/candidate/profile",
        { profile_photo_url: publicUrl },
        token,
      );

      setMessage({ type: "success", text: "Profile photo updated!" });
    } catch (err: any) {
      console.error("Upload error:", err);
      setMessage({ type: "error", text: err.message || "Failed to upload photo" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      const result = await apiClient.patch(
        "/candidate/profile",
        profile,
        token,
      );

      setProfile((prev) =>
        prev ? { ...prev, completion_score: result.completion_score } : null,
      );
      setMessage({ type: "success", text: "Profile settings saved successfully." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error("Save error:", err);
      setMessage({ type: "error", text: err.message || "Failed to save profile" });
    } finally {
      setSaving(false);
    }
  };

  const handleRetakeAssessment = async () => {
    if (
      !confirm(
        "Are you sure you want to reset your evaluation? This will permanently delete your scores and insights.",
      )
    )
      return;

    try {
      const token = awsAuth.getToken();
      await apiClient.post("/assessment/retake", {}, token);
      router.push("/assessment/candidate");
    } catch (err) {
      console.error("Retake error:", err);
      alert("Failed to reset evaluation. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">
            Loading Profile...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <CandidateHeader profile={profile} />
      <main className="flex flex-col">
        <div className="p-8 max-w-6xl mx-auto w-full font-sans">
          {/* Mirror Banner Card */}
          <div className="relative mb-10 overflow-hidden bg-slate-900 rounded-4xl p-10 shadow-2xl">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-linear-to-l from-primary/20 to-transparent pointer-none" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary/30 rounded-full blur-[80px]" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <h1 className="text-4xl font-black text-white tracking-tight mb-2">
                  Profile Settings
                </h1>
                <p className="text-slate-400 font-medium text-lg max-w-md">
                  Update your professional details, experience, and job preferences.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => router.push("/dashboard/candidate")}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3 h-3" /> Dashboard
                  </button>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10">
                <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mb-3">
                  Profile Completion
                </div>
                <div className="flex items-end gap-3 mb-2">
                  <div className="text-3xl font-black text-white">{profile?.completion_score || 0}%</div>
                  <div className="text-primary text-xs font-bold mb-1">
                    READY
                  </div>
                </div>
                <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-700" style={{ width: `${profile?.completion_score || 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 pb-32">
            {message?.text && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm transition-all animate-in fade-in slide-in-from-top-4 ${
                  message.type === "success"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-rose-50 border-rose-100 text-rose-800"
                }`}
              >
                {message.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <ShieldCheck className="w-5 h-5 text-rose-500" />}
                <p className="text-sm font-bold tracking-tight">
                  {message.text}
                </p>
              </div>
            )}

            {/* Basic Info Section */}
            <Section title="Personal details" description="Your identity and contact information" icon={User}>
              <div className="flex flex-col md:flex-row gap-10 items-start">
                <div className="flex flex-col items-center gap-4 group">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="h-32 w-32 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden relative transition-all group-hover:border-primary group-hover:bg-white"
                  >
                    {profile?.profile_photo_url ? (
                      <Image 
                        src={profile.profile_photo_url} 
                        alt="Profile" 
                        fill 
                        sizes="128px"
                        className="object-cover" 
                      />
                    ) : (
                      <PlusCircle className="h-8 w-8 text-slate-300" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 group-hover:text-primary transition-colors">
                    {uploading ? "Uploading..." : "Click to change photo"}
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  <Field label="Full Name" icon={User}>
                    <input
                      type="text"
                      name="full_name"
                      value={profile?.full_name || ""}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </Field>
                  <Field label="Phone Number" icon={Phone}>
                    <input
                      type="text"
                      name="phone_number"
                      value={profile?.phone_number || ""}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 000-0000"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </Field>
                  <Field label="Location" icon={MapPin}>
                    <input
                      type="text"
                      name="location"
                      value={profile?.location || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. New York, USA"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </Field>
                  <Field label="Birthdate" icon={Calendar}>
                    <input
                      type="date"
                      name="birthdate"
                      value={profile?.birthdate || ""}
                      onChange={handleInputChange}
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                    />
                  </Field>
                  <Field label="Gender" icon={Users}>
                    <select
                      name="gender"
                      value={profile?.gender || ""}
                      onChange={handleInputChange}
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer Not to Say</option>
                    </select>
                  </Field>
                  <Field label="Employment Status" icon={Briefcase}>
                    <select
                      name="current_employment_status"
                      value={profile?.current_employment_status || ""}
                      onChange={handleInputChange}
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select Status</option>
                      <option value="Employed">Currently Employed</option>
                      <option value="Unemployed">Unemployed</option>
                      <option value="Student">Student</option>
                    </select>
                  </Field>
                  <Field label="Referral Source" icon={Share2}>
                    <input
                      type="text"
                      name="referral"
                      value={profile?.referral || ""}
                      onChange={handleInputChange}
                      placeholder="e.g. LinkedIn, Friend, LinkedIn"
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-8">
                <Field label="Professional Summary" icon={Globe} fullWidth>
                  <textarea
                    name="bio"
                    rows={4}
                    value={profile?.bio || ""}
                    onChange={handleInputChange}
                    placeholder="Briefly describe your professional journey..."
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  />
                </Field>
              </div>
            </Section>

            {/* Career Details Section */}
            <Section title="Career & Preferences" description="Your professional positioning and goals" icon={Briefcase}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Field label="Target Role" icon={Target}>
                  <input
                    type="text"
                    name="target_role"
                    value={profile?.target_role || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. Senior Product Manager"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Long-term Goal" icon={Target}>
                  <textarea
                    name="long_term_goal"
                    rows={1}
                    value={profile?.long_term_goal || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. Lead a global team at a Fortune 500 company"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  />
                </Field>
                <Field label="Current Role" icon={Briefcase}>
                  <input
                    type="text"
                    name="current_role"
                    value={profile?.current_role || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. Senior Software Engineer"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Experience level" icon={Target}>
                   {profile?.assessment_status === "completed" ? (
                    <div className="w-full bg-slate-100 border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 cursor-not-allowed flex justify-between items-center group/lock">
                      <span>{profile?.experience?.toUpperCase() || "NOT SET"}</span>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  ) : (
                    <select
                      name="experience"
                      value={profile?.experience || "fresher"}
                      onChange={handleInputChange}
                      className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                    >
                      <option value="fresher">Fresher</option>
                      <option value="mid">Mid-Level</option>
                      <option value="senior">Senior</option>
                      <option value="leadership">Leadership</option>
                    </select>
                  )}
                </Field>
                <Field label="Job Preference" icon={Globe}>
                  <select
                    name="job_type"
                    value={profile?.job_type || "onsite"}
                    onChange={handleInputChange}
                    className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                  >
                    <option value="onsite">On-Site</option>
                    <option value="remote">Remote</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </Field>
                <Field label="Expected Salary" icon={DollarSign}>
                  <input
                    type="number"
                    name="expected_salary"
                    value={profile?.expected_salary || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. 100000"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Primary Industry" icon={Globe}>
                  <input
                    type="text"
                    name="primary_industry_focus"
                    value={profile?.primary_industry_focus || ""}
                    onChange={handleInputChange}
                    placeholder="e.g. Fintech, E-commerce"
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </Field>
                <Field label="Years of Experience" icon={Calendar}>
                   {profile?.assessment_status === "completed" ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 cursor-not-allowed flex justify-between items-center group/lock">
                      <span>{profile?.years_of_experience || 0} Years</span>
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  ) : (
                    <input
                      type="number"
                      name="years_of_experience"
                      value={profile?.years_of_experience || 0}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    />
                  )}
                </Field>
              </div>
            </Section>

            {/* Work Experience Section */}
            <Section 
              title="Experience history" 
              description="Your professional track record" 
              icon={Briefcase}
            >
              <div className="space-y-6">
                {(profile?.experience_history || []).map((exp, index) => (
                  <div key={index} className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl relative group transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                    <button
                      type="button"
                      onClick={() => removeHistoryItem("experience_history", index)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <Field label="Role" icon={User}>
                        <input
                          type="text"
                          value={exp.role || ""}
                          onChange={(e) => handleArrayInputChange("experience_history", index, "role", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="Company" icon={Globe}>
                        <input
                          type="text"
                          value={exp.company || ""}
                          onChange={(e) => handleArrayInputChange("experience_history", index, "company", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                      <Field label="Location" icon={MapPin}>
                        <input
                          type="text"
                          value={exp.location || ""}
                          onChange={(e) => handleArrayInputChange("experience_history", index, "location", e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="Start Month/Year" icon={Calendar}>
                        <input
                          type="text"
                          value={exp.start_date || ""}
                          onChange={(e) => handleArrayInputChange("experience_history", index, "start_date", e.target.value)}
                          placeholder="MM/YYYY"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="End Month/Year" icon={Calendar}>
                        <input
                          type="text"
                          value={exp.end_date || ""}
                          onChange={(e) => handleArrayInputChange("experience_history", index, "end_date", e.target.value)}
                          placeholder="MM/YYYY or Present"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                    </div>
                    <div className="mt-4">
                       <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Key achievements</label>
                        <button
                          type="button"
                          onClick={() => {
                            const newDescs = [...(exp.descriptions || []), ""];
                            handleArrayInputChange("experience_history", index, "descriptions", newDescs);
                          }}
                          className="text-[10px] font-black text-primary hover:text-indigo-800 uppercase flex items-center gap-1"
                        >
                          <PlusCircle className="w-3 h-3" /> Add achievement
                        </button>
                       </div>
                       <div className="space-y-3">
                          {(exp.descriptions || []).map((desc, dIdx) => (
                            <div key={dIdx} className="relative group/desc">
                              <textarea
                                value={desc}
                                onChange={(e) => {
                                  const newDescs = [...(exp.descriptions || [])];
                                  newDescs[dIdx] = e.target.value;
                                  handleArrayInputChange("experience_history", index, "descriptions", newDescs);
                                }}
                                rows={2}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                                placeholder="Describe your impact and results..."
                              />
                               <button
                                type="button"
                                onClick={() => {
                                  const newDescs = [...(exp.descriptions || [])];
                                  newDescs.splice(dIdx, 1);
                                  handleArrayInputChange("experience_history", index, "descriptions", newDescs);
                                }}
                                className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover/desc:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                       </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addHistoryItem("experience_history")}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold uppercase tracking-widest hover:border-indigo-300 hover:text-primary hover:bg-primary-light/30 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add work experience
                </button>
              </div>
            </Section>

            {/* Academic Section */}
            <Section title="Academic history" description="Degrees and educational background" icon={GraduationCap}>
               <div className="space-y-6">
                {(profile?.education_history || []).map((edu, index) => (
                  <div key={index} className="p-6 bg-slate-50/50 border border-slate-200 rounded-2xl relative group transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50">
                    <button
                      type="button"
                      onClick={() => removeHistoryItem("education_history", index)}
                      className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      <Field label="Institution" icon={Globe}>
                        <input
                          type="text"
                          value={edu.institution || ""}
                          onChange={(e) => handleArrayInputChange("education_history", index, "institution", e.target.value)}
                          placeholder="University Name"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="Degree" icon={GraduationCap}>
                        <input
                          type="text"
                          value={edu.degree || ""}
                          onChange={(e) => handleArrayInputChange("education_history", index, "degree", e.target.value)}
                          placeholder="e.g. Bachelor of Science"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                       <Field label="Field of Study" icon={Target}>
                        <input
                          type="text"
                          value={edu.field || ""}
                          onChange={(e) => handleArrayInputChange("education_history", index, "field", e.target.value)}
                          placeholder="e.g. Computer Science"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="Start Year" icon={Calendar}>
                         <input
                          type="text"
                          value={edu.start_date || ""}
                          onChange={(e) => handleArrayInputChange("education_history", index, "start_date", e.target.value)}
                          placeholder="YYYY"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                      <Field label="End Year" icon={Calendar}>
                         <input
                          type="text"
                          value={edu.end_date || ""}
                          onChange={(e) => handleArrayInputChange("education_history", index, "end_date", e.target.value)}
                          placeholder="YYYY"
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addHistoryItem("education_history")}
                  className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold uppercase tracking-widest hover:border-indigo-300 hover:text-primary hover:bg-primary-light/30 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" /> Add education
                </button>
               </div>
            </Section>

            {/* Digital Presence Section */}
            <Section title="Digital presence" description="Links to your professional profiles" icon={Globe}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Field label="LinkedIn Profile" icon={Linkedin}>
                    <div className="relative">
                      <input
                        type="url"
                        name="linkedin_url"
                        value={profile?.linkedin_url || ""}
                        onChange={handleInputChange}
                        placeholder="https://linkedin.com/in/username"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                      <Linkedin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </Field>
                  <Field label="Portfolio / Website" icon={Globe}>
                    <div className="relative">
                      <input
                        type="url"
                        name="portfolio_url"
                        value={profile?.portfolio_url || ""}
                        onChange={handleInputChange}
                        placeholder="https://yourportfolio.com"
                        className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      />
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    </div>
                  </Field>
               </div>
            </Section>

            {/* Career Gap Report (Conditional) */}
            {profile?.career_gap_report && (profile.career_gap_report.has_gap_exceeding_6mo || profile.career_gap_report.has_gap_exceeding_12mo) && (
              <div className="bg-amber-50 rounded-4xl p-8 border border-amber-200/60 shadow-sm">
                <h3 className="text-xl font-black text-amber-900 mb-4 flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6" />
                   AI AUDIT: WORK GAPS
                </h3>
                <p className="text-sm font-medium text-amber-800 leading-relaxed mb-6">
                  {profile.career_gap_report.has_gap_exceeding_12mo 
                    ? "A gap of more than 12 months was detected in your experience history." 
                    : "A gap of more than 6 months was detected in your experience history."}
                  Providing context help recruiters understand your journey better.
                </p>
                <div className="bg-white/60 p-4 rounded-xl border border-amber-200 inline-block">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest block mb-1">Total Gap Months</span>
                  <span className="text-lg font-black text-amber-900">{profile.career_gap_report.total_gap_months || 0} Months</span>
                </div>
              </div>
            )}

            {/* Mirror Sticky Actions */}
            <div className="fixed bottom-0 left-64 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 p-6 z-30 flex justify-center shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
              <div className="max-w-5xl w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/candidate")}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Discard changes
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="relative group overflow-hidden px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs uppercase tracking-[0.15em] hover:bg-primary-dark transition-all shadow-lg shadow-primary-light/50 active:scale-95 disabled:opacity-70 flex items-center gap-2"
                >
                   {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {saving ? "SAVING..." : "SAVE"}
                </button>
              </div>
            </div>
          </form>

          {/* Danger Zone */}
          <div className="bg-white rounded-4xl p-10 shadow-sm border border-rose-50 relative overflow-hidden mb-20">
            <h3 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-3 uppercase">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Evaluation Reset
            </h3>
            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 max-w-xl">
              Want to start fresh? Resetting your evaluation will <span className="text-rose-600 font-bold underline italic">permanently delete</span> all your current scores and AI insights.
            </p>
            <button
              onClick={handleRetakeAssessment}
              className="px-8 py-3 bg-white border-2 border-rose-100 text-rose-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all duration-300"
            >
              Reset My Evaluation
            </button>
          </div>
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

