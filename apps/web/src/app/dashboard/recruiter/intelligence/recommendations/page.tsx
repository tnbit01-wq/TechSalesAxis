"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  Users,
  Search,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Zap,
  Filter,
  Plus,
  ChevronRight,
  User,
  Star,
  Target,
  Trophy,
  MapPin,
  DollarSign,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import RecruiterSidebar from "@/components/RecruiterSidebar";
import LockedView from "@/components/dashboard/LockedView";
import CandidateProfileModal from "@/components/CandidateProfileModal";
import JobInviteModal from "@/components/JobInviteModal";
import { toast } from "sonner";

interface Candidate {
  user_id: string;
  full_name: string;
  email?: string;
  current_role: string;
  experience: "fresher" | "mid" | "senior" | "leadership";
  years_of_experience: number;
  culture_match_score: number;
  match_reasoning?: string;
  skills: string[];
  profile_photo_url?: string;
  resume_path?: string;
  identity_verified?: boolean;
  profile_strength?: string;
}

interface RecruiterProfile {
  assessment_status: string;
  companies: {
    profile_score: number;
  };
}

interface PostedJobContext {
  job_id: string;
  title: string;
  location?: string;
  experience_band?: string;
  skills_required?: string[];
}

const READINESS_OPTIONS = [
  { value: "immediate", label: "Immediate joiner", group: "Availability" },
  { value: "short_notice", label: "Notice period <= 30 days", group: "Availability" },
  { value: "long_notice", label: "Notice period >= 60 days", group: "Availability" },
  { value: "active_job_seeker", label: "Actively looking", group: "Intent" },
  { value: "passive_candidate", label: "Passive / open to move", group: "Intent" },
  { value: "between_roles", label: "Currently between jobs", group: "Employment status" },
  { value: "laid_off_recently", label: "Recently laid off", group: "Employment status" },
  { value: "recent_graduate_student", label: "Student / recent graduate", group: "Employment status" },
  { value: "willing_to_relocate", label: "Willing to relocate", group: "Work setup" },
  { value: "remote_only", label: "Remote only", group: "Work setup" },
  { value: "contract_preferred", label: "Contract preferred", group: "Work setup" },
  { value: "flexible", label: "Flexible work type", group: "Work setup" },
  { value: "salary_seeking_raise", label: "Seeking >=20% raise", group: "Compensation" },
  { value: "high_fit_by_compensation", label: "Within role budget", group: "Compensation" },
  { value: "needs_salary_clarification", label: "Missing salary expectation", group: "Compensation" },
  { value: "requires_visa_sponsorship", label: "Needs visa sponsorship", group: "Mobility" },
];

