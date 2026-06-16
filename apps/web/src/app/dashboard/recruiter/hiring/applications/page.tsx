"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  MapPin,
  Search,
  UserCheck,
  Users,
  Video,
  XCircle,
  ArrowRight,
  ClipboardList,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RejectionModal from "@/components/RejectionModal";
import ShortlistModal from "@/components/ShortlistModal";
import InterviewScheduler from "@/components/InterviewScheduler";
import CandidateProfileModal from "@/components/CandidateProfileModal";
import InterviewFeedbackModal from "@/components/InterviewFeedbackModal";
import LockedView from "@/components/dashboard/LockedView";

interface Application {
  id: string;
  status: string;
  feedback: string | null;
  created_at: string;
  job_id: string;
  candidate_id: string;
  jobs: {
    id: string;
    title: string;
    status: string;
    location: string | null;
    created_at: string;
  };
  candidate_profiles: {
    user_id: string;
    full_name: string;
    current_role: string | null;
    years_of_experience: number | null;
    phone_number: string | null;
    location: string | null;
    gender: string | null;
    birthdate: string | null;
    referral: string | null;
    bio: string | null;
    profile_photo_url: string | null;
    email?: string | null;
    resume_path?: string | null;
  };
  resume_data?: {
    timeline: any;
    education: any;
    achievements: string[];
    skills: string[];
  } | null;
  profile_scores?: {
    final_score: number;
  } | null;
  is_skill_match?: boolean;
  interviews?: any[];
}

