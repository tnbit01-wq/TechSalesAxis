"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import {
  Rocket,
  Target,
  Map as MapIcon,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Loader2,
} from "lucide-react";

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

export default function CareerGPSPage() {
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
    fetchGPS();
  }, []);

  const fetchGPS = async () => {
    setLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const res = await apiClient.get(
        "/candidate/career-gps",
        token,
      );
      if (res.status === "active") {
        setGpsData(res.gps);
        setMilestones(res.milestones);
      } else {
        // Fetch profile to pre-fill inputs if available
        const profile = await apiClient.get(
          "/candidate/profile",
          token,
        );
        if (profile) {
          setInputs({
            target_role: profile.target_role || "",
            career_interests: profile.career_interests || "",
            long_term_goal: profile.long_term_goal || "",
            learning_interests: profile.learning_interests || "",
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch GPS", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (
      !inputs.target_role ||
      !inputs.career_interests ||
      !inputs.long_term_goal
    )
      return;

    setIsGenerating(true);
    try {
      const token = awsAuth.getToken();
      
      // Update profile with learning interests first so it's persisted for matching
      // We only update if it's not empty, otherwise we just skip the patch or send an empty string
      await apiClient.patch("/candidate/profile", {
        learning_interests: inputs.learning_interests || ""
      }, token);

      await apiClient.post(
        "/candidate/career-gps/generate",
        inputs,
        token,
      );
      toast.success("Career GPS generated successfully!");
      await fetchGPS();
    } catch (err: any) {
      console.error("Failed to generate GPS", err);
      toast.error(err.message || "Failed to generate your Career GPS. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleMilestone = async (id: string, currentStatus: string) => {
    const newStatus =
      currentStatus === "completed" ? "not-started" : "completed";
    try {
      const token = awsAuth.getToken();
      await apiClient.patch(
        `/candidate/career-gps/milestone/${id}`,
        { status: newStatus },
        token,
      );

      setMilestones((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: newStatus as Milestone["status"] } : m,
        ),
      );

      // Celebration if completed
      if (newStatus === "completed") {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#4f46e5", "#818cf8", "#ffffff"],
        });

        // Full completion celebration
        const allDone = milestones
          .filter((m) => m.id !== id)
          .every((m) => m.status === "completed");
        if (allDone) {
          setTimeout(() => {
            confetti({
              particleCount: 300,
              spread: 120,
              origin: { y: 0.3 },
              colors: ["#22c55e", "#ffffff", "#4f46e5"],
            });
          }, 1000);
        }
      }
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  if (loading) {
    return (
      <div className="flex bg-slate-50 min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <MapIcon className="text-indigo-600" /> Career GPS
        </h1>
        <p className="text-slate-500 mt-2">
          Personalized roadmap to your dream IT Tech Sales career.
        </p>
      </header>

      {!gpsData ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center">
          <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Rocket className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Build Your Career Map
          </h2>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            Tell us where you want to go, and our AI will build a personalized
            path using industry-leading resources from Salesforce and HubSpot.
          </p>

          <div className="max-w-lg mx-auto space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Role
              </label>
              <input
                type="text"
                placeholder="e.g. Enterprise Account Executive"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={inputs.target_role}
                onChange={(e) =>
                  setInputs({ ...inputs, target_role: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tech Interests
              </label>
              <input
                type="text"
                placeholder="e.g. SaaS, Cybersecurity, AI Infrastructure"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={inputs.career_interests}
                onChange={(e) =>
                  setInputs({ ...inputs, career_interests: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Actively Learning Skills
              </label>
              <input
                type="text"
                placeholder="e.g. Docker, AWS, React, Advanced CRM"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                value={inputs.learning_interests}
                onChange={(e) =>
                  setInputs({ ...inputs, learning_interests: e.target.value })
                }
              />
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-wider">Help our AI match you with "Stretch" opportunities</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Long-term Goal
              </label>
              <textarea
                placeholder="e.g. Lead a global sales division at a top-tier tech firm"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none h-24"
                value={inputs.long_term_goal}
                onChange={(e) =>
                  setInputs({ ...inputs, long_term_goal: e.target.value })
                }
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                !inputs.target_role ||
                !inputs.career_interests ||
                !inputs.long_term_goal
              }
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" /> Generating Your GPS...
                </>
              ) : (
                "Generate My Map"
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar Info */}
          <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-8 self-start">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> Current Vision
              </h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Target Role
                  </span>
                  <p className="text-slate-700 font-medium">
                    {gpsData.target_role}
                  </p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Status
                  </span>
                  <div className="mt-1">
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase tracking-widest">
                      In Orbit
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setGpsData(null)}
                  className="text-indigo-600 text-sm font-medium hover:underline mt-2 flex items-center gap-1 group"
                >
                  Redefine Vision{" "}
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-bold mb-2 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-indigo-400" /> Progress Status
              </h3>
              <div className="flex items-end gap-2 mb-1">
                <span className="text-3xl font-bold">
                  {Math.round(
                    (milestones.filter((m) => m.status === "completed").length /
                      milestones.length) *
                      100,
                  )}
                  %
                </span>
                <span className="text-slate-400 text-sm mb-1 uppercase tracking-widest">
                  Verified
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                <motion.div
                  key={
                    milestones.filter((m) => m.status === "completed").length
                  }
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(milestones.filter((m) => m.status === "completed").length / milestones.length) * 100}%`,
                  }}
                  className="bg-indigo-500 h-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-4 leading-relaxed italic">
                &quot;Every milestone completed is a signal to premium
                recruiters. Keep pushing.&quot;
              </p>
            </div>
          </div>

          {/* Main Timeline (GPS View) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              {/* The GPS Line */}
              <div className="absolute left-6 top-8 bottom-8 w-1 bg-slate-200 hidden md:block" />

              <div className="space-y-8">
                {milestones.map((milestone, idx) => (
                  <motion.div
                    key={milestone.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className={`relative pl-0 md:pl-16 group`}
                  >
                    {/* Milestone Indicator */}
                    <div
                      className={`absolute left-0 md:left-[1.15rem] top-1 w-6 h-6 rounded-full border-4 flex items-center justify-center transition-colors z-10
                          ${milestone.status === "completed" ? "bg-indigo-600 border-indigo-200" : "bg-white border-slate-300"}
                          hidden md:flex
                        `}
                    >
                      {milestone.status === "completed" && (
                        <CheckCircle className="w-3 h-3 text-white" />
                      )}
                    </div>

                    <div
                      className={`bg-white p-6 rounded-2xl shadow-sm border transition-all duration-300
                          ${milestone.status === "completed" ? "border-green-200 bg-green-50/20" : "border-slate-200 group-hover:border-indigo-200"}
                        `}
                    >
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full uppercase">
                              Step {milestone.step_order}
                            </span>
                            {milestone.status === "completed" && (
                              <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-600 rounded-full uppercase">
                                Unlocked
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-bold text-slate-900">
                            {milestone.title}
                          </h4>
                        </div>
                        <button
                          onClick={() =>
                            toggleMilestone(milestone.id, milestone.status)
                          }
                          className={`p-2 rounded-full transition-colors ${milestone.status === "completed" ? "text-green-600 bg-green-100" : "text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"}`}
                        >
                          <CheckCircle className="w-6 h-6" />
                        </button>
                      </div>

                      <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                        {milestone.description}
                      </p>

                      {/* Skills Pills */}
                      <div className="flex flex-wrap gap-2 mb-6">
                        {milestone.skills_to_acquire?.map((skill) => (
                          <span
                            key={skill}
                            className="text-[10px] font-bold px-2 py-1 bg-white border border-slate-100 text-slate-400 rounded-md uppercase"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Learning Actions */}
                      {milestone.learning_actions?.length > 0 && (
                        <div className="border-t border-slate-100 pt-4 space-y-3">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                            Recommended Learning
                          </p>
                          {milestone.learning_actions.map((action, aidx) => (
                            <a
                              key={aidx}
                              href={action.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors group/link"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-lg bg-white shadow-xs`}
                                >
                                  {action.platform.includes("Salesforce") ? (
                                    <Image
                                      src="https://cdn.iconscout.com/icon/free/png-256/free-salesforce-logo-icon-download-in-svg-png-gif-file-formats--enterprise-platform-crm-developer-social-media-pack-logos-icons-226435.png?f=webp&w=128"
                                      alt="Salesforce"
                                      width={20}
                                      height={20}
                                      className="w-5 h-5 grayscale group-hover/link:grayscale-0 transition-all opacity-80"
                                    />
                                  ) : (
                                    <Image
                                      src="https://cdn.iconscout.com/icon/free/png-256/free-hubspot-logo-icon-download-in-svg-png-gif-file-formats--enterprise-platform-crm-developer-social-media-pack-logos-icons-226417.png?f=webp&w=128"
                                      alt="Hubspot"
                                      width={20}
                                      height={20}
                                      className="w-5 h-5 grayscale group-hover/link:grayscale-0 transition-all opacity-80"
                                    />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {action.title}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {action.platform}
                                  </p>
                                </div>
                              </div>
                              <ExternalLink className="w-4 h-4 text-slate-300 group-hover/link:text-indigo-600 transition-colors" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
