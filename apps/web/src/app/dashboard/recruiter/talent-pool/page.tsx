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
  MessageSquare
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

  console.log("🔎 Starting detailed query parsing...");

  // ===== PARSE EXPERIENCE WITH NATURAL LANGUAGE =====
  // Handle natural language comparisons FIRST
  
  // Pattern 1: "less than X", "fewer than X", "under X", "below X"
  const lessThanMatch = /(?:less\s+than|fewer\s+than|under|below)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (lessThanMatch) {
    const maxYears = parseInt(lessThanMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears - 1; // less than 4 means 0-3
    criteria.experienceConstraints = `less than ${maxYears}`;
    console.log(`✓ Experience: < ${maxYears} years (0-${maxYears - 1})`);
  }

  // Pattern 2: "more than X", "greater than X", "above X", "over X"
  const moreThanMatch = /(?:more\s+than|greater\s+than|above|over)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (moreThanMatch) {
    const minYears = parseInt(moreThanMatch[1]);
    criteria.minExp = minYears + 1; // more than 5 means 6+
    criteria.maxExp = 50;
    criteria.experienceConstraints = `more than ${minYears}`;
    console.log(`✓ Experience: > ${minYears} years (${minYears + 1}+)`);
  }

  // Pattern 3: "at least X", "minimum X"
  const atLeastMatch = /(?:at\s+least|minimum|atleast)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (atLeastMatch) {
    const minYears = parseInt(atLeastMatch[1]);
    criteria.minExp = minYears;
    criteria.maxExp = 50;
    criteria.experienceConstraints = `at least ${minYears}`;
    console.log(`✓ Experience: >= ${minYears} years`);
  }

  // Pattern 4: "up to X", "maximum X"
  const upToMatch = /(?:up\s+to|maximum|upto)\s+(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (upToMatch) {
    const maxYears = parseInt(upToMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears;
    criteria.experienceConstraints = `up to ${maxYears}`;
    console.log(`✓ Experience: <= ${maxYears} years`);
  }

  // Pattern 5: "between X and Y", "X to Y"
  const betweenMatch = /(?:between\s+)?(\d+)\s*(?:to|-)\s*(\d+)\s*(?:years?|yrs?)?/i.exec(query);
  if (betweenMatch && !lessThanMatch && !moreThanMatch && !atLeastMatch && !upToMatch) {
    const min = parseInt(betweenMatch[1]);
    const max = parseInt(betweenMatch[2]);
    criteria.minExp = min;
    criteria.maxExp = max;
    criteria.experienceConstraints = `between ${min} and ${max}`;
    console.log(`✓ Experience: ${min}-${max} years`);
  }

  // Pattern 6: Senior/Mid/Junior (if no explicit years mentioned)
  if (criteria.minExp === -1) {
    if (/\bsenior\b|lead\b|principal|veteran|experienced/i.test(lowerQuery)) {
      criteria.minExp = 10;
      criteria.maxExp = 50;
      criteria.experienceConstraints = "senior level (10+)";
      console.log(`✓ Experience: Senior level (10+)`);
    } else if (/\bmid[\s-]?level\b|intermediate/i.test(lowerQuery)) {
      criteria.minExp = 5;
      criteria.maxExp = 9;
      criteria.experienceConstraints = "mid level (5-9)";
      console.log(`✓ Experience: Mid level (5-9)`);
    } else if (/\bjunior\b|entry[\s-]?level|fresher|intern|beginner/i.test(lowerQuery)) {
      criteria.minExp = 0;
      criteria.maxExp = 2;
      criteria.experienceConstraints = "junior level (0-2)";
      console.log(`✓ Experience: Junior level (0-2)`);
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
        console.log(`✓ Location: ${loc}`);
      }
    }
  });

  if (/tier\s*1/i.test(lowerQuery)) {
    criteria.locations.push('Tier 1');
    console.log(`✓ Location: Tier 1`);
  }
  if (/tier\s*2/i.test(lowerQuery)) {
    criteria.locations.push('Tier 2');
    console.log(`✓ Location: Tier 2`);
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
    console.log(`✓ Skills: ${criteria.skills.join(', ')}`);
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
    console.log(`✓ Roles: ${criteria.roles.join(', ')}`);
  }

  // ===== PARSE SALARY =====
  // Pattern: "salary X to Y", "X-Y salary", "₹ X lakhs", etc.
  const salaryPatterns = [
    /salary\s+(?:of\s+)?₹?\s*([\d.]+)\s*(?:to|-)\s*₹?\s*([\d.]+)/i,
    /₹?\s*([\d.]+)\s*(?:to|-)\s*₹?\s*([\d.]+)\s*(?:lakhs?|salary)?/i,
    /(?:upto|up to|max|maximum)\s+₹?\s*([\d.]+)/i,
  ];

  salaryPatterns.forEach(pattern => {
    const match = pattern.exec(query);
    if (match) {
      if (match[2]) {
        // Range
        criteria.minSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        criteria.maxSalary = parseFloat(match[2]) > 100 ? parseFloat(match[2]) : parseFloat(match[2]) * 100000;
        console.log(`✓ Salary range: ₹${criteria.minSalary/100000}L - ₹${criteria.maxSalary/100000}L`);
      } else {
        // Max only
        criteria.maxSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        console.log(`✓ Max salary: ₹${criteria.maxSalary/100000}L`);
      }
    }
  });

  return criteria;
}

