# Natural Language → Recommendations Pipeline
## Technical Implementation Guide for Enhanced Assistant

---

## Overview

This document details how to extend the assistant to process natural language queries and route them to appropriate recommendation engines with proper filtering and explanation.

---

## 1. NL Query Processing Pipeline

### Step 1: Intent Classification with NL Understanding

**Current:**
```python
async def _resolve_intent(prompt: str, role: str, history: List[Dict]) -> Dict:
    # Classify into: candidate_search, job_search, company_search, market_insights, etc.
    return {"intent": str, "filters": {}, ...}
```

**Enhanced:**
```python
async def _resolve_intent_advanced(
    prompt: str, 
    role: str, 
    history: List[Dict],
    user_context: Dict  # Now passed in for context
) -> Dict:
    """
    Enhanced intent resolution with multi-dimensional understanding:
    1. Intent category (candidate_search, job_search, etc.)
    2. Match type (skill, culture, hybrid)
    3. Filter extraction (skills, location, salary, etc.)
    4. Contextual memory (previous queries, preferences)
    5. Confidence score
    """
    
    # Build conversation context
    history_snippet = "\n".join(
        f"{m['role'].upper()}: {m['content'][:150]}"
        for m in history[-6:]
    ) or "No prior messages."
    
    # Create rich prompt for AI
    intent_prompt = f"""
You are an advanced NL understanding engine for a hiring platform.

User role: {role}
User context: {json.dumps(user_context, default=str)}

Conversation history:
{history_snippet}

Current query: "{prompt}"

Classify and return ONLY valid JSON:
{{
  "intent": "candidate_search|job_search|company_search|market_insights|...",
  "match_type": "skill|culture|hybrid",
  "filters": {{
    "skills": [],
    "location": [],
    "salary_range": [min, max],
    "experience_band": "fresher|mid|senior|leadership|any",
    "company_stage": "startup|growth|scale-up|enterprise|any",
    "industry": [],
    "employment_status": "active|passive|exploring|any",
    "work_location": "remote|hybrid|onsite|any",
    "culture_keywords": []
  }},
  "requires_data": true,
  "confidence": 0.95,
  "match_type_inferred_from": "explicit|keywords|context",
  "requires_explanation": false,
  "suggested_follow_up": "Would you like to filter by salary?"
}}

Rules:
1. Extract ALL mentioned skills, locations, salary ranges
2. For "culture fit" keywords (innovation, remote, growth, autonomy), set match_type to 'culture' or 'hybrid'
3. For "skill match" keywords (experience, technical, expertise), set match_type to 'skill'
4. If both skill AND culture mentioned, match_type = 'hybrid'
5. Set confidence based on clarity of filters (0.5-1.0)
6. Infer experience_band from role titles (SDR=mid, VP Sales=senior, etc.)
"""
    
    result = await _call_ai_json(intent_prompt, "Advanced NL Intent Engine")
    
    # Validate and normalize
    if not result.get("intent"):
        result["intent"] = "general"
    
    # Ensure match_type is valid
    if result.get("match_type") not in ["skill", "culture", "hybrid"]:
        result["match_type"] = "hybrid"  # Default to hybrid
    
    # Clean up filters
    result["filters"] = _normalize_filters(result.get("filters", {}))
    
    return result


def _normalize_filters(filters: Dict) -> Dict:
    """
    Normalize extracted filters:
    - Convert skill strings to lowercase
    - Validate experience bands
    - Parse salary ranges
    - Handle location aliases (Blr → Bangalore)
    """
    normalized = {
        "skills": [s.lower().strip() for s in (filters.get("skills") or [])],
        "location": [_normalize_location(l) for l in (filters.get("location") or [])],
        "salary_range": _normalize_salary(filters.get("salary_range")),
        "experience_band": filters.get("experience_band", "any").lower(),
        "company_stage": filters.get("company_stage", "any").lower(),
        "industry": [i.lower().strip() for i in (filters.get("industry") or [])],
        "employment_status": filters.get("employment_status", "any").lower(),
        "work_location": filters.get("work_location", "any").lower(),
        "culture_keywords": filters.get("culture_keywords", [])
    }
    return {k: v for k, v in normalized.items() if v}


def _normalize_location(loc: str) -> str:
    """Location normalization with aliases"""
    aliases = {
        "blr": "Bangalore", "bangalore": "Bangalore", "bng": "Bangalore",
        "mumbai": "Mumbai", "mum": "Mumbai", "pune": "Pune",
        "delhi": "Delhi", "hyderabad": "Hyderabad", "hyd": "Hyderabad",
        "remote": "Remote", "wfh": "Remote", "work from home": "Remote"
    }
    normalized = aliases.get(loc.lower().strip(), loc.strip().title())
    return normalized


def _normalize_salary(salary_range: Any) -> tuple:
    """Parse and normalize salary range"""
    if not salary_range:
        return (None, None)
    
    if isinstance(salary_range, (list, tuple)) and len(salary_range) == 2:
        return (salary_range[0], salary_range[1])
    
    if isinstance(salary_range, str):
        # Parse "15-20 LPA" or "15 lakhs" patterns
        nums = re.findall(r'(\d+(?:\.\d+)?)', salary_range)
        if len(nums) >= 2:
            return (float(nums[0]), float(nums[1]))
        elif len(nums) == 1:
            return (float(nums[0]), None)
    
    return (None, None)
```

