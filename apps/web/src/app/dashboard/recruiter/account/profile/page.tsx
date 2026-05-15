"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  FileText,
  Globe,
  Linkedin,
  MapPin,
  ShieldCheck,
  Target,
  User,
  Tag,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface Company {
  id?: string;
  name?: string;
  website?: string;
  location?: string;
  description?: string;
  domain?: string;
  industry_category?: string;
  sales_model?: string;
  avg_deal_size_range?: string;
  hiring_focus_areas?: string[];
}

interface RecruiterProfile {
  full_name?: string;
  job_title?: string;
  linkedin_url?: string;
  bio?: string;
  company_id?: string;
  companies?: Company;
  is_verified?: boolean;
  assessment_status?: string;
  completion_score?: number;
  team_role?: string;
  professional_persona?: {
    focus_areas?: string[];
    years_experience?: number;
    preferred_hiring_style?: string;
    languages?: string[];
  };
}

const emptyCompany: Company = {
  name: "",
  website: "",
  location: "",
  description: "",
  domain: "",
  industry_category: "",
  sales_model: "",
  avg_deal_size_range: "",
  hiring_focus_areas: [],
};

const emptyPersona = {
  focus_areas: [] as string[],
  years_experience: 0,
  preferred_hiring_style: "",
  languages: [] as string[],
};

