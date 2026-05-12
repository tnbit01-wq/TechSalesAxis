"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Compass,
  ExternalLink,
  Flame,
  Layers3,
  Loader2,
  Map as MapIcon,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";

interface Milestone {
  id: string;
  step_order: number;
  title: string;
  description: string;
  skills_to_acquire: string[];
  learning_actions: {
    title: string;
    platform: string;
    url: string;
  }[];
  status: "not-started" | "in-progress" | "completed";
}

interface GPSData {
  target_role: string;
  long_term_goal: string;
  career_interests: string;
  learning_interests?: string;
}

const statusMeta: Record<Milestone["status"], { label: string; className: string }> = {
  "not-started": { label: "Not started", className: "bg-slate-100 text-slate-600 border-slate-200" },
  "in-progress": { label: "In progress", className: "bg-amber-100 text-amber-700 border-amber-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const buildResourceHref = (action: { title: string; platform: string; url: string }, milestone: Milestone) => {
  const params = new URLSearchParams({
    title: action.title,
    platform: action.platform,
    url: action.url,
    milestone: milestone.title,
  });
  return `/dashboard/candidate/gps/resource?${params.toString()}`;
};

export default function CareerGPSPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [gpsData, setGpsData] = useState<GPSData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [inputs, setInputs] = useState({
    target_role: "",
    career_interests: "",
    long_term_goal: "",
    learning_interests: "",
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void fetchGPS();
  }, []);

  const fetchGPS = async () => {
    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await apiClient.get("/candidate/career-gps", token);
      if (res.status === "active") {
        setGpsData(res.gps);
        setMilestones(res.milestones || []);
      } else {
        const profile = await apiClient.get("/candidate/profile", token);
        if (profile) {
          setInputs({
            target_role: profile.target_role || "",
            career_interests: profile.career_interests || "",
            long_term_goal: profile.long_term_goal || "",
            learning_interests: profile.learning_interests || "",
          });
        }
        setGpsData(null);
        setMilestones([]);
      }
    } catch (err) {
      console.error("Failed to fetch GPS", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!inputs.target_role || !inputs.career_interests || !inputs.long_term_goal) return;

    setIsGenerating(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(
        "/candidate/profile",
        { learning_interests: inputs.learning_interests || "" },
        token,
      );

      await apiClient.post("/candidate/career-gps/generate", inputs, token);
      toast.success("Career GPS updated.");
      await fetchGPS();
    } catch (err: any) {
      console.error("Failed to generate GPS", err);
      toast.error(err.message || "Could not update your career path. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMilestone = async (id: string, currentStatus: Milestone["status"]) => {
    const newStatus = currentStatus === "completed" ? "not-started" : "completed";

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.patch(`/candidate/career-gps/milestone/${id}`, { status: newStatus }, token);
      setMilestones((prev) => prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item)));

      if (newStatus === "completed") {
        confetti({ particleCount: 140, spread: 65, origin: { y: 0.65 }, colors: ["#FF8A00", "#FFB366", "#ffffff"] });
        const doneCount = milestones.filter((m) => m.id !== id && m.status === "completed").length + 1;
        if (milestones.length > 0 && doneCount === milestones.length) {
          setTimeout(() => {
            confetti({ particleCount: 240, spread: 100, origin: { y: 0.35 }, colors: ["#FF8A00", "#10B981", "#ffffff"] });
          }, 900);
        }
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const completedCount = useMemo(() => milestones.filter((m) => m.status === "completed").length, [milestones]);
  const progressPct = useMemo(() => {
    if (!milestones.length) return 0;
    return Math.round((completedCount / milestones.length) * 100);
  }, [completedCount, milestones.length]);
  const nextMilestone = useMemo(() => milestones.find((m) => m.status !== "completed") || milestones[0] || null, [milestones]);
  const topResources = useMemo(() => milestones.flatMap((m) => m.learning_actions.slice(0, 2).map((action) => ({ action, milestone: m }))).slice(0, 4), [milestones]);

  const renderSetupView = () => (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
        <div className="border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF8A00]">Career GPS</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-slate-900">Build a clearer path</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Share where you want to go, and we’ll shape a clean, practical roadmap with skills, next steps, and useful learning links.
          </p>
        </div>

        <div className="gps-scroll flex-1 min-h-0 overflow-y-auto p-5 lg:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Target role</span>
                  <input
                    type="text"
                    placeholder="Enterprise Account Executive"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/15"
                    value={inputs.target_role}
                    onChange={(e) => setInputs({ ...inputs, target_role: e.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Career focus</span>
                  <input
                    type="text"
                    placeholder="SaaS, cybersecurity, AI tools"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/15"
                    value={inputs.career_interests}
                    onChange={(e) => setInputs({ ...inputs, career_interests: e.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Learning areas</span>
                <input
                  type="text"
                  placeholder="AWS, CRM, demos, prospecting"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/15"
                  value={inputs.learning_interests}
                  onChange={(e) => setInputs({ ...inputs, learning_interests: e.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Long-term goal</span>
                <textarea
                  placeholder="Lead a global sales team at a high-growth tech company."
                  className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:bg-white focus:ring-2 focus:ring-[#FF8A00]/15"
                  value={inputs.long_term_goal}
                  onChange={(e) => setInputs({ ...inputs, long_term_goal: e.target.value })}
                />
              </label>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !inputs.target_role || !inputs.career_interests || !inputs.long_term_goal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#E67A00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating ? "Building map" : "Generate roadmap"}
              </button>
            </div>

            <aside className="rounded-[28px] border border-orange-100 bg-[#FFF8F1] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#C96B00]">What you get</p>
              <div className="mt-4 space-y-3">
                {[
                  { icon: Target, title: "A target role", text: "A clear destination without heavy jargon." },
                  { icon: Layers3, title: "A practical path", text: "Simple steps that fit your current skill level." },
                  { icon: Compass, title: "Useful learning links", text: "Curated actions that open in a clean view." },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-orange-100 bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF6ED] text-[#FF8A00]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.title}</p>
                          <p className="text-xs leading-relaxed text-slate-500">{item.text}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );

  const renderRoadmapView = () => (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
        <div className="border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF8A00]">Current direction</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF6ED] text-[#FF8A00]">
              <MapIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-slate-900">{gpsData?.target_role}</h2>
              <p className="truncate text-sm text-slate-500">Your target role</p>
            </div>
          </div>
        </div>

        <div className="gps-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="rounded-[24px] border border-orange-100 bg-[#FFF8F1] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C96B00]">Roadmap progress</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-black text-slate-900">{progressPct}%</span>
              <span className="pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">complete</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-orange-100">
              <div className="h-2 rounded-full bg-[#FF8A00]" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              {completedCount} of {milestones.length} milestones are complete.
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Goal statement</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{gpsData?.long_term_goal}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Career focus</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{gpsData?.career_interests}</p>
          </div>

          {gpsData?.learning_interests && (
            <div className="rounded-[24px] border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Learning focus</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{gpsData.learning_interests}</p>
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Next move</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {nextMilestone ? nextMilestone.title : "Your next milestone will appear here."}
            </p>
          </div>

          <div className="space-y-2">
            <Link href="/dashboard/candidate/jobs" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]">
              <span>View matching jobs</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/candidate/applications" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]">
              <span>Review applications</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => setGpsData(null)}
              className="flex w-full items-center justify-between rounded-2xl bg-[#FF8A00] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#E67A00]"
            >
              <span>Update roadmap</span>
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF8A00]">Roadmap</p>
            <p className="mt-1 text-sm text-slate-500">A focused view of what comes next</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-[#C96B00]">
            <Flame className="h-3.5 w-3.5" />
            {milestones.length} milestones
          </div>
        </div>

        <div className="gps-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {milestones.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
              <Rocket className="h-10 w-10 text-[#FF8A00]" />
              <p className="mt-4 text-lg font-black text-slate-900">No milestones yet</p>
              <p className="mt-2 max-w-md text-sm text-slate-500">Generate a roadmap to turn your target role into a practical plan.</p>
            </div>
          ) : (
            milestones.map((milestone, idx) => (
              <motion.article
                key={milestone.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition hover:border-orange-200 hover:shadow-[0_10px_28px_rgba(255,138,0,0.1)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-orange-100 bg-[#FFF8F1] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#C96B00]">
                        Step {milestone.step_order}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusMeta[milestone.status].className}`}>
                        {statusMeta[milestone.status].label}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900">{milestone.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{milestone.description}</p>
                  </div>

                  <button
                    onClick={() => toggleMilestone(milestone.id, milestone.status)}
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition ${
                      milestone.status === "completed"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-orange-100 bg-[#FFF8F1] text-[#FF8A00] hover:bg-[#FF8A00] hover:text-white"
                    }`}
                    title={milestone.status === "completed" ? "Mark as not started" : "Mark as completed"}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {milestone.skills_to_acquire.map((skill) => (
                    <span key={skill} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {skill}
                    </span>
                  ))}
                </div>

                {milestone.learning_actions.length > 0 && (
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {milestone.learning_actions.slice(0, 2).map((action) => (
                      <Link
                        key={`${milestone.id}-${action.title}`}
                        href={buildResourceHref(action, milestone)}
                        className="group flex items-center justify-between rounded-2xl border border-orange-100 bg-[#FFF8F1] px-4 py-3 transition hover:border-[#FF8A00] hover:bg-[#FFF2E3]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{action.title}</p>
                          <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C96B00]">{action.platform}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#FF8A00] transition group-hover:translate-x-0.5" />
                      </Link>
                    ))}
                  </div>
                )}
              </motion.article>
            ))
          )}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
        <div className="border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#FF8A00]">Resource picks</p>
          <p className="mt-1 text-sm text-slate-500">Open a clean detail view for each learning action</p>
        </div>

        <div className="gps-scroll flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {topResources.length === 0 ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 text-center">
              <BookOpen className="h-10 w-10 text-slate-300" />
            </div>
          ) : (
            topResources.map(({ action, milestone }) => (
              <Link
                key={`${milestone.id}-${action.title}`}
                href={buildResourceHref(action, milestone)}
                className="block rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition hover:border-orange-200 hover:shadow-[0_10px_26px_rgba(255,138,0,0.1)]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF8F1] text-[#FF8A00]">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{action.title}</p>
                    <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.18em] text-[#C96B00]">{action.platform}</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">Open a simple learning view for this milestone.</p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#FFE3BF] border-t-[#FF8A00]" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#C96B00]">Loading career path...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <style>{`
        .gps-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .gps-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1600px] flex-col gap-5 px-4 py-4">
        {gpsData ? renderRoadmapView() : renderSetupView()}
      </main>
    </div>
  );
}
