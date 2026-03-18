"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

  const fetchApplications = useCallback(async () => {
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const [data, profileData] = await Promise.all([
        apiClient.get("/recruiter/applications/pipeline", token),
        apiClient.get("/recruiter/profile", token),
      ]);

      const appsData = data || [];
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
      `TalentFlow_Candidates_${new Date().toISOString().split("T")[0]}.csv`,
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-xl">
              <div className="h-8 w-8 rounded-full border-4 border-slate-900 border-t-transparent animate-spin" />
            </div>
          </div>
          <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">
            Loading Pipeline...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Top Navigation Bar - Now integrated without redundancy */}
      <header className="bg-white/80 border-b border-slate-200 h-16 flex items-center justify-between px-8 sticky top-0 z-20 backdrop-blur-md text-black">
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              Pipeline Active
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 shadow-sm cursor-pointer group hover:bg-white hover:border-slate-300 transition-all">
            <div className="w-8 h-8 bg-indigo-900 rounded-lg flex items-center justify-center text-[10px] text-white font-black shadow-lg">
              {profile?.full_name?.[0] || "R"}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                Recruiter
              </span>
              <span className="text-xs font-bold text-slate-900">
                {profile?.full_name}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto py-8">
        {/* Top: Current Openings Section */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Current Openings{" "}
              <span className="text-slate-300 ml-2">
                ({Object.keys(groupedApps).length})
              </span>
            </h2>
            <button className="text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-2 group">
              See all{" "}
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(groupedApps)
              .slice(0, 4)
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
                    className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group/card cursor-pointer"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 group-hover/card:rotate-6 transition-transform">
                        <Briefcase className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className={`text-[8px] font-black uppercase tracking-widest ${daysLeft < 5 ? "text-rose-500" : "text-slate-300"}`}
                        >
                          {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                        </span>
                        <MoreVertical className="w-3 h-3 text-slate-200" />
                      </div>
                    </div>

                    <h3 className="text-[12px] font-black text-slate-900 mb-1 group-hover/card:text-indigo-600 transition-colors uppercase italic tracking-tighter truncate">
                      {group.jobTitle}
                    </h3>
                    <div className="flex items-center gap-2 text-slate-400 mb-4">
                      <MapPin className="w-2.5 h-2.5" />
                      <span className="text-[8px] font-black uppercase tracking-widest truncate">
                        {group.applications[0]?.jobs.location || "Remote"}
                      </span>
                    </div>

                    <div className="flex items-end justify-between">
                      <div>
                        <span className="text-xl font-black text-slate-900 leading-none">
                          {totalApps}
                        </span>
                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">
                          Apps
                        </span>
                      </div>
                      <div
                        className={`px-1.5 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border ${
                          todayApps > 0
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                            : "bg-slate-50 text-slate-400 border-slate-100"
                        }`}
                      >
                        +{todayApps} today
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Bottom: Candidates Section */}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm">
          <div className="p-8 pb-4">
            <h2 className="text-xl font-black text-slate-900 mb-6 tracking-tight">
              Candidates
            </h2>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex-1 relative min-w-62.5">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  type="text"
                  placeholder="Search name, role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 pl-12 pr-4 py-3.5 rounded-xl text-[10px] font-bold text-slate-900 placeholder:text-slate-300 outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button className="flex items-center gap-2 px-4 py-3.5 bg-white border border-slate-100 rounded-xl text-slate-600 hover:bg-slate-50 transition-all">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {filterStatus === "all"
                        ? "Filter"
                        : filterStatus.replace("_", " ")}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 p-2">
                    {[
                      "all",
                      "applied",
                      "shortlisted",
                      "interview_scheduled",
                      "offered",
                      "rejected",
                      "closed",
                    ].map((status) => (
                      <button
                        key={status}
                        onClick={() => setFilterStatus(status)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                          filterStatus === status
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {status === "all"
                          ? "All Stages"
                          : status === "interview_scheduled"
                            ? "Interview"
                            : status === "closed"
                              ? "Hired"
                              : status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative group">
                  <button className="flex items-center gap-2 px-4 py-3.5 bg-white border border-slate-100 rounded-xl text-slate-600 hover:bg-slate-50 transition-all">
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {sortOrder === "newest"
                        ? "Sort: Newest"
                        : sortOrder === "name-asc"
                          ? "A-Z"
                          : "Top Score"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30 p-2">
                    {[
                      { l: "Newest", v: "newest" },
                      { l: "A-Z", v: "name-asc" },
                      { l: "Top Score", v: "score-desc" },
                    ].map((s) => (
                      <button
                        key={s.v}
                        onClick={() => setSortOrder(s.v as any)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                          sortOrder === s.v
                            ? "bg-indigo-50 text-indigo-600"
                            : "text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {s.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="h-8 w-px bg-slate-100 mx-1" />
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-2 px-5 py-3.5 bg-white border border-slate-100 rounded-xl text-slate-900 font-extrabold hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" strokeWidth={3} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Export
                  </span>
                </button>
              </div>
            </div>

            {selectedApps.length > 0 && (
              <div className="flex items-center gap-3 bg-indigo-50 p-3 rounded-xl border border-indigo-100 mb-6">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest px-3 border-r border-indigo-200">
                  {selectedApps.length} Selected
                </span>
                <button
                  disabled={
                    !applications
                      .filter((a) => selectedApps.includes(a.id))
                      .every((a) => a.status === "applied")
                  }
                  onClick={() => handleBulkStatusChange("shortlisted")}
                  className="bg-indigo-600 text-white font-black py-2 px-4 rounded-lg hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-30 uppercase text-[8px] tracking-widest active:scale-95"
                >
                  <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                  Shortlist
                </button>
                <button
                  onClick={() => setIsRejectionModalOpen(true)}
                  className="bg-red-50 text-red-600 font-black py-2 px-4 rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center gap-2 uppercase text-[8px] tracking-widest active:scale-95 border border-red-100"
                >
                  <XCircle className="h-3 w-3" strokeWidth={3} />
                  Reject
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto min-h-87.5">
            <table className="w-full text-left border-collapse min-w-212.5">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-100">
                  <th className="px-4 py-3 w-10">
                    <div className="h-4 w-4 rounded border-2 border-slate-200" />
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Role
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Location
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Candidate
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Applied
                  </th>
                  <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    Stage
                  </th>
                  <th className="px-4 py-3 w-12 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedApplications.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-24 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest"
                    >
                      No matching records found
                    </td>
                  </tr>
                ) : (
                  sortedApplications.map((app, idx) => (
                    <tr
                      key={app.id}
                      className="group hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedApps.includes(app.id)}
                          onChange={() => toggleSelect(app.id)}
                          className="h-4 w-4 rounded border-2 border-slate-200 text-indigo-600 transition-all cursor-pointer accent-indigo-600"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[10px] font-black text-indigo-600 uppercase italic tracking-tighter truncate max-w-30 block">
                          {app.jobs?.title || "Role"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-20 block">
                          {app.jobs?.location || "Remote"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px] uppercase shadow-sm shrink-0">
                            {app.candidate_profiles?.full_name?.charAt(0) ||
                              "?"}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <button className="text-[11px] font-black text-slate-900 tracking-tight hover:text-indigo-600 transition-colors truncate">
                                {app.candidate_profiles?.full_name}
                              </button>
                              {app.is_skill_match && (
                                <Zap className="w-2 h-2 text-indigo-600 fill-indigo-600 shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[9px] font-black text-slate-600 tracking-widest whitespace-nowrap">
                          {app.candidate_profiles?.phone_number || "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
                          {new Date(app.created_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border whitespace-nowrap block text-center ${
                            app.status === "closed"
                              ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                              : app.status === "applied"
                                ? "bg-slate-50 text-slate-400 border-slate-100"
                                : app.status === "shortlisted"
                                  ? "bg-amber-50 text-amber-600 border-amber-100"
                                  : app.status === "interview_scheduled"
                                    ? "bg-cyan-50 text-cyan-600 border-cyan-100"
                                    : app.status === "offered"
                                      ? "bg-rose-50 text-rose-600 border-rose-100"
                                      : app.status === "rejected"
                                        ? "bg-red-50 text-red-600 border-red-100"
                                        : "bg-slate-50 text-slate-400 border-slate-100"
                          }`}
                        >
                          {app.status === "closed"
                            ? "Hired"
                            : app.status === "interview_scheduled"
                              ? "Interview"
                              : app.status.replace("_", " ")}
                        </span>
                        {/* Show Join button or status if an interview is active */}
                        {(() => {
                          const interview = app.interviews?.find((i: any) => 
                            i.status === "scheduled" || i.status === "pending_confirmation"
                          );
                          if (!interview) return null;

                          const slot = interview.interview_slots?.find((s: any) => s.is_selected);
                          
                          return (
                            <div className="mt-2 space-y-1 animate-in fade-in zoom-in duration-500">
                              <div className={`flex items-center justify-center gap-1.5 px-1.5 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border ${
                                interview.status === "scheduled" 
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-100" 
                                  : "bg-amber-50 text-amber-700 border-amber-100"
                              }`}>
                                <Clock className="h-2.5 w-2.5" />
                                {interview.status === "scheduled" ? (
                                  slot ? new Date(slot.start_time).toLocaleString('en-US', {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                    timeZoneName: "short"
                                  }) : "COORDINATING..."
                                ) : (
                                  `R${interview.round_number} PROPOSED`
                                )}
                              </div>
                                <div className="space-y-1">
                                  {(() => {
                                    if (interview.status === "pending_confirmation") {
                                      return (
                                        <p className="text-[6px] text-amber-500 font-bold uppercase tracking-tighter text-center leading-none px-1 py-1 bg-amber-50/50 rounded-md border border-amber-100/50 italic">
                                          Awaiting Candidate Action
                                        </p>
                                      );
                                    }
                                    const now = new Date();
                                    const start = new Date(slot?.start_time || "");
                                    const end = new Date(slot?.end_time || "");
                                    const isActive = now >= new Date(start.getTime() - 5 * 60000) && now <= end;

                                    if (isActive) {
                                      return (
                                        <>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              try {
                                                const token = awsAuth.getToken();
                                                if (token) {
                                                  apiClient.post(`/interviews/${interview.id}/join-event`, {}, token);
                                                }
                                              } catch (err) {
                                                console.error("Failed to signal join:", err);
                                              }
                                              window.open(interview.meeting_link, "_blank");
                                            }}
                                            className="w-full flex items-center justify-center gap-1 px-1.5 py-1.5 bg-indigo-600 text-white rounded-lg text-[7px] font-black uppercase tracking-widest hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"
                                          >
                                            <Video className="h-2.5 w-2.5" />
                                            Join Protocol
                                          </button>
                                          <p className="text-[6px] text-slate-400 font-bold uppercase tracking-tighter text-center leading-none px-1">
                                            Host Notice: Log in on Jitsi to start
                                          </p>
                                        </>
                                      );
                                    }
                                    if (now > end) {
                                      return (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
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
                                              initialFeedbackOpen: true,
                                            });
                                          }}
                                          className="w-full px-2 py-1.5 bg-slate-900 text-white rounded-lg text-[7.5px] font-black uppercase tracking-widest hover:bg-slate-800 transition active:scale-95 animate-pulse"
                                        >
                                          Evaluate Result
                                        </button>
                                      );
                                    }
                                    return (
                                      <p className="text-[7px] text-slate-400 font-black uppercase text-center py-1 mt-1 bg-slate-50 rounded-lg border border-slate-100 italic">
                                        Locked Until Start
                                      </p>
                                    );
                                  })()}
                                </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {["shortlisted", "applied"].includes(app.status) && (
                            <button
                              onClick={() => {
                                setActiveApplicationId(app.id);
                                setIsInterviewModalOpen(true);
                              }}
                              className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-100 shadow-sm"
                              title="Schedule"
                            >
                              <Calendar className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setHistoryModal({
                                isOpen: true,
                                appId: app.id,
                                name:
                                  app.candidate_profiles?.full_name ||
                                  "Candidate",
                              });
                            }}
                            className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-slate-900 shadow-sm"
                            title="History"
                          >
                            <Clock className="h-4 w-4" />
                          </button>

                          <div className="relative group/menu">
                            <button className="p-2 bg-white border border-slate-100 rounded-lg text-slate-400 hover:text-slate-900 shadow-sm">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <div
                              className={`absolute right-0 ${idx >= sortedApplications.length - 2 && idx > 0 ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right"} w-48 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-40 p-2`}
                            >
                              <button
                                onClick={() =>
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
                                  })
                                }
                                className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                              >
                                <Users className="w-3 h-3" /> View Profile
                              </button>
                              <button
                                onClick={() =>
                                  setProfileModal({
                                    isOpen: true,
                                    candidate: app.candidate_profiles,
                                    resumeData: app.resume_data,
                                    jobTitle: app.jobs.title,
                                    appliedDate: app.created_at,
                                    score: app.profile_scores?.final_score || 0,
                                    status: app.status,
                                    initialTab: app.candidate_profiles
                                      .resume_path
                                      ? "original_resume"
                                      : "resume",
                                    applicationId: app.id,
                                    interviews: app.interviews,
                                  })
                                }
                                className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2"
                              >
                                <Eye className="w-3 h-3" /> View Resume
                              </button>
                              
                              {app.status !== "rejected" && app.status !== "offered" && (
                                <>
                                  <div className="h-px bg-slate-50 my-1 mx-2" />
                                  
                                  {app.status === "applied" && (
                                    <button
                                      onClick={() => {
                                        setActiveApplicationId(app.id);
                                        handleBulkStatusChange("shortlisted");
                                      }}
                                      className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                    >
                                      <Zap className="w-3 h-3" /> Shortlist
                                    </button>
                                  )}

{app.status === "shortlisted" && !app.interviews?.some(i => i.status === "pending_confirmation" || i.status === "scheduled") && (
                                    <button
                                      onClick={() => {
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
                                      className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                    >
                                      <Video className="w-3 h-3" /> Propose Next Round
                                    </button>
                                  )}

                                  {app.status === "interview_scheduled" && (
                                    <button
                                      onClick={() => {
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
                                          initialFeedbackOpen: true,
                                        });
                                      }}
                                      className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center gap-2"
                                    >
                                      <Video className="w-3 h-3" /> Log Evaluation
                                    </button>
                                  )}

                                  <button
                                    onClick={() => {
                                      setActiveApplicationId(app.id);
                                      handleBulkStatusChange("offered");
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"
                                  >
                                    <CheckCircle2 className="w-3 h-3" /> Make Offer
                                  </button>

                                  <button
                                    onClick={() => {
                                      setActiveApplicationId(app.id);
                                      setIsRejectionModalOpen(true);
                                    }}
                                    className="w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                                  >
                                    <XCircle className="w-3 h-3" /> Reject
                                  </button>
                                </>
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
        </div>
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
