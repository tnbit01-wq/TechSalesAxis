"use client";

import React, { useState, useEffect, useMemo } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import TalentBubbleChart from "@/components/TalentBubbleChart";
import { 
  Zap, 
  Send,
  MousePointer2,
  User,
  MapPin,
  Briefcase,
  TrendingUp,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  Search,
  X,
  ChevronRight,
  Lock,
  Star
} from "lucide-react";

interface CandidateData {
  user_id: string;
  full_name: string;
  experience: string;
  years_of_experience: number;
  skills: string[];
  location: string;
  location_tier: string | null;
  expected_salary: number | null;
  target_role: string | null;
  current_role: string | null;
  is_shadow_profile?: boolean;
}

interface QueryResult {
  query: string;
  matches: CandidateData[];
  criteria: Record<string, any>;
}

const TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];
const TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi'];

function getCityTier(location: string): string {
  if (!location) return "Unspecified";
  const loc = location.toLowerCase();
  if (TIER_1_CITIES.some(city => loc.includes(city))) return "Tier 1";
  if (TIER_2_CITIES.some(city => loc.includes(city))) return "Tier 2";
  return "Tier 3";
}

function parseQuery(query: string): Record<string, any> {
  const criteria: Record<string, any> = {
    skills: [],
    locations: [],
    minExp: -1, // -1 means no constraint
    maxExp: -1, // -1 means no constraint
    roles: [],
    minSalary: 0,
    maxSalary: Infinity,
    experienceConstraints: null // store the exact constraint type
  };

  const lowerQuery = query.toLowerCase();

  console.log("ðŸ”Ž Starting detailed query parsing...");

  // ===== PARSE EXPERIENCE WITH NATURAL LANGUAGE =====
  // Handle natural language comparisons FIRST
  
  // Pattern 1: "less than X", "fewer than X", "under X", "below X"
  const lessThanMatch = /(?:less\s+than|fewer\s+than|under|below)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (lessThanMatch) {
    const maxYears = parseInt(lessThanMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears - 1; // less than 4 means 0-3
    criteria.experienceConstraints = `less than ${maxYears}`;
    console.log(`âœ“ Experience: < ${maxYears} years (0-${maxYears - 1})`);
  }

  // Pattern 2: "more than X", "greater than X", "above X", "over X"
  const moreThanMatch = /(?:more\s+than|greater\s+than|above|over)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (moreThanMatch) {
    const minYears = parseInt(moreThanMatch[1]);
    criteria.minExp = minYears + 1; // more than 5 means 6+
    criteria.maxExp = 50;
    criteria.experienceConstraints = `more than ${minYears}`;
    console.log(`âœ“ Experience: > ${minYears} years (${minYears + 1}+)`);
  }

  // Pattern 3: "at least X", "minimum X"
  const atLeastMatch = /(?:at\s+least|minimum|atleast)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (atLeastMatch) {
    const minYears = parseInt(atLeastMatch[1]);
    criteria.minExp = minYears;
    criteria.maxExp = 50;
    criteria.experienceConstraints = `at least ${minYears}`;
    console.log(`âœ“ Experience: >= ${minYears} years`);
  }

  // Pattern 4: "up to X", "maximum X"
  const upToMatch = /(?:up\s+to|maximum|upto)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (upToMatch) {
    const maxYears = parseInt(upToMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears;
    criteria.experienceConstraints = `up to ${maxYears}`;
    console.log(`âœ“ Experience: <= ${maxYears} years`);
  }

  // Pattern 5: "between X and Y", "X to Y"
  const betweenMatch = /(?:between\s+)?(\d+)\s*(?:to|-)\s*(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (betweenMatch && !lessThanMatch && !moreThanMatch && !atLeastMatch && !upToMatch) {
    const min = parseInt(betweenMatch[1]);
    const max = parseInt(betweenMatch[2]);
    criteria.minExp = min;
    criteria.maxExp = max;
    criteria.experienceConstraints = `between ${min} and ${max}`;
    console.log(`âœ“ Experience: ${min}-${max} years`);
  }

  // Pattern 6: Senior/Mid/Junior (if no explicit years mentioned)
  if (criteria.minExp === -1) {
    if (/\bsenior\b|lead\b|principal|veteran|experienced/i.test(lowerQuery)) {
      criteria.minExp = 10;
      criteria.maxExp = 50;
      criteria.experienceConstraints = "senior level (10+)";
      console.log(`âœ“ Experience: Senior level (10+)`);
    } else if (/\bmid[\s-]?level\b|intermediate/i.test(lowerQuery)) {
      criteria.minExp = 5;
      criteria.maxExp = 9;
      criteria.experienceConstraints = "mid level (5-9)";
      console.log(`âœ“ Experience: Mid level (5-9)`);
    } else if (/\bjunior\b|entry[\s-]?level|fresher|intern|beginner/i.test(lowerQuery)) {
      criteria.minExp = 0;
      criteria.maxExp = 2;
      criteria.experienceConstraints = "junior level (0-2)";
      console.log(`âœ“ Experience: Junior level (0-2)`);
    }
  }

  // ===== PARSE LOCATION =====
  const locationsMap: Record<string, string> = {
    'bangalore': 'bangalore', 'bengaluru': 'bengaluru', 'mumbai': 'mumbai', 'delhi': 'delhi',
    'hyderabad': 'hyderabad', 'chennai': 'chennai', 'kolkata': 'kolkata', 'pune': 'pune',
    'ahmedabad': 'ahmedabad', 'jaipur': 'jaipur', 'lucknow': 'lucknow', 'nagpur': 'nagpur',
    'indore': 'indore', 'kochi': 'kochi', 'coimbatore': 'coimbatore', 'madurai': 'madurai',
    'mysore': 'mysore', 'chandigarh': 'chandigarh', 'bhopal': 'bhopal', 'surat': 'surat',
    'patna': 'patna', 'ranchi': 'ranchi'
  };

  Object.keys(locationsMap).forEach(loc => {
    if (lowerQuery.includes(loc)) {
      if (!criteria.locations.includes(loc)) {
        criteria.locations.push(loc);
        console.log(`âœ“ Location: ${loc}`);
      }
    }
  });

  if (/tier\s*1/i.test(lowerQuery)) {
    criteria.locations.push('Tier 1');
    console.log(`âœ“ Location: Tier 1`);
  }
  if (/tier\s*2/i.test(lowerQuery)) {
    criteria.locations.push('Tier 2');
    console.log(`âœ“ Location: Tier 2`);
  }

  // ===== PARSE SKILLS =====
  // Look for "skilled in", "expertise in", "experienced with", etc.
  const skillPatterns = [
    /(?:skilled|expertise|experienced|proficient|expert)\s+(?:in|with|at)\s+([^,.\n;]+?)(?:[,.\n;]|and\s+(?:skilled|expertise|experienced))/gi,
    /knowledge\s+(?:in|of)\s+([^,.\n;]+?)(?:[,.\n;])/gi,
  ];

  const extractedSkills = new Set<string>();
  
  skillPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      const skillsText = match[1].trim();
      // Split by common delimiters and clean up
      const skillsList = skillsText.split(/[\s,]+/).map(s => s.trim()).filter(s => 
        s.length > 2 && !['and', 'or', 'the', 'for', 'with', 'in', 'of', 'at', 'to', 'be', 'by', 'is', 'are'].includes(s.toLowerCase())
      );
      skillsList.forEach(s => extractedSkills.add(s.toLowerCase()));
    }
  });

  // Also extract any compound skills like "outbound sales", "account management"
  const compoundSkillMatch = /(?:skilled|expertise|experienced|proficient)\s+(?:in|with)\s+([a-z\s]+?)(?:\s+and|\s+or|[,.\n]|$)/gi;
  let cMatch;
  while ((cMatch = compoundSkillMatch.exec(query)) !== null) {
    const compound = cMatch[1].trim();
    if (compound.length > 2) {
      extractedSkills.add(compound.toLowerCase());
    }
  }

  criteria.skills = Array.from(extractedSkills);
  if (criteria.skills.length > 0) {
    console.log(`âœ“ Skills: ${criteria.skills.join(', ')}`);
  }

  // ===== PARSE ROLES =====
  const rolesMap: Record<string, string> = {
    'developer': 'developer', 'engineer': 'engineer', 'manager': 'manager', 
    'lead': 'lead', 'analyst': 'analyst', 'architect': 'architect', 'designer': 'designer',
    'backend': 'backend', 'frontend': 'frontend', 'fullstack': 'fullstack', 'devops': 'devops',
    'qa': 'qa', 'tester': 'tester', 'scientist': 'scientist', 'product': 'product',
    'sales': 'sales', 'associate': 'associate', 'consultant': 'consultant',
    'business': 'business', 'development': 'development', 'enterprise': 'enterprise'
  };

  Object.keys(rolesMap).forEach(role => {
    if (lowerQuery.includes(role)) {
      criteria.roles.push(role);
    }
  });

  if (criteria.roles.length > 0) {
    console.log(`âœ“ Roles: ${criteria.roles.join(', ')}`);
  }

  // ===== PARSE SALARY =====
  // Pattern: "salary X to Y", "X-Y salary", "â‚¹ X lakhs", etc.
  const salaryPatterns = [
    /salary\s+(?:of\s+)?â‚¹?\s*([\d.]+)\s*(?:to|-)\s*â‚¹?\s*([\d.]+)/i,
    /â‚¹?\s*([\d.]+)\s*(?:to|-)\s*â‚¹?\s*([\d.]+)\s*(?:lakhs?|salary)?/i,
    /(?:upto|up to|max|maximum)\s+â‚¹?\s*([\d.]+)/i,
  ];

  salaryPatterns.forEach(pattern => {
    const match = pattern.exec(query);
    if (match) {
      if (match[2]) {
        // Range
        criteria.minSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        criteria.maxSalary = parseFloat(match[2]) > 100 ? parseFloat(match[2]) : parseFloat(match[2]) * 100000;
        console.log(`âœ“ Salary range: â‚¹${criteria.minSalary/100000}L - â‚¹${criteria.maxSalary/100000}L`);
      } else {
        // Max only
        criteria.maxSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        console.log(`âœ“ Max salary: â‚¹${criteria.maxSalary/100000}L`);
      }
    }
  });

  return criteria;
}