---

### Step 2: Match Type Inference

**Purpose:** Determine whether user wants skill-based, culture-based, or hybrid recommendations.

```python
async def _infer_match_type(
    prompt: str,
    detected_intent: str,
    filters: Dict,
    role: str
) -> str:
    """
    Infer match type based on:
    1. Explicit keywords (skills, culture, values)
    2. Intent type
    3. Available filters
    4. User role context
    """
    
    prompt_lower = prompt.lower()
    
    # Keyword-based signals
    skill_signals = [
        "skill", "experience", "technical", "expertise", "background",
        "know", "python", "salesforce", "sql", "database", "api",
        "proficiency", "competency"
    ]
    
    culture_signals = [
        "culture", "values", "work style", "autonomy", "innovation",
        "growth", "team", "mission", "impact", "remote", "flexible",
        "family", "work-life", "learning", "mentor"
    ]
    
    skill_score = sum(1 for s in skill_signals if s in prompt_lower)
    culture_score = sum(1 for s in culture_signals if s in prompt_lower)
    
    # Intent-based signals
    if detected_intent == "job_search":
        skill_score += 1  # Jobs are skill-centric
    elif detected_intent == "company_search":
        culture_score += 1  # Companies are culture-centric
    
    # Determine match type
    if skill_score > culture_score:
        return "skill"
    elif culture_score > skill_score:
        return "culture"
    else:
        return "hybrid"  # Balanced → use both
```

---

### Step 3: Dynamic Filter Extraction

**Purpose:** Extract actionable filters from NL queries using keyword matching + AI.

