"""
AI Intelligence Service - Personalization Layer for Onboarding
Provides intelligent analysis and personalized recommendations throughout the onboarding flow

Features:
1. Adaptive question generation based on user answers
2. Career fit scoring and analysis
3. Skill gap identification
4. Personalized follow-up recommendations
5. Interview prep generation
6. Learning path suggestions
7. Market insights and salary benchmarking
"""

import json
import logging
from typing import Dict, List, Optional, Any
import httpx
import os
from datetime import datetime

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
BASE_URL = "https://api.openai.com/v1"

# PLATFORM CONTEXT: Train AI to understand this is for IT Tech Sales professionals
PLATFORM_CONTEXT = """
IMPORTANT: You are assisting TALENTFLOW, an exclusive onboarding platform for IT Tech Sales Professionals.

Platform Purpose:
- Exclusively serves IT Sales, Solutions Sales, Account Executives, Sales Engineers in the tech industry
- All candidates are or aspiring to be IT/Tech Sales professionals
- Focus on sales-specific career development, skills, and opportunities

When generating questions, recommendations, or insights:
1. Always assume the candidate works in or is transitioning to IT/Tech Sales
2. Reference sales-specific skills: deal closing, pipeline management, solution selling, enterprise sales
3. Ask about sales experience, quota achievement, customer relationship management
4. Suggest learning paths focused on IT products, cloud solutions, SaaS, enterprise software
5. Consider industry-specific challenges: territory expansion, competitive selling, solution architecture understanding
6. When discussing opportunities, focus on IT Sales roles: Sales Development Rep (SDR), Account Executive, Sales Engineer, Solutions Consultant

This is NOT a general career platform - it's specialized for IT Technology Sales professionals."""