function matchCandidate(candidate: CandidateData, criteria: Record<string, any>): number {
  let score = 0;
  let totalWeight = 0;

  console.log(`\nðŸ” Checking ${candidate.full_name}...`);

  // ===== HARD FILTERS - MUST PASS OR REJECT COMPLETELY =====

  // 1. EXPERIENCE - Hard filter
  if (criteria.minExp !== -1 || criteria.maxExp !== -1) {
    const candExp = candidate.years_of_experience;
    const minOk = criteria.minExp === -1 || candExp >= criteria.minExp;
    const maxOk = criteria.maxExp === -1 || candExp <= criteria.maxExp;

    if (!minOk || !maxOk) {
      console.log(`  âŒ Experience filter FAILED: ${candExp} years (needed ${criteria.minExp === -1 ? '?' : criteria.minExp}-${criteria.maxExp === -1 ? '?' : criteria.maxExp})`);
      return 0; // REJECT
    }
    console.log(`  âœ“ Experience OK: ${candExp} years`);
    score += 25;
    totalWeight += 25;
  }

  // 2. LOCATION - Hard filter
  if (criteria.locations.length > 0) {
    const tier = getCityTier(candidate.location);
    const locationMatches = criteria.locations.some((loc: string) => {
      const locLower = loc.toLowerCase();
      const tierLower = tier.toLowerCase();
      const candLocLower = candidate.location.toLowerCase();
      
      return locLower.includes(tierLower) || candLocLower.includes(locLower) || locLower === tierLower;
    });

    if (!locationMatches) {
      console.log(`  âŒ Location filter FAILED: ${candidate.location} (needed ${criteria.locations.join(', ')})`);
      return 0; // REJECT
    }
    console.log(`  âœ“ Location OK: ${candidate.location}`);
    score += 25;
    totalWeight += 25;
  } else {
    // No location requirement, give default points
    score += 12.5;
    totalWeight += 25;
  }

  // 3. SKILLS - Hard filter with semantic matching
  if (criteria.skills.length > 0) {
    const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
    const skillMatches: string[] = [];

    // Create skill groups for semantic matching
    const skillGroups: Record<string, string[]> = {
      'sales': ['sales', 'selling', 'seller', 'outbound', 'inbound', 'b2b', 'b2c', 'inside sales', 'enterprise sales', 'field sales', 'account executive'],
      'business development': ['business development', 'bd', 'strategic partnership', 'account expansion', 'business growth', 'revenue growth'],
      'lead generation': ['lead generation', 'lead', 'prospecting', 'cold calling', 'outreach', 'linkedin outreach'],
      'account management': ['account management', 'key account', 'client management', 'relationship management', 'account executive', 'account development'],
      'crm': ['crm', 'salesforce', 'zoho', 'hubspot', 'dynamics', 'pipedrive', 'customer relationship'],
      'marketing': ['marketing', 'email marketing', 'digital marketing', 'content marketing', 'seo', 'sem', 'marketing automation'],
      'saas': ['saas', 'software', 'subscription', 'solution selling', 'solution sales'],
      'consulting': ['consulting', 'consultant', 'consultative', 'advisory', 'strategic'],
      'negotiation': ['negotiation', 'negotiating', 'closing', 'deal closure', 'contract negotiation'],
      'communication': ['communication', 'presentation', 'public speaking', 'stakeholder management', 'interpersonal'],
    };

    criteria.skills.forEach((requiredSkill: string) => {
      const skillLower = requiredSkill.toLowerCase();
      
      // Direct substring match
      let isMatch = candidateSkills.some(cs => 
        cs.includes(skillLower) || skillLower.includes(cs)
      );

      // If no direct match, try semantic matching via skill groups
      if (!isMatch) {
        for (const [groupKey, groupMembers] of Object.entries(skillGroups)) {
          // Check if required skill is part of this group
          const requiredInGroup = groupMembers.some(member => member.includes(skillLower) || skillLower.includes(member));
          
          // Check if candidate has any skill from this group
          const candHasGroupSkill = candidateSkills.some(cs => 
            groupMembers.some(member => cs.includes(member) || member.includes(cs.split(' ')[0]))
          );

          if (requiredInGroup && candHasGroupSkill) {
            isMatch = true;
            break;
          }
        }
      }

      if (isMatch) {
        skillMatches.push(requiredSkill);
      }
    });

    if (skillMatches.length === 0) {
      console.log(`  âŒ Skills filter FAILED: has none of [${criteria.skills.join(', ')}]`);
      console.log(`     Candidate skills: [${candidateSkills.slice(0, 5).join(', ')}...]`);
      return 0; // REJECT - no skills match
    }

    // Partial score based on how many skills match
    const skillScore = (skillMatches.length / criteria.skills.length) * 30;
    console.log(`  âœ“ Skills OK: matched ${skillMatches.length}/${criteria.skills.length} (${skillMatches.join(', ')})`);
    score += skillScore;
    totalWeight += 30;
  } else {
    // No skill requirement
    score += 15;
    totalWeight += 30;
  }

  // 4. ROLE - Hard filter
  if (criteria.roles.length > 0) {
    const currentRoleStr = (candidate.current_role || "").toLowerCase();
    const targetRoleStr = (candidate.target_role || "").toLowerCase();
    const combinedRoleStr = `${currentRoleStr} ${targetRoleStr}`;

    const roleMatches = criteria.roles.some((role: string) => 
      combinedRoleStr.includes(role.toLowerCase())
    );

    if (!roleMatches) {
      console.log(`  âŒ Role filter FAILED: ${candidate.current_role} / ${candidate.target_role} (needed ${criteria.roles.join(', ')})`);
      return 0; // REJECT
    }
    console.log(`  âœ“ Role OK: ${candidate.current_role}`);
    score += 20;
    totalWeight += 20;
  } else {
    // No role requirement
    score += 10;
    totalWeight += 20;
  }

  // 5. SALARY - Soft filter with rejection
  if (criteria.maxSalary !== Infinity && (candidate.expected_salary || 0) > 0) {
    const candSalary = candidate.expected_salary || 0;
    if (candSalary > criteria.maxSalary) {
      // Check if it's just mildly over budget
      if (candSalary > criteria.maxSalary * 1.2) {
        console.log(`  âŒ Salary filter FAILED: ${candSalary} > ${criteria.maxSalary} (over budget by 20%+)`);
        return 0; // REJECT - too expensive
      }
    }
  }

  // ===== FINAL SCORING =====
  const finalScore = totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  console.log(`  ðŸ“Š PASSED - Score: ${finalScore.toFixed(1)}%`);

  return finalScore;
}