```python
async def _extract_filters_enhanced(
    prompt: str,
    role: str,
    user_context: Dict,
    session_context: Dict
) -> Dict:
    """
    Extract filters from NL query with keyword + AI hybrid approach
    """
    
    # 1. Keyword-based extraction (fast, reliable)
    keyword_filters = _extract_keywords_filters(prompt)
    
    # 2. AI-powered semantic extraction (accurate, slower)
    ai_filters = await _extract_semantic_filters(prompt)
    
    # 3. Merge and prioritize
    merged_filters = {
        **session_context.get("last_filters", {}),  # Carry over previous
        **keyword_filters,
        **ai_filters
    }
    
    return merged_filters


def _extract_keywords_filters(prompt: str) -> Dict:
    """
    Fast keyword-based filter extraction
    """
    filters = {}
    
    # Skills extraction: "with X, Y, Z experience" or "know Python"
    skills_pattern = r'(?:with|have|know|using|expertise in)\s+([^,\.]+(?:,\s*[^,\.]+)*)'
    skills_match = re.search(skills_pattern, prompt, re.I)
    if skills_match:
        skills_text = skills_match.group(1)
        filters["skills"] = [s.strip() for s in skills_text.split(",")]
    
    # Location: "in X", "based in X"
    location_pattern = r'(?:in|at|based in|from|location)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:and|with|salary|experience)|$)'
    location_match = re.search(location_pattern, prompt, re.I)
    if location_match:
        filters["location"] = [location_match.group(1).strip()]
    
    # Salary: "X LPA", "X-Y lakhs"
    salary_pattern = r'(?:salary|pay|compensation)\s*(?:of|from)?\s*([0-9]+-?[0-9]*)\s*(?:LPA|lakhs|rupees)?'
    salary_match = re.search(salary_pattern, prompt, re.I)
    if salary_match:
        salary_str = salary_match.group(1)
        if "-" in salary_str:
            parts = salary_str.split("-")
            filters["salary_range"] = (float(parts[0]), float(parts[1]))
        else:
            filters["salary_range"] = (float(salary_str), None)
    
    # Experience: "X years", "senior", "fresher"
    exp_pattern = r'(?:with\s+)?(\d+)\s*(?:-\s*\d+)?\s*years?\s+(?:of\s+)?(?:experience|exp)'
    exp_match = re.search(exp_pattern, prompt, re.I)
    if exp_match:
        years = int(exp_match.group(1))
        if years <= 1:
            filters["experience_band"] = "fresher"
        elif years <= 5:
            filters["experience_band"] = "mid"
        elif years <= 10:
            filters["experience_band"] = "senior"
        else:
            filters["experience_band"] = "leadership"
    
    # Work location preference: "remote", "on-site"
    if "remote" in prompt.lower():
        filters["work_location"] = "remote"
    elif "on-site" in prompt.lower() or "onsite" in prompt.lower():
        filters["work_location"] = "onsite"
    elif "hybrid" in prompt.lower():
        filters["work_location"] = "hybrid"
    
    return filters


async def _extract_semantic_filters(prompt: str) -> Dict:
    """
    AI-powered semantic filter extraction for ambiguous queries
    """
    semantic_prompt = f"""
Extract nuanced filters from: "{prompt}"

Return JSON with:
{{
    "culture_keywords": ["array of culture signals found"],
    "company_stage": "startup|growth|scale-up|enterprise|any",
    "work_style_preference": "autonomous|collaborative|structured|flexible",
    "implied_seniority": "fresher|mid|senior|leadership|any",
    "team_size_preference": "small|medium|large|any",
    "growth_mindset": true/false,
    "learning_focus": true/false
}}
"""
    result = await _call_ai_json(semantic_prompt, "Semantic Filter Extractor")
    return result or {}
```

---

### Step 4: Select Recommendation Engine

**Purpose:** Route to the correct recommendation engine based on intent + match_type.

```python
async def _execute_tool_intelligent(
    intent: str,
    match_type: str,
    filters: Dict,
    user_id: str,
    role: str,
    db: Session
) -> Tuple[List[Dict], str]:
    """
    Intelligently route to recommendation engines
    """
    
    # Map intent + match_type to filter_type for backend engines
    filter_type_map = {
        ("candidate_search", "skill"): "skill_match",
        ("candidate_search", "culture"): "culture_fit",
        ("candidate_search", "hybrid"): "profile_matching",
        ("job_search", "skill"): "role_match",
        ("job_search", "culture"): "culture_fit_priority",
        ("job_search", "hybrid"): "holistic_match",
        ("company_search", "culture"): "culture_fit",
        ("company_search", "skill"): "skill_match",
        ("company_search", "hybrid"): "balanced_match",
    }
    
    filter_type = filter_type_map.get((intent, match_type), "hybrid")
    
    results = []
    data_source = ""
    
    try:
        if role == "recruiter" and intent == "candidate_search":
            results = await recruiter_service.get_recommended_candidates(
                user_id=user_id,
                filter_type=filter_type,
                params=filters
            )
            data_source = "Recruiter Recommendation Engine"
            
        elif role == "candidate" and intent == "job_search":
            results = await CandidateService.get_recommended_jobs(
                user_id=user_id,
                filter_type=filter_type,
                **filters
            )
            data_source = "Job Recommendation Engine"
            
        elif role == "candidate" and intent == "company_search":
            results = await CandidateService.get_recommended_companies(
                user_id=user_id,
                filter_type=filter_type,
                **filters
            )
            data_source = "Company Recommendation Engine"
            
        elif intent == "market_insights":
            results = _get_live_market_demand(limit=6)
            data_source = "Market Intelligence"
        
        return results, data_source
        
    except Exception as exc:
        log.error(f"Tool execution failed [{intent}]: {exc}")
        return [], "Error"
```

---

## 2. Recommendation Explanation System

### Enhanced Response with Reasoning