export default function RecommendationsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(["skill_match"]);
  const [appliedFilters, setAppliedFilters] = useState<string[]>(["skill_match"]);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [appliedSelectedJobId, setAppliedSelectedJobId] = useState<string>("");
  const [postedJob, setPostedJob] = useState<PostedJobContext | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearchTerm, setAppliedSearchTerm] = useState("");
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [appliedFilterExperience, setAppliedFilterExperience] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [appliedFilterLocation, setAppliedFilterLocation] = useState<string>("");
  const [filterMaxSalary, setFilterMaxSalary] = useState<string>("");
  const [appliedFilterMaxSalary, setAppliedFilterMaxSalary] = useState<string>("");
  const [selectedReadinessFilters, setSelectedReadinessFilters] = useState<string[]>([]);
  const [appliedReadinessFilters, setAppliedReadinessFilters] = useState<string[]>([]);
  const [selectedCandidateTypes, setSelectedCandidateTypes] = useState<string[]>(["active_verified", "active_unverified", "passive"]);
  const [appliedCandidateTypes, setAppliedCandidateTypes] = useState<string[]>(["active_verified", "active_unverified", "passive"]);
  const [minCultureScore, setMinCultureScore] = useState<string>("");
  const [appliedMinCultureScore, setAppliedMinCultureScore] = useState<string>("");

  const [currencySymbol, setCurrencySymbol] = useState<string>("$");
  const [isSyncing, setIsSyncing] = useState(false);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [personalInfoUnlocked, setPersonalInfoUnlocked] = useState<Record<string, boolean>>({});

  // Check if candidate has unlocked access to personal info
  const hasAccessToPersonalInfo = (candidateId: string): boolean => {
    const candidateApplications = pipelineData.filter(app => app.candidate_id === candidateId || app.app?.candidate_id === candidateId);
    
    if (candidateApplications.length === 0) return false;

    return candidateApplications.some(app => {
      const appStatus = app.status || app.app?.status || '';
      if (appStatus.toLowerCase() === 'rejected') return false;
      const isSensitiveStatus = ['applied', 'shortlisted', 'interview_scheduled', 'offered', 'hired'].includes(appStatus.toLowerCase());
      const hasInviteReply = app.invite_message_replied || app.has_replied_to_invite || false;
      return isSensitiveStatus || hasInviteReply;
    });
  };

  // Blur personal info if not unlocked
  const getDisplayName = (fullName: string, candidateId: string): string => {
    if (personalInfoUnlocked[candidateId] || hasAccessToPersonalInfo(candidateId)) {
      return fullName;
    }
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}**** ${parts[parts.length - 1].charAt(0)}****`;
    }
    return parts[0].charAt(0) + '****';
  };

  const toggleFilter = (mode: string) => {
    setActiveFilters([mode]);
    if (mode === "skill_match") {
      // Skills Match already enforces target experience (match or adjacent).
      setFilterExperience("all");
    }
  };

  const toggleExperienceFilter = (band: string) => {
    setFilterExperience(band);
  };

  const toggleReadinessFilter = (value: string) => {
    setSelectedReadinessFilters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const normalizeRecommendationList = (response: any): Candidate[] => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    return [];
  };

  const selectedReadinessLabels = READINESS_OPTIONS
    .filter((option) => selectedReadinessFilters.includes(option.value))
    .map((option) => option.label);

  const handleApplyFilters = () => {
    setAppliedFilters(activeFilters);
    setAppliedSelectedJobId(selectedJobId);
    setAppliedSearchTerm(searchTerm);
    setAppliedFilterExperience(filterExperience);
    setAppliedFilterLocation(filterLocation);
    setAppliedFilterMaxSalary(filterMaxSalary);
    setAppliedReadinessFilters(selectedReadinessFilters);
    setAppliedCandidateTypes(selectedCandidateTypes);
    setAppliedMinCultureScore(minCultureScore);
  };

  const [profileModal, setProfileModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
    initialTab?: string;
  }>({
    isOpen: false,
    candidate: null,
    initialTab: "resume",
  });

  const [inviteModal, setInviteModal] = useState<{
    isOpen: boolean;
    candidate: Candidate | null;
  }>({
    isOpen: false,
    candidate: null,
  });

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setIsSyncing(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      // Handle search params for skill matching
      const params = new URLSearchParams(window.location.search);
      const initialSkills = params.get("skills");
      const jobIdFromUrl = params.get("job_id");

      const [profileData, jobsData, pipelineResponse] = await Promise.all([
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/jobs", token),
        apiClient.get("/recruiter/applications/pipeline", token),
      ]);

      const jobList = Array.isArray(jobsData) ? jobsData : [];
      const preferredJobId = String(appliedSelectedJobId || selectedJobId || jobIdFromUrl || jobList.find((job) => job.status === "active")?.id || jobList[0]?.id || "");
      const selectedJob = jobList.find((job) => String(job.id) === preferredJobId) || null;

      if (preferredJobId && preferredJobId !== selectedJobId) {
        setSelectedJobId(preferredJobId);
      }
      if (preferredJobId && preferredJobId !== appliedSelectedJobId) {
        setAppliedSelectedJobId(preferredJobId);
      }

      const modesStr = appliedFilters.join(",");
      const isSkillMatch = appliedFilters.includes("skill_match");
      const baseUrl = isSkillMatch && preferredJobId
        ? `/recruiter/jobs/${encodeURIComponent(preferredJobId)}/recommended-candidates?filter_type=${modesStr}`
        : `/recruiter/recommended-candidates?filter_type=${modesStr}`;

      let url = baseUrl;

      if (!isSkillMatch && jobIdFromUrl) {
        url += `&job_id=${encodeURIComponent(jobIdFromUrl)}`;
      }
      if (appliedFilters.includes("skill_match") && initialSkills) {
        url += `&skills=${encodeURIComponent(initialSkills)}`;
      }
      if (appliedFilterLocation) url += `&location=${encodeURIComponent(appliedFilterLocation)}`;
      if (appliedFilterMaxSalary) url += `&max_salary=${encodeURIComponent(appliedFilterMaxSalary)}`;
      if (appliedReadinessFilters.length > 0) {
        url += `&career_readiness=${encodeURIComponent(appliedReadinessFilters.join(","))}`;
      }
      if (appliedFilterExperience !== "all") {
        url += `&experience_band=${encodeURIComponent(appliedFilterExperience)}`;
      }
      if (appliedSearchTerm) url += `&skills=${encodeURIComponent(appliedSearchTerm)}`;
      if (appliedMinCultureScore) {
        url += `&min_culture_score=${encodeURIComponent(appliedMinCultureScore)}`;
      }
      if (appliedCandidateTypes.length > 0) {
        url += `&candidate_types=${encodeURIComponent(appliedCandidateTypes.join(","))}`;
      }

      const recData = await apiClient.get(url, token);

      setCandidates(normalizeRecommendationList(recData));
      setPostedJob(selectedJob ? {
        job_id: selectedJob.id,
        title: selectedJob.title,
        location: selectedJob.location,
        experience_band: selectedJob.experience_band,
        skills_required: selectedJob.skills_required || [],
      } : recData?.job ? {
        job_id: recData.job.job_id,
        title: recData.job.title,
        location: recData.job.location,
        experience_band: recData.job.experience_band,
        skills_required: recData.job.skills_required || [],
      } : null);
      setRecruiterProfile(profileData);
      setJobs(jobList);
      setPipelineData(pipelineResponse || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      toast.error("Algorithmic Sync Failed: Could not load recommendations");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [appliedFilters, appliedFilterExperience, appliedFilterLocation, appliedFilterMaxSalary, appliedReadinessFilters, appliedSearchTerm, router, appliedSelectedJobId, selectedJobId, appliedCandidateTypes, appliedMinCultureScore]);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      const firstActiveJob = jobs.find((job) => job.status === "active");
      setSelectedJobId(firstActiveJob?.id || jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilter = params.get("filter") as any;
    if (initialFilter && (initialFilter === "skill_match" || initialFilter === "understanding_and_assessment" || initialFilter === "culture_fit")) {
      setActiveFilters([initialFilter === "understanding_and_assessment" ? "culture_fit" : initialFilter]);
    }
  }, []);

  useEffect(() => {
    // Detect Currency based on Location
    const loc = filterLocation.toLowerCase();
    if (loc.includes("india") || loc.includes("mumbai") || loc.includes("bangalore") || loc.includes("delhi") || loc.includes("pune") || loc.includes("hyd")) {
      setCurrencySymbol("₹");
    } else if (loc.includes("uk") || loc.includes("london") || loc.includes("manchester")) {
      setCurrencySymbol("£");
    } else if (loc.includes("europe") || loc.includes("germany") || loc.includes("france") || loc.includes("dublin") || loc.includes("paris") || loc.includes("berlin")) {
      setCurrencySymbol("€");
    } else {
      setCurrencySymbol("$");
    }
  }, [filterLocation]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleInviteCandidate = async (
    jobId: string,
    message: string,
    customTitle?: string,
  ) => {
    if (!inviteModal.candidate) return;
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        `/recruiter/candidate/${inviteModal.candidate.user_id}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );

      toast.success(`Invitation sent to ${inviteModal.candidate.full_name}`);
      setInviteModal({ isOpen: false, candidate: null });
    } catch (err: any) {
      console.error("Failed to invite candidate:", err);
      toast.error(err.message || "Invitation cycle failed");
    }
  };

  const trackProfileView = async (candidateId: string) => {
    try {
      console.log("[TRACKING] Starting profile view tracking for:", candidateId);
      const token = awsAuth.getToken();
      console.log("[TRACKING] Token exists:", !!token);
      if (!token) {
        console.log("[TRACKING] No token, skipping");
        return;
      }
      console.log("[TRACKING] Sending POST to /analytics/profile/" + candidateId + "/view");
      const response = await apiClient.post(
        `/analytics/profile/${candidateId}/view`,
        {},
        token,
      );
      console.log("[TRACKING] ✓ Profile view tracked:", candidateId);
      console.log("[TRACKING] Response:", response);
    } catch (err: any) {
      console.error("[TRACKING] ✗ Failed to track profile view:", candidateId);
      console.error("[TRACKING] Error details:", err);
    }
  };

  const handleViewProfile = async (
    candidate: Candidate,
    tab: string = "resume",
  ) => {
    // Track profile view
    await trackProfileView(candidate.user_id);
    
    setIsFetchingProfile(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      const fullCandidate = await apiClient.get(
        `/recruiter/candidate/${candidate.user_id}`,
        token,
      );

      setProfileModal({
        isOpen: true,
        candidate: { ...candidate, ...fullCandidate },
        initialTab: tab,
      });
    } catch (err) {
      console.error("Failed to fetch full candidate details:", err);
      toast.error("Deep Link Error: Could not hydrate talent profile");
    } finally {
      setIsFetchingProfile(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const matchesSearch =
      (c.full_name || "").toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
      (c.current_role || "").toLowerCase().includes(appliedSearchTerm.toLowerCase()) ||
      c.skills?.some((s) =>
        (s || "").toLowerCase().includes(appliedSearchTerm.toLowerCase()),
      );

    const matchesFilter =
      appliedFilters.includes("skill_match") || appliedFilterExperience === "all" || c.experience === appliedFilterExperience;
    return matchesSearch && matchesFilter;
  });

  // Group by Match Strength with any overlap minimum threshold
  const tiers = {
    elite: filteredCandidates.filter((c) => c.culture_match_score >= 85),
    strong: filteredCandidates.filter(
      (c) => c.culture_match_score >= 70 && c.culture_match_score < 85,
    ),
    potential: filteredCandidates.filter(
      (c) => c.culture_match_score >= 1 && c.culture_match_score < 70,
    ),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_36%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-[3px] border-[#FFE3BF] border-t-[#FF8A00] animate-spin shadow-[0_0_20px_rgba(255,138,0,0.18)]"></div>
          <p className="text-[#C96B00] font-black text-[10px] uppercase tracking-[0.24em]">Loading Recommendations...</p>
        </div>
      </div>
    );
  }

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.08),_transparent_34%),linear-gradient(180deg,#FFFCF8_0%,#FFFFFF_100%)] text-slate-900">
      <style>{`
        .reco-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .reco-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .reco-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .reco-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .reco-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-4 px-4 py-3">
        {isLocked ? (
          <LockedView featureName="Recommended Talent" />
        ) : (
          <>
            <section className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
              <aside className="sticky top-3 flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-[28px] border border-orange-100/80 bg-white/90 shadow-[0_8px_28px_rgba(255,138,0,0.07)]">
                <div className="flex-shrink-0 border-b border-orange-100/70 bg-gradient-to-r from-[#FFF6ED] to-white px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#FF8A00]">Filters</p>
                </div>
                <div className="reco-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Posted role</label>
                    <select
                      value={selectedJobId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedJobId(val);
                        setAppliedSelectedJobId(val);
                      }}
                      className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                    >
                      <option value="">Select a posted role</option>
                      {jobs.map((job) => (
                        <option key={String(job.id)} value={String(job.id)}>
                          {job.title} ({job.matching_candidates_count || 0} matches)
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">Skills Match uses the selected job description skills only.</p>
                  </div>

                  <div className="relative">
                    <label className="mb-1.5 block text-xs font-bold text-slate-600">Search</label>
                    <Search className="absolute left-3.5 top-[2rem] w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Name, role, or skills"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                    />
                  </div>

                  <div className="grid gap-3">
                    {/* Candidate Source Section */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-600">Candidate Source</label>
                      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCandidateTypes.includes("active_verified")}
                            onChange={(e) => {
                              setSelectedCandidateTypes(prev =>
                                e.target.checked
                                  ? [...prev, "active_verified"]
                                  : prev.filter(t => t !== "active_verified")
                              );
                            }}
                            className="rounded text-[#FF8A00] focus:ring-[#FF8A00]/25"
                          />
                          Active - Verified
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCandidateTypes.includes("active_unverified")}
                            onChange={(e) => {
                              setSelectedCandidateTypes(prev =>
                                e.target.checked
                                  ? [...prev, "active_unverified"]
                                  : prev.filter(t => t !== "active_unverified")
                              );
                            }}
                            className="rounded text-[#FF8A00] focus:ring-[#FF8A00]/25"
                          />
                          Active - Unverified
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCandidateTypes.includes("passive")}
                            onChange={(e) => {
                              setSelectedCandidateTypes(prev =>
                                e.target.checked
                                  ? [...prev, "passive"]
                                  : prev.filter(t => t !== "passive")
                              );
                            }}
                            className="rounded text-[#FF8A00] focus:ring-[#FF8A00]/25"
                          />
                          Passive Talent Pool
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Min Culture Fit</label>
                        <select
                          value={minCultureScore}
                          onChange={(e) => setMinCultureScore(e.target.value)}
                          className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                        >
                          <option value="">Any Culture Score</option>
                          <option value="85">Elite (&gt;=85%)</option>
                          <option value="70">Strong (&gt;=70%)</option>
                          <option value="50">Potential (&gt;=50%)</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Experience</label>
                        <select
                          value={filterExperience}
                          onChange={(e) => toggleExperienceFilter(e.target.value)}
                          className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-medium text-slate-900 outline-none transition-all focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                        >
                          <option value="all">All</option>
                          <option value="fresher">0-1 yrs</option>
                          <option value="mid">1-5 yrs</option>
                          <option value="senior">5-10 yrs</option>
                          <option value="leadership">10+ yrs</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Location</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Location"
                            value={filterLocation}
                            onChange={(e) => setFilterLocation(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-600">Budget</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="number"
                            placeholder="Max salary"
                            value={filterMaxSalary}
                            onChange={(e) => setFilterMaxSalary(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-xs text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#FF8A00]/60 focus:ring-2 focus:ring-[#FF8A00]/15"
                          />
                        </div>
                      </div>
                    </div>

                    <details className="overflow-hidden rounded-2xl border border-orange-100 bg-[#FFF8F1]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left">
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#C96B00]">
                            Availability and readiness
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            {selectedReadinessFilters.length > 0
                              ? `${selectedReadinessFilters.length} selected`
                              : "Tap to choose readiness filters"}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Advanced
                          </span>
                          <span className="rounded-full bg-[#FF8A00] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                            {selectedReadinessFilters.length}
                          </span>
                        </div>
                      </summary>
                      <div className="px-4 pb-4">
                        {selectedReadinessLabels.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {selectedReadinessLabels.slice(0, 4).map((label) => (
                              <span key={label} className="rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700">
                                {label}
                              </span>
                            ))}
                            {selectedReadinessLabels.length > 4 && (
                              <span className="rounded-full border border-orange-100 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500">
                                +{selectedReadinessLabels.length - 4} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="space-y-3">
                          {Array.from(new Set(READINESS_OPTIONS.map((option) => option.group))).map((group) => (
                            <div key={group}>
                              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{group}</p>
                              <div className="flex flex-wrap gap-2">
                                {READINESS_OPTIONS.filter((option) => option.group === group).map((option) => {
                                  const active = selectedReadinessFilters.includes(option.value);
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => toggleReadinessFilter(option.value)}
                                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${active ? "border-[#FF8A00] bg-[#FF8A00] text-white" : "border-orange-100 bg-white text-slate-700 hover:border-[#FF8A00]/40 hover:text-[#C96B00]"}`}
                                    >
                                      {option.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  </div>

                  <div className="sticky bottom-0 pt-3 bg-gradient-to-t from-white via-white to-white/70">
                    <button
                      onClick={handleApplyFilters}
                      disabled={isSyncing}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#FF8A00] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-all hover:bg-[#E67A00] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isSyncing ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Filter className="w-4 h-4" />
                      )}
                      {isSyncing ? "Searching..." : "Apply Filters"}
                    </button>
                  </div>
                </div>
              </aside>

              <section className="flex min-h-0 flex-col rounded-[28px] border border-orange-100/70 bg-white/85 shadow-[0_8px_28px_rgba(255,138,0,0.07)]">
                <div className="flex-shrink-0 border-b border-orange-100/70 px-5 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        {filteredCandidates.length} candidate{filteredCandidates.length !== 1 ? "s" : ""} found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Culture Fit uses recruiter and candidate assessment signals. Skills Match uses only the selected role's posted skills.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 p-5">
                  {loading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="flex flex-col items-center gap-4">
                        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#FFE3BF] border-t-[#FF8A00]" />
                        <p className="text-sm font-bold text-slate-400">Finding the best matches...</p>
                      </div>
                    </div>
                  ) : candidates.length > 0 && tiers.elite.length === 0 && tiers.strong.length === 0 && tiers.potential.length === 0 ? (
                    <div className="flex items-center justify-center rounded-[24px] border border-dashed border-orange-100 bg-[#FFF8F1] py-20">
                      <div className="text-center">
                        <Filter className="mx-auto mb-3 h-12 w-12 text-orange-200" />
                        <p className="font-bold text-slate-700">No candidates match your filters</p>
                        <p className="mt-1 text-sm text-slate-400">Try adjusting your search to see more results</p>
                      </div>
                    </div>
                  ) : filteredCandidates.length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(tiers).map(
                        ([tier, list]) =>
                          list.length > 0 && (
                            <div key={tier} className="space-y-3">
                              <div className="flex items-center gap-3 border-l-4 border-[#FF8A00] pl-3">
                                <div>
                                  <h2 className="font-bold text-slate-900">
                                    {tier === "elite" ? "Top Matches" : tier === "strong" ? "Strong Matches" : "Additional Matches"}
                                  </h2>
                                  <p className="text-xs text-slate-500">
                                    {list.length} candidate{list.length !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-2">
                                {list.map((candidate) => (
                                  <RecommendedCard
                                    key={candidate.user_id}
                                    candidate={candidate}
                                    postedJobTitle={postedJob?.title}
                                    onViewProfile={() => handleViewProfile(candidate, "resume")}
                                    onInvite={() => setInviteModal({ isOpen: true, candidate })}
                                    getDisplayName={getDisplayName}
                                  />
                                ))}
                              </div>
                            </div>
                          ),
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-[24px] border border-dashed border-orange-100 bg-[#FFF8F1] py-20">
                      <div className="text-center">
                        <Zap className="mx-auto mb-3 h-12 w-12 text-orange-200" />
                        <p className="font-bold text-slate-700">No candidates found</p>
                        <p className="mt-1 text-sm text-slate-400">Try adjusting your search to find more matches</p>
                      </div>
                    </div>
                  )}
              </div>
            </section>
          </section>
        </>
        )}

        {profileModal.isOpen && profileModal.candidate && (
          <CandidateProfileModal
            isOpen={profileModal.isOpen}
            onClose={() => setProfileModal({ ...profileModal, isOpen: false })}
            candidate={profileModal.candidate as any}
            resumeData={(profileModal.candidate as any).resume_data}
            jobTitle="Smart Match Details"
            appliedDate={new Date().toISOString()}
            score={profileModal.candidate.culture_match_score || 0}
            status="Recommended"
            initialTab={profileModal.initialTab}
            isDiscovery={true}
          />
        )}

        {isFetchingProfile && (
          <div className="fixed inset-0 z-100 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-2xl shadow-2xl border border-white flex flex-col items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <div className="h-6 w-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Analyzing match...</p>
            </div>
          </div>
        )}

        {inviteModal.isOpen && inviteModal.candidate && (
          <JobInviteModal
            candidateId={inviteModal.candidate.user_id}
            candidateName={inviteModal.candidate.full_name}
            jobs={jobs}
            onClose={() => setInviteModal({ isOpen: false, candidate: null })}
            onInvite={handleInviteCandidate}
          />
        )}
      </main>
    </div>
  );
}

