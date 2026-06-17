"use client";

import React, { useState, useEffect, useMemo } from "react";
import JobInviteModal from "@/components/JobInviteModal";
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
  Star,
  SlidersHorizontal
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
  current_salary: number | null;
  career_readiness_score: number;
  role_urgency_level: string; // 'passive' | 'active' | 'urgent_30days' | 'urgent_immediate'
  employment_readiness_status: string;
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

const CITY_EQUIVALENCE_GROUPS = [
  ["bangalore", "bengaluru", "banglore"],
  ["mumbai", "bombay"],
  ["mysore", "mysuru", "mysur"],
  ["chennai", "madras"],
  ["kolkata", "calcutta"],
  ["pune", "poona"],
  ["gurugram", "gurgaon"],
  ["kochi", "cochin"],
  ["thiruvananthapuram", "trivandrum"]
];

function getCitySynonyms(city: string): string[] {
  const synonyms: string[] = [];
  const cityLower = city.toLowerCase();
  for (const group of CITY_EQUIVALENCE_GROUPS) {
    if (group.includes(cityLower)) {
      synonyms.push(...group.filter(c => c !== cityLower));
    }
  }
  return synonyms;
}

function getCityTier(location: string): string {
  if (!location) return "Unspecified";
  const loc = location.toLowerCase();
  if (TIER_1_CITIES.some(city => loc.includes(city))) return "Tier 1";
  if (TIER_2_CITIES.some(city => loc.includes(city))) return "Tier 2";
  return "Tier 3";
}

const TECH_SALES_COMMON_SKILLS = [
  // Core Sales & Business Development (general concepts and skills, NOT specific roles)
  "sales", "b2b", "saas", "inside sales", "enterprise sales", "field sales", "outbound", "inbound",
  "lead generation", "cold calling", "prospecting", "outreach", "negotiation", "closing", "deal closure",
  "key account", "client relations", "business development", "bd", "strategic partnership", 
  "account management", "relationship management", "sales operations", "sales enablement", 
  "solution selling", "consultative selling", "presentation",
  
  // Tools & CRM
  "crm", "salesforce", "hubspot", "zoho", "pipedrive", "dynamics",
  
  // Technical skills (frequently sold or required in tech sales)
  "software", "cloud", "aws", "azure", "gcp", "api", "apis", "python", "javascript", "react", "node", "sql",
  "data analytics", "ai", "ml", "artificial intelligence", "machine learning", "devops"
];

const ROLE_SYNONYM_GROUPS: Record<string, string[]> = {
  'sales': ['sales', 'sdr', 'bdr', 'account executive', 'ae', 'representative', 'specialist', 'executive', 'inside sales', 'field sales', 'pre-sales', 'presales', 'outbound', 'inbound', 'closer', 'bd', 'business development'],
  'sdr': ['sdr', 'sales development', 'inside sales', 'representative', 'associate', 'sales rep', 'bd', 'sales executive', 'executive', 'rep'],
  'bdr': ['bdr', 'business development representative', 'sdr', 'inside sales', 'sales representative', 'associate', 'bd', 'sales executive', 'executive', 'rep'],
  'ae': ['ae', 'account executive', 'sales', 'closer', 'sales representative', 'key account', 'inside sales', 'field sales', 'sales executive', 'executive', 'rep'],
  'account executive': ['account executive', 'ae', 'sales', 'closer', 'sales representative', 'key account', 'inside sales', 'field sales', 'sales executive', 'executive', 'rep'],
  'developer': ['developer', 'engineer', 'programmer', 'coder', 'fullstack', 'frontend', 'backend', 'devops', 'architect'],
  'engineer': ['developer', 'engineer', 'programmer', 'coder', 'fullstack', 'frontend', 'backend', 'devops', 'architect'],
  'manager': ['manager', 'lead', 'director', 'vp', 'head', 'chief', 'principal'],
  'business development': ['business development', 'bd', 'sdr', 'bdr', 'sales', 'partnership', 'account executive', 'ae']
};

