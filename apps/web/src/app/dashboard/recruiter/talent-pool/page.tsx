"use client";

import React, { useState, useEffect, useMemo } from "react";
import { awsAuth } from "@/lib/awsAuth";
import { apiClient } from "@/lib/apiClient";
import TalentBubbleChart from "@/components/TalentBubbleChart";
import { toast } from "sonner";
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
  email?: string | null;
  phone_number?: string | null;
}

interface QueryResult {
  query: string;
  matches: CandidateData[];
  criteria: Record<string, any>;
}

const TIER_1_CITIES = ['bangalore', 'bengaluru', 'mumbai', 'delhi', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad'];
const TIER_2_CITIES = ['jaipur', 'lucknow', 'nagpur', 'indore', 'thiruvananthapuram', 'kochi', 'coimbatore', 'madurai', 'mysore', 'chandigarh', 'bhopal', 'surat', 'patna', 'ranchi'];

const LOCATION_SYNONYMS: Record<string, string> = {
  "bengaluru": "bangalore",
  "bangalore": "bengaluru",
  "mumbai": "bombay",
  "bombay": "mumbai",
  "mysuru": "mysore",
  "mysore": "mysuru",
  "chennai": "madras",
  "madras": "chennai",
  "kolkata": "calcutta",
  "calcutta": "kolkata",
  "pune": "poona",
  "poona": "pune",
  "gurugram": "gurgaon",
  "gurgaon": "gurugram",
  "kochi": "cochin",
  "cochin": "kochi",
  "thiruvananthapuram": "trivandrum",
  "trivandrum": "thiruvananthapuram"
};

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

  console.log("[SEARCH] Starting detailed query parsing...");

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
    'patna': 'patna', 'ranchi': 'ranchi', 'bombay': 'bombay', 'mysuru': 'mysuru', 'madras': 'madras',
    'calcutta': 'calcutta', 'poona': 'poona', 'gurugram': 'gurugram', 'gurgaon': 'gurgaon',
    'cochin': 'cochin', 'trivandrum': 'trivandrum', 'thiruvananthapuram': 'thiruvananthapuram'
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
    /salary\s+(?:of\s+)?[\u20B9₹]?\s*([\d.]+)\s*(?:to|-)\s*[\u20B9₹]?\s*([\d.]+)/i,
    /[\u20B9₹]?\s*([\d.]+)\s*(?:to|-)\s*[\u20B9₹]?\s*([\d.]+)\s*(?:lakhs?|salary)?/i,
    /(?:upto|up to|max|maximum)\s+[\u20B9₹]?\s*([\d.]+)/i,
  ];

  salaryPatterns.forEach(pattern => {
    const match = pattern.exec(query);
    if (match) {
      if (match[2]) {
        // Range
        criteria.minSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        criteria.maxSalary = parseFloat(match[2]) > 100 ? parseFloat(match[2]) : parseFloat(match[2]) * 100000;
        console.log(`✓ Salary range: \u20B9${criteria.minSalary/100000}L - \u20B9${criteria.maxSalary/100000}L`);
      } else {
        // Max only
        criteria.maxSalary = parseFloat(match[1]) > 100 ? parseFloat(match[1]) : parseFloat(match[1]) * 100000;
        console.log(`✓ Max salary: \u20B9${criteria.maxSalary/100000}L`);
      }
    }
  });

  return criteria;
}