export default function TalentPoolPage() {
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [pipelineData, setPipelineData] = useState<any[]>([]);
  const [personalInfoUnlocked, setPersonalInfoUnlocked] = useState<Record<string, boolean>>({});

  // Check if candidate has unlocked access to personal info
  const hasAccessToPersonalInfo = (candidateId: string): boolean => {
    // Check pipeline for: applied, shortlisted, or invited with reply
    const candidateApplications = pipelineData.filter(app => app.candidate_id === candidateId || app.app?.candidate_id === candidateId);
    
    if (candidateApplications.length === 0) return false;

    return candidateApplications.some(app => {
      const appStatus = app.status || app.app?.status || '';
      const isSensitiveStatus = ['applied', 'shortlisted', 'interview_scheduled', 'offered', 'hired'].includes(appStatus.toLowerCase());
      
      // Check if invited and has unread/replied messages
      const hasInviteReply = app.invite_message_replied || app.has_replied_to_invite || false;
      
      return isSensitiveStatus || hasInviteReply;
    });
  };

  // Blur personal info if not unlocked
  const getDisplayName = (fullName: string, candidateId: string): string => {
    if (personalInfoUnlocked[candidateId] || hasAccessToPersonalInfo(candidateId)) {
      return fullName;
    }
    // Show only first letter of first and last name
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}**** ${parts[parts.length - 1].charAt(0)}****`;
    }
    return parts[0].charAt(0) + '****';
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
      console.log("[TRACKING] âœ“ Profile view tracked:", candidateId);
      console.log("[TRACKING] Response:", response);
    } catch (err: any) {
      console.error("[TRACKING] âœ— Failed to track profile view:", candidateId);
      console.error("[TRACKING] Error details:", err);
    }
  };

  const handleInvite = async () => {
    if (!selectedCandidate) return;

    // Check if shadow profile
    if (selectedCandidate.is_shadow_profile) {
      console.log("Cannot invite shadow profile");
      return;
    }

    setInviteLoading(true);
    try {
      const token = awsAuth.getToken();
      const response = await apiClient.post(
        `/recruiter/candidate/${selectedCandidate.user_id}/invite`,
        {
          job_id: "",
          message: `Hi ${selectedCandidate.full_name}, we're interested in connecting with you about exciting opportunities!`
        },
        token,
      );
      
      console.log("Invite sent successfully", response);
      alert("Invitation sent successfully!");
      setSelectedCandidate(null);
    } catch (error) {
      console.error("Failed to send invite:", error);
      alert("Failed to send invitation. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEmailClick = () => {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 2000);
  };

  useEffect(() => {
    async function fetchPool() {
      try {
        const token = awsAuth.getToken();
        if (!token) {
          console.warn("No token found for talent-pool fetch");
          return;
        }
        console.log("Fetching talent-pool with token...");
        const data = await apiClient.get("/recruiter/talent-pool", token);
        console.log("Talent-pool data received:", data);
        setCandidates(data || []);

        // Also fetch pipeline data to check candidate application status
        try {
          console.log("Fetching pipeline data for access control...");
          const pipelineResponse = await apiClient.get("/recruiter/applications/pipeline", token);
          setPipelineData(pipelineResponse || []);
          console.log("Pipeline data received:", pipelineResponse);
        } catch (pipelineErr) {
          console.warn("Could not fetch pipeline data:", pipelineErr);
        }
      } catch (err) {
        console.error("Pool fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPool();
  }, []);

  const handleQuery = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setQueryResult(null);
      return;
    }

    console.log("\n=".repeat(60));
    console.log("ðŸ” STARTING TALENT POOL SEARCH");
    console.log("=".repeat(60));
    console.log("Query:", searchQuery);
    console.log(`Total candidates in pool: ${candidates.length}\n`);

    const criteria = parseQuery(searchQuery);

    const scored = candidates.map(c => ({
      candidate: c,
      score: matchCandidate(c, criteria)
    }));

    // Filter candidates - only include those with score > 0 (passed all hard filters)
    // AND score >= minimum threshold
    const MINIMUM_SCORE_THRESHOLD = 20; // Low threshold since hard filters do the work
    const matches = scored
      .filter(s => s.score > MINIMUM_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map(s => s.candidate);

    console.log("\n" + "=".repeat(60));
    console.log(`âœ¨ SEARCH COMPLETE: Found ${matches.length} matching ${matches.length === 1 ? 'candidate' : 'candidates'}`);
    console.log("=".repeat(60) + "\n");

    setQueryResult({
      query: searchQuery,
      matches,
      criteria
    });
  };

  const filteredCandidates = useMemo(() => {
    return queryResult?.matches || candidates;
  }, [queryResult, candidates]);

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center bg-[#F8F9FC]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 rounded-full border-[2.5px] border-slate-200 border-t-[#FF8A00] animate-spin" />
          <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading Talent Poolâ€¦</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] bg-[#F8F9FC] overflow-hidden flex gap-4 p-4">
      <style>{`
        .pool-invisible-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .pool-invisible-scroll::-webkit-scrollbar {
          width: 0;
          height: 0;
        }
      `}</style>

      {/* â”€â”€ LEFT: Search + Candidate List â”€â”€ */}
      <div className="w-[320px] flex-shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Search header */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="relative group mb-3">
            <Search className="absolute left-3 top-3.5 h-3.5 w-3.5 text-slate-400 group-focus-within:text-[#FF8A00] transition-colors" />
            <textarea
              placeholder="Describe who you're looking forâ€¦"
              rows={2}
              className="w-full pl-9 pr-3 py-2.5 bg-[#F8F9FC] border border-slate-200/60 rounded-xl text-[12.5px] leading-relaxed text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/20 focus:border-[#FF8A00]/50 transition-all resize-none min-h-[74px]"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleQuery(query);
                }
              }}
            />
          </div>
          <button
            onClick={() => handleQuery(query)}
            className="w-full flex items-center justify-center gap-2 py-2 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-[12px] font-semibold transition-all active:scale-95 shadow-sm"
          >
            <Send className="h-3.5 w-3.5" />
            Search Talent Pool
          </button>
          {queryResult && (
            <button
              onClick={() => { setQueryResult(null); setQuery(""); }}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3 w-3" /> Clear Filter
            </button>
          )}
        </div>

        {/* Stats strip */}
        <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/50">
          <span className="text-[11px] font-semibold text-slate-500">
            {queryResult ? "Matching Results" : "All Candidates"}
          </span>
          <span className="text-[13px] font-bold text-[#FF8A00]">{filteredCandidates.length}</span>
        </div>

        {/* Candidate list */}
        <div className="flex-1 overflow-y-auto dashboard-scroll pool-invisible-scroll">
          {filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center justify-center mb-2">
                <User className="h-4 w-4 text-slate-300" strokeWidth={1.5} />
              </div>
              <p className="text-[12px] font-semibold text-[#0F172A]">No matches found</p>
              <p className="text-[11px] text-slate-400 mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            filteredCandidates.map((candidate) => {
              const isSelected = selectedCandidate?.user_id === candidate.user_id;
              return (
                <button
                  key={candidate.user_id}
                  onClick={() => { trackProfileView(candidate.user_id); setSelectedCandidate(candidate); }}
                  className={`w-full px-4 py-3 text-left border-b border-slate-100/70 transition-all relative ${isSelected ? "bg-[#FFF6ED]" : "hover:bg-slate-50/80"}`}
                >
                  {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A00] rounded-r-full" />}
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg flex-shrink-0 bg-gradient-to-br from-[#FF8A00]/10 to-[#FF8A00]/5 flex items-center justify-center text-[12px] font-bold text-[#FF8A00] ring-1 ring-[#FF8A00]/10">
                      {getDisplayName(candidate.full_name, candidate.user_id)[0]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[12px] font-semibold truncate ${isSelected ? "text-[#FF8A00]" : "text-[#0F172A]"}`}>
                        {getDisplayName(candidate.full_name, candidate.user_id)}
                      </p>
                      <p className="text-[10.5px] text-slate-400 truncate">{candidate.current_role || "Professional"}</p>
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 flex-shrink-0 transition-colors ${isSelected ? "text-[#FF8A00]" : "text-slate-300"}`} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 pl-[42px]">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <TrendingUp className="h-2.5 w-2.5" />{candidate.years_of_experience}y exp
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin className="h-2.5 w-2.5" />{getCityTier(candidate.location)}
                    </span>
                  </div>
                  {candidate.skills?.length > 0 && (
                    <div className="flex gap-1 mt-1.5 pl-[42px] flex-wrap">
                      {candidate.skills.slice(0, 2).map((skill, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 bg-[#FFF6ED] border border-orange-100/80 rounded-md text-[#FF8A00] font-medium">{skill}</span>
                      ))}
                      {candidate.skills.length > 2 && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-500 font-medium">+{candidate.skills.length - 2}</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* â”€â”€ CENTER: Bubble Chart â”€â”€ */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div className="flex-1 bg-gradient-to-br from-white via-[#FFFDF9] to-[#FFF6ED] rounded-2xl border border-orange-100/70 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_28px_rgba(255,138,0,0.08)] overflow-hidden flex flex-col">
          <div className="px-5 py-3.5 border-b border-orange-100/70 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#FFF6ED] border border-orange-200/80 flex items-center justify-center shadow-sm">
                <Zap className="h-3.5 w-3.5 text-[#FF8A00]" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#0F172A]">Talent Distribution</p>
                <p className="text-[10.5px] text-slate-400">Candidates by experience level</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-[#C25E00] bg-[#FFF6ED] px-2.5 py-1.5 rounded-lg border border-orange-100/80">
              <MousePointer2 className="h-3 w-3" />
              Hover for details
            </div>
          </div>
          <div className="flex-1 relative p-3">
            <TalentBubbleChart data={filteredCandidates} />
          </div>
        </div>
      </div>

      {/* â”€â”€ RIGHT: Candidate Detail Panel â”€â”€ */}
      {selectedCandidate && (
        <div className="w-[320px] flex-shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_6px_24px_rgba(0,0,0,0.04)] overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl flex-shrink-0 bg-gradient-to-br from-[#FF8A00]/10 to-[#FF8A00]/5 flex items-center justify-center text-[14px] font-bold text-[#FF8A00] ring-1 ring-[#FF8A00]/10">
                {getDisplayName(selectedCandidate.full_name, selectedCandidate.user_id)[0]}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#0F172A] truncate">
                  {getDisplayName(selectedCandidate.full_name, selectedCandidate.user_id)}
                </p>
                <p className="text-[10.5px] text-slate-400 truncate">{selectedCandidate.current_role || "Professional"}</p>
              </div>
            </div>
            <button onClick={() => setSelectedCandidate(null)} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto dashboard-scroll pool-invisible-scroll p-4 space-y-4">
            {/* KPI grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#FFF6ED] rounded-xl p-3 border border-orange-100/80">
                <p className="text-[9px] font-semibold text-[#FF8A00] uppercase tracking-wider mb-1">Experience</p>
                <p className="text-[22px] font-extrabold text-[#0F172A] leading-none">{selectedCandidate.years_of_experience}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">years</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Level</p>
                <p className="text-[12px] font-bold text-[#0F172A] leading-tight">{selectedCandidate.experience || "Mid-level"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</p>
                <p className="text-[11px] font-bold text-[#0F172A]">{getCityTier(selectedCandidate.location)}</p>
                <p className="text-[9px] text-slate-400 truncate">{selectedCandidate.location || "â€”"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Salary Exp.</p>
                <p className="text-[12px] font-bold text-[#0F172A]">
                  {selectedCandidate.expected_salary ? `â‚¹${(selectedCandidate.expected_salary / 100000).toFixed(1)}L` : "Flexible"}
                </p>
              </div>
            </div>

            {/* Skills */}
            {selectedCandidate.skills?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3 w-3" />Expertise Areas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCandidate.skills.map((skill, idx) => (
                    <span key={idx} className="text-[10px] px-2.5 py-1 bg-[#FFF6ED] border border-orange-100/80 rounded-lg text-[#FF8A00] font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy notice */}
            {!hasAccessToPersonalInfo(selectedCandidate.user_id) && (
              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-[11px] font-semibold text-amber-800">Personal Info Locked</p>
                </div>
                <div className="space-y-1.5 pl-5">
                  {[{ icon: Mail, label: "Email Address" }, { icon: Phone, label: "Phone Number" }, { icon: Calendar, label: "Date of Birth" }].map(({ icon: Icon, label }) => (
                    <p key={label} className="flex items-center gap-1.5 text-[10.5px] text-slate-400 line-through">
                      <Icon className="h-3 w-3 text-amber-400" />{label}
                    </p>
                  ))}
                </div>
                <p className="text-[9.5px] text-amber-600 mt-2">Unlocks when candidate applies, is shortlisted, or replies to an invite</p>
              </div>
            )}

            {hasAccessToPersonalInfo(selectedCandidate.user_id) && (
              <div className="bg-emerald-50 border border-emerald-200/60 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">Contact Info</p>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><Mail className="h-3 w-3 text-emerald-500" />Accessible</p>
                <p className="flex items-center gap-1.5 text-[11px] text-slate-600"><Phone className="h-3 w-3 text-emerald-500" />Accessible</p>
              </div>
            )}
          </div>

          {/* Action footer */}
          <div className="p-4 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0">
            <button
              onClick={handleInvite}
              disabled={selectedCandidate?.is_shadow_profile || inviteLoading}
              className="w-full py-2.5 bg-[#FF8A00] hover:bg-[#E67A00] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-[12px] font-semibold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              {inviteLoading ? "Sending Inviteâ€¦" : "Invite Candidate"}
            </button>
            <button
              onClick={handleEmailClick}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[12px] font-medium transition-all border border-slate-200/60 relative"
            >
              Email
              {showComingSoon && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#0F172A] text-white text-[10px] rounded-lg whitespace-nowrap shadow-lg">
                  Coming Soon
                </div>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