export default function RecruiterProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RecruiterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          router.replace("/login");
          return;
        }

        const data = await apiClient.get("/recruiter/profile", token);
        setProfile(data);
      } catch (error) {
        console.error("Failed to load recruiter profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const updateProfile = (patch: Partial<RecruiterProfile>) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  };

  const updateCompany = (patch: Partial<Company>) => {
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        companies: {
          ...(current.companies || emptyCompany),
          ...patch,
        },
      };
    });
  };

  const updatePersona = (patch: Partial<NonNullable<RecruiterProfile["professional_persona"]>>) => {
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        professional_persona: {
          ...(current.professional_persona || emptyPersona),
          ...patch,
        },
      };
    });
  };

  const handleSuggestBio = async () => {
    const website = profile?.companies?.website;
    if (!website) {
      setMessage({ type: "error", text: "Add a website first to generate a bio." });
      return;
    }

    setGeneratingBio(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const response = await apiClient.post("/recruiter/generate-bio", { website }, token);
      if (response.bio) {
        updateCompany({ description: response.bio });
        setMessage({ type: "success", text: "Bio suggested from your website." });
      }
    } catch (error) {
      console.error("Bio generation failed:", error);
      setMessage({ type: "error", text: "Failed to generate bio." });
    } finally {
      setGeneratingBio(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const token = awsAuth.getToken() || undefined;
      const result = await apiClient.patch("/recruiter/profile", profile, token);
      if (result?.completion_score !== undefined) {
        setProfile((current) => (current ? { ...current, completion_score: result.completion_score } : current));
      }
      setMessage({ type: "success", text: "Profile updated successfully." });
    } catch (error: any) {
      console.error("Save error:", error);
      setMessage({ type: "error", text: error.message || "Failed to save recruiter profile." });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    awsAuth.logout();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#FF8A00]" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50/40">
      <main className="h-[calc(100vh-5rem)] min-h-0 overflow-y-auto">
        <div className="mx-auto grid min-h-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-6">
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-[28px] border border-orange-100/80 bg-white p-6 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Recruiter Profile</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">Profile</h1>
              <p className="mt-2 text-sm text-slate-500">A focused editor for your identity, company, and hiring style.</p>

              <div className="mt-6 space-y-3">
                <StatCard label="Completion" value={`${profile?.completion_score || 0}%`} />
                <StatCard label="Status" value={profile?.assessment_status || "In progress"} />
                <StatCard label="Role" value={profile?.team_role || "Recruiter"} />
              </div>

              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => router.push("/dashboard/recruiter")} className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-white">Dashboard</button>
                <button type="button" onClick={handleLogout} className="rounded-2xl bg-[#FF8A00] px-4 py-3 text-sm font-bold text-white transition-all hover:bg-[#E67A00]">Logout</button>
              </div>
            </div>

            <div className="rounded-[28px] border border-orange-100/80 bg-white p-6 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Quick action</p>
              <button type="button" onClick={handleSuggestBio} disabled={generatingBio} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-white disabled:opacity-50">
                {generatingBio ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF8A00] border-t-transparent" /> : <CheckCircle2 className="h-4 w-4" />}
                {generatingBio ? "Synthesizing..." : "AI suggest bio"}
              </button>
            </div>
          </aside>

          <div className="space-y-6 min-w-0 pb-8">
            {message && (
              <div className={`rounded-2xl border p-4 shadow-sm ${message.type === "success" ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-rose-100 bg-rose-50 text-rose-800"}`}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className={`h-5 w-5 ${message.type === "success" ? "text-emerald-500" : "text-rose-500"}`} />
                  <p className="text-sm font-bold">{message.text}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <Section title="Identity & pitch" description="Who you are and how you introduce yourself" icon={User}>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <Field label="Full Name" icon={User}><TextInput value={profile?.full_name || ""} onChange={(e) => updateProfile({ full_name: e.target.value })} placeholder="Recruiter name" /></Field>
                  <Field label="Job Title" icon={Briefcase}><TextInput value={profile?.job_title || ""} onChange={(e) => updateProfile({ job_title: e.target.value })} placeholder="Talent Acquisition Lead" /></Field>
                  <Field label="LinkedIn" icon={Linkedin}><TextInput value={profile?.linkedin_url || ""} onChange={(e) => updateProfile({ linkedin_url: e.target.value })} placeholder="linkedin.com/in/username" /></Field>
                  <Field label="Team Role" icon={ShieldCheck}><TextInput value={profile?.team_role || ""} onChange={(e) => updateProfile({ team_role: e.target.value })} placeholder="Hiring manager, recruiter, coordinator" /></Field>
                  <Field label="Professional Pitch" icon={FileText} fullWidth><textarea rows={4} value={profile?.bio || ""} onChange={(e) => updateProfile({ bio: e.target.value })} placeholder="Brief professional intro..." className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20" /></Field>
                </div>
              </Section>

              <Section title="Company profile" description="Company intelligence and market positioning" icon={Building2}>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <Field label="Company Name" icon={Building2}><TextInput value={profile?.companies?.name || ""} onChange={(e) => updateCompany({ name: e.target.value })} /></Field>
                  <Field label="Official Website" icon={Globe}><TextInput value={profile?.companies?.website || ""} onChange={(e) => updateCompany({ website: e.target.value })} placeholder="https://company.com" /></Field>
                  <Field label="Headquarters" icon={MapPin}><TextInput value={profile?.companies?.location || ""} onChange={(e) => updateCompany({ location: e.target.value })} placeholder="City, Country" /></Field>
                  <Field label="Industry / Domain" icon={Tag}><TextInput value={profile?.companies?.industry_category || ""} onChange={(e) => updateCompany({ industry_category: e.target.value })} placeholder="Fintech, SaaS, HealthTech" /></Field>
                  <Field label="Core Sales Model" icon={Target}><SelectInput value={profile?.companies?.sales_model || ""} onChange={(e) => updateCompany({ sales_model: e.target.value })} options={["", "Inbound", "Outbound", "Hybrid"]} labels={["Select Model", "Inbound Intelligence", "Outbound Strategy", "Hybrid Ecosystem"]} /></Field>
                  <Field label="Avg. Deal Size" icon={DollarSign}><SelectInput value={profile?.companies?.avg_deal_size_range || ""} onChange={(e) => updateCompany({ avg_deal_size_range: e.target.value })} options={["", "under_10k", "10k_50k", "50k_150k", "150k_plus"]} labels={["Range Configuration", "Under $10k", "$10k - $50k", "$50k - $150k", "$150k Enterprise"]} /></Field>
                  <Field label="Company Mission" icon={FileText} fullWidth>
                    <div className="relative">
                      <textarea rows={4} value={profile?.companies?.description || ""} onChange={(e) => updateCompany({ description: e.target.value })} placeholder="What makes your company a great place for sales talent?" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-28 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/20" />
                      <button type="button" onClick={handleSuggestBio} disabled={generatingBio} className="absolute right-4 top-4 rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-white disabled:opacity-50">{generatingBio ? "Working..." : "AI Suggest"}</button>
                    </div>
                  </Field>
                </div>
              </Section>

              <Section title="Professional persona" description="How you recruit and who you recruit for" icon={User}>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                  <Field label="Years Recruiting" icon={Briefcase}><TextInput type="number" value={profile?.professional_persona?.years_experience || 0} onChange={(e) => updatePersona({ years_experience: parseInt(e.target.value) || 0 })} /></Field>
                  <Field label="Hiring Style" icon={Target}><SelectInput value={profile?.professional_persona?.preferred_hiring_style || ""} onChange={(e) => updatePersona({ preferred_hiring_style: e.target.value })} options={["", "consultative", "directive", "collaborative"]} labels={["Select Style", "Consultative", "Directive", "Collaborative"]} /></Field>
                  <Field label="Focus Areas" icon={Tag} fullWidth><TextInput value={profile?.professional_persona?.focus_areas?.join(", ") || ""} onChange={(e) => updatePersona({ focus_areas: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Sales leadership, SDRs, enterprise sellers" /></Field>
                </div>
              </Section>

              <div className="sticky bottom-0 z-20 -mx-4 border-t border-slate-200 bg-white/85 px-4 py-4 backdrop-blur-xl lg:mx-0 lg:rounded-3xl lg:border lg:px-6">
                <div className="flex items-center justify-between gap-4">
                  <button type="button" onClick={() => router.push("/dashboard/recruiter")} className="rounded-xl px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-800">Discard changes</button>
                  <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#FF8A00] px-6 py-3 text-xs font-bold uppercase tracking-[0.15em] text-white transition-all hover:bg-[#E67A00] disabled:opacity-70">
                    {saving ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {saving ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, description, icon: Icon, children }: { title: string; description?: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50 lg:p-10">
      <div className="mb-8">
        <h2 className="mb-2 flex items-center gap-4 text-2xl font-black text-slate-900">
          <div className="rounded-2xl border border-[#FFE0BF] bg-[#FFF5E8] p-3 text-[#FF8A00] shadow-sm">
            <Icon className="h-6 w-6" />
          </div>
          {title}
        </h2>
        {description && <p className="ml-16 font-medium text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, icon: Icon, children, fullWidth = false }: { label: string; icon: React.ElementType; children: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? "md:col-span-2" : "group"}>
      <label className="mb-3 ml-1 flex items-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors group-focus-within:text-[#FF8A00]">
        <Icon className="mr-2 h-3.5 w-3.5 opacity-70" />
        {label}
      </label>
      {children}
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
      {options.map((option, index) => (
        <option key={option} value={option}>
          {labels[index]}
        </option>
      ))}
    </select>
  );
}