function matchCandidate(candidate: CandidateData, criteria: Record<string, any>): number {
  let score = 0;
  let totalWeight = 0;

  console.log(`\n[CHECK] Checking ${candidate.full_name}...`);

  // ===== HARD FILTERS - MUST PASS OR REJECT COMPLETELY =====

  // 1. EXPERIENCE - Hard filter
  if (criteria.minExp !== -1 || criteria.maxExp !== -1) {
    const candExp = candidate.years_of_experience;
    const minOk = criteria.minExp === -1 || candExp >= criteria.minExp;
    const maxOk = criteria.maxExp === -1 || candExp <= criteria.maxExp;

    if (!minOk || !maxOk) {
      console.log(`  ✗ Experience filter FAILED: ${candExp} years (needed ${criteria.minExp === -1 ? '?' : criteria.minExp}-${criteria.maxExp === -1 ? '?' : criteria.maxExp})`);
      return 0; // REJECT
    }
    console.log(`  ✓ Experience OK: ${candExp} years`);
    score += 25;
    totalWeight += 25;
  }

  // 2. LOCATION - Hard filter
  if (criteria.locations.length > 0) {
    const tier = getCityTier(candidate.location || "");
    const locationMatches = criteria.locations.some((loc: string) => {
      const locLower = loc.toLowerCase();
      const tierLower = tier.toLowerCase();
      const candLocLower = (candidate.location || "").toLowerCase();
      const synonym = LOCATION_SYNONYMS[locLower];
      
      const directMatch = candLocLower.includes(locLower) || locLower.includes(tierLower) || locLower === tierLower;
      const synonymMatch = synonym ? candLocLower.includes(synonym) : false;
      
      return directMatch || synonymMatch;
    });

    if (!locationMatches) {
      console.log(`  ✗ Location filter FAILED: ${candidate.location} (needed ${criteria.locations.join(', ')})`);
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
      console.log(`  ✗ Skills filter FAILED: has none of [${criteria.skills.join(', ')}]`);
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

    const roleMatches = criteria.roles.some((role: string) => 
      combinedRoleStr.includes(role.toLowerCase())
    );

    if (!roleMatches) {
      console.log(`  ✗ Role filter FAILED: ${candidate.current_role} / ${candidate.target_role} (needed ${criteria.roles.join(', ')})`);
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
        console.log(`  ✗ Salary filter FAILED: ${candSalary} > ${criteria.maxSalary} (over budget by 20%+)`);
        return 0; // REJECT - too expensive
      }
    }
  }

  // ===== FINAL SCORING =====
  const finalScore = totalWeight > 0 ? (score / totalWeight) * 100 : 0;
  console.log(`  [SCORE] PASSED - Score: ${finalScore.toFixed(1)}%`);

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
  const [activeTab, setActiveTab] = useState<"chart" | "list">("chart");

  const [chatThreads, setChatThreads] = useState<any[]>([]);
  const [selectedThreadMessages, setSelectedThreadMessages] = useState<any[]>([]);
  const [isEditingInvite, setIsEditingInvite] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const isInvited = useMemo(() => {
    if (!selectedCandidate) return false;
    return chatThreads.some(t => t.candidate_id === selectedCandidate.user_id && t.is_active);
  }, [selectedCandidate, chatThreads]);

  const isInviteBlocked = useMemo(() => {
    if (!selectedCandidate) return false;
    const thread = chatThreads.find(t => t.candidate_id === selectedCandidate.user_id);
    if (thread && !thread.is_active && thread.last_message_at) {
      const lastMsgDate = new Date(thread.last_message_at);
      const diffTime = Math.abs(new Date().getTime() - lastMsgDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    }
    return false;
  }, [selectedCandidate, chatThreads]);

  // Reset custom invite message and edit state when candidate selection changes
  useEffect(() => {
    if (selectedCandidate) {
      setInviteMessage(`Hi ${selectedCandidate.full_name}, we're interested in connecting with you about exciting opportunities!`);
      setIsEditingInvite(false);
    }
  }, [selectedCandidate]);

  // Fetch messages if a thread exists for the selected candidate
  useEffect(() => {
    if (selectedCandidate && chatThreads.length > 0) {
      const thread = chatThreads.find(t => t.candidate_id === selectedCandidate.user_id);
      if (thread) {
        const fetchMessages = async () => {
          try {
            const token = awsAuth.getToken();
            const msgs = await apiClient.get(`/chat/messages/${thread.id}`, token);
            setSelectedThreadMessages(msgs || []);
          } catch (err) {
            console.error("Failed to fetch messages for thread:", err);
            setSelectedThreadMessages([]);
          }
        };
        fetchMessages();
      } else {
        setSelectedThreadMessages([]);
      }
    } else {
      setSelectedThreadMessages([]);
    }
  }, [selectedCandidate, chatThreads]);

  const fetchFullCandidateDetails = async (candidateId: string) => {
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      const fullData = await apiClient.get(`/recruiter/candidate/${candidateId}`, token);
      if (fullData) {
        setSelectedCandidate(prev => prev && prev.user_id === candidateId ? { ...prev, ...fullData } : prev);
      }
    } catch (err) {
      console.error("Failed to fetch full candidate details:", err);
    }
  };

  // Check if candidate has unlocked access to personal info
  const hasAccessToPersonalInfo = (candidateId: string): boolean => {
    // Check if the candidate has rejected the invitation (thread is inactive)
    const thread = chatThreads.find(t => t.candidate_id === candidateId);
    if (thread && !thread.is_active) {
      return false;
    }

    // Check pipeline for: applied, shortlisted, or invited with reply
    const candidateApplications = pipelineData.filter(app => app.candidate_id === candidateId || app.app?.candidate_id === candidateId);
    
    const hasApplicationAccess = candidateApplications.some(app => {
      const appStatus = (app.status || app.app?.status || '').toLowerCase();
      // If application is explicitly rejected, lock the personal details
      if (appStatus === 'rejected') return false;

      const isSensitiveStatus = ['applied', 'shortlisted', 'interview_scheduled', 'offered', 'hired'].includes(appStatus);
      
      // Check if invited and has unread/replied messages
      const hasInviteReply = app.invite_message_replied || app.has_replied_to_invite || false;
      
      return isSensitiveStatus || hasInviteReply;
    });

    if (hasApplicationAccess) return true;

    // Check if the candidate has replied to a chat thread
    if (thread && thread.is_active && selectedThreadMessages.length > 0) {
      const hasReplied = selectedThreadMessages.some(m => m.sender_id === candidateId);
      if (hasReplied) return true;
    }

    return false;
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
      console.log("[TRACKING] ✓ Profile view tracked:", candidateId);
      console.log("[TRACKING] Response:", response);
    } catch (err: any) {
      console.error("[TRACKING] ✗ Failed to track profile view:", candidateId);
      console.error("[TRACKING] Error details:", err);
    }
  };

  const handleInvite = async () => {
    if (!selectedCandidate) return;

    // Check if shadow profile
    if (selectedCandidate.is_shadow_profile) {
      toast.error("Cannot invite shadow profile");
      return;
    }

    setInviteLoading(true);
    try {
      const token = awsAuth.getToken();
      const response = await apiClient.post(
        `/recruiter/candidate/${selectedCandidate.user_id}/invite`,
        {
          job_id: "",
          message: inviteMessage
        },
        token,
      );
      
      console.log("Invite sent successfully", response);
      toast.success("Invitation sent successfully!");
      setIsEditingInvite(false);
      
      // Refresh chat threads to update the button status to "Invited"
      if (token) {
        const threadsResponse = await apiClient.get("/chat/threads", token);
        setChatThreads(threadsResponse || []);
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
      toast.error("Failed to send invitation. Please try again.");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteButtonClick = () => {
    if (isInvited) return;
    setIsEditingInvite(true);
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

        // Fetch chat threads to check invite statuses
        try {
          console.log("Fetching chat threads for invite status...");
          const threadsResponse = await apiClient.get("/chat/threads", token);
          setChatThreads(threadsResponse || []);
          console.log("Chat threads received:", threadsResponse);
        } catch (chatErr) {
          console.warn("Could not fetch chat threads:", chatErr);
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
    console.log("[SEARCH] STARTING TALENT POOL SEARCH");
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
    console.log(`[COMPLETE] SEARCH COMPLETE: Found ${matches.length} matching ${matches.length === 1 ? 'candidate' : 'candidates'}`);
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
          <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Loading Talent Pool...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,138,0,0.06),_transparent_40%),linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_56%,#FFFDF9_100%)] text-slate-900">
      <style>{`
        .pool-invisible-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }
        .pool-invisible-scroll::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .pool-invisible-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .pool-invisible-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .pool-invisible-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <main className="h-full w-full max-w-[1700px] mx-auto px-4 py-3 flex flex-col overflow-hidden">
        
        {/* Mobile top search bar & tab switcher (hidden on desktop lg:hidden) */}
        <div className="lg:hidden flex flex-col gap-2.5 p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm mb-3 flex-shrink-0">
          <div className="relative group">
            <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400 group-focus-within:text-[#FF8A00] transition-colors" />
            <input
              type="text"
              placeholder="Describe who you're looking for..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/10 focus:border-[#FF8A00]/40 transition-all"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleQuery(query);
                }
              }}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleQuery(query)}
              className="flex-1 py-2 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
            >
              Search Pool
            </button>
            {queryResult && (
              <button
                onClick={() => { setQueryResult(null); setQuery(""); }}
                className="px-3 border border-slate-200 text-slate-500 rounded-xl text-xs hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          
          <div className="h-px bg-slate-100 my-1" />
          
          {/* Tab selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
            <button 
              onClick={() => setActiveTab("chart")}
              className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === "chart" ? "bg-[#FF8A00] text-white shadow-sm" : "text-slate-600"}`}
            >
              Talent Chart
            </button>
            <button 
              onClick={() => setActiveTab("list")}
              className={`flex-1 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${activeTab === "list" ? "bg-[#FF8A00] text-white shadow-sm" : "text-slate-600"}`}
            >
              Candidates ({filteredCandidates.length})
            </button>
          </div>
        </div>

        {/* 3-Column main area */}
        <div className="flex-1 flex gap-4 min-h-0 overflow-hidden relative">
          
          {/* 1. LEFT COLUMN: Search & List (visible always on desktop, on mobile only when activeTab === "list") */}
          <div className={`${activeTab === "list" ? "flex" : "hidden lg:flex"} w-full lg:w-[320px] flex-shrink-0 flex-col bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden h-full`}>
            
            {/* Desktop Search Header */}
            <div className="hidden lg:block p-4 border-b border-slate-100 flex-shrink-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF8A00] mb-2">Search Talent Pool</p>
              <div className="relative group mb-2.5">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 group-focus-within:text-[#FF8A00] transition-colors" />
                <textarea
                  placeholder="Describe who you're looking for..."
                  rows={2}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs leading-relaxed text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/10 focus:border-[#FF8A00]/40 transition-all resize-none min-h-[58px]"
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
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-orange-100"
              >
                <Send className="h-3 w-3" />
                Search
              </button>
              {queryResult && (
                <button
                  onClick={() => { setQueryResult(null); setQuery(""); }}
                  className="w-full mt-2 flex items-center justify-center gap-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-2.5 w-2.5" /> Clear Filter
                </button>
              )}
            </div>

            {/* Stats strip */}
            <div className="px-4 py-2 border-b border-slate-50 flex items-center justify-between flex-shrink-0 bg-slate-50/40">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {queryResult ? "Matching" : "Total Pool"}
              </span>
              <span className="text-xs font-black text-[#FF8A00]">{filteredCandidates.length}</span>
            </div>

            {/* Candidates List container */}
            <div className="flex-1 overflow-y-auto pool-invisible-scroll">
              {filteredCandidates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
                  <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-2 shadow-sm">
                    <User className="h-4 w-4 text-slate-300" strokeWidth={1.5} />
                  </div>
                  <p className="text-xs font-black text-[#0F172A] uppercase tracking-wider">No matches found</p>
                  <p className="text-[10px] text-slate-400 mt-1">Try adjusting search parameters</p>
                </div>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isSelected = selectedCandidate?.user_id === candidate.user_id;
                  return (
                    <button
                      key={candidate.user_id}
                      onClick={() => { trackProfileView(candidate.user_id); setSelectedCandidate(candidate); fetchFullCandidateDetails(candidate.user_id); }}
                      className={`w-full px-4 py-3 text-left border-b border-slate-50 transition-all relative ${isSelected ? "bg-[#FFF8F1]" : "hover:bg-slate-50/50"}`}
                    >
                      {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF8A00] rounded-r-full" />}
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg flex-shrink-0 bg-orange-50 border border-orange-100 flex items-center justify-center text-[10px] font-black text-[#FF8A00]">
                          {getDisplayName(candidate.full_name, candidate.user_id)[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${isSelected ? "text-[#C96B00]" : "text-slate-800"}`}>
                            {getDisplayName(candidate.full_name, candidate.user_id)}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{candidate.current_role || "Professional"}</p>
                        </div>
                        <ChevronRight className={`h-3 w-3 flex-shrink-0 transition-colors ${isSelected ? "text-[#FF8A00]" : "text-slate-300"}`} />
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 pl-[38px] text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-2.5 w-2.5 text-slate-300" />{candidate.years_of_experience}y exp
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-slate-300" />{getCityTier(candidate.location)}
                        </span>
                      </div>
                      {candidate.skills?.length > 0 && (
                        <div className="flex gap-1 mt-1.5 pl-[38px] flex-wrap">
                          {candidate.skills.slice(0, 2).map((skill, i) => (
                            <span key={i} className="text-[8px] px-1.5 py-0.5 bg-[#FFF8F1] border border-orange-100/50 rounded-md text-[#C96B00] font-black uppercase tracking-wider">{skill}</span>
                          ))}
                          {candidate.skills.length > 2 && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 rounded-md text-slate-400 font-bold">+{candidate.skills.length - 2}</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. CENTER COLUMN: Chart (visible always on desktop, on mobile only when activeTab === "chart") */}
          <div className={`${activeTab === "chart" ? "flex" : "hidden lg:flex"} flex-1 min-w-0 flex-col bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgba(15,23,42,0.03)] overflow-hidden h-full`}>
            <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between flex-shrink-0 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
              <div>
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#FF8A00]">Talent Distribution</h2>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Candidates segmented by experience bands</p>
              </div>
              <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#C96B00] bg-[#FFF8F1] px-2 py-1 rounded-lg border border-orange-100/50">
                <MousePointer2 className="h-3 w-3" />
                Hover bubbles for details
              </div>
            </div>
            
            <div className="flex-1 relative p-3">
              <TalentBubbleChart data={filteredCandidates} />
            </div>
          </div>

          {/* 3. RIGHT COLUMN: Details Drawer */}
          {selectedCandidate && (
            <>
              {/* Backdrop for mobile */}
              <div 
                className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 lg:hidden"
                onClick={() => setSelectedCandidate(null)}
              />
              
              {/* Drawer Container (Absolute on mobile, inline flex column on desktop) */}
              <div className="absolute right-0 top-0 bottom-0 z-50 w-full sm:w-[350px] flex flex-col bg-white shadow-2xl border-l border-slate-100 lg:relative lg:right-auto lg:top-auto lg:bottom-auto lg:z-auto lg:w-[320px] lg:shadow-none lg:border-l-0 lg:rounded-[24px] lg:border lg:border-slate-100 h-full overflow-hidden animate-in slide-in-from-right duration-200">
                
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-[linear-gradient(135deg,#FFF9F2_0%,#FFFFFF_100%)]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8.5 w-8.5 rounded-xl flex-shrink-0 bg-orange-50 border border-orange-100 flex items-center justify-center text-xs font-black text-[#FF8A00]">
                      {getDisplayName(selectedCandidate.full_name, selectedCandidate.user_id)[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {getDisplayName(selectedCandidate.full_name, selectedCandidate.user_id)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{selectedCandidate.current_role || "Professional"}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedCandidate(null)} 
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-50 transition-colors flex-shrink-0 border border-slate-100"
                  >
                    <X className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                </div>

                {/* Compact Scrollable Body */}
                <div className="flex-1 overflow-y-auto pool-invisible-scroll p-4 space-y-4">
                  
                  {/* KPI Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#FFF8F1] rounded-xl p-2.5 border border-orange-100/50">
                      <p className="text-[8px] font-black text-[#C96B00] uppercase tracking-wider mb-0.5">Experience</p>
                      <p className="text-lg font-black text-slate-800 leading-none">{selectedCandidate.years_of_experience}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">years</p>
                    </div>
                    
                    <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Level</p>
                      <p className="text-[10.5px] font-bold text-slate-700 truncate">{selectedCandidate.experience || "Mid-level"}</p>
                      <p className="text-[8px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">band</p>
                    </div>
                    
                    <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Location</p>
                      <p className="text-[10.5px] font-bold text-slate-700 truncate">{getCityTier(selectedCandidate.location)}</p>
                      <p className="text-[8px] text-slate-400 font-medium truncate mt-0.5">{selectedCandidate.location || "Remote"}</p>
                    </div>
                    
                    <div className="bg-slate-50/50 rounded-xl p-2.5 border border-slate-100">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Salary Expectation</p>
                      <p className="text-[10.5px] font-bold text-slate-700">
                        {selectedCandidate.expected_salary ? `\u20B9${(selectedCandidate.expected_salary / 100000).toFixed(1)}L` : "Flexible"}
                      </p>
                      <p className="text-[8px] text-slate-300 font-bold uppercase tracking-wider mt-0.5">annual</p>
                    </div>
                  </div>

                  {/* Skills */}
                  {selectedCandidate.skills?.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-slate-300" />
                        Expertise Areas
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {selectedCandidate.skills.map((skill, idx) => (
                          <span key={idx} className="text-[8px] px-2 py-0.5 bg-[#FFF8F1] border border-orange-100/50 rounded-md text-[#C96B00] font-black uppercase tracking-wider">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Privacy state (locked vs unlocked) */}
                  {!hasAccessToPersonalInfo(selectedCandidate.user_id) ? (
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Lock className="h-3.5 w-3.5 text-amber-500" />
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">Personal Info Locked</p>
                      </div>
                      <div className="space-y-1.5 pl-5">
                        {[{ icon: Mail, label: "Email Address" }, { icon: Phone, label: "Phone Number" }].map(({ icon: Icon, label }) => (
                          <p key={label} className="flex items-center gap-1.5 text-[10px] text-slate-400 line-through">
                            <Icon className="h-3 w-3 text-amber-300" />{label}
                          </p>
                        ))}
                      </div>
                      <p className="text-[9px] text-amber-600/80 font-medium mt-2 leading-relaxed">
                        Unlocks when candidate applies, is shortlisted, or replies to an invitation
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 mb-1">Contact Details</p>
                      <p className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                        <Mail className="h-3.5 w-3.5 text-emerald-500" />
                        {selectedCandidate.email || "Accessible"}
                      </p>
                      <p className="flex items-center gap-1.5 text-[10px] text-slate-600 font-bold">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        {selectedCandidate.phone_number || "Accessible"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <div className="p-4 border-t border-slate-100 flex flex-col gap-2 flex-shrink-0 bg-slate-50/20">
                  {isEditingInvite ? (
                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-[#C96B00] uppercase tracking-wider">Customize Invite Message</label>
                        <textarea
                          value={inviteMessage}
                          onChange={(e) => setInviteMessage(e.target.value)}
                          rows={3}
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#FF8A00]/10 focus:border-[#FF8A00]/40 transition-all resize-none leading-relaxed text-slate-700"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditingInvite(false)}
                          className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleInvite}
                          disabled={inviteLoading}
                          className="flex-1 py-2 bg-[#FF8A00] hover:bg-[#E67A00] disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <Send className="h-3 w-3" />
                          {inviteLoading ? "Sending..." : "Send Invite"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleInviteButtonClick}
                        disabled={selectedCandidate?.is_shadow_profile || inviteLoading || isInvited || isInviteBlocked}
                        className="w-full py-2 bg-[#FF8A00] hover:bg-[#E67A00] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {inviteLoading 
                          ? "Sending Invite..." 
                          : isInviteBlocked 
                            ? "Invite Blocked (30d cooldown)" 
                            : isInvited 
                              ? "Invited" 
                              : "Invite Candidate"}
                      </button>

                      {hasAccessToPersonalInfo(selectedCandidate.user_id) && (
                        <button
                          onClick={handleEmailClick}
                          className="w-full py-1.5 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-slate-200 relative active:scale-[0.98]"
                        >
                          Email
                          {showComingSoon && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#0F172A] text-white text-[9px] rounded-lg whitespace-nowrap shadow-lg uppercase tracking-wider font-bold">
                              Coming Soon
                            </div>
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
