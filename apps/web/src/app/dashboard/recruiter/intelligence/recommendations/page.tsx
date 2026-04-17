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

export default function RecommendationsPage() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(["understanding_and_assessment"]);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [filterMaxSalary, setFilterMaxSalary] = useState<string>("");
  const [filterCareerReadiness, setFilterCareerReadiness] = useState<string>("");

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
  };

  const toggleExperienceFilter = (band: string) => {
    setFilterExperience(band);
  };

  const handleApplyFilters = () => {
    fetchRecommendations();
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
      
      let modesStr = activeFilters.join(",");
      let url = `/recruiter/recommended-candidates?filter_type=${modesStr}`;
      
      if (activeFilters.includes("skill_match") && initialSkills) {
        url += `&skills=${initialSkills}`;
      }
      
      // Add Location & Salary & Career Readiness filters
      if (filterLocation) url += `&location=${encodeURIComponent(filterLocation)}`;
      if (filterMaxSalary) url += `&max_salary=${encodeURIComponent(filterMaxSalary)}`;
      if (filterCareerReadiness) url += `&career_readiness=${encodeURIComponent(filterCareerReadiness)}`;
      if (filterExperience !== "all") url += `&experience_band=${encodeURIComponent(filterExperience)}`;
      if (searchTerm) url += `&skills=${encodeURIComponent(searchTerm)}`;

      const [recData, profileData, jobsData, pipelineResponse] = await Promise.all([
        apiClient.get(url, token),
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/jobs", token),
        apiClient.get("/recruiter/applications/pipeline", token),
      ]);

      setCandidates(recData || []);
      setRecruiterProfile(profileData);
      setJobs(jobsData || []);
      setPipelineData(pipelineResponse || []);
      setJobs(jobsData || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      toast.error("Algorithmic Sync Failed: Could not load recommendations");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [activeFilters, filterExperience, filterLocation, filterMaxSalary, filterCareerReadiness, searchTerm, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilter = params.get("filter") as any;
    if (initialFilter && (initialFilter === "skill_match" || initialFilter === "understanding_and_assessment")) {
      setActiveFilters([initialFilter]);
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
    // Initial fetch on mount only
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      (c.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.current_role || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.skills?.some((s) =>
        (s || "").toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesFilter =
      filterExperience === "all" || c.experience === filterExperience;
    return matchesSearch && matchesFilter;
  });

  // Group by Match Strength with 75% minimum threshold
  const tiers = {
    elite: filteredCandidates.filter((c) => c.culture_match_score >= 85),
    strong: filteredCandidates.filter(
      (c) => c.culture_match_score >= 75 && c.culture_match_score < 85,
    ),
    // Removed potential tier - only show candidates with 75%+ match
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Loading Recommendations...</p>
        </div>
      </div>
    );
  }

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLocked ? (
          <LockedView featureName="Recommended Talent" />
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  AI <span className="text-blue-600">Recommendations</span>
                </h1>
                <p className="text-slate-500 text-xs mt-0.5">
                  Discover the best candidates for your open roles
                </p>
              </div>
            </header>

            {/* Search & Filters */}
            <section className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm mb-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, role, or skills..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-2.5 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-all"
                />
              </div>

              {/* Filter Type Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Match Type</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { 
                      id: "understanding_and_assessment", 
                      label: "Best Match", 
                      description: "Culture & Assessment"
                    },
                    { 
                      id: "skill_match", 
                      label: "Our Recommendation", 
                      description: "Skills & Expertise"
                    }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleFilter(f.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                        activeFilters.includes(f.id)
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >

                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Experience Level */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Experience Level</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all", label: "All Levels" },
                    { id: "fresher", label: "Fresher" },
                    { id: "mid", label: "Mid-Level" },
                    { id: "senior", label: "Senior" },
                    { id: "leadership", label: "Executive" }
                  ].map((band) => (
                    <button
                      key={band.id}
                      onClick={() => toggleExperienceFilter(band.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        filterExperience === band.id
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-150"
                      }`}
                    >
                      {band.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Filters */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Refine Search</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Location"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 transition-all"
                    />
                  </div>

                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      placeholder="Max Salary"
                      value={filterMaxSalary}
                      onChange={(e) => setFilterMaxSalary(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 transition-all"
                    />
                  </div>

                  <select
                    value={filterCareerReadiness}
                    onChange={(e) => setFilterCareerReadiness(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-sm text-slate-900 outline-none focus:border-blue-600 transition-all cursor-pointer font-medium"
                  >
                    <option value="">Career Status</option>
                    <option value="immediate">Immediate</option>
                    <option value="actively_looking">Actively Looking</option>
                    <option value="exploring">Exploring</option>
                    <option value="passive">Passive</option>
                  </select>

                  <button
                    onClick={handleApplyFilters}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSyncing ? (
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Filter className="w-4 h-4" />
                    )}
                    {isSyncing ? "Searching..." : "Search"}
                  </button>
                </div>
              </div>
            </section>

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Calculating best matches...</p>
                </div>
              </div>
            ) : candidates.length > 0 && (tiers.elite.length === 0 && tiers.strong.length === 0) ? (
              <div className="flex items-center justify-center py-20 bg-slate-50 rounded-3xl">
                <div className="text-center">
                  <Filter className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No candidates above 75% match</p>
                  <p className="text-slate-400 text-sm mt-1">Try adjusting your filters to see more candidates</p>
                </div>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="space-y-12">
                {Object.entries(tiers).map(
                  ([tier, list]) =>
                    list.length > 0 && (
                      <div key={tier} className="space-y-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-10 w-10 rounded-lg flex items-center justify-center shadow-md flex-shrink-0 ${
                              tier === "elite"
                                ? "bg-orange-500 shadow-orange-200"
                                : tier === "strong"
                                  ? "bg-blue-600 shadow-blue-200"
                                  : "bg-slate-400 shadow-slate-200"
                            }`}
                          >
                            {tier === "elite" ? (
                              <Trophy className="w-5 h-5 text-white" />
                            ) : tier === "strong" ? (
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                              <Users className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-900">
                              {tier === "elite"
                                ? "Best Match"
                                : tier === "strong"
                                  ? "Strong Match"
                                  : "Potential Match"}
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {list.length} candidate{list.length !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {list.map((candidate) => (
                            <RecommendedCard
                              key={candidate.user_id}
                              candidate={candidate}
                              onViewProfile={() =>
                                handleViewProfile(candidate, "resume")
                              }
                              onInvite={() =>
                                setInviteModal({ isOpen: true, candidate })
                              }
                              isElite={tier === "elite"}
                              getDisplayName={getDisplayName}
                              activeFilter={activeFilters[0]}
                            />
                          ))}
                        </div>
                      </div>
                    ),
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-20 bg-slate-50 rounded-3xl">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No matches found</p>
                  <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            )}
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
            onClose={() => setInviteModal({ isOpen: false, candidate: null })}
            candidateName={inviteModal.candidate.full_name}
            jobs={jobs}
            onInvite={handleInviteCandidate}
          />
        )}
      </main>
    </div>
  );
}

function RecommendedCard({
  candidate,
  onViewProfile,
  onInvite,
  isElite,
  getDisplayName,
  activeFilter,
}: {
  candidate: Candidate;
  onViewProfile: () => void;
  onInvite: () => void;
  isElite?: boolean;
  getDisplayName: (name: string, id: string) => string;
  activeFilter?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow-lg transition-shadow flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {candidate.profile_photo_url ? (
              <img
                src={candidate.profile_photo_url}
                alt={candidate.full_name}
                className="h-full w-full object-cover"
              />
            ) : (
              <User className="h-5 w-5 text-slate-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-slate-900 truncate">
              {getDisplayName(candidate.full_name, candidate.user_id)}
            </h3>
            <p className="text-xs text-slate-500 truncate">
              {candidate.current_role}
            </p>
          </div>
        </div>
        {candidate.identity_verified && (
          <div className="flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1 flex flex-col gap-3">
        {/* Match Score Badge - Only show for "Best Match" filter */}
        {activeFilter === "understanding_and_assessment" && (
          <div className={`px-3 py-2 rounded-lg text-center ${
            isElite ? "bg-orange-50" : "bg-blue-100"
          }`}>
            <p className={`text-xs font-medium ${
              isElite ? "text-orange-600" : "text-blue-600"
            }`}>
              {isElite ? "Best Match" : "Good Match"}
            </p>
            <p className={`text-xl font-bold ${
              isElite ? "text-orange-700" : "text-blue-700"
            }`}>
              {candidate.culture_match_score}%
            </p>
          </div>
        )}

        {/* Match Reasoning */}
        {candidate.match_reasoning && (
          <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100">
            <p className="text-xs font-medium text-slate-600 mb-1">Why this match:</p>
            <p className="text-xs italic text-slate-600">"{candidate.match_reasoning}"</p>
          </div>
        )}

        {/* Experience & Skills */}
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium">
              {candidate.years_of_experience}y Experience
            </span>
            <span className={`px-2.5 py-1 rounded-md font-medium text-white ${
              candidate.experience === "fresher" ? "bg-blue-600" :
              candidate.experience === "mid" ? "bg-blue-600" :
              candidate.experience === "senior" ? "bg-purple-600" :
              "bg-slate-600"
            }`}>
              {candidate.experience?.charAt(0).toUpperCase() + candidate.experience?.slice(1)}
            </span>
          </div>

          {candidate.skills && candidate.skills.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Top Skills</p>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.slice(0, 2).map((skill) => (
                  <span
                    key={skill}
                    className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium"
                  >
                    {skill}
                  </span>
                ))}
                {candidate.skills.length > 2 && (
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium">
                    +{candidate.skills.length - 2}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t border-slate-100 flex items-center gap-2">
        <button
          onClick={onViewProfile}
          className="flex-1 px-3 py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-all active:scale-95"
        >
          Profile
        </button>
        <button
          onClick={onInvite}
          className={`p-2.5 rounded-lg transition-all active:scale-95 flex-shrink-0 ${
            isElite
              ? "bg-orange-600 text-white hover:bg-orange-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          title="Invite"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

