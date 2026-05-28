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
import InterviewScheduler from "@/components/InterviewScheduler";
import CandidateProfileModal from "@/components/CandidateProfileModal";

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
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "name-asc" | "score-desc">("newest");
  const [selectedJobId, setSelectedJobId] = useState<string>(searchParams.get("job") || "");
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

      const [data, interviewData] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token),
        apiClient.get("/interviews/my", token),
      ]);

      const appsData = (data || []).map((app: any) => ({
        ...app,
        interviews: (interviewData || []).filter((i: any) => i.application_id === app.id),
      }));

      setApplications(appsData);
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
      setSelectedApps([]);
      setActiveApplicationId(null);
      fetchApplications();
    } catch (err) {
      console.error("Failed to update statuses:", err);
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

      return (nameMatch || roleMatch || jobMatch) && statusMatch && openingMatch;
    });
  }, [applications, searchTerm, filterStatus, selectedJobId]);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_42%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
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
      `}</style>

      <main className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1700px] flex-col gap-4 px-4 py-4">
        <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex-shrink-0 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Candidate Pipeline</p>
              <p className="mt-1 text-sm text-slate-500">Review applicants, schedule interviews, and move hiring forward</p>
            </div>

            <div className="apps-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search candidate, role, or opening"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                />
              </div>

              <div>
                <p className="mb-2.5 text-[11px] font-bold text-slate-600">Hiring Stage</p>
                <div className="space-y-2">
                  {statusOptions.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setFilterStatus(status.value)}
                      className={`w-full rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                        filterStatus === status.value
                          ? "bg-[#FF8A00] text-white"
                          : "text-slate-600 hover:bg-[#FFF6ED] hover:text-[#FF8A00]"
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2.5 text-[11px] font-bold text-slate-600">Sort Candidates</p>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as "newest" | "name-asc" | "score-desc")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                >
                  <option value="newest">Newest first</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="score-desc">Best match first</option>
                </select>
              </div>

              <div className="rounded-2xl border border-orange-100 bg-[#FFF8F1] p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C96B00]">Openings</p>
                  {selectedJobId && (
                    <button
                      onClick={() => setSelectedJobId("")}
                      className="text-[10px] font-black uppercase tracking-wider text-[#C96B00] hover:text-[#FF8A00]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {openings.length === 0 ? (
                    <p className="text-xs text-slate-500">No openings with applicants yet.</p>
                  ) : (
                    openings.map((opening) => (
                      <button
                        key={opening.id}
                        onClick={() => setSelectedJobId(opening.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
                          selectedJobId === opening.id
                            ? "border-[#FF8A00] bg-[#FFF1E0]"
                            : "border-orange-100 bg-white hover:border-[#FF8A00]/50"
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{opening.jobTitle}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-1">{opening.location}</p>
                        <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#C96B00]">
                          {opening.count} candidate{opening.count !== 1 ? "s" : ""}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white shadow-[0_8px_24px_rgba(255,138,0,0.08)]">
            <div className="flex flex-col gap-3 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF7EE] to-white px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#FF8A00]">Applications View</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {selectedOpening
                      ? `Showing candidates for ${selectedOpening.jobTitle}`
                      : "Showing candidates across all openings"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </button>
                  <Link
                    href="/dashboard/recruiter/hiring/jobs"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00]"
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    Open Roles
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-orange-100 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Candidates</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{sortedApplications.length}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Interview Stage</p>
                  <p className="mt-1 text-lg font-black text-blue-800">{interviewReadyCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Offers</p>
                  <p className="mt-1 text-lg font-black text-emerald-800">{offerCount}</p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-[#FFF8F1] px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#C96B00]">Selected</p>
                  <p className="mt-1 text-lg font-black text-slate-900">{selectedApps.length}</p>
                </div>
              </div>

              {selectedApps.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-orange-200 bg-[#FFF3E3] p-2.5">
                  <span className="rounded-lg bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#C96B00]">
                    {selectedApps.length} selected
                  </span>
                  <button
                    disabled={!applications.filter((app) => selectedApps.includes(app.id)).every((app) => app.status === "applied")}
                    onClick={() => handleBulkStatusChange("shortlisted")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Shortlist
                  </button>
                  <button
                    onClick={() => setIsRejectionModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>

            <div className="apps-scroll flex-1 min-h-0 overflow-y-auto p-4">
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
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {sortedApplications.map((app) => {
                    const hasScheduledInterview = app.interviews?.some((item: any) => item.status === "scheduled");
                    const hasInterviewFlow = app.interviews?.some((item: any) => ["pending_confirmation", "scheduled"].includes(item.status));
                    const canSchedule = ["shortlisted", "interview_scheduled"].includes(app.status);
                    const canReject = !["rejected", "offered", "closed"].includes(app.status);
                    const canShortlist = app.status === "applied";

                    return (
                      <article
                        key={app.id}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.05)] transition-all hover:border-orange-200 hover:shadow-[0_10px_24px_rgba(255,138,0,0.1)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selectedApps.includes(app.id)}
                              onChange={() => toggleSelect(app.id)}
                              className="mt-1 h-4 w-4 cursor-pointer rounded border-2 border-slate-300 accent-[#FF8A00]"
                            />
                            <div>
                              <button
                                onClick={() => {
                                  trackProfileView(app.candidate_id, app.job_id);
                                  setProfileModal({
                                    isOpen: true,
                                    candidate: app.candidate_profiles,
                                    resumeData: app.resume_data,
                                    jobTitle: app.jobs.title,
                                    appliedDate: app.created_at,
                                    score: app.profile_scores?.final_score || 0,
                                    status: app.status,
                                    initialTab: "application",
                                    applicationId: app.id,
                                    interviews: app.interviews,
                                  });
                                }}
                                className="text-left text-base font-black text-slate-900 transition hover:text-[#FF8A00]"
                              >
                                {app.candidate_profiles?.full_name || "Candidate"}
                              </button>
                              <p className="mt-0.5 text-sm text-slate-500">
                                {app.candidate_profiles?.current_role || "Role not specified"}
                              </p>
                            </div>
                          </div>

                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${getStatusClasses(app.status)}`}>
                            {getStatusLabel(app.status)}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Opening</p>
                            <p className="mt-1 font-semibold text-slate-800 line-clamp-1">{app.jobs?.title}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Match Score</p>
                            <p className="mt-1 font-semibold text-slate-800">{getScore(app)}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Candidate Location</p>
                            <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800 line-clamp-1">
                              <MapPin className="h-3.5 w-3.5 text-slate-500" />
                              {app.candidate_profiles?.location || "Not provided"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Applied On</p>
                            <p className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
                              <Calendar className="h-3.5 w-3.5 text-slate-500" />
                              {new Date(app.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                          {canShortlist && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(app.id);
                                handleBulkStatusChange("shortlisted");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Shortlist
                            </button>
                          )}

                          {canSchedule && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(app.id);
                                setIsInterviewModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              {hasInterviewFlow ? "Update Interview" : "Schedule Interview"}
                            </button>
                          )}

                          {app.status === "interview_scheduled" && hasScheduledInterview && (
                            <button
                              onClick={() => {
                                trackProfileView(app.candidate_id, app.job_id);
                                setProfileModal({
                                  isOpen: true,
                                  candidate: app.candidate_profiles,
                                  resumeData: app.resume_data,
                                  jobTitle: app.jobs.title,
                                  appliedDate: app.created_at,
                                  score: app.profile_scores?.final_score || 0,
                                  status: app.status,
                                  initialTab: "interview",
                                  applicationId: app.id,
                                  interviews: app.interviews,
                                });
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700 transition hover:bg-blue-100"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Interview Details
                            </button>
                          )}

                          <button
                            onClick={() => {
                              trackProfileView(app.candidate_id, app.job_id);
                              setProfileModal({
                                isOpen: true,
                                candidate: app.candidate_profiles,
                                resumeData: app.resume_data,
                                jobTitle: app.jobs.title,
                                appliedDate: app.created_at,
                                score: app.profile_scores?.final_score || 0,
                                status: app.status,
                                initialTab: "application",
                                applicationId: app.id,
                                interviews: app.interviews,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Profile
                          </button>

                          {canReject && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(app.id);
                                setIsRejectionModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
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

      {isInterviewModalOpen && activeApplicationId && (
        <InterviewScheduler
          candidateName={applications.find((item) => item.id === activeApplicationId)?.candidate_profiles.full_name || "Candidate"}
          applicationId={activeApplicationId}
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
