"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
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
  ChevronLeft,
  Mail,
  Phone,
  Lock,
  Unlock,
  FileText,
  Award,
  Briefcase,
  Calendar,
  X,
  ClipboardList,
} from "lucide-react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import LockedView from "@/components/dashboard/LockedView";
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
  actual_culture_fit_score?: number;
  matched_skills?: string[];
  missing_skills?: string[];
  expected_salary?: string;
  location?: string;
  is_shadow?: boolean;
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
  { value: "immediate", label: "Immediate Joiner", group: "Availability" },
  { value: "short_notice", label: "Notice period <= 30 days", group: "Availability" },
  { value: "long_notice", label: "Notice period >= 60 days", group: "Availability" },
  { value: "active_job_seeker", label: "Actively Looking", group: "Intent" },
  { value: "passive_candidate", label: "Open to Opportunities", group: "Intent" },
  { value: "between_roles", label: "Between Roles", group: "Employment Status" },
  { value: "laid_off_recently", label: "Recently Laid Off", group: "Employment Status" },
  { value: "recent_graduate_student", label: "Recent Graduate", group: "Employment Status" },
  { value: "willing_to_relocate", label: "Willing to Relocate", group: "Work Setup" },
  { value: "remote_only", label: "Remote Only", group: "Work Setup" },
  { value: "contract_preferred", label: "Contract Preferred", group: "Work Setup" },
  { value: "flexible", label: "Flexible Work Type", group: "Work Setup" },
  { value: "salary_seeking_raise", label: "Seeking >=20% Raise", group: "Compensation" },
  { value: "high_fit_by_compensation", label: "Within Budget", group: "Compensation" },
  { value: "needs_salary_clarification", label: "No Salary Expectation", group: "Compensation" },
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

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "resume">("overview");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  const isProfessionalPhoto = (url?: string) => {
    return url && !url.includes("dicebear.com") && !url.includes("api.dicebear.com");
  };

  const toggleFilter = (mode: string) => {
    setActiveFilters([mode]);
    if (mode === "skill_match") {
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
    setShowMobileFilters(false);
  };

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

  const selectCandidate = async (candidate: Candidate) => {
    setSelectedCandidateId(candidate.user_id);
    setSelectedCandidate(candidate);
    setLoadingDetails(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      apiClient.post(`/analytics/profile/${candidate.user_id}/view`, {}, token).catch(() => {});

      const fullCandidate = await apiClient.get(
        `/recruiter/candidate/${candidate.user_id}`,
        token,
      );
      if (fullCandidate) {
        setSelectedCandidate((prev: any) => prev && prev.user_id === candidate.user_id ? { ...prev, ...fullCandidate } : prev);
      }
    } catch (err) {
      console.error("Failed to fetch candidate details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleInviteCandidate = async (
    candidateId: string,
    jobId: string,
    message: string,
    customTitle?: string,
  ) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;

      await apiClient.post(
        `/recruiter/candidate/${candidateId}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );

      const candidateName = candidates.find(c => c.user_id === candidateId)?.full_name || "Talent";
      toast.success(`Invitation sent to ${candidateName}`);
      setInviteModal({ isOpen: false, candidate: null });
      fetchRecommendations();
    } catch (err: any) {
      console.error("Failed to invite candidate:", err);
      toast.error(err.message || "Invitation cycle failed");
    }
  };

  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
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
  }, [candidates, appliedSearchTerm, appliedFilters, appliedFilterExperience]);

  // Sync selectedCandidateId
  useEffect(() => {
    if (filteredCandidates.length > 0) {
      if (!filteredCandidates.some((c) => c.user_id === selectedCandidateId)) {
        selectCandidate(filteredCandidates[0]);
      }
    } else {
      setSelectedCandidateId(null);
      setSelectedCandidate(null);
    }
  }, [filteredCandidates, selectedCandidateId]);

  const tiers = useMemo(() => {
    return {
      elite: filteredCandidates.filter((c) => c.culture_match_score >= 85),
      strong: filteredCandidates.filter(
        (c) => c.culture_match_score >= 70 && c.culture_match_score < 85,
      ),
      potential: filteredCandidates.filter(
        (c) => c.culture_match_score >= 1 && c.culture_match_score < 70,
      ),
    };
  }, [filteredCandidates]);

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  const getSkills = (cand: any) => {
    if (Array.isArray(cand.skills)) return cand.skills;
    if (typeof cand.skills === "string" && cand.skills) {
      return cand.skills.split(",").map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
  };

  const getTimeline = (cand: any) => {
    const resume = cand.resume_data;
    if (resume && Array.isArray(resume.timeline)) return resume.timeline;
    return [];
  };

  const getEducation = (cand: any) => {
    const resume = cand.resume_data;
    return resume?.education || null;
  };

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.03),_transparent_40%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900">
      <style>{`
        .reco-scroll {
          scrollbar-width: thin;
          scrollbar-color: #e2e8f0 transparent;
        }
        .reco-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .reco-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .reco-scroll::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 999px;
        }
        .reco-scroll::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      <main className="h-full w-full max-w-[1600px] mx-auto px-4 py-3 flex flex-col overflow-hidden">
        {isLocked ? (
          <div className="flex h-full w-full items-center justify-center rounded-[24px] border border-orange-100/80 bg-white p-12 shadow-[0_8px_24px_rgba(255,138,0,0.06)]">
            <LockedView featureName="Recommended Talent" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden space-y-3">
            {/* Header section */}
            <div className="flex items-center justify-between gap-4 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm flex-shrink-0">
              <div className="flex items-center gap-3">
                <h1 className="text-sm font-black tracking-tight text-slate-950">Recommended Candidates</h1>
                <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[9px] font-black text-[#FF8A00] ring-1 ring-orange-100">
                  {filteredCandidates.length} Matches
                </span>
              </div>

              {/* Mobile Filter toggle */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="xl:hidden inline-flex h-8 items-center gap-1 border border-slate-200 bg-white rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 hover:border-[#FF8A00]"
              >
                <Filter className="w-3.5 h-3.5" /> Filters
              </button>
            </div>

            {/* Split layout: Filters | Matches List | Details */}
            <div className="flex-1 flex min-h-0 gap-4 overflow-hidden relative">
              
              {/* Left Column: Filter Sidebar (Desktop version) */}
              <aside className="hidden xl:flex xl:w-[270px] flex-shrink-0 flex-col min-h-0 bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden">
                <div className="flex-shrink-0 border-b border-slate-100 bg-slate-50/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Filters</p>
                </div>
                
                <div className="reco-scroll flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Job Posting Select */}
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-450">Posted Role</label>
                    <select
                      value={selectedJobId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedJobId(val);
                        setAppliedSelectedJobId(val);
                      }}
                      className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#FF8A00] focus:ring-2 focus:ring-[#FF8A00]/5"
                    >
                      <option value="">Select a role</option>
                      {jobs.map((job) => (
                        <option key={String(job.id)} value={String(job.id)}>
                          {job.title} ({job.matching_candidates_count || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Term */}
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-450">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Skills, name, or role..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 outline-none focus:border-[#FF8A00]"
                      />
                    </div>
                  </div>

                  {/* Candidate Types */}
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-450">Candidate Type</label>
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/20 p-3 text-xs">
                      <label className="flex items-center gap-2 text-slate-650 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCandidateTypes.includes("active_verified")}
                          onChange={(e) => {
                            setSelectedCandidateTypes(prev =>
                              e.target.checked ? [...prev, "active_verified"] : prev.filter(t => t !== "active_verified")
                            );
                          }}
                          className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                        />
                        Active - Verified
                      </label>
                      <label className="flex items-center gap-2 text-slate-655 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCandidateTypes.includes("active_unverified")}
                          onChange={(e) => {
                            setSelectedCandidateTypes(prev =>
                              e.target.checked ? [...prev, "active_unverified"] : prev.filter(t => t !== "active_unverified")
                            );
                          }}
                          className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                        />
                        Active - Unverified
                      </label>
                      <label className="flex items-center gap-2 text-slate-655 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedCandidateTypes.includes("passive")}
                          onChange={(e) => {
                            setSelectedCandidateTypes(prev =>
                              e.target.checked ? [...prev, "passive"] : prev.filter(t => t !== "passive")
                            );
                          }}
                          className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                        />
                        Passive Talent Pool
                      </label>
                    </div>
                  </div>

                  {/* Culture score, experience, location, budget */}
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-450">Minimum Cultural Match</label>
                      <select
                        value={minCultureScore}
                        onChange={(e) => setMinCultureScore(e.target.value)}
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#FF8A00]"
                      >
                        <option value="">Any Culture score</option>
                        <option value="85">Elite (&gt;=85%)</option>
                        <option value="70">Strong (&gt;=70%)</option>
                        <option value="50">Potential (&gt;=50%)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Experience</label>
                      <select
                        value={filterExperience}
                        onChange={(e) => toggleExperienceFilter(e.target.value)}
                        className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-[#FF8A00]"
                      >
                        <option value="all">All Experience</option>
                        <option value="fresher">0-1 yrs</option>
                        <option value="mid">1-5 yrs</option>
                        <option value="senior">5-10 yrs</option>
                        <option value="leadership">10+ yrs</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="City/Country"
                          value={filterLocation}
                          onChange={(e) => setFilterLocation(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#FF8A00]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Max Salary</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="number"
                          placeholder="Max Salary"
                          value={filterMaxSalary}
                          onChange={(e) => setFilterMaxSalary(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:border-[#FF8A00]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Exposed Work Preferences (Readiness) */}
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/20 p-3.5 space-y-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-455">Work Preferences</p>
                      <p className="text-[8px] text-slate-400 font-semibold mt-0.5">Filter by availability, mobility, or setup</p>
                    </div>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto reco-scroll pr-1">
                      {Array.from(new Set(READINESS_OPTIONS.map((o) => o.group))).map((group) => (
                        <div key={group} className="space-y-1">
                          <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{group}</p>
                          <div className="flex flex-wrap gap-1">
                            {READINESS_OPTIONS.filter((o) => o.group === group).map((option) => {
                              const active = selectedReadinessFilters.includes(option.value);
                              return (
                                <button
                                  key={option.value}
                                  type="button"
                                  onClick={() => toggleReadinessFilter(option.value)}
                                  className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold transition-all ${
                                    active ? "border-[#FF8A00] bg-[#FF8A00]/10 text-[#FF8A00]" : "border-slate-200 bg-white text-slate-650 hover:border-orange-200"
                                  }`}
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
                </div>

                {/* Apply button */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/20 flex-shrink-0">
                  <button
                    onClick={handleApplyFilters}
                    disabled={isSyncing}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] py-2 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-[#E67A00] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    {isSyncing ? "Searching..." : "Apply Filters"}
                  </button>
                </div>
              </aside>

              {/* Middle Column: Matches List */}
              <div
                className={`w-full lg:w-[350px] xl:w-[380px] flex-shrink-0 flex flex-col min-h-0 bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden lg:flex ${
                  selectedCandidateId && "hidden lg:flex"
                }`}
              >
                <div className="flex-shrink-0 border-b border-slate-100 bg-slate-50/30 px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Matches</span>
                </div>

                <div className="reco-scroll flex-1 overflow-y-auto p-4 space-y-4">
                  {filteredCandidates.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="h-10 w-10 text-orange-200 mx-auto" />
                      <p className="mt-3 text-xs font-bold text-slate-500">No matches found</p>
                      <p className="mt-1 text-[10px] text-slate-400 leading-relaxed max-w-[200px] mx-auto">
                        Try modifying search keyword or applying different filters.
                      </p>
                    </div>
                  ) : (
                    Object.entries(tiers).map(([tier, list]) => {
                      if (list.length === 0) return null;
                      return (
                        <div key={tier} className="space-y-2">
                          <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l-2 border-[#FF8A00] pl-2">
                            {tier === "elite" ? "Top Matches" : tier === "strong" ? "Strong Matches" : "Potential Matches"} ({list.length})
                          </h3>
                          
                          <div className="space-y-2.5">
                            {list.map((c) => {
                              const isSelected = selectedCandidateId === c.user_id;
                              
                              let typeLabel = "Active - Unverified";
                              let typeStyle = "bg-amber-50 text-amber-700 border-amber-100/80";
                              if (c.is_shadow) {
                                typeLabel = "Passive Lead";
                                typeStyle = "bg-blue-50 text-blue-700 border-blue-100/80";
                              } else if (c.profile_strength === "Lead") {
                                typeLabel = "Lead";
                                typeStyle = "bg-slate-100 text-slate-650 border-slate-200";
                              } else if (c.identity_verified) {
                                typeLabel = "Active - Verified";
                                typeStyle = "bg-emerald-50 text-emerald-700 border-emerald-100/80";
                              }

                              return (
                                <article
                                  key={c.user_id}
                                  onClick={() => selectCandidate(c)}
                                  className={`cursor-pointer rounded-2xl border p-3.5 transition-all duration-200 flex flex-col gap-2.5 relative ${
                                    isSelected
                                      ? "border-[#FF8A00] bg-orange-50/5 shadow-xs"
                                      : "border-slate-100 bg-white hover:border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2.5">
                                    <div className="flex items-center gap-3 min-w-0">
                                      {/* Professional initials circle */}
                                      {isProfessionalPhoto(c.profile_photo_url) ? (
                                        <img
                                          src={c.profile_photo_url}
                                          alt={c.full_name}
                                          className="h-10 w-10 rounded-full object-cover shrink-0 ring-1 ring-orange-100"
                                        />
                                      ) : (
                                        <div className="h-10 w-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 text-[#FF8A00] font-black text-xs uppercase shadow-sm">
                                          {c.full_name?.substring(0, 2) || "C"}
                                        </div>
                                      )}

                                      <div className="min-w-0">
                                        <h4 className={`text-xs font-bold text-slate-800 truncate ${isSelected ? "text-[#FF8A00]" : ""}`}>
                                          {getDisplayName(c.full_name, c.user_id)}
                                        </h4>
                                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5 truncate">
                                          {c.current_role}
                                        </p>
                                      </div>
                                    </div>

                                    <span className="inline-flex rounded-lg bg-orange-50/50 border border-orange-100/50 px-2 py-0.5 text-[9px] font-black text-[#FF8A00] shrink-0">
                                      {c.culture_match_score}%
                                    </span>
                                  </div>

                                  {/* Tags line */}
                                  <div className="flex flex-wrap items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-400">
                                    <span className={`px-1.5 py-0.5 rounded border ${typeStyle}`}>
                                      {typeLabel}
                                    </span>
                                    <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                      {c.years_of_experience} Yrs exp
                                    </span>
                                    {c.location && (
                                      <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded text-slate-500 truncate max-w-[100px]">
                                        {c.location}
                                      </span>
                                    )}
                                  </div>
                                </article>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane: Detailed candidate view */}
              <div
                className={`flex-1 flex flex-col min-h-0 bg-white border border-slate-100 rounded-3xl shadow-xs overflow-hidden ${
                  !selectedCandidateId && "hidden lg:flex"
                }`}
              >
                {selectedCandidate ? (
                  <div className="h-full flex flex-col min-h-0 relative">
                    
                    {/* Header back bar for mobile */}
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/20 shrink-0">
                      <button
                        onClick={() => setSelectedCandidateId(null)}
                        className="lg:hidden inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 border border-slate-200 bg-white rounded-lg px-2.5 py-1"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" /> Back
                      </button>

                      <div className="hidden lg:block">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Candidate Details
                        </span>
                      </div>

                      <span className="text-[9px] font-black uppercase text-[#FF8A00] tracking-wider">
                        Recommended Fit
                      </span>
                    </div>

                    {/* Candidate header card */}
                    <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 bg-gradient-to-r from-orange-50/10 to-transparent">
                      <div className="flex items-center gap-4">
                        {isProfessionalPhoto(selectedCandidate.profile_photo_url) ? (
                          <img
                            src={selectedCandidate.profile_photo_url}
                            alt={selectedCandidate.full_name}
                            className="h-12 w-12 rounded-full object-cover shrink-0 ring-2 ring-orange-200/50"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-orange-100 to-orange-50 flex items-center justify-center shrink-0 ring-2 ring-orange-200/50 text-[#FF8A00] font-black text-sm uppercase">
                            {selectedCandidate.full_name?.substring(0, 2) || "C"}
                          </div>
                        )}

                        <div className="min-w-0">
                          <h2 className="text-base font-black text-slate-850 flex items-center gap-2">
                            {getDisplayName(selectedCandidate.full_name, selectedCandidate.user_id)}
                            {hasAccessToPersonalInfo(selectedCandidate.user_id) ? (
                              <span title="Unlocked Contact Info"><Unlock className="h-3.5 w-3.5 text-emerald-500" /></span>
                            ) : (
                              <span title="Locked Contact Info"><Lock className="h-3.5 w-3.5 text-amber-500" /></span>
                            )}
                          </h2>
                          <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                            {selectedCandidate.current_role}
                          </p>

                          {/* Contact information details */}
                          <div className="flex items-center gap-3 mt-2">
                            {hasAccessToPersonalInfo(selectedCandidate.user_id) ? (
                              <>
                                <span className="flex items-center gap-1 text-[10px] text-slate-655 font-bold">
                                  <Mail className="h-3.5 w-3.5 text-emerald-500" />
                                  {selectedCandidate.email || "Email Available"}
                                </span>
                                {selectedCandidate.phone_number && (
                                  <span className="flex items-center gap-1 text-[10px] text-slate-655 font-bold border-l border-slate-200 pl-3">
                                    <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                    {selectedCandidate.phone_number}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50/50 border border-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                Contact Masked
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SVG circular score match */}
                      <div className="flex-shrink-0 flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                        <div className="relative">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="21" className="stroke-slate-200" strokeWidth="2.5" fill="transparent" />
                            <circle
                              cx="24"
                              cy="24"
                              r="21"
                              className="stroke-[#FF8A00] transition-all duration-500"
                              strokeWidth="2.5"
                              fill="transparent"
                              strokeDasharray="132"
                              strokeDashoffset={132 - (132 * (selectedCandidate.culture_match_score || 0)) / 100}
                              strokeLinecap="round"
                            />
                            <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="font-black text-[10px] fill-slate-800 rotate-90 origin-center">
                              {Math.round(selectedCandidate.culture_match_score || 0)}%
                            </text>
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Match score</span>
                          <span className="text-[10px] font-black text-[#C96B00] uppercase tracking-wider mt-0.5">Cultural Match</span>
                        </div>
                      </div>
                    </div>

                    {/* Ribbon Actions */}
                    <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                          Next Actions
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedCandidate.resume_path && (
                          <button
                            onClick={() => window.open(selectedCandidate.resume_path!, '_blank')}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700 transition hover:border-[#FF8A00] hover:text-[#FF8A00] active:scale-95 shadow-xs"
                          >
                            <FileText className="h-3.5 w-3.5 text-[#FF8A00]" />
                            View Resume (PDF)
                          </button>
                        )}
                        <button
                          onClick={() => setInviteModal({ isOpen: true, candidate: selectedCandidate })}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#FF8A00] active:scale-95"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Invite to Job
                        </button>
                      </div>
                    </div>

                    {/* Inline Tab Headers */}
                    <div className="flex border-b border-slate-100 bg-slate-50/10 shrink-0">
                      {[
                        { id: "overview", label: "Match Summary", icon: ClipboardList },
                        { id: "resume", label: "Resume Info", icon: FileText, disabled: !selectedCandidate.resume_path },
                      ].map((t) => (
                        <button
                          key={t.id}
                          disabled={t.disabled}
                          onClick={() => setDetailTab(t.id as any)}
                          className={`flex items-center gap-2 py-3 px-5 text-xs font-black uppercase tracking-wider border-b-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                            detailTab === t.id
                              ? "border-[#FF8A00] text-[#FF8A00] bg-white"
                              : "border-transparent text-slate-400 hover:text-slate-650 hover:bg-slate-50/30"
                          }`}
                        >
                          <t.icon className="h-3.5 w-3.5" />
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Scrollable details contents */}
                    <div className="flex-1 overflow-y-auto pipeline-scroll p-6 space-y-6">
                      
                      {detailTab === "overview" && (
                        <div className="space-y-6">
                          
                          {/* Match reasoning text */}
                          {selectedCandidate.match_reasoning && (
                            <div className="space-y-1.5 bg-orange-50/10 border border-orange-100/50 p-4 rounded-2xl">
                              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#C96B00]">
                                Match Reasoning
                              </h3>
                              <p className="text-xs font-semibold text-slate-650 leading-relaxed mt-1">
                                {selectedCandidate.match_reasoning}
                              </p>
                            </div>
                          )}

                          {/* Matched & Missing skills comparison */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Matched skills */}
                            <div className="bg-emerald-50/10 border border-emerald-100 rounded-2xl p-4.5 space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-wider text-emerald-800">Matched Focus</h4>
                              <div className="flex flex-wrap gap-1">
                                {selectedCandidate.matched_skills && selectedCandidate.matched_skills.length > 0 ? (
                                  selectedCandidate.matched_skills.map((s: string) => (
                                    <span key={s} className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-md text-[9px] font-bold uppercase tracking-tight">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">No exact skill overlap.</span>
                                )}
                              </div>
                            </div>

                            {/* Missing skills */}
                            <div className="bg-slate-50/30 border border-slate-100 rounded-2xl p-4.5 space-y-2">
                              <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-500">Missing Focus</h4>
                              <div className="flex flex-wrap gap-1">
                                {selectedCandidate.missing_skills && selectedCandidate.missing_skills.length > 0 ? (
                                  selectedCandidate.missing_skills.map((s: string) => (
                                    <span key={s} className="px-2 py-0.5 bg-white border border-slate-200 text-slate-500 rounded-md text-[9px] font-medium uppercase tracking-tight line-through">
                                      {s}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] text-slate-400 italic">Complete match (no missing skills).</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bio */}
                          <div className="space-y-1.5">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Talent Summary
                            </h3>
                            <p className="text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                              {selectedCandidate.bio || "Candidate has not provided a professional bio yet."}
                            </p>
                          </div>

                          {/* Skills Declared */}
                          <div className="space-y-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                              Skills Summary
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {getSkills(selectedCandidate).length === 0 ? (
                                <span className="text-xs text-slate-400">No skills declared in profile.</span>
                              ) : (
                                getSkills(selectedCandidate).map((skill: string) => (
                                  <span
                                    key={skill}
                                    className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-700 uppercase tracking-tighter"
                                  >
                                    {skill}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {detailTab === "resume" && (
                        <div className="space-y-6">
                          {selectedCandidate.resume_path && (
                            <div className="bg-orange-50/20 border border-orange-100 rounded-2xl p-4 flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FileText className="h-8 w-8 text-[#FF8A00] shrink-0" />
                                <div>
                                  <h4 className="text-xs font-bold text-slate-800">Original Resume PDF</h4>
                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Open in a clean browser tab for complete viewing</p>
                                </div>
                              </div>
                              <button
                                onClick={() => window.open(selectedCandidate.resume_path!, '_blank')}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] px-4 py-1 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-[#E67A00] active:scale-95"
                              >
                                Open PDF
                              </button>
                            </div>
                          )}

                          {/* Render Parsed Resume Details */}
                          <div className="space-y-5">
                            {/* Experience Timeline */}
                            <div className="space-y-2.5">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider font-bold">Parsed Work Experience</h4>
                              {getTimeline(selectedCandidate).length === 0 ? (
                                <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-slate-100">No experience details parsed.</p>
                              ) : (
                                <div className="space-y-3.5 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                  {getTimeline(selectedCandidate).map((entry: any, index: number) => (
                                    <div key={index} className="border-l-2 border-orange-200 pl-3.5">
                                      <h5 className="text-xs font-bold text-slate-805">{entry.role || entry.title || "Sales Executive"}</h5>
                                      <p className="text-[10px] font-bold text-[#C96B00] mt-0.5">{entry.company || "Tech Company"}</p>
                                      {entry.description && <p className="text-[10px] text-slate-500 leading-relaxed mt-1 font-semibold">{entry.description}</p>}
                                      <p className="text-[9px] font-bold text-slate-455 uppercase tracking-wider mt-1">{entry.start || "N/A"} — {entry.end || "Present"}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Education Section */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Parsed Education</h4>
                              {(() => {
                                const edu = getEducation(selectedCandidate);
                                if (!edu) return <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-2xl border border-slate-100">No education details parsed.</p>;
                                return (
                                  <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                                    <div className="p-2 bg-white border border-slate-150 rounded-xl text-slate-500 shrink-0">
                                      <Award className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-bold text-slate-800">{edu.degree || "Degree"}</h5>
                                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">{edu.institution || "Institution"}</p>
                                      {edu.year && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">{edu.year}</p>}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center p-12 bg-slate-50/20">
                    <Users className="h-12 w-12 text-slate-200" />
                    <h3 className="mt-4 text-xs font-black text-slate-850 uppercase tracking-wider">No Match Selected</h3>
                    <p className="mt-1.5 text-[10px] text-slate-400 font-semibold leading-relaxed max-w-[280px]">
                      Select a candidate match from the middle column list to view details, match analysis, and invite actions.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Filters Modal Overlay */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-955/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm h-full max-h-[85vh] shadow-2xl border border-slate-150 flex flex-col overflow-hidden animate-in slide-in-from-right duration-250">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
              <span className="text-xs font-black uppercase tracking-wider text-slate-805">Search Filters</span>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-1 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4 text-slate-450" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 reco-scroll">
              {/* Role select */}
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Posted Role</label>
                <select
                  value={selectedJobId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedJobId(val);
                    setAppliedSelectedJobId(val);
                  }}
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-850 outline-none"
                >
                  <option value="">Select a role</option>
                  {jobs.map((job) => (
                    <option key={String(job.id)} value={String(job.id)}>
                      {job.title} ({job.matching_candidates_count || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search text */}
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Skills, name, or role..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Candidate Sourcing Status */}
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Candidate Type</label>
                <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/20 p-3 text-xs">
                  <label className="flex items-center gap-2 text-slate-655 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCandidateTypes.includes("active_verified")}
                      onChange={(e) => {
                        setSelectedCandidateTypes(prev =>
                          e.target.checked ? [...prev, "active_verified"] : prev.filter(t => t !== "active_verified")
                        );
                      }}
                      className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                    />
                    Active - Verified
                  </label>
                  <label className="flex items-center gap-2 text-slate-655 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCandidateTypes.includes("active_unverified")}
                      onChange={(e) => {
                        setSelectedCandidateTypes(prev =>
                          e.target.checked ? [...prev, "active_unverified"] : prev.filter(t => t !== "active_unverified")
                        );
                      }}
                      className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                    />
                    Active - Unverified
                  </label>
                  <label className="flex items-center gap-2 text-slate-655 font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCandidateTypes.includes("passive")}
                      onChange={(e) => {
                        setSelectedCandidateTypes(prev =>
                          e.target.checked ? [...prev, "passive"] : prev.filter(t => t !== "passive")
                        );
                      }}
                      className="rounded border-slate-300 text-[#FF8A00] focus:ring-[#FF8A00]/25"
                    />
                    Passive Talent Pool
                  </label>
                </div>
              </div>

              {/* Filters list */}
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Minimum Cultural Match</label>
                  <select
                    value={minCultureScore}
                    onChange={(e) => setMinCultureScore(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="">Any Culture score</option>
                    <option value="85">Elite (&gt;=85%)</option>
                    <option value="70">Strong (&gt;=70%)</option>
                    <option value="50">Potential (&gt;=50%)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Experience</label>
                  <select
                    value={filterExperience}
                    onChange={(e) => toggleExperienceFilter(e.target.value)}
                    className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 outline-none"
                  >
                    <option value="all">All Experience</option>
                    <option value="fresher">0-1 yrs</option>
                    <option value="mid">1-5 yrs</option>
                    <option value="senior">5-10 yrs</option>
                    <option value="leadership">10+ yrs</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Location</label>
                  <input
                    type="text"
                    placeholder="City/Country"
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-455">Max Salary</label>
                  <input
                    type="number"
                    placeholder="Max Salary"
                    value={filterMaxSalary}
                    onChange={(e) => setFilterMaxSalary(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-1.5 px-3 text-xs text-slate-900 outline-none"
                  />
                </div>
              </div>

              {/* Mobile Work Preferences */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/20 p-3 space-y-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-455">Work Preferences</p>
                </div>
                <div className="space-y-3">
                  {Array.from(new Set(READINESS_OPTIONS.map((o) => o.group))).map((group) => (
                    <div key={group} className="space-y-1">
                      <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">{group}</p>
                      <div className="flex flex-wrap gap-1">
                        {READINESS_OPTIONS.filter((o) => o.group === group).map((option) => {
                          const active = selectedReadinessFilters.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleReadinessFilter(option.value)}
                              className={`rounded-lg border px-2 py-0.5 text-[9px] font-bold transition-all ${
                                active ? "border-[#FF8A00] bg-[#FF8A00]/10 text-[#FF8A00]" : "border-slate-200 bg-white text-slate-600 hover:border-orange-200"
                              }`}
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
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/20">
              <button
                onClick={handleApplyFilters}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#FF8A00] py-2 text-xs font-black uppercase tracking-widest text-white"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal.isOpen && inviteModal.candidate && (
        <JobInviteModal
          candidateId={inviteModal.candidate.user_id}
          candidateName={inviteModal.candidate.full_name}
          jobs={jobs}
          onClose={() => setInviteModal({ isOpen: false, candidate: null })}
          onInvite={(jobId, message, customTitle) => 
            handleInviteCandidate(inviteModal.candidate!.user_id, jobId, message, customTitle)
          }
        />
      )}
    </div>
  );
}