```python
async def _generate_response_with_reasoning(
    prompt: str,
    role: str,
    intent: str,
    match_type: str,
    filters: Dict,
    data_results: List[Dict],
    limit: int,
    history: List[Dict],
    user_context: Dict
) -> str:
    """
    Generate conversational response that explains:
    1. What was recommended and why
    2. How filters were applied
    3. Match breakdowns per item
    """
    
    results_preview = json.dumps(data_results[:limit], default=str)
    filters_applied = json.dumps(filters, default=str)
    
    response_prompt = f"""
You are an expert conversational AI assistant for {role}s on a hiring platform.

Query: "{prompt}"
Match Type: {match_type} (skill|culture|hybrid)
Filters Applied: {filters_applied}
Results ({len(data_results)} total): {results_preview}

Generate a natural, conversational response that:

1. OPENING: Briefly acknowledge what was requested
   Example: "Found 8 senior sales candidates actively looking in Bangalore..."

2. HIGHLIGHTS: Present top 2-3 results with reasoning
   Example: "**John Doe** stands out because: ✓ 95% skill match ✓ Perfect exp level ⚠ Missing: CRM"

3. PATTERNS: Call out patterns across results
   Example: "Most candidates have strong SaaS experience but limited enterprise context"

4. NEXT STEPS: Suggest natural follow-ups
   Example: "Ready to schedule interviews? Or refine by salary expectations?"

Rules:
- Conversational tone, NO markdown headers or bullet points
- Max 200 words
- For {match_type} matching, emphasize that dimension
- Include specific skill names from results
- Reference filters naturally ("in Bangalore" not "location=Bangalore")
- Offer refinement options (by salary, experience, etc.)
"""
    
    return await _call_ai(response_prompt, "Conversational Recommendation Assistant")


async def _generate_detailed_explanation(
    result: Dict,
    result_type: str,  # "candidate", "job", "company"
    role: str,
    match_type: str,
    filters: Dict
) -> Dict:
    """
    Generate detailed explanation for a single result
    """
    
    explanation_prompt = f"""
Explain why this {result_type} is recommended for a {role}:

{json.dumps(result, default=str)}

Match Type: {match_type}
Filters Applied: {json.dumps(filters)}

Return JSON:
{{
    "summary": "One sentence why this is a match",
    "strengths": [
        "specific strength 1 with detail",
        "specific strength 2 with detail"
    ],
    "gaps": [
        "gap 1 with impact",
        "gap 2 with impact"
    ],
    "growth_areas": [
        "learning opportunity 1",
        "learning opportunity 2"
    ],
    "next_action": "What should the user do next?",
    "confidence_score": 0.95,
    "reasoning_breakdown": {{
        "skill_match": percentage,
        "culture_fit": percentage,
        "experience_alignment": percentage
    }}
}}
"""
    
    return await _call_ai_json(explanation_prompt, "Detailed Explanation Generator")
```

---

## 3. Session Context & Memory

### Persistent Filter Memory

```python
async def _manage_session_context(
    db: Session,
    session_id: str,
    user_id: str,
    current_intent: str,
    current_filters: Dict,
    results: List[Dict],
    match_type: str
) -> Dict:
    """
    Maintain session context across multiple queries:
    - Last filters used (for refinement)
    - Last results (for comparison)
    - User preferences (skill vs culture focus)
    - Query history (for better follow-ups)
    """
    
    # Load current session
    session = db.query(AIAssistantSession).filter(
        AIAssistantSession.id == session_id,
        AIAssistantSession.user_id == user_id
    ).first()
    
    if not session:
        return {}
    
    # Parse existing context
    session_context = session.session_context or {}
    
    # Update context with latest query
    session_context["last_intent"] = current_intent
    session_context["last_filters"] = current_filters
    session_context["last_results"] = [r.get("user_id") or r.get("job_id") or r.get("id") for r in results]
    session_context["last_match_type"] = match_type
    session_context["query_history"] = session_context.get("query_history", []) + [
        {
            "intent": current_intent,
            "filters": current_filters,
            "result_count": len(results),
            "timestamp": datetime.now().isoformat()
        }
    ]
    
    # Cap history to last 10 queries
    session_context["query_history"] = session_context["query_history"][-10:]
    
    # Infer user preferences from pattern
    recent_match_types = [q["match_type"] for q in session_context.get("query_history", [-3:])[-3:]]
    session_context["inferred_preference"] = max(set(recent_match_types), key=recent_match_types.count)
    
    # Persist back to DB
    session.session_context = session_context
    db.commit()
    
    return session_context
```