function parseQuery(query: string): Record<string, any> {
  const criteria: Record<string, any> = {
    skills: [],
    locations: [],
    minExp: -1, // -1 means no constraint
    maxExp: -1, // -1 means no constraint
    roles: [],
    minSalary: 0,
    maxSalary: Infinity,
    minCurrentSalary: 0,
    maxCurrentSalary: Infinity,
    readinessModes: [], // e.g. ['active', 'exploring', 'passive']
    experienceConstraints: null // store the exact constraint type
  };

  // Convert words to lowercase and replace text numbers to numeric representations
  let cleanQuery = query.toLowerCase();
  const wordToNum: Record<string, string> = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5",
    "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10",
    "eleven": "11", "twelve": "12", "thirteen": "13", "fourteen": "14", "fifteen": "15"
  };
  Object.keys(wordToNum).forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "g");
    cleanQuery = cleanQuery.replace(regex, wordToNum[word]);
  });

  console.log("[SEARCH] Starting detailed query parsing with:", cleanQuery);

  // ===== PARSE CURRENT SALARY (and mask it from query to prevent expected salary collision) =====
  // Match range for current salary: e.g. "earning 10 to 12 LPA", "current salary 8-10 lpa"
  const currentRangeRegex = /\b(?:current|earning|cctc|currently\s+earning|current\s+salary)\s+(\d+)\s*(?:to|-)\s*(\d+)\s*(?:lakhs?|lpa|l|lakh)?\b/i;
  const currentRangeMatch = currentRangeRegex.exec(cleanQuery);
  if (currentRangeMatch) {
    const minVal = parseFloat(currentRangeMatch[1]);
    const maxVal = parseFloat(currentRangeMatch[2]);
    criteria.minCurrentSalary = minVal < 100 ? minVal * 100000 : minVal;
    criteria.maxCurrentSalary = maxVal < 100 ? maxVal * 100000 : maxVal;
    cleanQuery = cleanQuery.replace(currentRangeMatch[0], "");
    console.log(`✓ Parsed Current Salary Range: ₹${criteria.minCurrentSalary/100000}L - ₹${criteria.maxCurrentSalary/100000}L`);
  } else {
    // Match single current salary limit: e.g. "current salary under 10L", "earning 15 lpa"
    const currentSingleRegex = /\b(?:current|earning|cctc|currently\s+earning|current\s+salary)\s+(?:under|max|maximum|upto|up\s+to|below|less\s+than|of\s+)?(\d+)\s*(?:lakhs?|lpa|l|lakh)?\b/i;
    const currentSingleMatch = currentSingleRegex.exec(cleanQuery);
    if (currentSingleMatch) {
      const val = parseFloat(currentSingleMatch[1]);
      criteria.maxCurrentSalary = val < 100 ? val * 100000 : val;
      criteria.minCurrentSalary = 0;
      cleanQuery = cleanQuery.replace(currentSingleMatch[0], "");
      console.log(`✓ Parsed Current Salary Limit: ₹${criteria.maxCurrentSalary/100000}L`);
    }
  }

  // ===== PARSE EXPERIENCE WITH NATURAL LANGUAGE =====
  
  // Pattern 1: X+ years, X+ yrs, X+ yr, X+, X years+, X yrs+, X yr+
  const plusMatch = /(\d+)\s*\+(?:\s*(?:years?|yrs?|yr))?/i.exec(cleanQuery);
  if (plusMatch) {
    const minYears = parseInt(plusMatch[1]);
    criteria.minExp = minYears;
    criteria.maxExp = 50;
    criteria.experienceConstraints = `at least ${minYears}`;
    console.log(`✓ Experience (X+): >= ${minYears} years`);
  }

  // Pattern 2: "less than X", "fewer than X", "under X", "below X"
  const lessThanMatch = /(?:less\s+than|fewer\s+than|under|below)\s+(\d+)\s*(?:years?|yrs?|yr)?/i.exec(cleanQuery);
  if (lessThanMatch && criteria.minExp === -1) {
    const maxYears = parseInt(lessThanMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears - 1; // less than 4 means 0-3
    criteria.experienceConstraints = `less than ${maxYears}`;
    console.log(`✓ Experience (<): < ${maxYears} years (0-${maxYears - 1})`);
  }

  // Pattern 3: "more than X", "greater than X", "above X", "over X"
  const moreThanMatch = /(?:more\s+than|greater\s+than|above|over)\s+(\d+)\s*(?:years?|yrs?|yr)?/i.exec(cleanQuery);
  if (moreThanMatch && criteria.minExp === -1) {
    const minYears = parseInt(moreThanMatch[1]);
    criteria.minExp = minYears + 1; // more than 5 means 6+
    criteria.maxExp = 50;
    criteria.experienceConstraints = `more than ${minYears}`;
    console.log(`✓ Experience (>): > ${minYears} years (${minYears + 1}+)`);
  }

  // Pattern 4: "at least X", "minimum X", "min X"
  const atLeastMatch = /(?:at\s+least|minimum|atleast|min)\s+(\d+)\s*(?:years?|yrs?|yr)?/i.exec(cleanQuery);
  if (atLeastMatch && criteria.minExp === -1) {
    const minYears = parseInt(atLeastMatch[1]);
    criteria.minExp = minYears;
    criteria.maxExp = 50;
    criteria.experienceConstraints = `at least ${minYears}`;
    console.log(`✓ Experience (>=): >= ${minYears} years`);
  }

  // Pattern 5: "up to X", "maximum X", "max X"
  const upToMatch = /(?:up\s+to|maximum|upto|max)\s+(\d+)\s*(?:years?|yrs?|yr)?/i.exec(cleanQuery);
  if (upToMatch && criteria.minExp === -1) {
    const maxYears = parseInt(upToMatch[1]);
    criteria.minExp = 0;
    criteria.maxExp = maxYears;
    criteria.experienceConstraints = `up to ${maxYears}`;
    console.log(`✓ Experience (<=): <= ${maxYears} years`);
  }

  // Pattern 6: "between X and Y", "X to Y"
  const betweenMatch = /(?:between\s+)?(\d+)\s*(?:to|-)\s*(\d+)\s*(?:years?|yrs?|yr)?/i.exec(cleanQuery);
  if (betweenMatch && criteria.minExp === -1) {
    const min = parseInt(betweenMatch[1]);
    const max = parseInt(betweenMatch[2]);
    criteria.minExp = min;
    criteria.maxExp = max;
    criteria.experienceConstraints = `between ${min} and ${max}`;
    console.log(`✓ Experience (range): ${min}-${max} years`);
  }

  // Pattern 7: Single number like "X years", "X yrs", "X yr" (without prefix)
  const singleExpMatch = /\b(\d+)\s*(?:years?|yrs?|yr)\b/i.exec(cleanQuery);
  if (singleExpMatch && criteria.minExp === -1) {
    const yearsVal = parseInt(singleExpMatch[1]);
    criteria.minExp = yearsVal;
    criteria.maxExp = 50;
    criteria.experienceConstraints = `at least ${yearsVal}`;
    console.log(`✓ Experience (implicit >=): >= ${yearsVal} years`);
  }

  // Pattern 8: Senior/Mid/Junior (if no explicit years mentioned)
  if (criteria.minExp === -1) {
    if (/\bsenior\b|lead\b|principal|veteran|experienced/i.test(cleanQuery)) {
      criteria.minExp = 10;
      criteria.maxExp = 50;
      criteria.experienceConstraints = "senior level (10+)";
      console.log(`✓ Experience: Senior level (10+)`);
    } else if (/\bmid[\s-]?level\b|intermediate/i.test(cleanQuery)) {
      criteria.minExp = 5;
      criteria.maxExp = 9;
      criteria.experienceConstraints = "mid level (5-9)";
      console.log(`✓ Experience: Mid level (5-9)`);
    } else if (/\bjunior\b|entry[\s-]?level|fresher|intern|beginner/i.test(cleanQuery)) {
      criteria.minExp = 0;
      criteria.maxExp = 2;
      criteria.experienceConstraints = "junior level (0-2)";
      console.log(`✓ Experience: Junior level (0-2)`);
    }
  }

  // ===== PARSE LOCATION =====
  const locationsMap: Record<string, string> = {
    'bangalore': 'bangalore', 'bengaluru': 'bengaluru', 'banglore': 'banglore', 
    'mumbai': 'mumbai', 'bombay': 'bombay',
    'delhi': 'delhi', 'ncr': 'delhi', 'new delhi': 'delhi',
    'hyderabad': 'hyderabad', 'secunderabad': 'hyderabad',
    'chennai': 'chennai', 'madras': 'chennai',
    'kolkata': 'kolkata', 'calcutta': 'kolkata',
    'pune': 'pune', 'poona': 'pune',
    'ahmedabad': 'ahmedabad', 'jaipur': 'jaipur', 'lucknow': 'lucknow', 
    'nagpur': 'nagpur', 'indore': 'indore', 'kochi': 'kochi', 'cochin': 'kochi',
    'coimbatore': 'coimbatore', 'madurai': 'madurai',
    'mysore': 'mysore', 'mysuru': 'mysuru', 'mysur': 'mysur',
    'chandigarh': 'chandigarh', 'bhopal': 'bhopal', 'surat': 'surat', 
    'patna': 'patna', 'ranchi': 'ranchi', 
    'gurugram': 'gurugram', 'gurgaon': 'gurugram',
    'noida': 'noida', 'ghaziabad': 'ghaziabad',
    'trivandrum': 'trivandrum', 'thiruvananthapuram': 'thiruvananthapuram',
    'remote': 'remote', 'flexible': 'remote'
  };

  // Check known list
  Object.keys(locationsMap).forEach(loc => {
    const regex = new RegExp(`\\b${loc}\\b`, "i");
    if (regex.test(cleanQuery)) {
      if (!criteria.locations.includes(locationsMap[loc])) {
        criteria.locations.push(locationsMap[loc]);
        console.log(`✓ Location (Map): ${locationsMap[loc]}`);
      }
    }
  });

  // Extract from "in [City]" or "based in [City]"
  const prepMatch = /\b(?:in|at|based\s+in|location:?)\s+([a-z]+)\b/gi;
  let pMatch;
  while ((pMatch = prepMatch.exec(cleanQuery)) !== null) {
    const potentialLoc = pMatch[1];
    const stopWords = ["years", "yrs", "yr", "lakhs", "lpa", "lakh", "sales", "tech", "lead", "dev", "and", "the", "with", "l", "k", "flexible", "remote"];
    if (!stopWords.includes(potentialLoc) && potentialLoc.length > 2) {
      if (!criteria.locations.includes(potentialLoc)) {
        criteria.locations.push(potentialLoc);
        console.log(`✓ Location (Parsed): ${potentialLoc}`);
      }
    }
  }

  if (/tier\s*1/i.test(cleanQuery)) {
    criteria.locations.push('Tier 1');
    console.log(`✓ Location: Tier 1`);
  }
  if (/tier\s*2/i.test(cleanQuery)) {
    criteria.locations.push('Tier 2');
    console.log(`✓ Location: Tier 2`);
  }

  // ===== PARSE SKILLS =====
  // 1. Keyword extraction from patterns (skilled in, expertise in, etc.)
  const skillPatterns = [
    /(?:skilled|expertise|experienced|proficient|expert)\s+(?:in|with|at)\s+([^,.\n;]+?)(?:[,.\n;]|and\s+(?:skilled|expertise|experienced))/gi,
    /knowledge\s+(?:in|of)\s+([^,.\n;]+?)(?:[,.\n;])/gi,
  ];

  const extractedSkills = new Set<string>();
  
  skillPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      const skillsText = match[1].trim();
      const skillsList = skillsText.split(/[\s,]+/).map(s => s.trim()).filter(s => 
        s.length > 2 && !['and', 'or', 'the', 'for', 'with', 'in', 'of', 'at', 'to', 'be', 'by', 'is', 'are'].includes(s.toLowerCase())
      );
      skillsList.forEach(s => extractedSkills.add(s.toLowerCase()));
    }
  });

  const compoundSkillMatch = /(?:skilled|expertise|experienced|proficient)\s+(?:in|with)\s+([a-z\s]+?)(?:\s+and|\s+or|[,.\n]|$)/gi;
  let cMatch;
  while ((cMatch = compoundSkillMatch.exec(query)) !== null) {
    const compound = cMatch[1].trim();
    if (compound.length > 2) {
      extractedSkills.add(compound.toLowerCase());
    }
  }

  // 2. Direct dictionary scanning (handles queries like "Salesforce Pune 5+ years" or "React NodeJS Developer")
  TECH_SALES_COMMON_SKILLS.forEach(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i");
    if (regex.test(cleanQuery)) {
      extractedSkills.add(skill.toLowerCase());
    }
  });

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
    'business': 'business', 'development': 'development', 'enterprise': 'enterprise',
    'sdr': 'sdr', 'bdr': 'bdr', 'ae': 'ae', 'account executive': 'account executive',
    'representative': 'representative', 'specialist': 'specialist', 'executive': 'executive',
    'director': 'director', 'vp': 'vp', 'head': 'head', 'pre-sales': 'pre-sales', 'presales': 'presales'
  };

  Object.keys(rolesMap).forEach(role => {
    const regex = new RegExp(`\\b${role.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, "i");
    if (regex.test(cleanQuery)) {
      if (!criteria.roles.includes(rolesMap[role])) {
        criteria.roles.push(rolesMap[role]);
      }
    }
  });

  if (criteria.roles.length > 0) {
    console.log(`✓ Roles: ${criteria.roles.join(', ')}`);
  }

  // ===== PARSE EXPECTED SALARY =====
  // Match range: e.g., "10 to 15 lpa", "10-15 lakhs", "10 - 15 l", "10-15 lpa salary"
  const rangeSalaryRegex = /\b(\d+)\s*(?:to|-)\s*(\d+)\s*(?:lakhs?|lpa|l|lakh)?\b/i;
  const rangeMatch = rangeSalaryRegex.exec(cleanQuery);
  if (rangeMatch) {
    const minVal = parseFloat(rangeMatch[1]);
    const maxVal = parseFloat(rangeMatch[2]);
    criteria.minSalary = minVal < 100 ? minVal * 100000 : minVal;
    criteria.maxSalary = maxVal < 100 ? maxVal * 100000 : maxVal;
    console.log(`✓ Parsed Expected Salary Range: ₹${criteria.minSalary/100000}L - ₹${criteria.maxSalary/100000}L`);
  } else {
    // Match max only: e.g., "under 15 lpa", "max 15 lakhs", "upto 12l", "less than 10 lpa"
    const maxSalaryRegex = /\b(?:under|max|maximum|upto|up\s+to|below|less\s+than)\s+(\d+)\s*(?:lakhs?|lpa|l|lakh)?\b/i;
    const maxMatch = maxSalaryRegex.exec(cleanQuery);
    if (maxMatch) {
      const maxVal = parseFloat(maxMatch[1]);
      criteria.maxSalary = maxVal < 100 ? maxVal * 100000 : maxVal;
      criteria.minSalary = 0;
      console.log(`✓ Parsed Expected Max Salary: ₹${criteria.maxSalary/100000}L`);
    } else {
      // Match general salary mention: e.g. "12 lpa", "15 lakhs"
      const singleSalaryRegex = /\b(\d+)\s*(?:lakhs?|lpa|l|lakh)\b/i;
      const singleMatch = singleSalaryRegex.exec(cleanQuery);
      if (singleMatch) {
        const val = parseFloat(singleMatch[1]);
        criteria.maxSalary = val < 100 ? val * 100000 : val;
        criteria.minSalary = 0;
        console.log(`✓ Parsed Expected Salary Limit: ₹${criteria.maxSalary/100000}L`);
      }
    }
  }

  // ===== PARSE CAREER READINESS STATUS =====
  if (/\b(?:active|actively\s+looking|immediate|urgently|urgent|ready|exploring)\b/i.test(cleanQuery)) {
    if (/\b(?:active|actively|immediate|urgently|urgent|ready)\b/i.test(cleanQuery)) {
      criteria.readinessModes.push("active", "urgent_30days", "urgent_immediate");
      console.log("✓ Readiness: Active / Urgent");
    }
    if (/\b(?:exploring|open|passive)\b/i.test(cleanQuery)) {
      criteria.readinessModes.push("exploring", "passive");
      console.log("✓ Readiness: Exploring / Passive");
    }
  } else if (/\b(?:passive|not\s+looking)\b/i.test(cleanQuery)) {
    criteria.readinessModes.push("passive");
    console.log("✓ Readiness: Passive");
  }

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

  // 2. LOCATION - Hard filter with Remote/Flexible candidate tolerance
  if (criteria.locations.length > 0) {
    const candLocLower = (candidate.location || "").toLowerCase();
    const isCandRemote = candLocLower.includes("remote") || candLocLower.includes("flexible") || candLocLower === "any";
    const tier = getCityTier(candidate.location || "");

    const locationMatches = isCandRemote || criteria.locations.some((loc: string) => {
      const locLower = loc.toLowerCase();
      const tierLower = tier.toLowerCase();
      const synonyms = getCitySynonyms(locLower);
      
      const directMatch = candLocLower.includes(locLower) || locLower.includes(tierLower) || locLower === tierLower;
      const synonymMatch = synonyms.some((syn: string) => candLocLower.includes(syn));
      
      return directMatch || synonymMatch;
    });

    if (!locationMatches) {
      console.log(`  ✗ Location filter FAILED: ${candidate.location} (needed ${criteria.locations.join(', ')})`);
      return 0; // REJECT
    }
    
    console.log(`  ✓ Location OK (Match or Remote): ${candidate.location}`);
    const isExactMatch = !isCandRemote || criteria.locations.some((loc: string) => candLocLower.includes(loc.toLowerCase()));
    score += isExactMatch ? 25 : 15; // exact gets full points, remote helper gets partial
    totalWeight += 25;
  } else {
    // No location requirement, give default points
    score += 12.5;
    totalWeight += 25;
  }

  // 3. SKILLS - Hard filter with semantic matching and normalized checking
  if (criteria.skills.length > 0) {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const candidateSkillsNorm = (candidate.skills || []).map(s => normalize(s));
    const skillMatches: string[] = [];

    // Create skill groups for semantic matching
    const skillGroups: Record<string, string[]> = {
      'sales': ['sales', 'selling', 'seller', 'outbound', 'inbound', 'b2b', 'b2c', 'inside sales', 'enterprise sales', 'field sales', 'account executive', 'closer', 'lead generation', 'cold calling'],
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
      const skillNorm = normalize(requiredSkill);
      
      // Direct substring match on normalized names (e.g. react.js -> reactjs)
      let isMatch = candidateSkillsNorm.some(csNorm => 
        csNorm.includes(skillNorm) || skillNorm.includes(csNorm)
      );

      // If no direct normalized match, try semantic matching via skill groups
      if (!isMatch) {
        for (const [groupKey, groupMembers] of Object.entries(skillGroups)) {
          // Check if required skill is part of this group
          const requiredInGroup = groupMembers.some(member => {
            const memberNorm = normalize(member);
            return memberNorm.includes(skillNorm) || skillNorm.includes(memberNorm);
          });
          
          // Check if candidate has any skill from this group
          const candHasGroupSkill = candidateSkillsNorm.some(csNorm => 
            groupMembers.some(member => {
              const memberNorm = normalize(member);
              return csNorm.includes(memberNorm) || memberNorm.includes(csNorm.split(' ')[0]);
            })
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

  // 4. ROLE - Hard filter with Role Synonym Groups
  if (criteria.roles.length > 0) {
    const currentRoleStr = (candidate.current_role || "").toLowerCase();
    const targetRoleStr = (candidate.target_role || "").toLowerCase();
    const combinedRoleStr = `${currentRoleStr} ${targetRoleStr}`;

    const roleMatches = criteria.roles.some((role: string) => {
      const roleLower = role.toLowerCase();
      // Direct substring match
      if (combinedRoleStr.includes(roleLower)) return true;
      // Synonym Group Match
      const synonyms = ROLE_SYNONYM_GROUPS[roleLower];
      if (synonyms) {
        return synonyms.some(syn => combinedRoleStr.includes(syn));
      }
      return false;
    });

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

  // 5. EXPECTED SALARY - Soft filter with rejection
  if (criteria.maxSalary !== Infinity && (candidate.expected_salary || 0) > 0) {
    const candSalary = candidate.expected_salary || 0;
    if (candSalary > criteria.maxSalary) {
      // Check if it's just mildly over budget
      if (candSalary > criteria.maxSalary * 1.2) {
        console.log(`  ✗ Expected Salary filter FAILED: ${candSalary} > ${criteria.maxSalary} (over budget by 20%+)`);
        return 0; // REJECT - too expensive
      }
    }
  }

  // 6. CURRENT SALARY - Soft filter with rejection
  if (criteria.maxCurrentSalary !== Infinity && (candidate.current_salary || 0) > 0) {
    const candCurrentSalary = candidate.current_salary || 0;
    if (candCurrentSalary > criteria.maxCurrentSalary || candCurrentSalary < criteria.minCurrentSalary) {
      if (candCurrentSalary > criteria.maxCurrentSalary * 1.1 || candCurrentSalary < criteria.minCurrentSalary * 0.9) {
        console.log(`  ✗ Current Salary filter FAILED: ${candCurrentSalary} (needed ${criteria.minCurrentSalary}-${criteria.maxCurrentSalary})`);
        return 0; // REJECT
      }
    }
  }

  // 7. CAREER READINESS STATUS - Hard filter
  if (criteria.readinessModes && criteria.readinessModes.length > 0) {
    const candMode = (candidate.role_urgency_level || "passive").toLowerCase();
    const candStatus = (candidate.employment_readiness_status || "not_specified").toLowerCase();
    const hasReadinessMatch = criteria.readinessModes.some((mode: string) => {
      const modeLower = mode.toLowerCase();
      return candMode.includes(modeLower) || modeLower.includes(candMode) || candStatus.includes(modeLower) || modeLower.includes(candStatus);
    });
    if (!hasReadinessMatch) {
      console.log(`  ✗ Career Readiness filter FAILED: ${candidate.role_urgency_level} (needed ${criteria.readinessModes.join(', ')})`);
      return 0; // REJECT
    }
    console.log(`  ✓ Career Readiness OK: ${candidate.role_urgency_level}`);
    score += 15;
    totalWeight += 15;
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
  const [jobs, setJobs] = useState<any[]>([]);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

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

  const handleInviteFromModal = async (jobId: string, message: string, customTitle?: string) => {
    if (!selectedCandidate) return;
    setInviteLoading(true);
    try {
      const token = awsAuth.getToken();
      if (!token) return;
      await apiClient.post(
        `/recruiter/candidate/${selectedCandidate.user_id}/invite`,
        {
          job_id: jobId,
          message: message,
          custom_role_title: customTitle,
        },
        token,
      );
      
      toast.success("Invitation sent successfully!");
      setInviteModalOpen(false);
      
      const [threadsResponse, pipelineResponse] = await Promise.all([
        apiClient.get("/chat/threads", token),
        apiClient.get("/recruiter/applications/pipeline", token)
      ]);
      setChatThreads(threadsResponse || []);
      setPipelineData(pipelineResponse || []);
    } catch (error: any) {
      console.error("Failed to send invite:", error);
      toast.error(error.message || "Failed to send invitation. Please try again.");
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
        const [data, jobsData] = await Promise.all([
          apiClient.get("/recruiter/talent-pool", token),
          apiClient.get("/recruiter/jobs", token)
        ]);
        console.log("Talent-pool data received:", data);
        setCandidates(data || []);
        setJobs(jobsData || []);

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

  // Visual Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterSkills, setFilterSkills] = useState<string[]>([]);
  const [filterReadiness, setFilterReadiness] = useState<string[]>([]);
  const [filterMinExp, setFilterMinExp] = useState<number>(-1);
  const [filterMaxExp, setFilterMaxExp] = useState<number>(-1);
  const [filterMinSalary, setFilterMinSalary] = useState<number>(0);
  const [filterMaxSalary, setFilterMaxSalary] = useState<number>(100); // in LPA
  const [filterMinCurrentSalary, setFilterMinCurrentSalary] = useState<number>(0);
  const [filterMaxCurrentSalary, setFilterMaxCurrentSalary] = useState<number>(100); // in LPA

  const handleQuery = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setQueryResult(null);
      setFilterSkills([]);
      setFilterReadiness([]);
      setFilterMinExp(-1);
      setFilterMaxExp(-1);
      setFilterMinSalary(0);
      setFilterMaxSalary(100);
      setFilterMinCurrentSalary(0);
      setFilterMaxCurrentSalary(100);
      return;
    }

    console.log("\n=".repeat(60));
    console.log("[SEARCH] STARTING TALENT POOL SEARCH");
    console.log("=".repeat(60));
    console.log("Query:", searchQuery);
    console.log(`Total candidates in pool: ${candidates.length}\n`);

    const criteria = parseQuery(searchQuery);

    // Auto-populate visual filters state from criteria
    setFilterSkills(criteria.skills || []);
    setFilterReadiness(criteria.readinessModes || []);
    setFilterMinExp(criteria.minExp);
    setFilterMaxExp(criteria.maxExp);
    setFilterMinSalary(criteria.minSalary ? Math.round(criteria.minSalary / 100000) : 0);
    setFilterMaxSalary(criteria.maxSalary && criteria.maxSalary !== Infinity ? Math.round(criteria.maxSalary / 100000) : 100);
    setFilterMinCurrentSalary(criteria.minCurrentSalary ? Math.round(criteria.minCurrentSalary / 100000) : 0);
    setFilterMaxCurrentSalary(criteria.maxCurrentSalary && criteria.maxCurrentSalary !== Infinity ? Math.round(criteria.maxCurrentSalary / 100000) : 100);

    const scored = candidates.map(c => ({
      candidate: c,
      score: matchCandidate(c, criteria)
    }));

    const MINIMUM_SCORE_THRESHOLD = 20;
    const matches = scored
      .filter(s => s.score > MINIMUM_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map(s => s.candidate);

    console.log("\n" + "=".repeat(60));
    console.log(`[COMPLETE] SEARCH COMPLETE: Found ${matches.length} matching candidates`);
    console.log("=".repeat(60) + "\n");

    setQueryResult({
      query: searchQuery,
      matches,
      criteria
    });
  };

  const activeCriteria = useMemo(() => {
    return {
      skills: filterSkills,
      locations: queryResult?.criteria?.locations || [],
      roles: queryResult?.criteria?.roles || [],
      minExp: filterMinExp,
      maxExp: filterMaxExp,
      minSalary: filterMinSalary * 100000,
      maxSalary: filterMaxSalary === 100 ? Infinity : filterMaxSalary * 100000,
      minCurrentSalary: filterMinCurrentSalary * 100000,
      maxCurrentSalary: filterMaxCurrentSalary === 100 ? Infinity : filterMaxCurrentSalary * 100000,
      readinessModes: filterReadiness,
    };
  }, [
    queryResult,
    filterSkills,
    filterReadiness,
    filterMinExp,
    filterMaxExp,
    filterMinSalary,
    filterMaxSalary,
    filterMinCurrentSalary,
    filterMaxCurrentSalary,
  ]);

  const filteredCandidates = useMemo(() => {
    const hasActiveFilters = 
      filterSkills.length > 0 || 
      filterReadiness.length > 0 || 
      filterMinExp !== -1 || 
      filterMaxExp !== -1 || 
      filterMinSalary > 0 || 
      filterMaxSalary < 100 || 
      filterMinCurrentSalary > 0 || 
      filterMaxCurrentSalary < 100 ||
      (queryResult?.criteria?.locations?.length || 0) > 0 ||
      (queryResult?.criteria?.roles?.length || 0) > 0;

    if (!hasActiveFilters && !queryResult) {
      return candidates;
    }

    const scored = candidates.map(c => ({
      candidate: c,
      score: matchCandidate(c, activeCriteria)
    }));

    const MINIMUM_SCORE_THRESHOLD = 20;
    return scored
      .filter(s => s.score > MINIMUM_SCORE_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .map(s => s.candidate);
  }, [candidates, activeCriteria, queryResult]);

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
        <div className="lg:hidden flex flex-col gap-2.5 p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm mb-3 flex-shrink-0 max-h-[70vh] overflow-y-auto pool-invisible-scroll">
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-3 flex items-center justify-center border rounded-xl transition-all shadow-sm ${
                showFilters 
                  ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00]" 
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </button>
            {queryResult && (
              <button
                onClick={() => {
                  setQueryResult(null);
                  setQuery("");
                  setFilterSkills([]);
                  setFilterReadiness([]);
                  setFilterMinExp(-1);
                  setFilterMaxExp(-1);
                  setFilterMinSalary(0);
                  setFilterMaxSalary(100);
                  setFilterMinCurrentSalary(0);
                  setFilterMaxCurrentSalary(100);
                }}
                className="px-3 border border-slate-200 text-slate-500 rounded-xl text-xs hover:bg-slate-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Collapsible Filters for Mobile */}
          {showFilters && (
            <div className="mt-2 p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Skills Multi-Select */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Expertise Areas</label>
                <div className="flex flex-wrap gap-1">
                  {["Sales", "SaaS", "B2B", "Cold Calling", "Salesforce", "HubSpot", "React"].map(skill => {
                    const isActive = filterSkills.includes(skill.toLowerCase());
                    return (
                      <button
                        key={skill}
                        onClick={() => {
                          if (isActive) {
                            setFilterSkills(filterSkills.filter(s => s !== skill.toLowerCase()));
                          } else {
                            setFilterSkills([...filterSkills, skill.toLowerCase()]);
                          }
                        }}
                        className={`text-[9px] px-2 py-0.5 rounded-lg border transition-all ${
                          isActive
                            ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00] font-black"
                            : "bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-50"
                        }`}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Career Readiness Checklist */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Candidate Status</label>
                <div className="flex gap-1.5">
                  {["Active", "Exploring", "Passive"].map(status => {
                    const statusLower = status.toLowerCase();
                    const isActive = filterReadiness.includes(statusLower) || (statusLower === "active" && filterReadiness.includes("urgent_30days"));
                    return (
                      <button
                        key={status}
                        onClick={() => {
                          if (isActive) {
                            if (statusLower === "active") {
                              setFilterReadiness(filterReadiness.filter(r => !["active", "urgent_30days", "urgent_immediate"].includes(r)));
                            } else {
                              setFilterReadiness(filterReadiness.filter(r => r !== statusLower));
                            }
                          } else {
                            if (statusLower === "active") {
                              setFilterReadiness([...filterReadiness, "active", "urgent_30days", "urgent_immediate"]);
                            } else {
                              setFilterReadiness([...filterReadiness, statusLower]);
                            }
                          }
                        }}
                        className={`flex-1 py-1 rounded-lg border text-[9px] font-black text-center uppercase tracking-wider transition-all ${
                          isActive
                            ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00]"
                            : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                        }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expected Salary Limit Range */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Expected Salary (LPA)</label>
                  <span className="text-[10px] font-black text-[#C96B00]">
                    {filterMinSalary}L - {filterMaxSalary === 100 ? "Any" : `${filterMaxSalary}L`}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filterMaxSalary}
                    onChange={(e) => setFilterMaxSalary(parseInt(e.target.value))}
                    className="w-full accent-[#FF8A00] h-1 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Current Salary Limit Range */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Current Salary (LPA)</label>
                  <span className="text-[10px] font-black text-[#C96B00]">
                    {filterMinCurrentSalary}L - {filterMaxCurrentSalary === 100 ? "Any" : `${filterMaxCurrentSalary}L`}
                  </span>
                </div>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={filterMaxCurrentSalary}
                    onChange={(e) => setFilterMaxCurrentSalary(parseInt(e.target.value))}
                    className="w-full accent-[#FF8A00] h-1 bg-slate-200 rounded-lg cursor-pointer"
                  />
                </div>
              </div>

              {/* Reset Button inside panel */}
              <button
                onClick={() => {
                  setFilterSkills([]);
                  setFilterReadiness([]);
                  setFilterMinExp(-1);
                  setFilterMaxExp(-1);
                  setFilterMinSalary(0);
                  setFilterMaxSalary(100);
                  setFilterMinCurrentSalary(0);
                  setFilterMaxCurrentSalary(100);
                  setQueryResult(null);
                  setQuery("");
                }}
                className="w-full py-1 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors border border-dashed border-slate-200 hover:border-slate-300 rounded-lg"
              >
                Reset Filters
              </button>
            </div>
          )}
          
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
            <div className="hidden lg:block p-4 border-b border-slate-100 flex-shrink-0 max-h-[90%] overflow-y-auto pool-invisible-scroll bg-[linear-gradient(180deg,#FFFDFB_0%,#FFFFFF_100%)]">
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
              <div className="flex gap-2">
                <button
                  onClick={() => handleQuery(query)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-[#FF8A00] hover:bg-[#E67A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm shadow-orange-100"
                >
                  <Send className="h-3 w-3" />
                  Search
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 flex items-center justify-center border rounded-xl transition-all shadow-sm ${
                    showFilters 
                      ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00]" 
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                  title="Advanced Filters"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Collapsible Advanced Visual Filters Panel */}
              {showFilters && (
                <div className="mt-3 p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Skills Multi-Select */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Expertise Areas</label>
                    <div className="flex flex-wrap gap-1">
                      {["Sales", "SaaS", "B2B", "Cold Calling", "Salesforce", "HubSpot", "React"].map(skill => {
                        const isActive = filterSkills.includes(skill.toLowerCase());
                        return (
                          <button
                            key={skill}
                            onClick={() => {
                              if (isActive) {
                                setFilterSkills(filterSkills.filter(s => s !== skill.toLowerCase()));
                              } else {
                                setFilterSkills([...filterSkills, skill.toLowerCase()]);
                              }
                            }}
                            className={`text-[9px] px-2 py-0.5 rounded-lg border transition-all ${
                              isActive
                                ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00] font-black"
                                : "bg-white border-slate-200 text-slate-500 font-medium hover:bg-slate-50"
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Career Readiness Checklist */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Candidate Status</label>
                    <div className="flex gap-1.5">
                      {["Active", "Exploring", "Passive"].map(status => {
                        const statusLower = status.toLowerCase();
                        const isActive = filterReadiness.includes(statusLower) || (statusLower === "active" && filterReadiness.includes("urgent_30days"));
                        return (
                          <button
                            key={status}
                            onClick={() => {
                              if (isActive) {
                                if (statusLower === "active") {
                                  setFilterReadiness(filterReadiness.filter(r => !["active", "urgent_30days", "urgent_immediate"].includes(r)));
                                } else {
                                  setFilterReadiness(filterReadiness.filter(r => r !== statusLower));
                                }
                              } else {
                                if (statusLower === "active") {
                                  setFilterReadiness([...filterReadiness, "active", "urgent_30days", "urgent_immediate"]);
                                } else {
                                  setFilterReadiness([...filterReadiness, statusLower]);
                                }
                              }
                            }}
                            className={`flex-1 py-1 rounded-lg border text-[9px] font-black text-center uppercase tracking-wider transition-all ${
                              isActive
                                ? "bg-[#FFF8F1] border-orange-200 text-[#C96B00]"
                                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expected Salary Limit Range */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Expected Salary (LPA)</label>
                      <span className="text-[10px] font-black text-[#C96B00]">
                        {filterMinSalary}L - {filterMaxSalary === 100 ? "Any" : `${filterMaxSalary}L`}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterMaxSalary}
                        onChange={(e) => setFilterMaxSalary(parseInt(e.target.value))}
                        className="w-full accent-[#FF8A00] h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Current Salary Limit Range */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Current Salary (LPA)</label>
                      <span className="text-[10px] font-black text-[#C96B00]">
                        {filterMinCurrentSalary}L - {filterMaxCurrentSalary === 100 ? "Any" : `${filterMaxCurrentSalary}L`}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={filterMaxCurrentSalary}
                        onChange={(e) => setFilterMaxCurrentSalary(parseInt(e.target.value))}
                        className="w-full accent-[#FF8A00] h-1 bg-slate-200 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Reset Button inside panel */}
                  <button
                    onClick={() => {
                      setFilterSkills([]);
                      setFilterReadiness([]);
                      setFilterMinExp(-1);
                      setFilterMaxExp(-1);
                      setFilterMinSalary(0);
                      setFilterMaxSalary(100);
                      setFilterMinCurrentSalary(0);
                      setFilterMaxCurrentSalary(100);
                      setQueryResult(null);
                      setQuery("");
                    }}
                    className="w-full py-1 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors border border-dashed border-slate-200 hover:border-slate-300 rounded-lg"
                  >
                    Reset Filters
                  </button>
                </div>
              )}

              {queryResult && (
                <button
                  onClick={() => {
                    setQueryResult(null);
                    setQuery("");
                    setFilterSkills([]);
                    setFilterReadiness([]);
                    setFilterMinExp(-1);
                    setFilterMaxExp(-1);
                    setFilterMinSalary(0);
                    setFilterMaxSalary(100);
                    setFilterMinCurrentSalary(0);
                    setFilterMaxCurrentSalary(100);
                  }}
                  className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-2.5 w-2.5" /> Clear Filters
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
                  <button
                    onClick={() => setInviteModalOpen(true)}
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
                </div>
              </div>
            </>
          )}
        </div>
        
        {inviteModalOpen && selectedCandidate && (
          <JobInviteModal
            candidateId={selectedCandidate.user_id}
            candidateName={selectedCandidate.full_name}
            jobs={jobs}
            onClose={() => setInviteModalOpen(false)}
            onInvite={handleInviteFromModal}
          />
        )}
      </main>
    </div>
  );
}