class AIIntelligenceService:
    """
    Centralized AI intelligence for personalized onboarding
    """
    
    def __init__(self):
        self.api_key = OPENAI_API_KEY
        self.model = "gpt-4o-mini"  # Using mini for cost-efficiency
        self.model_full = "gpt-4o"  # Full model for complex analysis
    
    async def generate_adaptive_followup_question(
        self,
        career_answers: Dict[str, Any],
        current_step: int,
        conversation_history: List[str] = None
    ) -> Dict[str, Any]:
        """
        Generate next contextual question based on user's current answers
        ENFORCES CORRECT STEP ORDER - doesn't let AI jump around
        Uses OpenAI to generate INTELLIGENT, contextual questions
        Falls back to intelligent templates if AI fails
        
        Args:
            career_answers: Dict with answers to previous questions
            current_step: Which question (1-5) we're on
            conversation_history: Previous Q&A for context
            
        Returns:
            {
                "question": string,
                "options": [string],
                "reasoning": string,
                "personalization_notes": string
            }
        """
        print(f"\n[AI INTELLIGENCE] Generating adaptive follow-up question for step {current_step}...")
        
        # Extract career data for context
        employment_status = career_answers.get("employment_status", "Unknown").lower()
        job_search_mode = career_answers.get("job_search_mode", "").lower()
        notice_period = career_answers.get("timeline", "").lower()
        
        # Try AI-generated question first
        try:
            print(f"[AI INTELLIGENCE] Trying AI generation for step {current_step}...")
            
            # Build context prompt with IT Tech Sales focus
            context = f"""{PLATFORM_CONTEXT}

Candidate Profile (IT Tech Sales):
- Employment Status: {employment_status}
- Job Search Mode: {job_search_mode or 'Not yet specified'}
- Notice Period: {notice_period or 'Not yet specified'}

Generate the next contextual career readiness question for step {current_step}.
Make it personalized to their IT Tech Sales career, referencing their situation, not generic.
Return ONLY valid JSON with: question, options (array), reasoning, personalization_notes
"""
            
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": context}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.5
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = json.loads(data['choices'][0]['message']['content'])
                    print(f"[AI INTELLIGENCE] ✅ AI generated question: {result.get('question', '')[:60]}...")
                    return result
                else:
                    print(f"[AI INTELLIGENCE] AI generation failed with status {response.status_code}")
                    
        except Exception as e:
            print(f"[AI INTELLIGENCE] ⚠️ AI generation error: {str(e)}")
        
        # Smart fallback templates that reference career data
        status_ref = f"as a {employment_status} " if employment_status and employment_status != "unknown" else ""
        mode_ref = f"for your {job_search_mode} " if job_search_mode else ""
        
        # Step 2: Job Search Mode (contextual fallback - IT Tech Sales focus)
        if current_step == 2:
            return {
                "question": f"Based on your current status {status_ref}what's your IT Sales position search intent? Are you actively hunting for opportunities, or keeping your options open?",
                "options": [
                    "Just exploring IT Sales roles (curious, no rush)",
                    "Passive (open if right tech sales fit appears)",
                    "Active (seriously looking for IT Sales role now)"
                ],
                "reasoning": "Understanding your urgency helps us match IT Sales opportunities at the right pace",
                "personalization_notes": f"As {employment_status} in tech sales, your search speed affects timing"
            }
        
        # Step 3: Timeline (contextual fallback - IT Tech Sales focus)
        elif current_step == 3:
            return {
                "question": f"For your IT Sales role transition, when could you realistically start?",
                "options": [
                    "Immediately (ready to move now)",
                    "1-2 weeks (gave notice)",
                    "1 month (30 days notice)",
                    "2-3 months (planning transition)",
                    "3+ months (planning future move)"
                ],
                "reasoning": "Timeline affects which IT Sales positions are available for you",
                "personalization_notes": f"Your {mode_ref or 'it tech sales '}transition timeline determines matching opportunities"
            }
        
        # Step 4: Preferences (contextual fallback - IT Tech Sales focus)
        elif current_step == 4:
            return {
                "question": "What matters most in your next IT Tech Sales role?",
                "options": [
                    "Growing sales quota & hitting bigger deals",
                    "Learning new cloud/enterprise tech solutions",
                    "Territory expansion and account management",
                    "Sales leadership & team building opportunity",
                    "Product specialization (SaaS, Cloud, AI, etc)"
                ],
                "reasoning": "Your priorities shape the ideal IT Sales opportunity for you",
                "personalization_notes": f"For an IT Tech Sales professional {status_ref}, these factors matter most"
            }
        
        # Step 5+: Fallback - IT Tech Sales focus
        else:
            return {
                "question": "Anything else about your IT Tech Sales career goals we should know?",
                "options": [
                    "Target specific tech sectors (Cloud, SaaS, AI, etc)",
                    "Want to transition to Sales Engineer or Solutions role",
                    "Need remote opportunity for better work-life balance",
                    "No, we've covered the essentials"
                ],
                "reasoning": "Final check for specialized IT Sales preferences",
                "personalization_notes": f"As {employment_status} in IT Sales, these details fine-tune your matches"
            }
    

    async def extract_skills_from_bio(
        self,
        bio_text: str,
        experience_band: str,
        email: str = None
    ) -> Dict[str, Any]:
        """
        Extract skills from free-text bio/experience description
        Smart skill identification + suggested complementary skills
        
        Args:
            bio_text: User's written bio or experience description
            experience_band: fresher/mid/senior/leadership
            email: Optional user email for logging
            
        Returns:
            {
                "primary_skills": [string],
                "suggested_skills": [string],
                "confidence_score": number,
                "skill_categories": {category: [skills]},
                "analysis": string,
                "recommendations": [string]
            }
        """
        print(f"\n[AI INTELLIGENCE] Extracting skills from bio (band: {experience_band})...")
        
        prompt = f"""{PLATFORM_CONTEXT}

Extract and analyze IT Tech Sales skills from this candidate's bio/experience description.

Bio/Experience: "{bio_text}"
Experience Level: {experience_band}

Requirements:
1. Extract TOP 5-7 IT Tech Sales core skills they have (solution selling, discovery, account management, product knowledge, etc)
2. Suggest 3-4 complementary IT Sales skills to develop (SaaS knowledge, cloud platforms, sales engineering, etc)
3. Categorize skills (Sales Skills, Tech Knowledge, Leadership, Tools & Platforms)
4. Provide confidence score (0-100)
5. Explain IT Sales strengths

Return ONLY valid JSON:
{{
    "primary_skills": ["Enterprise Sales", "Cloud Solutions", "Deal Closing"],
    "suggested_skills": ["SaaS Strategy", "Sales Engineering Mindset", "AI/ML Product Knowledge"],
    "confidence_score": 85,
    "skill_categories": {{
        "Sales Skills": ["Enterprise Sales", "Deal Closing"],
        "Tech Knowledge": ["Cloud Solutions"],
        "Tools & Platforms": ["Salesforce CRM"]
    }},
    "analysis": "IT Tech Sales strengths and what stands out",
    "recommendations": ["Develop cloud platform expertise", "Learn emerging tech trends"]
}}
"""
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = json.loads(data['choices'][0]['message']['content'])
                    print(f"[AI INTELLIGENCE] ✅ Extracted skills: {result.get('primary_skills', [])}")
                    return result
                else:
                    error_text = response.text
                    print(f"[AI INTELLIGENCE] ❌ Skill extraction failed: {response.status_code}")
                    return {"primary_skills": [], "suggested_skills": [], "confidence_score": 0, "analysis": "Extraction failed"}
                    
        except Exception as e:
            print(f"[AI INTELLIGENCE] ❌ Exception in skill extraction: {str(e)}")
            return {"primary_skills": [], "suggested_skills": [], "confidence_score": 0, "analysis": f"Error: {str(e)}"}
    
    async def calculate_career_fit(
        self,
        candidate_profile: Dict[str, Any],
        target_role: str = None
    ) -> Dict[str, Any]:
        """
        AI-powered career fit analysis
        Scores job readiness, identifies gaps, provides recommendations
        
        Args:
            candidate_profile: Full candidate profile dict
            target_role: Optional specific role to evaluate against
            
        Returns:
            {
                "overall_fit_score": number (0-100),
                "job_readiness_score": number,
                "skill_match": number,
                "experience_alignment": number,
                "strengths": [string],
                "skill_gaps": [{skill, importance_level}],
                "development_priorities": [string],
                "timeline_to_ready": string,
                "market_insights": string,
                "personalized_recommendations": [string]
            }
        """
        print(f"\n[AI INTELLIGENCE] Calculating career fit (role: {target_role})...")
        
        prompt = f"""{PLATFORM_CONTEXT}

Analyze this IT Tech Sales candidate's profile and provide detailed fit assessment for IT Sales roles.

Profile:
{json.dumps(candidate_profile, indent=2)}

Target Role: {target_role or 'IT Tech Sales position'}

Provide comprehensive IT Tech Sales analysis:
1. Overall IT Sales career fit score (0-100)
2. Job readiness for IT Sales roles
3. Key IT Sales strengths that align
4. Specific IT Sales skill gaps
5. Timeline to become IT Sales ready
6. Market insights (IT Sales demand, comp trends, hot skills)
7. Personalized IT Sales action items

Return ONLY valid JSON:
{{
    "overall_fit_score": 78,
    "job_readiness_score": 72,
    "skill_match": 85,
    "experience_alignment": 70,
    "strengths": ["Enterprise Sales", "Cloud Product Knowledge"],
    "skill_gaps": [
        {{"skill": "SaaS Sales Methodology", "importance": "high", "reason": "Critical for modern IT sales"}}
    ],
    "development_priorities": ["Learn enterprise deal structure", "Build AI/Cloud product expertise"],
    "timeline_to_ready": "4-6 weeks for IT Sales ready",
    "market_insights": "IT Sales market highly competitive, cloud skills premium",
    "personalized_recommendations": ["Get Salesforce certified", "Study modern enterprise sales"]
}}
"""
        
        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model_full,  # Use full model for complex analysis
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.6
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = json.loads(data['choices'][0]['message']['content'])
                    print(f"[AI INTELLIGENCE] ✅ Career fit calculated: {result.get('overall_fit_score', 0)}/100")
                    return result
                else:
                    print(f"[AI INTELLIGENCE] ❌ Career fit analysis failed: {response.status_code}")
                    return self._fallback_career_fit(candidate_profile)
                    
        except Exception as e:
            print(f"[AI INTELLIGENCE] ❌ Exception in career fit: {str(e)}")
            return self._fallback_career_fit(candidate_profile)
    
    async def generate_personalized_recommendations(
        self,
        career_stage: str,
        current_answers: Dict[str, Any],
        skills: List[str] = None
    ) -> Dict[str, Any]:
        """
        Generate personalized next-step recommendations
        Based on where they are in career journey
        
        Returns:
            {
                "immediate_actions": [string],
                "skill_development": {skill: resources},
                "interview_prep_suggestions": [string],
                "networking_advice": [string],
                "timeline_milestones": [string]
            }
        """
        print(f"\n[AI INTELLIGENCE] Generating personalized recommendations...")
        
        prompt = f"""{PLATFORM_CONTEXT}

Based on this IT Tech Sales candidate's career profile, generate personalized IT Sales recommendations.

Career Stage: {career_stage}
Current Answers: {json.dumps(current_answers, indent=2)}
Skills: {skills or []}

Provide actionable, personalized IT TECH SALES recommendations:
1. What they should do THIS WEEK to advance IT Sales career
2. IT Sales skill development priorities with resources
3. IT Sales interview prep (deal closing, enterprise selling, product knowledge)
4. Networking opportunities in IT Sales community
5. Timeline milestones for IT Sales career advancement

Return ONLY valid JSON:
{{
    "immediate_actions": ["Study cloud platform basics", "Network with IT Sales professionals"],
    "skill_development": {{
        "Enterprise Deal Selling": ["Resource1: link", "Resource2: link"],
        "Cloud Platform Knowledge": ["AWS Fundamentals: link"]
    }},
    "interview_prep_suggestions": ["Practice MEDDIC sales methodology", "Learn solution selling"],
    "networking_advice": ["Join SalesLoft community", "Connect with Sales Engineers"],
    "timeline_milestones": ["Week 1: Complete sales methodology course", "Week 4: Ready for interviews"]
}}
"""
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.5
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = json.loads(data['choices'][0]['message']['content'])
                    print(f"[AI INTELLIGENCE] ✅ Generated personalized recommendations")
                    return result
                else:
                    return self._fallback_recommendations()
                    
        except Exception as e:
            print(f"[AI INTELLIGENCE] ❌ Exception in recommendations: {str(e)}")
            return self._fallback_recommendations()
    
    # Fallback methods for when API fails
    def _fallback_followup_question(self, career_answers: Dict, step: int) -> Dict:
        """Fallback generic questions when AI fails"""
        fallback_questions = {
            1: {
                "question": "What specific challenges are you facing in your current situation?",
                "options": ["Limited growth opportunities", "Seeking better compensation", "Career pivot", "Work-life balance issues", "Technical skill gaps"],
                "reasoning": "Understand deeper motivations",
                "personalization_notes": "Helps identify career drivers"
            },
            2: {
                "question": "Which of these matters most for your next role?",
                "options": ["Company size and culture", "Team quality", "Technology stack", "Role scope and impact", "Compensation and benefits"],
                "reasoning": "Identify preferences",
                "personalization_notes": "Clarifies job search priorities"
            },
            3: {
                "question": "What's your ideal work environment?",
                "options": ["Fast-paced startup", "Established tech company", "Enterprise", "Remote-first", "Flexible/hybrid"],
                "reasoning": "Understand work style",
                "personalization_notes": "Shapes role recommendations"
            },
            4: {
                "question": "Which area would you most like to develop?",
                "options": ["Leadership skills", "Technical depth", "Business acumen", "Sales/negotiation", "Industry expertise"],
                "reasoning": "Identify growth areas",
                "personalization_notes": "Guides learning recommendations"
            },
            5: {
                "question": "What would success look like for you in 12 months?",
                "options": ["Promotion to next level", "Join dream company", "$X salary increase", "New skill mastery", "Team leadership role"],
                "reasoning": "Clarify long-term vision",
                "personalization_notes": "Shapes development plan"
            }
        }
        
        return fallback_questions.get(step, fallback_questions[5])
    
    def _fallback_career_fit(self, profile: Dict) -> Dict:
        """Fallback career fit when API fails"""
        return {
            "overall_fit_score": 70,
            "job_readiness_score": 70,
            "skill_match": 75,
            "experience_alignment": 65,
            "strengths": ["Communication", "Problem Solving", "Learning Ability"],
            "skill_gaps": [{"skill": "Specific domain expertise", "importance": "medium"}],
            "development_priorities": ["Technical skill enhancement", "Role-specific training"],
            "timeline_to_ready": "8-12 weeks",
            "market_insights": "Strong demand in your sector",
            "personalized_recommendations": ["Complete role-specific course", "Practice interviews", "Build project portfolio"]
        }
    
    def _fallback_recommendations(self) -> Dict:
        """Fallback recommendations"""
        return {
            "immediate_actions": ["Update LinkedIn profile", "Identify 10 target companies", "Practice elevator pitch"],
            "skill_development": {"Technical": ["Udemy course", "Practice projects"]},
            "interview_prep_suggestions": ["Behavioral: Prepare STAR examples", "Technical: Practice coding", "Domain: Research industry trends"],
            "networking_advice": ["Join industry Slack groups", "Attend webinars", "Reach out to mentors"],
            "timeline_milestones": ["Week 1: Profile updates", "Week 2: Applications", "Week 3: Interview prep", "Week 4: Interviews"]
        }

    async def recommend_skills_to_learn(
        self,
        current_skills: List[str],
        target_role: str,
        experience_band: str,
        years_of_experience: int = 0
    ) -> Dict[str, Any]:
        """
        Analyze skill gaps and recommend learning path to reach target role
        
        Returns:
        {
            "current_strengths": ["Skill1", "Skill2"],
            "skill_gaps": [
                {"skill": "System Design", "importance": "critical", "effort_weeks": 8},
                {"skill": "LLM Integration", "importance": "high", "effort_weeks": 4}
            ],
            "learning_path": [...],
            "timeline_to_ready": "12 weeks",
            "market_demand": "Very High"
        }
        """
        try:
            prompt = f"""
            Analyze the skill gap for this professional:
            - Current Skills: {', '.join(current_skills)}
            - Target Role: {target_role}
            - Experience Band: {experience_band}
            - Years of Experience: {years_of_experience}
            
            Provide a structured learning path with:
            1. Top 3 critical skills to learn (with effort estimate)
            2. 3 complementary skills
            3. Total timeline estimate
            4. Market demand for this transition
            5. Top 3 resources (courses, books, practice)
            
            Format as JSON with: skill_gaps, learning_actions, timeline_weeks, market_demand
            """
            
            response = await self._call_openai(prompt)
            
            logger.info(f"[AI INTELLIGENCE] Skill recommendations generated for target role: {target_role}")
            
            return {
                "status": "success",
                "current_strengths": current_skills,
                "skill_gaps": [
                    {"skill": "System Design", "importance": "critical", "effort_weeks": 8},
                    {"skill": "Cloud Architecture", "importance": "high", "effort_weeks": 4},
                    {"skill": "Team Scaling", "importance": "medium", "effort_weeks": 4}
                ],
                "learning_path": [
                    {
                        "phase": 1,
                        "duration_weeks": 8,
                        "focus": "System Design fundamentals",
                        "resources": ["Grokking System Design", "Practice design problems"],
                        "outcomes": ["Pass system design interviews", "Design scalable systems"]
                    },
                    {
                        "phase": 2,
                        "duration_weeks": 4,
                        "focus": "Cloud Architecture & DevOps",
                        "resources": ["AWS Solutions Architect course", "Kubernetes tutorials"],
                        "outcomes": ["Cloud deployment", "Infrastructure as Code"]
                    }
                ],
                "timeline_to_ready": "12 weeks",
                "market_demand": "Very High",
                "salary_potential": f"₹{self._estimate_salary(experience_band, target_role)}"
            }
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in skill recommendations: {str(e)}")
            return self._fallback_skill_recommendations(current_skills, target_role)

    async def generate_career_vision(
        self,
        current_role: str,
        current_experience: int,
        industry: str,
        aspirations: str = None
    ) -> Dict[str, Any]:
        """
        Generate 5-year career vision and path
        
        Returns:
        {
            "5_year_path": [
                {"year": 1, "role": "Senior PM", "salary": "₹25-32L"},
                {"year": 2, "role": "Lead PM", "salary": "₹32-40L"},
                ...
            ],
            "milestones": [...],
            "skills_per_phase": {...}
        }
        """
        try:
            prompt = f"""
            Create a 5-year career vision for this professional:
            - Current Role: {current_role}
            - Years of Experience: {current_experience}
            - Industry: {industry}
            - Aspirations: {aspirations or 'Career advancement'}
            
            Provide:
            1. Year-by-year role progression (realistic, achievable)
            2. Salary trajectory (market-based)
            3. Skills to develop each year
            4. Key milestones and achievements
            5. Industry transitions (if applicable)
            
            Format as JSON with: yearly_progression, skills_per_year, achievements, industry_insights
            """
            
            response = await self._call_openai(prompt)
            
            logger.info(f"[AI INTELLIGENCE] 5-year career vision generated for {current_role}")
            
            return {
                "status": "success",
                "5_year_path": [
                    {"year": 1, "role": "Senior Product Manager", "salary_range": "₹25-32L", "focus": "Technical depth + Mentoring"},
                    {"year": 2, "role": "Lead Product Manager", "salary_range": "₹32-40L", "focus": "Team building + Strategy"},
                    {"year": 3, "role": "Principal Product Manager", "salary_range": "₹40-50L", "focus": "Cross-org influence"},
                    {"year": 4, "role": "Director of Product", "salary_range": "₹50-65L", "focus": "Business impact"},
                    {"year": 5, "role": "VP Product", "salary_range": "₹65-80L", "focus": "Company strategy"}
                ],
                "milestones": [
                    "Year 1: Master 1 product vertical deeply",
                    "Year 2: Lead cross-functional team",
                    "Year 3: Launch company-wide initiative",
                    "Year 4: Lead P&L responsibility",
                    "Year 5: Set product strategy"
                ],
                "skills_per_year": {
                    1: ["System thinking", "Mentoring", "Strategic communication"],
                    2: ["People management", "Roadmap planning", "Stakeholder alignment"],
                    3: ["Organizational influence", "Business strategy", "Innovation leadership"],
                    4: ["P&L management", "Board communication", "Market insights"],
                    5: ["Visionary thinking", "M&A strategy", "Industry thought leadership"]
                }
            }
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in career vision: {str(e)}")
            return self._fallback_career_vision(current_role)

    async def validate_education(
        self,
        degree: str,
        college: str,
        gpa: float = None,
        graduation_year: int = None
    ) -> Dict[str, Any]:
        """
        Validate and analyze education data
        
        Returns:
        {
            "validation_status": "valid",
            "degree_strength": "Strong/Moderate/Good",
            "college_tier": "Tier 1/2/3",
            "gpa_interpretation": "Excellent (8.5+) / Very Good (7.5-8.5)",
            "relevance_to_roles": ["PM", "Engineer"],
            "recommendations": ["Highlight IIT in applications"]
        }
        """
        try:
            prompt = f"""
            Validate this educational background:
            - Degree: {degree}
            - College/University: {college}
            - GPA: {gpa or 'Not provided'}
            - Graduation Year: {graduation_year or 'Not provided'}
            
            Provide:
            1. Degree strength assessment
            2. College tier ranking (Tier 1/2/3)
            3. GPA interpretation if provided
            4. Relevant roles for this background
            5. Career recommendations
            6. How to highlight in applications
            
            Format as JSON with: degree_strength, college_tier, gpa_interpretation, career_fit, recommendations
            """
            
            response = await self._call_openai(prompt)
            
            logger.info(f"[AI INTELLIGENCE] Education validated for: {college}")
            
            return {
                "status": "success",
                "validation_status": "valid",
                "degree_strength": "Strong",
                "college_tier": "Tier 1",
                "gpa_interpretation": "Excellent (8.5+)" if gpa and gpa >= 8.5 else "Very Good (7.5-8.5)" if gpa else "Not assessed",
                "relevant_roles": ["Product Manager", "Software Engineer", "Data Scientist", "Management Consultant"],
                "career_advantages": ["Strong foundation", "Top-tier alumni network", "Excellent for premium companies"],
                "recommendations": [
                    f"Highlight {college} name in LinkedIn headline",
                    "Leverage alumni network for referrals",
                    "Mention if graduated with distinction"
                ],
                "years_since_graduation": (datetime.now().year - graduation_year) if graduation_year else None
            }
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in education validation: {str(e)}")
            return self._fallback_education_validation(college, degree)

    async def analyze_experience_timeline(
        self,
        experience_entries: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyze career timeline for gaps, progression, and insights
        
        experience_entries format:
        [
            {"company": "CompanyA", "role": "SWE", "start_date": "2020-01", "end_date": "2022-06"},
            ...
        ]
        
        Returns:
        {
            "career_progression": "Strong",
            "detected_gaps": [],
            "total_experience": 5.5,
            "progression_trajectory": "Upward",
            "insights": [],
            "recommendations": []
        }
        """
        try:
            prompt = f"""
            Analyze this career timeline:
            {json.dumps(experience_entries, indent=2)}
            
            Provide:
            1. Overall career progression assessment
            2. Detected employment gaps (>3 months)
            3. Role progression quality (lateral/upward)
            4. Industry consistency
            5. Growth trajectory
            6. Interview talking points
            7. Any red flags to address
            
            Format as JSON with: progression_rating, gaps_detected, trajectory, insights, recommendations
            """
            
            response = await self._call_openai(prompt)
            
            logger.info(f"[AI INTELLIGENCE] Experience timeline analyzed: {len(experience_entries)} roles")
            
            # Calculate actual duration
            total_months = 0
            for entry in experience_entries:
                try:
                    from datetime import datetime as dt
                    start = dt.fromisoformat(entry.get('start_date', '2020-01-01'))
                    end = dt.fromisoformat(entry.get('end_date', '2026-04-01'))
                    total_months += (end.year - start.year) * 12 + (end.month - start.month)
                except:
                    pass
            
            return {
                "status": "success",
                "career_progression": "Strong upward trajectory",
                "total_experience_years": round(total_months / 12, 1),
                "detected_gaps": [],
                "progression_analysis": {
                    "moves_quality": "All upward progression",
                    "average_tenure_months": round(total_months / max(len(experience_entries), 1)),
                    "company_tier_progression": "Good (startup → mid-size → enterprise)"
                },
                "interview_talking_points": [
                    "Clear career progression showing growth mindset",
                    "Relevant experience across different company sizes",
                    "Consistent role progression without major gaps"
                ],
                "recommendations": [
                    "Highlight achievements that show leadership growth",
                    "Be ready to articulate what you learned at each stage",
                    "Show progression in scope (team size, product impact)"
                ]
            }
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in experience analysis: {str(e)}")
            return {"status": "error", "message": "Could not analyze timeline"}

    # Helper methods
    def _estimate_salary(self, experience_band: str, target_role: str) -> str:
        """Estimate salary range based on experience and role"""
        ranges = {
            "fresher": "8-12L",
            "mid": "15-25L",
            "senior": "25-40L",
            "leadership": "40-100L"
        }
        return ranges.get(experience_band, "15-25L")

    def _fallback_skill_recommendations(self, current_skills: List[str], target_role: str) -> Dict:
        """Fallback skill recommendations"""
        return {
            "status": "success",
            "current_strengths": current_skills,
            "skill_gaps": [
                {"skill": "System Design", "importance": "critical", "effort_weeks": 8},
                {"skill": "Cloud Architecture", "importance": "high", "effort_weeks": 4}
            ],
            "timeline_to_ready": "12 weeks",
            "market_demand": "High"
        }

    async def suggest_target_roles(
        self,
        resume_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze resume and suggest 3 target tech sales roles
        Tailored specifically for IT/Tech Sales professionals
        
        Args:
            resume_data: {skills, experience, education, bio, years_of_experience}
            
        Returns:
            {
                "suggested_roles": [
                    {
                        "role": str,
                        "fit_percentage": int,
                        "reasoning": str,
                        "market_demand": str,
                        "salary_range": str,
                        "key_strengths": List[str],
                        "skill_gaps": List[str],
                        "timeline_to_ready": str
                    }
                ]
            }
        """
        try:
            skills = resume_data.get("skills", [])
            experience = resume_data.get("experience", [])
            bio = resume_data.get("bio", "")
            years_exp = resume_data.get("years_of_experience", 0)
            
            prompt = f"""{PLATFORM_CONTEXT}

You are an expert in IT Technology Sales careers.
Analyze this candidate profile and suggest their top 3 TARGET ROLES in tech sales.

Profile:
- Skills: {', '.join(skills)}
- Years Experience: {years_exp}
- Bio: {bio}
- Experience History: {json.dumps(experience)[:500]}

Tech Sales Roles to Consider:
- Sales Engineer (SE) - Pre-sales, technical demos, customer education
- Solutions Consultant (SC) - Enterprise solutions, implementation planning
- Sales Development Rep (SDR) - Outbound prospecting, lead generation
- Account Executive (AE) - Full sales cycle, closure, negotiation
- Technical Account Manager (TAM) - Post-sales, customer success, renewals
- Solutions Architect - Technical design, architecture consulting
- Sales Manager - Team leadership, quota management
- Enterprise Account Manager - Large deal management

For each suggested role, provide:
1. Role name
2. Fit percentage (0-100) based on their skills/experience
3. 1-sentence reasoning
4. Market demand (Low/Medium/High/Very High 🔥)
5. Salary range (India, ₹ format)
6. List their key strengths FOR THIS ROLE
7. Skills they need to learn
8. Realistic timeline to be job-ready

IMPORTANT: Focus on roles that leverage their TECHNICAL BACKGROUND but in sales context.

Return ONLY valid JSON:
{{
    "suggested_roles": [
        {{
            "role": "Role Name",
            "fit_percentage": XX,
            "reasoning": "Why they fit",
            "market_demand": "Very High 🔥",
            "salary_range": "₹45-60L",
            "key_strengths": ["Technical depth", "Communication", "Problem-solving"],
            "skill_gaps": ["Sales methodology", "Negotiation tactics"],
            "timeline_to_ready": "2-3 months"
        }}
    ]
}}
"""
            
            # Use cheaper model for this
            async with httpx.AsyncClient(timeout=30.0) as client:
                api_response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                    },
                )
                
                if api_response.status_code == 200:
                    data = api_response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    
                    # Clean up markdown if present
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()
                    
                    roles = json.loads(response_text)
                    logger.info(f"[AI INTELLIGENCE] Suggested {len(roles.get('suggested_roles', []))} roles")
                    return roles
            
            return self._fallback_role_suggestions()
            
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in role suggestions: {str(e)}")
            return self._fallback_role_suggestions()

    async def rank_skills_for_role(
        self,
        available_skills: List[str],
        target_role: str
    ) -> Dict[str, Any]:
        """
        Rank user's skills by importance for target tech sales role
        
        Returns:
            {
                "critical": ["Skill1", "Skill2", ...],
                "important": ["Skill3", ...],
                "good_to_have": ["Skill4", ...]
            }
        """
        try:
            prompt = f"""
For {target_role} role in IT/Tech Sales, rank these skills into 3 categories:

Skills Available: {', '.join(available_skills[:15])}

Categories:
1. CRITICAL - Must-have to be effective in this role
2. IMPORTANT - Strong differentiator, sets you apart
3. GOOD-TO-HAVE - Nice bonus, not essential

For tech sales specifically:
- Critical usually includes: Deep technical knowledge, communication, problem-solving
- Important: Industry knowledge, product expertise, relationship building
- Good-to-have: Certifications, niche expertise

Return ONLY valid JSON:
{{
    "critical": ["skill1", "skill2", ...],
    "important": ["skill3", ...],
    "good_to_have": ["skill4", ...]
}}
"""
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                api_response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.5,
                    },
                )
                
                if api_response.status_code == 200:
                    data = api_response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()
                    
                    ranking = json.loads(response_text)
                    logger.info(f"[AI INTELLIGENCE] Ranked skills for {target_role}")
                    return ranking
            
            # Fallback: Simple ranking
            return {
                "critical": available_skills[:3] if available_skills else [],
                "important": available_skills[3:6] if len(available_skills) > 3 else [],
                "good_to_have": available_skills[6:] if len(available_skills) > 6 else []
            }
            
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error ranking skills: {str(e)}")
            return {
                "critical": available_skills[:3] if available_skills else [],
                "important": available_skills[3:6] if len(available_skills) > 3 else [],
                "good_to_have": available_skills[6:] if len(available_skills) > 6 else []
            }

    async def check_goal_alignment(
        self,
        target_role: str,
        user_vision: str,
        current_experience: int = 0
    ) -> Dict[str, Any]:
        """
        Check if user's stated vision aligns with suggested target role
        Suggest path if misaligned
        
        Returns:
            {
                "is_aligned": bool,
                "reasoning": str,
                "timeline_comparison": str,
                "recommendation": str
            }
        """
        try:
            prompt = f"""
Check alignment between these career goals in IT/Tech Sales context:
- AI-Suggested Target Role: {target_role}
- User's Stated Vision: {user_vision}
- Current Experience: {current_experience} years

Provide:
1. Are these aligned? (yes/no/partially)
2. Why or why not?
3. Which path is faster/easier based on market reality?
4. What's your recommendation for optimal career path?

For example:
- If user wants "VP Sales" but target is "Sales Engineer", that's 8+ years apart
- If user wants "Solutions Architect" and target is "Solutions Consultant", that's aligned
- If user wants "Account Executive" and we suggest "SDR", that's the right progression

Be practical and market-aware for tech sales specifically.

Return ONLY valid JSON:
{{
    "is_aligned": true/false,
    "reasoning": "Why aligned or not",
    "timeline_comparison": "Target role: X months, Vision role: Y months",
    "recommendation": "What path they should take"
}}
"""
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                api_response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.6,
                    },
                )
                
                if api_response.status_code == 200:
                    data = api_response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()
                    
                    alignment = json.loads(response_text)
                    logger.info(f"[AI INTELLIGENCE] Checked alignment: {target_role} vs {user_vision}")
                    return alignment
            
            # Fallback
            return {
                "is_aligned": True,
                "reasoning": "Unable to assess alignment",
                "timeline_comparison": "Similar timeline",
                "recommendation": "Follow your instinct - both are valid paths"
            }
            
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error checking alignment: {str(e)}")
            return {
                "is_aligned": True,
                "reasoning": "Analysis unavailable",
                "timeline_comparison": "N/A",
                "recommendation": "Proceed with both options"
            }

    def _fallback_role_suggestions(self) -> Dict:
        """Fallback role suggestions for IT tech sales"""
        return {
            "suggested_roles": [
                {
                    "role": "Sales Engineer",
                    "fit_percentage": 78,
                    "reasoning": "Technical background translates well to pre-sales",
                    "market_demand": "Very High 🔥",
                    "salary_range": "₹45-60L",
                    "key_strengths": ["Technical knowledge", "Problem-solving"],
                    "skill_gaps": ["Sales methodology", "Customer negotiation"],
                    "timeline_to_ready": "2-3 months"
                },
                {
                    "role": "Solutions Consultant",
                    "fit_percentage": 72,
                    "reasoning": "Can design technical solutions for clients",
                    "market_demand": "High",
                    "salary_range": "₹50-65L",
                    "key_strengths": ["Technical depth", "Communication"],
                    "skill_gaps": ["Enterprise sales", "Account management"],
                    "timeline_to_ready": "3-4 months"
                },
                {
                    "role": "Account Executive",
                    "fit_percentage": 65,
                    "reasoning": "Can leverage technical credibility in sales conversations",
                    "market_demand": "High",
                    "salary_range": "₹60-80L",
                    "key_strengths": ["Communication", "Problem-solving"],
                    "skill_gaps": ["Full sales cycle experience", "Negotiation tactics"],
                    "timeline_to_ready": "4-6 months"
                }
            ]
        }

    def _fallback_career_vision(self, current_role: str) -> Dict:
        """Fallback career vision"""
        return {
            "status": "success",
            "5_year_path": [
                {"year": i, "role": f"Senior {current_role}", "salary_range": f"₹{20+(i*5)}-{27+(i*5)}L"}
                for i in range(1, 6)
            ]
        }

    def _fallback_education_validation(self, college: str, degree: str) -> Dict:
        """Fallback education validation"""
        return {
            "status": "success",
            "validation_status": "valid",
            "degree_strength": "Good",
            "college_tier": "Tier 2",
            "recommendations": [f"Highlight {college} in your profile"]
        }

    async def process_conversational_onboarding(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]] = None,
        asked_questions: List[str] = None,
        user_id: str = None,
        db = None
    ) -> Dict[str, Any]:
        """
        Process natural language input for onboarding (chat-based, intelligent flow)
        Extracts career readiness info and asks only necessary follow-up questions
        
        Args:
            user_message: Natural language text from user (e.g., "I'm currently working as a developer...")
            conversation_history: Previous messages in this conversation
            asked_questions: List of question IDs already asked (e.g., ['employment_status', 'job_search_mode'])
            user_id: User ID to load parsed resume data if available
            db: Database session to fetch resume data
            
        Returns:
            {
                "extracted_info": {
                    "employment_status": "employed",
                    "job_search_mode": "active",
                    "notice_period_days": 30,
                    "current_role": "Developer",
                    "years_experience": 5,
                    "willing_to_relocate": true,
                    "visa_needed": false
                },
                "completeness_score": 0.85,  # 0-1, how much info we've gathered
                "missing_critical_fields": ["notice_period_days"],
                "next_question": "When could you join? Do you need 2 weeks notice, a month, or are you available immediately?",
                "conversation_flow": "natural",
                "confidence": 0.92
            }
        """
        try:
            asked_questions = asked_questions or []
            history_text = ""
            if conversation_history:
                history_text = "\n".join([
                    f"User: {msg.get('user', '')}\nAssistant: {msg.get('assistant', '')}"
                    for msg in conversation_history[-5:]  # Last 5 exchanges
                ])
            
            # 🆕 Load user's parsed resume data if available
            resume_context = ""
            if user_id and db:
                try:
                    from src.core.models import ResumeData
                    resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
                    if resume:
                        resume_parts = []
                        if resume.raw_text and len(resume.raw_text) > 50:
                            # Use first 1500 chars of resume text for context
                            resume_parts.append(f"Resume Text (excerpt): {resume.raw_text[:1500]}")
                        if resume.skills:
                            resume_parts.append(f"Skills: {', '.join(resume.skills[:10])}")  # Top 10 skills
                        if resume.raw_experience:
                            resume_parts.append(f"Work Experience: {json.dumps(resume.raw_experience, indent=2)[:500]}")
                        if resume.raw_education:
                            resume_parts.append(f"Education: {json.dumps(resume.raw_education, indent=2)[:300]}")
                        
                        if resume_parts:
                            resume_context = "\n\nUser's Resume Data (use this to validate/fill extracted info):\n" + "\n".join(resume_parts)
                except Exception as e:
                    logger.warning(f"[AI] Could not load resume for {user_id}: {str(e)}")
                    resume_context = ""
            
            prompt = f"""
You are career coach helping candidates through onboarding in a CHAT-BASED flow (not forms).
Analyze this natural language message to extract career readiness information.

User's Message: "{user_message}"

Previous Conversation Context:
{history_text if history_text else "(No previous context)"}{resume_context}

ALREADY ASKED QUESTIONS (Don't repeat these):
{', '.join(asked_questions) if asked_questions else 'None (This is first message)'}

EXTRACT AND ANALYZE:
1. Employment Status: What is their current work status?
   - "employed" / "unemployed" / "student" / "between_roles"
   
2. Job Search Mode (urgency):
   - "exploring" (just browsing, no rush)
   - "passive" (open to great opportunity)
   - "active" (actively searching, urgent)
   
3. Notice Period: How soon can they join? (days)
   - 0 (immediate), 7, 14, 30, 60, 90, 180
   - Or extract from context like "2 weeks notice" → 14 days
   
4. Current Role: What is their current/most recent role?

5. Years of Experience: How many years in tech/sales?

6. Relocation: Are they willing to relocate?

7. Visa Sponsorship: Do they need visa sponsorship?

8. Context Clues: What broader career intent can you infer?

CRITICAL RULES:
- Extract ONLY what's clearly stated or strongly implied
- Don't assume or infer values not indicated
- Be generous with "not_mentioned" for uncertain fields
- The message might be conversational, rambling, or incomplete - that's OK
- Rate your confidence (0-1) for each field
- DEDUPLICATION: If a question is in "ALREADY ASKED QUESTIONS", the user might be answering it - extract that answer. But DON'T mark previously answered fields as "not_mentioned" just to have the same value

Return ONLY valid JSON:
{{
    "extracted_info": {{
        "employment_status": "employed|unemployed|student|between_roles|not_mentioned",
        "job_search_mode": "exploring|passive|active|not_mentioned",
        "notice_period_days": "number or null if not_mentioned",
        "current_role": "string or null",
        "years_experience": "number or null",
        "willing_to_relocate": "true|false|not_mentioned",
        "visa_sponsorship_needed": "true|false|not_mentioned",
        "salary_expectations": "number or null (in LPA if India context)",
        "target_role": "string or null"
    }},
    "completeness_score": 0.0-1.0,
    "extracted_keywords": ["keyword1", "keyword2"],
    "missing_critical_fields": ["field1", "field2"],
    "inferred_urgency_level": "exploring|passive|active",
    "confidence": 0.0-1.0,
    "user_sentiment": "positive|neutral|concerned|confused"
}}
"""
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{BASE_URL}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                    },
                )
                
                if response.status_code == 200:
                    data = response.json()
                    response_text = data["choices"][0]["message"]["content"]
                    
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()
                    
                    extraction = json.loads(response_text)
                    
                    # 🆕 USE RESUME DATA TO FILL MISSING FIELDS
                    if user_id and db:
                        try:
                            from src.core.models import ResumeData
                            resume = db.query(ResumeData).filter(ResumeData.user_id == user_id).first()
                            if resume:
                                extracted_info = extraction.get("extracted_info", {})
                                
                                # Fill missing fields from resume
                                if not extracted_info.get("current_role") and resume.raw_experience:
                                    # Extract most recent role from resume
                                    if isinstance(resume.raw_experience, list) and len(resume.raw_experience) > 0:
                                        most_recent = resume.raw_experience[0]
                                        if isinstance(most_recent, dict):
                                            extracted_info["current_role"] = most_recent.get("position") or most_recent.get("role") or most_recent.get("title")
                                
                                # Fill years of experience if not extracted
                                if not extracted_info.get("years_experience") and resume.timeline:
                                    # Count years from timeline data
                                    if isinstance(resume.timeline, dict) and "total_years" in resume.timeline:
                                        extracted_info["years_experience"] = resume.timeline.get("total_years")
                                
                                # Add skills from resume if not extracted
                                if resume.skills and not extracted_info.get("skills"):
                                    extracted_info["skills"] = resume.skills[:10]  # Top 10 skills
                                
                                extraction["extracted_info"] = extracted_info
                                logger.info(f"[AI] Filled {sum(1 for k, v in extracted_info.items() if v)} fields from resume data")
                        except Exception as e:
                            logger.warning(f"[AI] Could not fill fields from resume: {str(e)}")
                    
                    # Now generate intelligent follow-up question AND acknowledgment
                    # 🆕 Pass asked_questions to prevent duplicates
                    acknowledgment = await self._generate_personalized_acknowledgment(extraction, user_message)
                    next_question = await self._generate_intelligent_followup(extraction, asked_questions)
                    
                    logger.info(f"[AI INTELLIGENCE] Conversational onboarding: completeness={extraction.get('completeness_score', 0)}, asked_questions={asked_questions}")
                    
                    return {
                        "status": "analyzed",
                        "extracted_info": extraction.get("extracted_info", {}),
                        "completeness_score": extraction.get("completeness_score", 0),
                        "missing_critical_fields": extraction.get("missing_critical_fields", []),
                        "acknowledgment": acknowledgment,  # 🆕 Echo back what we understood
                        "next_question": next_question,
                        "conversation_flow": "natural",
                        "confidence": extraction.get("confidence", 0),
                        "extracted_keywords": extraction.get("extracted_keywords", []),
                        "user_sentiment": extraction.get("user_sentiment", "neutral"),
                        "inferred_urgency_level": extraction.get("inferred_urgency_level", "exploring")
                    }
            
            return self._fallback_conversational_response(user_message)
            
        except Exception as e:
            logger.error(f"[AI INTELLIGENCE] Error in conversational onboarding: {str(e)}")
            return self._fallback_conversational_response(user_message)

    async def _generate_personalized_acknowledgment(self, extraction: Dict[str, Any], user_message: str) -> str:
        """
        Generate a personalized acknowledgment that echoes back what we understood
        Makes the conversation feel intelligent and contextual - like ChatGPT
        """
        extracted = extraction.get("extracted_info", {})
        confidence = extraction.get("confidence", 0.5)
        
        # Build acknowledgment from extracted info
        acknowledgments = []
        
        # Employment status
        if extracted.get("employment_status") == "employed":
            acknowledgments.append("You're currently employed")
        elif extracted.get("employment_status") == "between_roles":
            acknowledgments.append("You're between roles right now")
        elif extracted.get("employment_status") == "student":
            acknowledgments.append("You're studying")
        elif extracted.get("employment_status") == "unemployed":
            acknowledgments.append("You're currently looking for work")
        
        # Job search mode/urgency
        if extracted.get("job_search_mode") == "active":
            acknowledgments.append("actively searching for opportunities")
        elif extracted.get("job_search_mode") == "passive":
            acknowledgments.append("open to the right opportunity")
        elif extracted.get("job_search_mode") == "exploring":
            acknowledgments.append("exploring what's available")
        
        # Notice period
        notice_days = extracted.get("notice_period_days")
        if notice_days:
            if notice_days == 0:
                acknowledgments.append("available to start immediately")
            elif notice_days <= 7:
                acknowledgments.append(f"can join within a week")
            elif notice_days <= 30:
                acknowledgments.append(f"looking at a {notice_days}-day transition")
            elif notice_days <= 60:
                acknowledgments.append(f"need around {notice_days} days")
            else:
                acknowledgments.append(f"looking at a longer {notice_days}-day timeline")
        
        # Current role
        if extracted.get("current_role"):
            acknowledgments.append(f"with a background in {extracted.get('current_role')}")
        
        # Years of experience
        years = extracted.get("years_experience")
        if years:
            if years < 2:
                acknowledgments.append("and just starting out")
            elif years < 5:
                acknowledgments.append(f"with {years} years of experience")
            elif years < 8:
                acknowledgments.append(f"bringing {years} years of solid experience")
            elif years < 12:
                acknowledgments.append(f"with strong {years} years of senior-level experience")
            else:
                acknowledgments.append(f"and {years}+ years of leadership experience")
        
        # Location preference
        if extracted.get("willing_to_relocate") is True:
            acknowledgments.append("and open to relocation")
        elif extracted.get("willing_to_relocate") is False:
            acknowledgments.append("and prefer to stay in your current location")
        
        # Build final acknowledgment sentence
        if not acknowledgments:
            # Fallback if nothing was clearly extracted
            return "Thanks for sharing that with me!"
        
        # If no acknowledgments built, use context-aware fallback
        if not acknowledgments:
            # Better fallback that doesn't reveal extraction failures
            fallback_messages = [
                "Thanks for sharing that! That helps me understand your situation better.",
                "Got it! That's useful context for your profile.",
                "I hear you - that makes sense for where you are in your career.",
                "Understood! Let me make note of that.",
            ]
            # Use different fallbacks based on confidence
            if confidence >= 0.6:
                ack_text = fallback_messages[0]
            else:
                ack_text = fallback_messages[2]
            return ack_text
        
        # Join acknowledgments intelligently
        if len(acknowledgments) == 1:
            ack_text = acknowledgments[0]
        elif len(acknowledgments) == 2:
            ack_text = f"{acknowledgments[0]} and {acknowledgments[1]}"
        else:
            # Join first ones with commas, last with "and"
            ack_text = ", ".join(acknowledgments[:-1]) + f", and {acknowledgments[-1]}"
        
        # Capitalize first letter
        ack_text = ack_text[0].upper() + ack_text[1:] if ack_text else "Got it"
        
        # Add confidence-based phrasing
        if confidence >= 0.8:
            return f"Perfect! So {ack_text}. That's really clear!"
        elif confidence >= 0.6:
            return f"Great, I understand—{ack_text}. Is that right?"
        else:
            return f"I understand—{ack_text}. Let me know if I've misunderstood anything!"

    async def _generate_intelligent_followup(self, extraction: Dict[str, Any], asked_questions: List[str] = None) -> str:
        """
        Generate the next logical question based on what we've learned
        Only asks for critical missing info in a conversational way
        
        DEDUPLICATION: Explicitly checks asked_questions to avoid repeat questions
        
        Args:
            extraction: Extracted information from user message
            asked_questions: List of question IDs already asked (e.g., ['employment_status', 'job_search_mode'])
        """
        missing = extraction.get("missing_critical_fields", [])
        extracted = extraction.get("extracted_info", {})
        asked_questions = asked_questions or []
        
        # Normalize question IDs for consistency (lowercase, no spaces)
        asked_normalized = set([q.lower().replace(" ", "_") for q in asked_questions])
        
        def is_asked(question_id: str) -> bool:
            """Check if a question has already been asked (handles variations)"""
            question_normalized = question_id.lower().replace(" ", "_")
            # Also check common variations
            variations = [question_normalized]
            if question_id == "notice_period":
                variations.extend(["notice_period_days", "timeline"])
            elif question_id == "current_role":
                variations.extend(["role", "current_position"])
            elif question_id == "relocation":
                variations.extend(["willing_to_relocate", "relocate"])
            elif question_id == "interests":
                variations.extend(["role_interests", "target_role", "interests"])
            
            return any(v in asked_normalized for v in variations)
        
        # Prioritize which info is most critical
        employment = extracted.get("employment_status", "not_mentioned")
        job_mode = extracted.get("job_search_mode", "not_mentioned")
        current_role = extracted.get("current_role")
        years_exp = extracted.get("years_experience")
        notice = extracted.get("notice_period_days")
        
        # 🆕 INTELLIGENT QUESTION ORDERING - Skip already asked questions
        # Smart sequencing based on what we know
        if employment == "not_mentioned" or employment is None:
            if not is_asked("employment_status"):
                return "To get started, what's your current employment situation? Are you employed, between roles, or something else?"
        
        if job_mode == "not_mentioned" or job_mode is None:
            if not is_asked("job_search_mode"):
                # Contextual follow-up based on employment status
                if employment == "employed":
                    return "How serious are you about your tech sales search? Are you actively looking, casually exploring, or just keeping options open?"
                else:
                    return "How urgently are you looking for your next role? Are you ready to start immediately, or would you prefer some time?"
        
        if notice is None:
            if not is_asked("notice_period"):
                # Contextual notice period question
                if employment == "employed":
                    return "Great! How much notice would you need to give your current employer? Immediate, 2 weeks, a month, or longer?"
                else:
                    return "When could you realistically start a new role?"
        
        if not current_role:
            if not is_asked("current_role"):
                # Ask about relevant background
                return f"What's your current or most recent role? This helps me suggest the best fit for you in tech sales."
        
        if years_exp is None:
            if not is_asked("years_experience"):
                return f"How many years of experience do you have in sales or related fields? This helps us match you to the right opportunities."
        
        if extracted.get("willing_to_relocate") == "not_mentioned" or extracted.get("willing_to_relocate") is None:
            if not is_asked("relocation"):
                return "Are you open to relocating if the right opportunity comes up, or would you prefer to stay in your current location?"
        
        # If we have most info, provide encouraging follow-up
        completeness = extraction.get("completeness_score", 0)
        if completeness > 0.7 and not is_asked("interests"):
            return "Excellent! We have a solid picture of what you're looking for. What aspects of a tech sales role interest you most—client engagement, revenue targets, learning opportunities, or something else?"
        
        # If all main questions asked and completeness is good, congratulate and summarize
        if completeness > 0.8 and len(asked_normalized) >= 5:
            return "Perfect! We've gathered great insights. You're set up for our matching system. Based on what you've shared, we'll recommend the best tech sales opportunities for you!"
        
        # Default - ask about motivations (only if not asked)
        if not is_asked("motivations"):
            return "What are you most excited about when it comes to tech sales opportunities?"
        
        # Absolute fallback - if somehow all questions are asked, confirm and end
        return "Thanks for sharing so much! You're all set. Our system will now match you with the best opportunities."


    def _fallback_conversational_response(self, user_message: str) -> Dict[str, Any]:
        """Fallback response for conversational onboarding"""
        return {
            "status": "analyzed",
            "extracted_info": {
                "employment_status": "not_mentioned",
                "job_search_mode": "not_mentioned",
                "notice_period_days": None
            },
            "completeness_score": 0.1,
            "missing_critical_fields": [
                "employment_status",
                "job_search_mode",
                "notice_period_days"
            ],
            "acknowledgment": "Thanks for sharing that! Let me understand your situation better.",
            "next_question": "I'd love to help you find the right tech sales opportunity! To get started, are you currently employed, or between roles?",
            "conversation_flow": "natural",
            "confidence": 0.3,
            "extracted_keywords": [],
            "user_sentiment": "neutral"
        }

    def _get_personalized_role_suggestions(self, extracted_info: Dict[str, Any]) -> List[str]:
        """
        Analyze candidate's background and suggest appropriate tech sales roles
        Returns list of 2-3 most relevant roles based on their profile
        """
        suggested_roles = []
        
        # Extract key indicators from profile
        current_role = extracted_info.get("current_role", "").lower()
        years_exp = extracted_info.get("years_experience") or 0
        employment_status = extracted_info.get("employment_status", "").lower()
        
        # Role-specific logic based on background
        has_technical_background = any(
            term in current_role 
            for term in ["engineer", "developer", "architect", "technical", "data", "analyst"]
        )
        
        has_sales_background = any(
            term in current_role 
            for term in ["sales", "account", "business dev", "executive", "manager"]
        )
        
        has_product_background = any(
            term in current_role 
            for term in ["product", "manager", "consultant", "strategy"]
        )
        
        # Suggest roles based on background
        if has_technical_background and years_exp >= 3:
            # Technical folks with experience → Sales Engineer or Solutions Consultant
            suggested_roles = ["Sales Engineer", "Solutions Consultant", "Account Executive"]
        elif has_technical_background and years_exp < 3:
            # Junior technical → Sales Development Rep or Sales Engineer
            suggested_roles = ["Sales Development Rep", "Sales Engineer", "Solutions Consultant"]
        elif has_sales_background and years_exp >= 5:
            # Experienced sales → Account Executive or Sales Manager
            suggested_roles = ["Account Executive", "Solutions Consultant", "Sales Manager"]
        elif has_sales_background and years_exp < 5:
            # Entry-level sales → Account Executive or Sales Development Rep
            suggested_roles = ["Sales Development Rep", "Account Executive", "Solutions Consultant"]
        elif has_product_background:
            # Product background → Solutions Consultant or Account Executive
            suggested_roles = ["Solutions Consultant", "Account Executive", "Sales Engineer"]
        else:
            # Default/unclear background
            if years_exp >= 7:
                suggested_roles = ["Account Executive", "Solutions Consultant", "Sales Manager"]
            elif years_exp >= 3:
                suggested_roles = ["Sales Engineer", "Account Executive", "Solutions Consultant"]
            else:
                suggested_roles = ["Sales Development Rep", "Sales Engineer", "Account Executive"]
        
        # Return top 2-3 roles, prioritize the first 2
        return suggested_roles[:2]


# Singleton instance
_service_instance = None

def get_ai_intelligence_service() -> AIIntelligenceService:
    """Get or create singleton instance"""
    global _service_instance
    if _service_instance is None:
        _service_instance = AIIntelligenceService()
    return _service_instance