---

## 4. Multi-turn Refinement Flow

### Handle Follow-up Queries Intelligently

```python
async def _handle_refinement_query(
    prompt: str,
    session_context: Dict,
    last_results: List[Dict],
    user_id: str,
    role: str
) -> Tuple[str, List[Dict]]:
    """
    Handle refinement queries like:
    - "Show me only those in remote roles"
    - "Filter by salary 20-30 LPA"
    - "Who has the most growth potential?"
    """
    
    # Detect if this is a refinement (not a new search)
    is_refinement = _is_refinement_query(prompt, session_context)
    
    if not is_refinement:
        return None, []  # Let normal flow handle it
    
    # Extract refinement filters
    refinement_filters = _extract_refinement_filters(prompt)
    
    # Merge with last filters
    merged_filters = {
        **session_context.get("last_filters", {}),
        **refinement_filters
    }
    
    # Re-execute with merged filters
    last_intent = session_context.get("last_intent")
    last_match_type = session_context.get("last_match_type", "hybrid")
    
    refined_results, _ = await _execute_tool_intelligent(
        intent=last_intent,
        match_type=last_match_type,
        filters=merged_filters,
        user_id=user_id,
        role=role,
        db=SessionLocal()
    )
    
    # Generate refinement response
    response = f"""
Refined results for you:

Applying: {_filters_to_prose(refinement_filters)}

Found {len(refined_results)} matches.
"""
    
    return response, refined_results


def _is_refinement_query(prompt: str, session_context: Dict) -> bool:
    """Detect if query is refining previous search"""
    refinement_keywords = [
        "show me", "only", "filter", "just the", "with", "excluding",
        "without", "remove", "add", "more", "less", "higher",
        "lower", "prefer", "not", "skip", "instead"
    ]
    
    if not session_context.get("last_intent"):
        return False
    
    return any(kw in prompt.lower() for kw in refinement_keywords)


def _extract_refinement_filters(prompt: str) -> Dict:
    """Extract incremental filters from refinement query"""
    refinement = {}
    
    # "only remote" → work_location: remote
    if "remote" in prompt.lower():
        refinement["work_location"] = "remote"
    
    # "20-30 LPA" → salary_range
    salary_match = re.search(r'(\d+)-(\d+)\s*(?:LPA|lakhs)', prompt, re.I)
    if salary_match:
        refinement["salary_range"] = (float(salary_match.group(1)), float(salary_match.group(2)))
    
    # "exclude X" → negative filter
    exclude_match = re.search(r'(?:exclude|without|not|skip)\s+([^,\.]+)', prompt, re.I)
    if exclude_match:
        refinement["exclude_keyword"] = exclude_match.group(1).strip()
    
    return refinement


def _filters_to_prose(filters: Dict) -> str:
    """Convert filters dict to natural language"""
    prose_parts = []
    
    if filters.get("skills"):
        prose_parts.append(f"skills: {', '.join(filters['skills'])}")
    if filters.get("location"):
        prose_parts.append(f"location: {', '.join(filters['location'])}")
    if filters.get("salary_range"):
        min_sal, max_sal = filters["salary_range"]
        prose_parts.append(f"salary: {min_sal}-{max_sal} LPA")
    if filters.get("work_location"):
        prose_parts.append(f"work: {filters['work_location']}")
    
    return ", ".join(prose_parts)
```

---

## 5. New API Endpoints

### Explanation Endpoint

```python
@router.get("/ai/assistant/explain/{result_id}")
async def explain_recommendation(
    result_id: str,
    result_type: str = Query(..., enum=["candidate", "job", "company"]),
    current_user: Dict = Depends(get_current_user)
):
    """
    Explain why a specific recommendation was made
    
    Example:
    GET /ai/assistant/explain/uuid-123?result_type=candidate
    
    Returns:
    {
        "result_id": "uuid-123",
        "summary": "...",
        "strengths": [...],
        "gaps": [...],
        "confidence_score": 0.95,
        "next_action": "..."
    }
    """
    role = current_user.get("role")
    user_id = current_user.get("sub")
    
    # Fetch the result from cache or DB
    result = _get_recommendation_result(result_id, result_type, user_id)
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    # Generate explanation
    explanation = await _generate_detailed_explanation(
        result=result,
        result_type=result_type,
        role=role,
        match_type="hybrid",  # Could be stored in session
        filters={}  # Could be loaded from session
    )
    
    return {
        "result_id": result_id,
        **explanation
    }
```