function matchCandidate(candidate: CandidateData, criteria: Record<string, any>): number {
  let score = 0;
  let totalWeight = 0;

  console.log(`\n🔍 Checking ${candidate.full_name}...`);

  // ===== HARD FILTERS - MUST PASS OR REJECT COMPLETELY =====

  // 1. EXPERIENCE - Hard filter
  if (criteria.minExp !== -1 || criteria.maxExp !== -1) {
    const candExp = candidate.years_of_experience;
    const minOk = criteria.minExp === -1 || candExp >= criteria.minExp;
    const maxOk = criteria.maxExp === -1 || candExp <= criteria.maxExp;

    if (!minOk || !maxOk) {
      console.log(`  ❌ Experience filter FAILED: ${candExp} years (needed ${criteria.minExp === -1 ? '?' : criteria.minExp}-${criteria.maxExp === -1 ? '?' : criteria.maxExp})`);
      return 0; // REJECT
    }
    console.log(`  ✓ Experience OK: ${candExp} years`);
    score += 25;
    totalWeight += 25;
  }

  // 2. LOCATION - Hard filter
  if (criteria.locations.length > 0) {
    const tier = getCityTier(candidate.location);
    const locationMatches = criteria.locations.some(loc => {
      const locLower = loc.toLowerCase();
      const tierLower = tier.toLowerCase();
      const candLocLower = candidate.location.toLowerCase();
      
      return locLower.includes(tierLower) || candLocLower.includes(locLower) || locLower === tierLower;
    });

    if (!locationMatches) {
      console.log(`  ❌ Location filter FAILED: ${candidate.location} (needed ${criteria.locations.join(', ')})`);
      return 0; // REJECT
    }
    console.log(`  ✓ Location OK: ${candidate.location}`);
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
    const skillMatches = [];

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

    criteria.skills.forEach(requiredSkill => {
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
      console.log(`  ❌ Skills filter FAILED: has none of [${criteria.skills.join(', ')}]`);
      console.log(`     Candidate skills: [${candidateSkills.slice(0, 5).join(', ')}...]`);
      return 0; // REJECT - no skills match
    }

    // Partial score based on how many skills match
    const skillScore = (skillMatches.length / criteria.skills.length) * 30;
    console.log(`  ✓ Skills OK: matched ${skillMatches.length}/${criteria.skills.length} (${skillMatches.join(', ')})`);
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

    const roleMatches = criteria.roles.some(role => 
      combinedRoleStr.includes(role.toLowerCase())
    );

    if (!roleMatches) {
      console.log(`  ❌ Role filter FAILED: ${candidate.current_role} / ${candidate.target_role} (needed ${criteria.roles.join(', ')})`);
      return 0; // REJECT
    }
    console.log(`  ✓ Role OK: ${candidate.current_role}`);
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
        console.log(`  ❌ Salary filter FAILED: ${candSalary} > ${criteria.maxSalary} (over budget by 20%+)`);
        return 0; // REJECT - too expensive
      }
    }
  }

  // ===== FINAL SCORING =====
  const finalScore = totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  console.log(`  📊 PASSED - Score: ${finalScore.toFixed(1)}%`);

  return finalScore;
}

