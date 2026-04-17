"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Search,
  CheckCircle2,
  XCircle,
  Filter,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Target,
  Zap,
  Clock,
  Calendar,
  Award,
  Download,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Video,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RecruiterSidebar from "@/components/RecruiterSidebar";
import RejectionModal from "@/components/RejectionModal";
import ApplicationHistoryModal from "@/components/ApplicationHistoryModal";
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

interface GroupedApplications {
  [jobId: string]: {
    jobTitle: string;
    jobStatus: string;
    applications: Application[];
  };
}

export default function ApplicationsPipelinePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(
    null,
  );
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    appId: string;
    name: string;
  }>({
    isOpen: false,
    appId: "",
    name: "",
  });
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
  const [expandedJobs, setExpandedJobs] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<
    "newest" | "name-asc" | "score-desc"
  >("newest");
  const [showAllOpenings, setShowAllOpenings] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const [data, profileData, interviewData] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token),
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/interviews/my", token),
      ]);

      const appsData = (data || []).map((app: any) => ({
        ...app,
        interviews: (interviewData || []).filter(
          (i: any) => i.application_id === app.id
        ),
      }));
      setApplications(appsData);
      setProfile(profileData);

      // Initialize expanded state for all jobs
      const jobs = Array.from(new Set(appsData.map((a: any) => a.job_id)));
      const expanded: Record<string, boolean> = {};
      jobs.forEach((id: any) => (expanded[id] = true));
      setExpandedJobs(expanded);
    } catch (err) {
      console.error("Failed to fetch applications:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchApplications();
    // Refresh recruiter pipeline every 1 minute to track selection updates
    const interval = setInterval(fetchApplications, 60000);
    return () => clearInterval(interval);
  }, [fetchApplications]);

  const trackProfileView = async (candidateId: string, jobId?: string) => {
    try {
      console.log("[TRACKING] Starting profile view tracking for:", candidateId);
      console.log("[TRACKING] Job ID:", jobId);
      
      const token = awsAuth.getToken();
      console.log("[TRACKING] Token exists:", !!token);
      if (!token) {
        console.log("[TRACKING] No token, skipping");
        return;
      }

      const url = jobId 
        ? `/analytics/profile/${candidateId}/view?job_id=${jobId}`
        : `/analytics/profile/${candidateId}/view`;
      
      console.log("[TRACKING] Sending POST to", url);
      const response = await apiClient.post(
        url,
        {},
        token
      );
      console.log("[TRACKING] ✓ Profile view tracked:", candidateId);
      console.log("[TRACKING] Response:", response);
      if (response?.notification_sent) {
        console.log("[TRACKING] ✓ Notification sent to candidate for job application");
      }
    } catch (err: any) {
      console.error("[TRACKING] ✗ Failed to track profile view:", candidateId);
      console.error("[TRACKING] Error details:", err);
      if (err?.response) {
        console.error("[TRACKING] API Status:", err.response.status);
        console.error("[TRACKING] API Response:", err.response.data);
      }
    }
  };

  const exportToCSV = () => {
    if (filteredApplications.length === 0) return;

    const headers = [
      "Role",
      "Location",
      "Candidate",
      "Contact",
      "Applied Date",
      "Stage",
      "Score",
    ];
    const rows = filteredApplications.map((app) => [
      app.jobs?.title || "N/A",
      app.jobs?.location || "Remote",
      app.candidate_profiles?.full_name || "Unknown",
      app.candidate_profiles?.phone_number || "Hidden",
      new Date(app.created_at).toLocaleDateString(),
      app.status.toUpperCase(),
      app.profile_scores?.final_score || 0,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
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
    setSelectedApps((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const toggleJobExpansion = (jobId: string) => {
    setExpandedJobs((prev) => ({ ...prev, [jobId]: !prev[jobId] }));
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

  // Filter application list based on search and status
  const filteredApplications = applications.filter((app) => {
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

    return (nameMatch || roleMatch || jobMatch) && statusMatch;
  });

  // Apply Sorting
  const sortedApplications = [...filteredApplications].sort((a, b) => {
    if (sortOrder === "newest")
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    if (sortOrder === "name-asc")
      return (a.candidate_profiles?.full_name || "").localeCompare(
        b.candidate_profiles?.full_name || "",
      );
    if (sortOrder === "score-desc")
      return (
        (b.profile_scores?.final_score || 0) -
        (a.profile_scores?.final_score || 0)
      );
    return 0;
  });

  // Grouping logic
  const groupedApps: GroupedApplications = sortedApplications.reduce(
    (acc, app) => {
      const jobId = app.job_id;
      if (!acc[jobId]) {
        acc[jobId] = {
          jobTitle: app.jobs.title,
          jobStatus: app.jobs.status,
          applications: [],
        };
      }
      acc[jobId].applications.push(app);
      return acc;
    },
    {} as GroupedApplications,
  );

  // Sorting within groups by Skill Match first, then Match Score
  Object.values(groupedApps).forEach((group) => {
    group.applications.sort((a: any, b: any) => {
      // Priority 1: Skill Match
      if (a.is_skill_match && !b.is_skill_match) return -1;
      if (!a.is_skill_match && b.is_skill_match) return 1;

      // Priority 2: Match Score
      const scoreA = a.profile_scores?.final_score || 0;
      const scoreB = b.profile_scores?.final_score || 0;
      return scoreB - scoreA;
    });
  });

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-20 space-y-10">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Pipeline</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your candidate applications and interviews.</p>
        </div>
        <Link
          href="/dashboard/recruiter/hiring/jobs"
          className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors shadow-md flex items-center justify-center gap-2 w-full md:w-auto"
        >
          <Briefcase className="h-4 w-4" />
          View Jobs
        </Link>
      </header>

      {/* Current Openings Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Current Openings</h2>
          <span className="text-sm font-bold text-slate-500">
            {Object.keys(groupedApps).length} active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(groupedApps)
            .slice(0, showAllOpenings ? undefined : 4)
            .map(([jobId, group]) => {
              const totalApps = group.applications.length;
              const today = new Date().toISOString().split("T")[0];
              const todayApps = group.applications.filter((a) =>
                a.created_at && String(a.created_at).startsWith(today),
              ).length;

              // Calculate days left (fallback: 30 days from creation)
              const createdAtStr = group.applications[0]?.jobs?.created_at || group.applications[0]?.created_at || new Date().toISOString();
              const createdAt = new Date(createdAtStr);
              const deadline = new Date(
                createdAt.getTime() + 30 * 24 * 60 * 60 * 1000,
              );
              const daysLeft = Math.ceil(
                (deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              );

              return (
                <div
                  key={jobId}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${daysLeft < 5 ? "bg-red-50 border-red-200 text-red-600" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                      {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 mb-2 line-clamp-1">
                    {group.jobTitle}
                  </h3>
                  
                  <div className="flex items-center gap-2 text-slate-500 mb-3">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs truncate">
                      {group.applications[0]?.jobs.location || "Remote"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-slate-900">{totalApps}</span>
                      <span className="text-xs text-slate-400 ml-1">applications</span>
                    </div>
                    {todayApps > 0 && (
                      <span className="text-xs font-bold text-emerald-600">+{todayApps} today</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {Object.keys(groupedApps).length > 4 && (
          <button 
            onClick={() => setShowAllOpenings(!showAllOpenings)}
            className="w-full py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
          >
            {showAllOpenings ? "Show Less" : "Show All"}
          </button>
        )}
      </section>

      {/* Candidates Search & Filters */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Candidates</h2>

        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, role, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                filterStatus === "all"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              All
            </button>
            {["applied", "shortlisted", "interview_scheduled", "offered", "rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${
                  filterStatus === status
                    ? "bg-indigo-600 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {status === "interview_scheduled"
                  ? "Interview"
                  : status === "closed"
                    ? "Hired"
                    : status.replace("_", " ")}
              </button>
            ))}
          </div>

          {sortedApplications.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative group">
                <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <span className="text-xs">
                    {sortOrder === "newest"
                      ? "Newest"
                      : sortOrder === "name-asc"
                        ? "A-Z"
                        : "Top Score"}
                  </span>
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute left-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 p-1">
                  {[
                    { label: "Newest", value: "newest" },
                    { label: "A-Z", value: "name-asc" },
                    { label: "Top Score", value: "score-desc" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setSortOrder(opt.value as any)}
                      className={`w-full text-left px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                        sortOrder === opt.value
                          ? "bg-indigo-50 text-indigo-600"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={exportToCSV}
                className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedApps.length > 0 && (
          <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-6">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest px-3 border-r border-indigo-200">
              {selectedApps.length} Selected
            </span>
            <button
              disabled={
                !applications
                  .filter((a) => selectedApps.includes(a.id))
                  .every((a) => a.status === "applied")
              }
              onClick={() => handleBulkStatusChange("shortlisted")}
              className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 className="h-3 w-3" />
              Shortlist
            </button>
            <button
              onClick={() => setIsRejectionModalOpen(true)}
              className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold border border-red-200 rounded hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <XCircle className="h-3 w-3" />
              Reject
            </button>
          </div>
        )}

        {/* Candidates Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedApps.length === sortedApplications.length && sortedApplications.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedApps(sortedApplications.map((a) => a.id));
                      } else {
                        setSelectedApps([]);
                      }
                    }}
                    className="h-4 w-4 rounded border-2 border-slate-300 cursor-pointer accent-indigo-600"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Candidate</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Applied</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Score</th>
                <th className="px-4 py-3 w-10 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedApplications.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-16 text-center text-slate-400 font-bold text-sm"
                  >
                    No candidates found
                  </td>
                </tr>
              ) : (
                sortedApplications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedApps.includes(app.id)}
                        onChange={() => toggleSelect(app.id)}
                        className="h-4 w-4 rounded border-2 border-slate-300 cursor-pointer accent-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3">
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
                        className="text-sm font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1"
                      >
                        {app.candidate_profiles?.full_name}
                        {app.is_skill_match && (
                          <Zap className="w-3 h-3 text-indigo-600 fill-indigo-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{app.jobs?.title}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{app.candidate_profiles?.location || "Location not provided"}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(app.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap border ${
                          app.status === "closed"
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : app.status === "applied"
                              ? "bg-slate-50 text-slate-500 border-slate-100"
                              : app.status === "shortlisted"
                                ? "bg-amber-50 text-amber-600 border-amber-100"
                                : app.status === "interview_scheduled"
                                  ? "bg-blue-50 text-blue-600 border-blue-100"
                                  : app.status === "offered"
                                    ? "bg-rose-50 text-rose-600 border-rose-100"
                                    : "bg-red-50 text-red-600 border-red-100"
                        }`}
                      >
                        {app.status === "closed"
                          ? "Hired"
                          : app.status === "interview_scheduled"
                            ? "Interview"
                            : app.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">
                      {app.profile_scores?.final_score ? (
                        `${app.profile_scores.final_score > 1 ? app.profile_scores.final_score.toFixed(0) : (app.profile_scores.final_score * 100).toFixed(0)}%`
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {app.status === "interview_scheduled" && app.interviews?.some(i => i.status === "scheduled") && (
                          <button
                            onClick={() => {
                              trackProfileView(app.candidate_id);
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
                            className="px-3 py-1.5 bg-indigo-600 text-white border border-indigo-600 rounded-lg hover:bg-indigo-700 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95"
                            title="Join Interview"
                          >
                            <Video className="h-4 w-4" />
                            Join
                          </button>
                        )}
                        {["shortlisted", "interview_scheduled"].includes(app.status) && (
                          <button
                            onClick={() => {
                              setActiveApplicationId(app.id);
                              setIsInterviewModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-1.5 active:scale-95"
                            title="Schedule Interview"
                          >
                            <Calendar className="h-4 w-4" />
                            Schedule
                          </button>
                        )}
                        <button
                          onClick={() => {
                            trackProfileView(app.candidate_id);
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
                          className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-1.5 active:scale-95"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                          Profile
                        </button>

                        <div className="relative group/menu">
                          <button className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-all hover:shadow-sm" title="More options">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-3 w-48 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 z-50 py-1">
                            {app.status === "applied" && (
                              <button
                                onClick={() => {
                                  setActiveApplicationId(app.id);
                                  handleBulkStatusChange("shortlisted");
                                }}
                                className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                Shortlist
                              </button>
                            )}
                            {app.status !== "rejected" && app.status !== "offered" && app.status !== "closed" && (
                              <button
                                onClick={() => {
                                  setActiveApplicationId(app.id);
                                  setIsRejectionModalOpen(true);
                                }}
                                className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            )}
                            {app.status === "shortlisted" && !app.interviews?.some(i => i.status === "pending_confirmation" || i.status === "scheduled") && (
                              <button
                                onClick={() => {
                                  trackProfileView(app.candidate_id);
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
                                className="w-full text-left px-4 py-2.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                              >
                                <Video className="w-4 h-4" />
                                Schedule Interview
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modals */}
      <RejectionModal
        isOpen={isRejectionModalOpen}
        onClose={() => {
          setIsRejectionModalOpen(false);
          setActiveApplicationId(null);
        }}
        onConfirm={(reason) => handleBulkStatusChange("rejected", reason)}
        count={activeApplicationId ? 1 : selectedApps.length}
      />

      <ApplicationHistoryModal
        isOpen={historyModal.isOpen}
        onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
        applicationId={historyModal.appId}
        candidateName={historyModal.name}
      />

      {isInterviewModalOpen && activeApplicationId && (
        <InterviewScheduler
          candidateName={
            applications.find((a) => a.id === activeApplicationId)
              ?.candidate_profiles.full_name || "Candidate"
          }
          applicationId={activeApplicationId}
          initialRoundNumber={(applications.find(a => a.id === activeApplicationId)?.interviews?.length || 0) + 1}
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
