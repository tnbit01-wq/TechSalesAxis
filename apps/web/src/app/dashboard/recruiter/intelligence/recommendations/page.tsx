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
  LogOut,
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
  const [activeFilters, setActiveFilters] = useState<string[]>(["culture_fit"]);
  const [recruiterProfile, setRecruiterProfile] =
    useState<RecruiterProfile | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [filterExperience, setFilterExperience] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [debouncedLocation, setDebouncedLocation] = useState<string>("");
  const [filterMaxSalary, setFilterMaxSalary] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocation(filterLocation);
    }, 500);
    return () => clearTimeout(timer);
  }, [filterLocation]);

  const [currencySymbol, setCurrencySymbol] = useState<string>("$");
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterSalesModel, setFilterSalesModel] = useState<string>("");
  const [filterTargetMarket, setFilterTargetMarket] = useState<string>("");

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
    // Only fetch if we're not manually typing in the location field anymore
    if (filterLocation !== debouncedLocation) return;
    
    setLoading(true);
    setIsSyncing(true);
    try {
      const token = awsAuth.getToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      // Handle search params for skill_match
      const params = new URLSearchParams(window.location.search);
      const initialSkills = params.get("skills");
      
      let modesStr = activeFilters.join(",");
      let url = `/recruiter/recommended-candidates?filter_type=${modesStr}`;
      
      if (activeFilters.includes("skill_match") && initialSkills) {
        url += `&skills=${initialSkills}`;
      }
      
      // Add Location & Salary & Sales DNA filters
      if (debouncedLocation) url += `&location=${encodeURIComponent(debouncedLocation)}`;
      if (filterMaxSalary) url += `&max_salary=${encodeURIComponent(filterMaxSalary)}`;
      if (filterSalesModel) url += `&sales_model=${encodeURIComponent(filterSalesModel)}`;
      if (filterTargetMarket) url += `&target_market=${encodeURIComponent(filterTargetMarket)}`;
      if (filterExperience !== "all") url += `&experience_band=${encodeURIComponent(filterExperience)}`;
      if (searchTerm) url += `&skills=${encodeURIComponent(searchTerm)}`;

      const [recData, profileData, jobsData] = await Promise.all([
        apiClient.get(url, token),
        apiClient.get("/recruiter/profile", token),
        apiClient.get("/recruiter/jobs", token),
      ]);

      setCandidates(recData || []);
      setRecruiterProfile(profileData);
      setJobs(jobsData || []);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      toast.error("Algorithmic Sync Failed: Could not load recommendations");
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [router, activeFilters, debouncedLocation, filterLocation, filterMaxSalary, filterSalesModel, filterTargetMarket, searchTerm]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialFilter = params.get("filter") as any;
    if (initialFilter && (initialFilter === "skill_match" || initialFilter === "profile_matching")) {
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
    // Initial fetch
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleLogout = async () => {
    awsAuth.logout();
    router.replace("/login");
  };

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

  // Group by Match Strength for a more "Recommended" feel
  const tiers = {
    elite: filteredCandidates.filter((c) => c.culture_match_score >= 85),
    strong: filteredCandidates.filter(
      (c) => c.culture_match_score >= 60 && c.culture_match_score < 85,
    ),
    potential: filteredCandidates.filter((c) => c.culture_match_score < 60),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-6">
          <div className="h-16 w-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center shadow-xl">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
          <p className="text-primary font-black text-[10px] uppercase tracking-[0.4em]">
            Calculating Best Match...
          </p>
        </div>
      </div>
    );
  }

  const isLocked = (recruiterProfile?.companies?.profile_score ?? 0) === 0;

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-7xl mx-auto px-4 py-12">
        {isLocked ? (
          <LockedView featureName="Recommended Talent" />
        ) : (
          <>
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  AI <span className="text-primary">Recommendations</span>
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Discover the best candidates for your open roles
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all text-sm font-medium flex items-center gap-2 w-fit"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </header>

            {/* Search & Filters */}
            <section className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm mb-8 space-y-4">
              {/* First Row: Search and Match Type Filters */}
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <div className="flex-1 relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, role, or skills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-11 pr-4 py-2.5 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: "culture_fit", label: "Culture Fit" },
                    { id: "skill_match", label: "Skills" },
                    { id: "profile_matching", label: "Expert View" }
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => toggleFilter(f.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        activeFilters.includes(f.id)
                          ? "bg-primary text-white shadow-md shadow-primary-light"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Second Row: Experience Filters */}
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
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      filterExperience === band.id
                        ? "bg-primary text-white shadow-md shadow-primary-light"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>

              {/* Third Row: Detailed Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Location..."
                    value={filterLocation}
                    onChange={(e) => setFilterLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    placeholder="Budget..."
                    value={filterMaxSalary}
                    onChange={(e) => setFilterMaxSalary(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-2.5 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                  />
                </div>

                <div>
                  <select
                    value={filterSalesModel}
                    onChange={(e) => setFilterSalesModel(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 px-4 py-2.5 rounded-lg text-sm text-slate-900 font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
                  >
                    <option value="">Sales Model...</option>
                    <option value="Transactional">Transactional</option>
                    <option value="Consultative">Consultative</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <div>
                  <select
                    value={filterTargetMarket}
                    onChange={(e) => setFilterTargetMarket(e.target.value)}
                    className="w-full bg-white border-2 border-slate-300 px-4 py-2.5 rounded-lg text-sm text-slate-900 font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
                  >
                    <option value="">Target Market...</option>
                    <option value="SMB">SMB</option>
                    <option value="Mid-Market">Mid-Market</option>
                    <option value="Enterprise">Enterprise</option>
                  </select>
                </div>

                <button
                  onClick={handleApplyFilters}
                  disabled={isSyncing}
                  className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-primary-light disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
                >
                  {isSyncing ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Filter className="w-4 h-4" />
                  )}
                  {isSyncing ? "Searching..." : "Apply"}
                </button>
              </div>
            </section>

            {/* Results */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-sm">Calculating best matches...</p>
                </div>
              </div>
            ) : filteredCandidates.length > 0 ? (
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
                                  ? "bg-primary shadow-primary-light"
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
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary-light">
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
}: {
  candidate: Candidate;
  onViewProfile: () => void;
  onInvite: () => void;
  isElite?: boolean;
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
              {candidate.full_name}
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
        {/* Match Score Badge */}
        <div className={`px-3 py-2 rounded-lg text-center ${
          isElite ? "bg-orange-50" : "bg-primary-light"
        }`}>
          <p className={`text-xs font-medium ${
            isElite ? "text-orange-600" : "text-primary"
          }`}>
            {isElite ? "Best Match" : "Good Match"}
          </p>
          <p className={`text-xl font-bold ${
            isElite ? "text-orange-700" : "text-primary-dark"
          }`}>
            {candidate.culture_match_score}%
          </p>
        </div>

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
              candidate.experience === "mid" ? "bg-primary" :
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
                    className="px-2 py-1 bg-primary-light text-primary-dark rounded-md text-xs font-medium"
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
              : "bg-primary text-white hover:bg-primary-dark"
          }`}
          title="Invite"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