export default function TalentPoolPage() {
  const [candidates, setCandidates] = useState<CandidateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateData | null>(null);

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
    console.log("🔍 STARTING TALENT POOL SEARCH");
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
    console.log(`✨ SEARCH COMPLETE: Found ${matches.length} matching ${matches.length === 1 ? 'candidate' : 'candidates'}`);
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Initializing Talent Matrix...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0a1228] to-[#0d1320] text-slate-100 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10 max-w-[1400px] mx-auto space-y-8 font-sans">
        {/* Header */}
        <div className="flex flex-col gap-6 border-b border-white/5 pb-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-cyan-500 rounded-full shadow-[0_0_10px_#06b6d4]" />
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em]">Talent Discovery</span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Find Your <span className="text-cyan-500">Perfect</span> Fit
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              Describe the qualities you're looking for, and we'll find the best matches from your talent pool.
            </p>
          </div>

          {/* Chat Query Input */}
          <div className="flex gap-3">
            <div className="flex-1 relative group">
              <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
              <input
                type="text"
                placeholder="e.g., Looking for experienced professionals in Bangalore with strong technical background, open to competitive packages..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-cyan-500/20 rounded-xl text-sm font-medium focus:border-cyan-500/50 focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all placeholder:text-slate-500 hover:border-cyan-500/30"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    const searchQuery = (e.target as HTMLInputElement).value;
                    handleQuery(searchQuery);
                  }
                }}
              />
            </div>
            <button
              onClick={() => handleQuery(query)}
              className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-black rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-cyan-500/30"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline text-[11px]">FIND</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bubble Chart */}
          <div className="lg:col-span-2">
            <div className="bg-white/[0.02] border border-cyan-500/10 rounded-[32px] p-8 relative shadow-2xl overflow-hidden group hover:border-cyan-500/20 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="h-10 w-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">Team Distribution</h3>
                  <p className="text-[10px] text-slate-500 font-bold">Candidates by experience level</p>
                </div>
              </div>
              <div className="h-[550px] w-full relative z-10 transition-all duration-700">
                <TalentBubbleChart data={filteredCandidates} />
                <div className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/40 border border-cyan-500/20 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <MousePointer2 className="h-3 w-3 text-cyan-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest\">Hover for details</span>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] border border-cyan-500/10 rounded-[32px] p-6 relative shadow-2xl overflow-hidden">
              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black text-cyan-400">{filteredCandidates.length}</span>
                  <span className="text-sm font-bold text-slate-400 uppercase">Candidates</span>
                </div>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                  {queryResult ? "Matching Results" : "Available Pool"}
                </p>
              </div>

              {queryResult && (
                <div className="mb-6 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  <p className="text-[11px] font-bold text-cyan-300 mb-2">Your Request:</p>
                  <p className="text-xs text-slate-300 italic">{queryResult.query}</p>
                </div>
              )}

              <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
                {filteredCandidates.slice(0, 10).map((candidate) => (
                  <div
                    key={candidate.user_id}
                    onClick={() => {
                      trackProfileView(candidate.user_id);
                      setSelectedCandidate(candidate);
                    }}
                    className="p-3 bg-white/[0.02] border border-cyan-500/10 rounded-lg hover:border-cyan-500/30 hover:bg-cyan-500/5 cursor-pointer transition-all group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-2 flex-1">
                        <User className="h-4 w-4 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-black text-white truncate group-hover:text-cyan-300">
                            {candidate.full_name}
                          </p>
                          <p className="text-[9px] text-slate-400 truncate">{candidate.current_role || "Professional"}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[9px]">
                      <div className="flex items-center gap-1 text-slate-400">
                        <TrendingUp className="h-3 w-3 text-teal-400" />
                        <span>{candidate.years_of_experience} years exp.</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin className="h-3 w-3 text-teal-400" />
                        <span className="truncate">{getCityTier(candidate.location)}</span>
                      </div>
                    </div>

                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="text-[8px] px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-300">
                            {skill}
                          </span>
                        ))}
                        {candidate.skills.length > 3 && (
                          <span className="text-[8px] px-2 py-1 bg-slate-500/10 rounded-full text-slate-400">
                            +{candidate.skills.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {filteredCandidates.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <MessageSquare className="h-8 w-8 text-slate-600 mb-2" />
                    <p className="text-xs text-slate-500 font-black uppercase tracking-widest">No Results Found</p>
                    <p className="text-[9px] text-slate-600 mt-1">Try adjusting your requirements</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Candidate Detail Modal */}
        {selectedCandidate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/20 rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-b border-cyan-500/10 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h2 className="text-2xl font-black text-white">{selectedCandidate.full_name}</h2>
                    <p className="text-sm text-slate-400 mt-1">{selectedCandidate.current_role || "Professional"}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    className="text-slate-400 hover:text-white transition flex-shrink-0 ml-4 text-2xl font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-cyan-500/20 rounded-lg">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Years of Experience</p>
                    <p className="text-2xl font-black text-cyan-300">{selectedCandidate.years_of_experience}</p>
                    <p className="text-[9px] text-slate-500 mt-1">years</p>
                  </div>

                  <div className="p-4 bg-white/5 border border-cyan-500/20 rounded-lg">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Location</p>
                    <p className="text-lg font-black text-cyan-300">{getCityTier(selectedCandidate.location)}</p>
                    <p className="text-[9px] text-slate-500 mt-1">{selectedCandidate.location}</p>
                  </div>

                  <div className="p-4 bg-white/5 border border-cyan-500/20 rounded-lg">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Expected Compensation</p>
                    <p className="text-2xl font-black text-cyan-300">
                      {selectedCandidate.expected_salary 
                        ? `₹${(selectedCandidate.expected_salary / 100000).toFixed(1)}L` 
                        : "Flexible"}
                    </p>
                  </div>

                  <div className="p-4 bg-white/5 border border-cyan-500/20 rounded-lg">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-2">Experience Level</p>
                    <p className="text-lg font-black text-cyan-300 uppercase">{selectedCandidate.experience}</p>
                  </div>
                </div>

                {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                  <div className="border-t border-cyan-500/10 pt-6">
                    <p className="text-sm font-black text-slate-300 uppercase mb-4 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-cyan-400" />
                      Expertise Areas
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {selectedCandidate.skills.map((skill, idx) => (
                        <span key={idx} className="text-sm px-4 py-2 bg-cyan-500/15 border border-cyan-500/30 rounded-lg text-cyan-200 font-semibold hover:bg-cyan-500/25 transition">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-cyan-500/10 pt-6 flex gap-3">
                  <button className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-bold rounded-lg transition shadow-lg">
                    View Full Profile
                  </button>
                  <button className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition">
                    Connect
                  </button>
                  <button
                    onClick={() => setSelectedCandidate(null)}
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