function RecommendedCard({
  candidate,
  postedJobTitle,
  onViewProfile,
  onInvite,
  getDisplayName,
}: {
  candidate: any;
  postedJobTitle?: string | null;
  onViewProfile: () => void;
  onInvite: () => void;
  getDisplayName: (name: string, id: string) => string;
}) {
  const isCompleted = candidate.assessment_completed || false;
  const isShadow = candidate.is_shadow || false;
  
  let typeLabel = "Active - Unverified";
  let typeStyle = "bg-amber-50 text-amber-700 border-amber-100/80";
  
  if (isShadow) {
    typeLabel = "Passive Lead";
    typeStyle = "bg-blue-50 text-blue-700 border-blue-100/80";
  } else if (isCompleted) {
    typeLabel = "Active - Verified";
    typeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100/80";
  }

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-[0_12px_24px_rgba(255,138,0,0.08)]">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FF8A00] via-[#FFB366] to-[#FFE3BF]" />

      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-[#FFF6ED] text-[#FF8A00] shadow-sm">
              {candidate.profile_photo_url ? (
                <img
                  src={candidate.profile_photo_url}
                  alt={candidate.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-bold text-slate-800">
                  {getDisplayName(candidate.full_name, candidate.user_id)}
                </h3>
                {candidate.identity_verified && (
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                )}
              </div>
              <p className="truncate text-xs text-slate-400 font-medium">{candidate.current_role}</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end flex-shrink-0">
            <span className="inline-flex items-center rounded-lg bg-orange-50 px-2 py-1 text-xs font-bold text-[#FF8A00] border border-orange-100/50">
              {candidate.culture_match_score}% Match
            </span>
            {candidate.actual_culture_fit_score > 0 && (
              <span className="mt-1 text-[10px] font-semibold text-slate-400">
                Culture: {candidate.actual_culture_fit_score}%
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${typeStyle}`}>
            {typeLabel}
          </span>
          <span className="inline-flex items-center rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {candidate.years_of_experience} yrs exp
          </span>
          {candidate.location && (
            <span className="inline-flex items-center gap-0.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 truncate max-w-[120px]">
              <MapPin className="h-3 w-3 text-slate-400" />
              {candidate.location}
            </span>
          )}
        </div>

        <div className="rounded-xl bg-slate-50/50 p-2.5 border border-slate-100/50 text-xs">
          {candidate.matched_skills && candidate.matched_skills.length > 0 && (
            <div className="mb-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Matched Skills</span>
              <div className="flex flex-wrap gap-1">
                {candidate.matched_skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100/50">
                    {skill}
                  </span>
                ))}
                {candidate.matched_skills.length > 4 && (
                  <span className="inline-flex items-center rounded bg-emerald-50/40 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                    +{candidate.matched_skills.length - 4}
                  </span>
                )}
              </div>
            </div>
          )}

          {candidate.missing_skills && candidate.missing_skills.length > 0 && (
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Missing Skills</span>
              <div className="flex flex-wrap gap-1">
                {candidate.missing_skills.slice(0, 3).map((skill) => (
                  <span key={skill} className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200/50 line-through">
                    {skill}
                  </span>
                ))}
                {candidate.missing_skills.length > 3 && (
                  <span className="inline-flex items-center rounded bg-slate-100/40 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                    +{candidate.missing_skills.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-50">
        <button
          onClick={onViewProfile}
          className="flex-1 rounded-lg bg-slate-900 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800 active:scale-95"
        >
          View Profile
        </button>
        <button
          onClick={onInvite}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-orange-100 bg-[#FFF6ED] text-[#FF8A00] transition-all hover:bg-[#FF8A00] hover:text-white active:scale-95"
          title="Invite to Job"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