const statusOptions = [
  { value: "all", label: "All Stages" },
  { value: "applied", label: "Applied" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview_scheduled", label: "Interview" },
  { value: "offered", label: "Offer" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPipelinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isShortlistModalOpen, setIsShortlistModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    isOpen: boolean;
    interviewId: string;
    applicationId: string;
    candidateName: string;
    roundName: string;
    recruiterJoinedAt: string | null;
    candidateJoinedAt: string | null;
  }>({
    isOpen: false,
    interviewId: "",
    applicationId: "",
    candidateName: "",
    roundName: "",
    recruiterJoinedAt: null,
    candidateJoinedAt: null,
  });
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "name-asc" | "score-desc">("newest");
  const [selectedJobId, setSelectedJobId] = useState<string>(searchParams.get("job") || "");
  const [viewMode, setViewMode] = useState<"split" | "kanban">("split");
  const [minExperience, setMinExperience] = useState<number>(0);
  const [minScore, setMinScore] = useState<number>(0);
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<"resume" | "timeline" | "feedback">("resume");
  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    candidate: any | null;
    resumeData: any | null;
    jobTitle: string;
    appliedDate: string;
    score: number;
    status: string;
    initialTab?: string;
    applicationId?: string;
    interviews?: any[];
    initialFeedbackOpen?: boolean;
  }>({
    isOpen: false,
    candidate: null,
    resumeData: null,
    jobTitle: "",
    appliedDate: "",
    score: 0,
    status: "",
    initialTab: "resume",
    applicationId: undefined,
    interviews: [],
    initialFeedbackOpen: false,
  });

  const [profile, setProfile] = useState<{
    companies?: {
      profile_score: number;
    };
  } | null>(null);

  const isLocked = Boolean(profile && (profile.companies?.profile_score ?? 0) === 0);

  useEffect(() => {
    setSelectedJobId(searchParams.get("job") || "");
  }, [searchParams]);

  const fetchApplications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      const [data, interviewData, profileData] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token),
        apiClient.get("/interviews/my", token),
        apiClient.get("/recruiter/profile", token).catch(() => null),
      ]);

      const appsData = (data || []).map((app: any) => ({
        ...app,
        interviews: (interviewData || []).filter((i: any) => i.application_id === app.id),
      }));

      setApplications(appsData);
      setProfile(profileData);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchApplications();
    const interval = setInterval(fetchApplications, 60000);
    return () => clearInterval(interval);
  }, [fetchApplications]);

  const trackProfileView = async (candidateId: string, jobId?: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const url = jobId
        ? `/analytics/profile/${candidateId}/view?job_id=${jobId}`
        : `/analytics/profile/${candidateId}/view`;

      await apiClient.post(url, {}, token);
    } catch (err) {
      console.error("Failed to track profile view:", err);
    }
  };

  const handleBulkStatusChange = async (status: string, feedback?: string) => {
    const targets = activeApplicationId ? [activeApplicationId] : selectedApps;
    if (targets.length === 0) return;

    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/applications/bulk-status",
        {
          application_ids: targets,
          status,
          feedback,
        },
        token,
      );

      setIsRejectionModalOpen(false);
      setIsShortlistModalOpen(false);
      setSelectedApps([]);
      setActiveApplicationId(null);
      fetchApplications();
    } catch (err) {
      console.error("Failed to update statuses:", err);
    }
  };

  const handleStageTransition = async (applicationId: string, status: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        "/recruiter/applications/bulk-status",
        {
          application_ids: [applicationId],
          status: status,
          feedback: `Stage transitioned in Board View.`,
        },
        token,
      );
      fetchApplications();
    } catch (err) {
      console.error("Failed to update status via drag & drop:", err);
    }
  };

  const openings = useMemo(() => {
    const grouped = new Map<string, { jobTitle: string; location: string; count: number }>();

    applications.forEach((app) => {
      const key = app.job_id;
      if (!grouped.has(key)) {
        grouped.set(key, {
          jobTitle: app.jobs?.title || "Role",
          location: app.jobs?.location || "Remote",
          count: 0,
        });
      }
      const current = grouped.get(key)!;
      current.count += 1;
    });

    return Array.from(grouped.entries()).map(([id, value]) => ({
      id,
      ...value,
    }));
  }, [applications]);

  const selectedOpening = useMemo(() => {
    return openings.find((opening) => opening.id === selectedJobId) || null;
  }, [openings, selectedJobId]);

  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      const nameMatch = (app.candidate_profiles?.full_name || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const roleMatch = (app.candidate_profiles?.current_role || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const jobMatch = (app.jobs?.title || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const statusMatch = filterStatus === "all" || app.status === filterStatus;
      const openingMatch = !selectedJobId || app.job_id === selectedJobId;

      const expValue = app.candidate_profiles?.years_of_experience ?? 0;
      const expMatch = expValue >= minExperience;
      
      const rawScore = app.profile_scores?.final_score ?? 0;
      const normalizedScore = rawScore > 1 ? rawScore : rawScore * 100;
      const scoreMatch = normalizedScore >= minScore;

      return (nameMatch || roleMatch || jobMatch) && statusMatch && openingMatch && expMatch && scoreMatch;
    });
  }, [applications, searchTerm, filterStatus, selectedJobId, minExperience, minScore]);

  const sortedApplications = useMemo(() => {
    const items = [...filteredApplications];
    items.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortOrder === "name-asc") {
        return (a.candidate_profiles?.full_name || "").localeCompare(
          b.candidate_profiles?.full_name || "",
        );
      }
      return (b.profile_scores?.final_score || 0) - (a.profile_scores?.final_score || 0);
    });
    return items;
  }, [filteredApplications, sortOrder]);

  const selectedCandidate = useMemo(() => {
    if (activeCandidateId) {
      return sortedApplications.find((app) => app.id === activeCandidateId) || sortedApplications[0] || null;
    }
    return sortedApplications[0] || null;
  }, [sortedApplications, activeCandidateId]);

  useEffect(() => {
    if (selectedCandidate) {
      trackProfileView(selectedCandidate.candidate_id, selectedCandidate.job_id);
    }
  }, [selectedCandidate]);

  const interviewReadyCount = sortedApplications.filter((app) => app.status === "interview_scheduled").length;
  const offerCount = sortedApplications.filter((app) => app.status === "offered").length;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "applied":
        return "Applied";
      case "shortlisted":
        return "Shortlisted";
      case "interview_scheduled":
        return "Interview";
      case "offered":
        return "Offer";
      case "closed":
        return "Hired";
      case "rejected":
        return "Rejected";
      default:
        return status.replace(/_/g, " ");
    }
  };

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "applied":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "shortlisted":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "interview_scheduled":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "offered":
      case "closed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "rejected":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getScore = (app: Application) => {
    const raw = app.profile_scores?.final_score;
    if (!raw) return "-";
    return raw > 1 ? `${raw.toFixed(0)}%` : `${(raw * 100).toFixed(0)}%`;
  };

  const exportToCSV = () => {
    if (sortedApplications.length === 0) return;

    const headers = ["Role", "Location", "Candidate", "Applied Date", "Stage", "Score"];
    const rows = sortedApplications.map((app) => [
      app.jobs?.title || "N/A",
      app.jobs?.location || "Remote",
      app.candidate_profiles?.full_name || "Unknown",
      new Date(app.created_at).toLocaleDateString(),
      getStatusLabel(app.status),
      getScore(app),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `TechSalesAxis_Candidates_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelect = (id: string) => {
    setSelectedApps((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-[#FFE3BF] border-t-[#FF8A00]"></div>
          <p className="text-[#C96B00] font-black text-xs uppercase tracking-[0.18em]">Loading candidate pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.06),_transparent_40%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900">
      <style>{`
        .apps-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .apps-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .apps-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .apps-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .apps-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="h-full w-full max-w-[1700px] mx-auto px-4 py-3 flex flex-col overflow-hidden">
        {isLocked ? (
          <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-orange-100/80 bg-white p-12 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
            <LockedView featureName="Candidate Pipeline" />
          </div>
        ) : (
          <section className="flex flex-col lg:grid lg:grid-cols-[280px_minmax(0,1fr)] min-h-0 flex-1 gap-4 overflow-hidden">
            <aside className="flex flex-col min-h-0 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden lg:h-full flex-shrink-0">
              <div className="hidden lg:block flex-shrink-0 px-5 py-4 border-b border-slate-50 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF8A00]">Pipeline Directory</h2>
                <p className="mt-0.5 text-[11px] font-medium text-slate-400">Review applicants, schedule interviews, and move hiring forward</p>
              </div>

              <div className="flex flex-col gap-3 lg:gap-4 p-4 flex-shrink-0 lg:flex-1 lg:overflow-y-auto lg:space-y-4 lg:gap-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate, role, or opening"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-150 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/50 focus:bg-white focus:ring-4 focus:ring-[#FF8A00]/5"
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:block">Hiring Stage</h3>
                  <div className="flex flex-row overflow-x-auto gap-2 lg:flex-col lg:space-y-1 lg:gap-0 scrollbar-none py-1 -mx-4 px-4 lg:mx-0 lg:px-0">
                    {statusOptions.map((status) => (
                      <button
                        key={status.value}
                        onClick={() => setFilterStatus(status.value)}
                        className={`flex items-center justify-between w-auto lg:w-full gap-2 rounded-xl px-3 py-1.5 lg:py-2 text-xs font-bold transition-all whitespace-nowrap ${
                          filterStatus === status.value
                            ? "bg-[#FF8A00] text-white shadow-md shadow-orange-100"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span>{status.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 lg:flex-col lg:gap-0">
                  <div className="flex-1">
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hidden lg:block">Sort Candidates</h3>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as "newest" | "name-asc" | "score-desc")}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#FF8A00]/60 focus:ring-4 focus:ring-[#FF8A00]/5"
                    >
                      <option value="newest">Newest first</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="score-desc">Best match first</option>
                    </select>
                  </div>

                  <div className="flex-1 lg:hidden">
                    <select
                      value={selectedJobId}
                      onChange={(e) => setSelectedJobId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-[#FF8A00]/60 focus:ring-4 focus:ring-[#FF8A00]/5"
                    >
                      <option value="">All Openings</option>
                      {openings.map((opening) => (
                        <option key={opening.id} value={opening.id}>
                          {opening.jobTitle} ({opening.count})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Candidate Quality Filters */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 hidden lg:block space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Quality Filters</h3>
                    {(minExperience > 0 || minScore > 0) && (
                      <button
                        onClick={() => {
                          setMinExperience(0);
                          setMinScore(0);
                        }}
                        className="text-[9px] font-black uppercase tracking-wider text-[#C96B00] hover:text-[#FF8A00] underline underline-offset-2"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>Min Experience</span>
                      <span className="text-[#FF8A00] font-black">{minExperience}+ yrs</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="15"
                      value={minExperience}
                      onChange={(e) => setMinExperience(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF8A00]"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-600">
                      <span>Min Match Score</span>
                      <span className="text-[#FF8A00] font-black">{minScore}%+</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={minScore}
                      onChange={(e) => setMinScore(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#FF8A00]"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 hidden lg:block">
                  <div className="mb-2.5 flex items-center justify-between">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Openings</h3>
                    {selectedJobId && (
                      <button
                        onClick={() => setSelectedJobId("")}
                        className="text-[9px] font-black uppercase tracking-wider text-[#C96B00] hover:text-[#FF8A00] underline underline-offset-2"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5 max-h-[220px] overflow-y-auto jobs-scroll -mx-1 px-1">
                    {openings.length === 0 ? (
                      <p className="text-[10px] text-slate-400">No openings with applicants.</p>
                    ) : (
                      openings.map((opening) => (
                        <button
                          key={opening.id}
                          onClick={() => setSelectedJobId(opening.id)}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                            selectedJobId === opening.id
                              ? "border-[#FF8A00] bg-[#FFF8F1] text-[#C96B00]"
                              : "border-slate-100 bg-white hover:border-[#FF8A00]/40 hover:bg-slate-50/50"
                          }`}
                        >
                          <p className="text-xs font-bold text-slate-800 line-clamp-1">{opening.jobTitle}</p>
                          <p className="mt-0.5 text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{opening.location}</p>
                          <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-[#C96B00]">
                            {opening.count} candidate{opening.count !== 1 ? "s" : ""}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden">
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)] flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <h1 className="text-base font-black tracking-tight text-slate-900">Applications Board</h1>
                  <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-black text-[#FF8A00] ring-1 ring-inset ring-orange-100">
                    {filteredApplications.length} total
                  </span>
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setViewMode("split")}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        viewMode === "split"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Workspace
                    </button>
                    <button
                      onClick={() => setViewMode("kanban")}
                      className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                        viewMode === "kanban"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Kanban Board
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                  <Link
                    href="/dashboard/recruiter/hiring/jobs"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95 shadow-md shadow-slate-200"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    Open Roles
                  </Link>
                </div>
              </div>

              <div className="flex-shrink-0 flex flex-col gap-3 border-b border-slate-100 bg-slate-50/10 px-6 py-3">
                {selectedOpening && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Showing candidates for <span className="text-[#C96B00]">{selectedOpening.jobTitle}</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-150 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Total Applicants</p>
                    <p className="mt-0.5 text-base font-black text-slate-800">{sortedApplications.length}</p>
                  </div>
                  <div className="rounded-xl border border-blue-100 bg-blue-50/20 px-3 py-2 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-500">Interviewing</p>
                    <p className="mt-0.5 text-base font-black text-blue-700">{interviewReadyCount}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 px-3 py-2 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-500">Offered</p>
                    <p className="mt-0.5 text-base font-black text-emerald-700">{offerCount}</p>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-[#FFFDF9] px-3 py-2 shadow-sm">
                    <p className="text-[9px] font-black uppercase tracking-wider text-[#C96B00]">Selected</p>
                    <p className="mt-0.5 text-base font-black text-[#C96B00]">{selectedApps.length}</p>
                  </div>
                </div>

                {selectedApps.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-[#FFF3E3] p-2">
                    <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#C96B00]">
                      {selectedApps.length} selected
                    </span>
                    <button
                      disabled={!applications.filter((app) => selectedApps.includes(app.id)).every((app) => app.status === "applied")}
                      onClick={() => {
                        setActiveApplicationId(null);
                        setIsShortlistModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserCheck className="h-3 w-3" />
                      Shortlist
                    </button>
                    <button
                      onClick={() => setIsRejectionModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              {viewMode === "kanban" ? (
                <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden p-4 flex gap-4 apps-scroll bg-slate-50/20">
                  {([
                    { value: "applied", label: "Applied" },
                    { value: "shortlisted", label: "Shortlisted" },
                    { value: "interview_scheduled", label: "Interviewing" },
                    { value: "offered", label: "Offered" },
                    { value: "closed", label: "Hired" },
                    { value: "rejected", label: "Rejected" }
                  ] as const).map((col) => {
                    const colApps = sortedApplications.filter((app) => app.status === col.value);
                    return (
                      <div
                        key={col.value}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const appId = e.dataTransfer.getData("applicationId");
                          if (appId) {
                            handleStageTransition(appId, col.value);
                          }
                        }}
                        className="w-[280px] flex-shrink-0 h-full flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"
                      >
                        <div className="flex-shrink-0 p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                          <span className="text-[10px] font-black text-slate-800 uppercase tracking-wider">{col.label}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black text-slate-500">
                            {colApps.length}
                          </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 apps-scroll bg-slate-50/10">
                          {colApps.length === 0 ? (
                            <div className="h-full min-h-[100px] flex items-center justify-center text-center">
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Drag candidate here</p>
                            </div>
                          ) : (
                            colApps.map((app) => (
                              <div
                                key={app.id}
                                draggable={true}
                                onDragStart={(e) => e.dataTransfer.setData("applicationId", app.id)}
                                onClick={() => {
                                  setActiveCandidateId(app.id);
                                  setViewMode("split");
                                }}
                                className="group cursor-grab active:cursor-grabbing rounded-xl border border-slate-150 bg-white p-3 shadow-sm hover:border-[#FF8A00] transition duration-200"
                              >
                                <p className="text-xs font-bold text-slate-800 group-hover:text-[#FF8A00] transition-colors">{app.candidate_profiles?.full_name}</p>
                                <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider truncate">
                                  {app.candidate_profiles?.current_role || "No role specified"}
                                </p>
                                <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                  <span>Score: {getScore(app)}</span>
                                  <span className="text-slate-400">{new Date(app.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 min-h-0 flex overflow-hidden">
                  
                  {/* Left Stream: Candidate Cards */}
                  <div className="apps-scroll flex-1 overflow-y-auto p-4 border-r border-slate-100">
                    {sortedApplications.length === 0 ? (
                      <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-[#FFFDF9] p-10 text-center">
                        <ClipboardList className="h-10 w-10 text-orange-200" />
                        <h3 className="mt-4 text-lg font-black text-slate-900">No candidates in this view</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Try another filter, or review your active openings to attract more applications.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                          <Link
                            href="/dashboard/recruiter/hiring/jobs"
                            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF8A00] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#E67A00]"
                          >
                            Manage Openings
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                          {selectedJobId && (
                            <button
                              onClick={() => setSelectedJobId("")}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                            >
                              Show All Candidates
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {sortedApplications.map((app) => {
                          const isSelected = selectedCandidate?.id === app.id;
                          return (
                            <article
                              key={app.id}
                              onClick={() => setActiveCandidateId(app.id)}
                              className={`group flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-200 cursor-pointer ${
                                isSelected
                                  ? "border-[#FF8A00] bg-[#FFFDF9] ring-2 ring-[#FF8A00]/5"
                                  : "border-slate-150 bg-white hover:border-orange-200 hover:shadow-md"
                              }`}
                            >
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={selectedApps.includes(app.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        toggleSelect(app.id);
                                      }}
                                      className="mt-1 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#FF8A00]"
                                    />
                                    <div className="min-w-0">
                                      <p className="text-left text-sm font-bold text-slate-800 transition hover:text-[#FF8A00] line-clamp-1">
                                        {app.candidate_profiles?.full_name || "Candidate"}
                                      </p>
                                      <p className="text-[10px] font-medium text-slate-400 mt-0.5 line-clamp-1">
                                        {app.candidate_profiles?.current_role || "Role not specified"}
                                      </p>
                                    </div>
                                  </div>

                                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusClasses(app.status)} flex-shrink-0`}>
                                    {getStatusLabel(app.status)}
                                  </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Opening">
                                      <Briefcase className="h-3 w-3 text-slate-400" />
                                      <span className="line-clamp-1">{app.jobs?.title}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFF7EE] border border-orange-100 px-2 py-0.5 text-[#C96B00] font-black" title="Match Score">
                                      Score: {getScore(app)}
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Location">
                                      <MapPin className="h-3 w-3 text-slate-400" />
                                      <span className="line-clamp-1">{app.candidate_profiles?.location || "Remote"}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-slate-500" title="Applied Date">
                                      <Calendar className="h-3 w-3 text-slate-400" />
                                      {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {app.status === "applied" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveApplicationId(app.id);
                                          setIsShortlistModalOpen(true);
                                        }}
                                        className="h-6 px-2.5 rounded-lg bg-[#FFF8F1] border border-orange-200 text-[9px] font-black uppercase tracking-wider text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-white"
                                      >
                                        Shortlist
                                      </button>
                                    )}
                                    {app.status === "shortlisted" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveApplicationId(app.id);
                                          setIsInterviewModalOpen(true);
                                        }}
                                        className="h-6 px-2.5 rounded-lg bg-blue-50 border border-blue-100 text-[9px] font-black uppercase tracking-wider text-blue-700 transition-all hover:bg-blue-600 hover:text-white"
                                      >
                                        Schedule
                                      </button>
                                    )}
                                    {app.status === "interview_scheduled" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStageTransition(app.id, "offered");
                                        }}
                                        className="h-6 px-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[9px] font-black uppercase tracking-wider text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white"
                                      >
                                        Send Offer
                                      </button>
                                    )}
                                    {app.status === "offered" && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleStageTransition(app.id, "closed");
                                        }}
                                        className="h-6 px-2.5 rounded-lg bg-emerald-50 border border-emerald-100 text-[9px] font-black uppercase tracking-wider text-emerald-700 transition-all hover:bg-emerald-600 hover:text-white"
                                      >
                                        Hire
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Dynamic Workspace Preview Pane */}
                  <aside className="w-[440px] flex-shrink-0 h-full border-l border-slate-100 bg-slate-50/10 flex flex-col min-h-0">
                    {selectedCandidate ? (
                      <div className="flex-1 flex flex-col min-h-0">
                        {/* Candidate Short Profile Card */}
                        <div className="p-5 border-b border-slate-100 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)] flex-shrink-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              {selectedCandidate.candidate_profiles?.profile_photo_url ? (
                                <img
                                  src={selectedCandidate.candidate_profiles.profile_photo_url}
                                  alt={selectedCandidate.candidate_profiles.full_name}
                                  className="w-12 h-12 rounded-2xl object-cover ring-2 ring-orange-100"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-[#C96B00] flex items-center justify-center font-black text-sm uppercase">
                                  {selectedCandidate.candidate_profiles?.full_name?.substring(0, 2) || "CN"}
                                </div>
                              )}
                              <div>
                                <h3 className="text-sm font-black text-slate-800 line-clamp-1">{selectedCandidate.candidate_profiles?.full_name}</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{selectedCandidate.candidate_profiles?.current_role || "Role not specified"}</p>
                              </div>
                            </div>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${getStatusClasses(selectedCandidate.status)}`}>
                              {getStatusLabel(selectedCandidate.status)}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-bold uppercase tracking-wider">
                            <span className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-[#C96B00] font-black">
                              Score: {getScore(selectedCandidate)}
                            </span>
                            <span className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-slate-500">
                              {selectedCandidate.candidate_profiles?.location || "Remote"}
                            </span>
                            {selectedCandidate.candidate_profiles?.years_of_experience && (
                              <span className="bg-white border border-slate-100 px-2 py-1 rounded-lg text-slate-500">
                                {selectedCandidate.candidate_profiles.years_of_experience} yrs exp
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tabs list */}
                        <div className="flex-shrink-0 flex border-b border-slate-100 bg-white p-1">
                          {(["resume", "timeline", "feedback"] as const).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setPreviewTab(tab)}
                              className={`flex-1 text-center py-2 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all ${
                                previewTab === tab
                                  ? "bg-slate-900 text-white shadow-sm"
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        {/* Tab Contents */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 apps-scroll bg-white">
                          {previewTab === "resume" && (
                            <div className="space-y-4">
                              {selectedCandidate.candidate_profiles?.bio && (
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">About</h4>
                                  <p className="text-xs text-slate-600 leading-relaxed">{selectedCandidate.candidate_profiles.bio}</p>
                                </div>
                              )}

                              <div>
                                <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Technical Skills</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {selectedCandidate.resume_data?.skills && selectedCandidate.resume_data.skills.length > 0 ? (
                                    selectedCandidate.resume_data.skills.map((skill, i) => (
                                      <span key={i} className="bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg text-[9px] font-bold text-slate-700">
                                        {skill}
                                      </span>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-slate-400">No skills parsed from resume.</p>
                                  )}
                                </div>
                              </div>

                              {selectedCandidate.resume_data?.achievements && selectedCandidate.resume_data.achievements.length > 0 && (
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Key Achievements</h4>
                                  <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-600">
                                    {selectedCandidate.resume_data.achievements.map((ach, i) => (
                                      <li key={i}>{ach}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {selectedCandidate.resume_data?.timeline && (
                                <div>
                                  <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Career Timeline</h4>
                                  <div className="space-y-3 border-l-2 border-slate-100 pl-3 ml-1">
                                    {Array.isArray(selectedCandidate.resume_data.timeline) ? (
                                      selectedCandidate.resume_data.timeline.map((item: any, i: number) => (
                                        <div key={i} className="relative">
                                          <div className="absolute -left-[17px] top-1 w-2 h-2 rounded-full bg-[#FF8A00] border-2 border-white" />
                                          <p className="text-[9px] font-black text-[#C96B00] uppercase tracking-wider">{item.duration || "Duration not specified"}</p>
                                          <p className="text-xs font-bold text-slate-800">{item.role || item.title || "Experience"}</p>
                                          <p className="text-[10px] text-slate-500">{item.company || item.institution || ""}</p>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-[10px] text-slate-400">Timeline data not available in visual list.</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {previewTab === "timeline" && (
                            <div className="space-y-4">
                              <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Interview Status & Logs</h4>
                              {selectedCandidate.interviews && selectedCandidate.interviews.length > 0 ? (
                                <div className="space-y-3">
                                  {selectedCandidate.interviews.map((int: any) => (
                                    <div key={int.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-800">{int.round_name || `Round ${int.round_number}`}</p>
                                        <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border ${
                                          int.status === "scheduled" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                        }`}>
                                          {int.status}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">Format: {int.format || "Video call"}</p>
                                      {int.meeting_link && (
                                        <a
                                          href={int.meeting_link}
                                          target="_blank"
                                          className="mt-2 inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-600 hover:underline"
                                        >
                                          <Video className="w-3.5 h-3.5" /> Join Meeting Room
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No interviews scheduled yet.</p>
                              )}
                            </div>
                          )}

                          {previewTab === "feedback" && (
                            <div className="space-y-4">
                              <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400">Hiring Feedback & Notes</h4>
                              {selectedCandidate.feedback ? (
                                <div className="rounded-xl border border-slate-100 bg-[#FFFDF9] p-4 text-xs text-slate-600 italic">
                                  "{selectedCandidate.feedback}"
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">No evaluation notes logged yet.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action footer */}
                        <div className="flex-shrink-0 p-4 border-t border-slate-100 bg-slate-50/20 flex flex-wrap gap-2 justify-end">
                          {selectedCandidate.candidate_profiles?.resume_path && (
                            <a
                              href={selectedCandidate.candidate_profiles.resume_path}
                              target="_blank"
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:border-[#FF8A00] hover:text-[#FF8A00] transition active:scale-95"
                            >
                              <Download className="w-3.5 h-3.5" /> Resume
                            </a>
                          )}

                          {selectedCandidate.status === "applied" && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(selectedCandidate.id);
                                setIsShortlistModalOpen(true);
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1 text-[9px] font-black uppercase tracking-wider text-white hover:bg-[#FF8A00] transition active:scale-95 shadow-md shadow-slate-200"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Shortlist
                            </button>
                          )}

                          {(selectedCandidate.status === "shortlisted" || 
                           (selectedCandidate.status === "interview_scheduled" && 
                            selectedCandidate.interviews?.some((i: any) => i.status === "pending_confirmation"))) && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(selectedCandidate.id);
                                setIsInterviewModalOpen(true);
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-700 hover:border-[#FF8A00] hover:text-[#FF8A00] transition active:scale-95"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              {selectedCandidate.interviews?.some((i: any) => i.status === "pending_confirmation") ? "Update Slots" : "Schedule Interview"}
                            </button>
                          )}

                          {selectedCandidate.status === "interview_scheduled" && 
                           selectedCandidate.interviews?.some((i: any) => i.status === "scheduled") && (
                            <button
                              onClick={() => {
                                const activeInt = selectedCandidate.interviews?.find((i: any) => i.status === "scheduled");
                                if (activeInt) {
                                  setFeedbackModal({
                                    isOpen: true,
                                    interviewId: activeInt.id,
                                    applicationId: selectedCandidate.id,
                                    candidateName: selectedCandidate.candidate_profiles.full_name,
                                    roundName: activeInt.round_name,
                                    recruiterJoinedAt: activeInt.recruiter_joined_at,
                                    candidateJoinedAt: activeInt.candidate_joined_at,
                                  });
                                }
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#C96B00] hover:bg-orange-100 transition active:scale-95"
                            >
                              <ClipboardList className="w-3.5 h-3.5" /> Log Feedback
                            </button>
                          )}

                          <button
                            onClick={() => router.push(`/dashboard/recruiter/messages?candidate=${selectedCandidate.candidate_id}`)}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-blue-700 hover:bg-blue-100 transition active:scale-95"
                          >
                            Message
                          </button>

                          {["shortlisted", "interview_scheduled"].includes(selectedCandidate.status) && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(selectedCandidate.id);
                                handleBulkStatusChange("offered", "Job offer extended.");
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1 text-[9px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-500/10"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Send Offer
                            </button>
                          )}

                          {selectedCandidate.status === "offered" && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(selectedCandidate.id);
                                handleBulkStatusChange("closed", "Hired successfully.");
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1 text-[9px] font-black uppercase tracking-wider text-white hover:bg-emerald-700 transition active:scale-95 shadow-md shadow-emerald-500/10"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Finalize Hire
                            </button>
                          )}

                          {["applied", "shortlisted", "interview_scheduled", "offered"].includes(selectedCandidate.status) && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(selectedCandidate.id);
                                setIsRejectionModalOpen(true);
                              }}
                              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-wider text-rose-700 hover:bg-rose-50 transition active:scale-95"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Reject
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-slate-50/10">
                        <Users className="w-8 h-8 text-slate-300 mb-3" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-wider">No Candidate Selected</p>
                        <p className="text-[10px] text-slate-400 mt-1">Select an applicant from the stream to view their profile details.</p>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => {
          setIsRejectionModalOpen(false);
          setActiveApplicationId(null);
        }}
        onConfirm={(reason) => handleBulkStatusChange("rejected", reason)}
        count={activeApplicationId ? 1 : selectedApps.length}
      />

      <ShortlistModal
        isOpen={isShortlistModalOpen}
        onClose={() => {
          setIsShortlistModalOpen(false);
          setActiveApplicationId(null);
        }}
        onConfirm={(feedback) => handleBulkStatusChange("shortlisted", feedback)}
        count={activeApplicationId ? 1 : selectedApps.length}
      />

      {feedbackModal.isOpen && (
        <InterviewFeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
          interviewId={feedbackModal.interviewId}
          applicationId={feedbackModal.applicationId}
          candidateName={feedbackModal.candidateName}
          roundName={feedbackModal.roundName}
          recruiterJoinedAt={feedbackModal.recruiterJoinedAt}
          candidateJoinedAt={feedbackModal.candidateJoinedAt}
          onSuccess={() => {
            setFeedbackModal({ ...feedbackModal, isOpen: false });
            fetchApplications();
          }}
        />
      )}

      {isInterviewModalOpen && activeApplicationId && (
        <InterviewScheduler
          candidateName={applications.find((item) => item.id === activeApplicationId)?.candidate_profiles.full_name || "Candidate"}
          applicationId={activeApplicationId}
          jobTitle={applications.find((item) => item.id === activeApplicationId)?.jobs?.title}
          initialRoundNumber={(applications.find((item) => item.id === activeApplicationId)?.interviews?.length || 0) + 1}
          onClose={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
          }}
          onSuccess={() => {
            setIsInterviewModalOpen(false);
            setActiveApplicationId(null);
            fetchApplications();
          }}
        />
      )}

      {profileModal.isOpen && profileModal.candidate && (
        <CandidateProfileModal
          isOpen={profileModal.isOpen}
          onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
          candidate={profileModal.candidate}
          resumeData={profileModal.resumeData}
          jobTitle={profileModal.jobTitle}
          appliedDate={profileModal.appliedDate}
          score={profileModal.score}
          status={profileModal.status}
          initialTab={profileModal.initialTab}
          applicationId={profileModal.applicationId}
          interviews={profileModal.interviews}
          initialFeedbackOpen={profileModal.initialFeedbackOpen}
          onRefresh={() => {
            fetchApplications();
            setProfileModal({ ...profileModal, isOpen: false });
          }}
        />
      )}
    </div>
  );
}