---

## 6. Example: End-to-End Query Flow

```
Query: "Find me senior data engineers in Bangalore who value innovation and remote work, with Python experience"

1. Intent Classification
   → intent: "candidate_search"
   → match_type: "hybrid" (both skills + culture)
   → confidence: 0.92

2. Filter Extraction
   → skills: ["Python"]
   → location: ["Bangalore"]
   → experience_band: "senior"
   → work_location: "remote"
   → culture_keywords: ["innovation"]

3. Filter Normalization
   → skills: ["python"]
   → location: ["Bangalore"]
   → experience_band: "senior"
   → work_location: "remote"
   → culture_keywords: ["innovation"]

4. Tool Selection
   → Engine: recruiter_service.get_recommended_candidates()
   → Filter Type: "profile_matching" (hybrid → use expert match)

5. Execute Recommendation
   → Recruiter Service filters 200 candidates
   → Applies skill filters: python overlap
   → Applies culture fit: innovation scoring
   → Applies experience filter: senior level
   → Returns top 10 ranked by hybrid score

6. Explanation Generation
   → AI generates prose: "Found 8 senior Python engineers who value innovation..."
   → For each result: skill match %, culture fit %, gaps
   → Next steps: "Ready to schedule interviews?"

7. Response Construction
   → text: AI-generated explanation
   → data_results: List of 10 candidates
   → data_type: "candidate_list"
   → action_cards: [View Profile, Schedule Interview, Save Candidate]
   → next_steps: ["Schedule interviews", "Compare candidates"]

8. Session Persistence
   → Store intent, filters, results in session_context
   → Enable follow-up refinement: "Show me only remote positions"
```

---

## 7. Testing & Validation

### Test Cases for NL Processing

```python
def test_intent_classification():
    test_cases = [
        ("Find candidates with SaaS experience", "candidate_search", "skill"),
        ("Show me companies with great culture", "company_search", "culture"),
        ("SDRs in Bangalore who are actively looking", "candidate_search", "skill"),
        ("Companies hiring for data engineers", "company_search", "hybrid"),
        ("Jobs matching my profile and values", "job_search", "hybrid"),
    ]
    
    for prompt, expected_intent, expected_match_type in test_cases:
        result = await _resolve_intent_advanced(prompt, "recruiter", [])
        assert result["intent"] == expected_intent
        assert result["match_type"] == expected_match_type


def test_filter_extraction():
    test_cases = [
        ("Find Python developers with 5 years experience in Bangalore, 15-20 LPA",
         {"skills": ["Python"], "experience_band": "mid", "location": ["Bangalore"], "salary_range": (15, 20)}),
        ("Remote, SaaS, senior level, values innovation",
         {"work_location": "remote", "skills": ["SaaS"], "experience_band": "senior", "culture_keywords": ["innovation"]}),
    ]
    
    for prompt, expected_filters in test_cases:
        filters = await _extract_filters_enhanced(prompt, "recruiter", {}, {})
        for key, value in expected_filters.items():
            assert filters[key] == value, f"Mismatch on {key}: {filters[key]} != {value}"
```

---

## Conclusion

This implementation guide provides the technical foundation for connecting natural language queries to intelligent recommendation systems. Key benefits:

1. **Natural Conversations:** Users don't need to use filters; they speak naturally
2. **Intelligent Routing:** System determines skill vs. culture focus automatically
3. **Persistent Memory:** Session context enables multi-turn refinement
4. **Transparent Explanations:** Users understand why something was recommended
5. **Flexible Matching:** Hybrid matching for most relevant results

**Start with Phase 1** (basic NL extraction) before advancing to Phase 2+ (semantic understanding, proactive recommendations).

---

**Document Version:** 1.0  
**Status:** Ready for Implementation  
**Estimated Dev Time:** 2-3 weeks (Phase 1)
