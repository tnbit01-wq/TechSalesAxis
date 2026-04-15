/**
 * AI Intelligence Client - Frontend utility
 * Calls personalization endpoints for intelligent onboarding
 */

import { apiClient } from './apiClient'; // Assuming you have this

interface CareerReadinessAnswers {
  employment_status?: string;
  job_search_mode?: string;
  timeline?: string;
  salary_expectation?: string;
  preferences?: string[];
  step: number;
}

interface AIIntelligenceResponse<T> {
  status: 'success' | 'error';
  data: T;
  timestamp: string;
}

class AIIntelligenceClient {
  private baseURL = '/api/v1/intelligence';

  /**
   * Get adaptive follow-up question for career readiness
   * Makes questions contextual based on previous answers - personalized, not generic
   */
  async getAdaptiveFollowupQuestion(
    answers: CareerReadinessAnswers,
    token?: string
  ): Promise<AIIntelligenceResponse<{
    question: string;
    options: string[];
    reasoning: string;
    personalization_notes: string;
  }>> {
    try {
      console.log('[AI CLIENT] Fetching adaptive followup question...', answers);

      const response = await apiClient.post(
        `${this.baseURL}/career-readiness/adaptive-question`,
        answers,
        token
      );

      console.log('[AI CLIENT] ✅ Got adaptive question:', response.data?.question?.substring(0, 60) + '...');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error fetching adaptive question:', error);
      throw error;
    }
  }

  /**
   * Extract skills from free-text bio
   * Auto-fills skills during manual resume building
   * User types bio → AI extracts skills → User reviews
   */
  async extractSkillsFromBio(
    bioText: string,
    experienceBand: string,
    token?: string
  ): Promise<AIIntelligenceResponse<{
    primary_skills: string[];
    suggested_skills: string[];
    confidence_score: number;
    skill_categories: Record<string, string[]>;
    analysis: string;
    recommendations: string[];
  }>> {
    try {
      console.log('[AI CLIENT] Extracting skills from bio (length: ' + bioText.length + ')...');

      const response = await apiClient.post(
        `${this.baseURL}/skills/extract-from-bio`,
        {
          bio_text: bioText,
          experience_band: experienceBand,
        },
        token
      );

      console.log('[AI CLIENT] ✅ Extracted skills:', response.data?.primary_skills);
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error extracting skills:', error);
      throw error;
    }
  }

  /**
   * Calculate career fit score
   * Shows personalized career insights after onboarding
   * Score + gaps + development timeline + recommendations
   */
  async calculateCareerFit(
    targetRole?: string,
    includeFullAnalysis: boolean = false,
    token?: string
  ): Promise<AIIntelligenceResponse<{
    overall_fit_score: number;
    job_readiness_score: number;
    skill_match: number;
    experience_alignment: number;
    strengths: string[];
    skill_gaps: Array<{
      skill: string;
      importance: 'high' | 'medium' | 'low';
      reason: string;
    }>;
    development_priorities: string[];
    timeline_to_ready: string;
    market_insights: string;
    personalized_recommendations: string[];
  }>> {
    try {
      console.log('[AI CLIENT] Calculating career fit score...', { targetRole });

      const response = await apiClient.post(
        `${this.baseURL}/career-fit/calculate`,
        {
          target_role: targetRole,
          include_full_analysis: includeFullAnalysis,
        },
        token
      );

      console.log('[AI CLIENT] ✅ Career fit score:', response.data?.overall_fit_score + '/100');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error calculating career fit:', error);
      throw error;
    }
  }

  /**
   * Get personalized recommendations
   * Shown at end of onboarding
   * This week's actions + skill development + interview prep + networking + timeline
   */
  async getPersonalizedRecommendations(
    careerStage: string,
    includeTimeline: boolean = true,
    token?: string
  ): Promise<AIIntelligenceResponse<{
    immediate_actions: string[];
    skill_development: Record<string, string[]>;
    interview_prep_suggestions: string[];
    networking_advice: string[];
    timeline_milestones: string[];
  }>> {
    try {
      console.log('[AI CLIENT] Getting personalized recommendations...', { careerStage });

      const response = await apiClient.post(
        `${this.baseURL}/recommendations/personalized`,
        {
          career_stage: careerStage,
          include_timeline: includeTimeline,
        },
        token
      );

      console.log('[AI CLIENT] ✅ Got personalized recommendations');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error getting recommendations:', error);
      throw error;
    }
  }

  /**
   * Check if AI Intelligence service is healthy
   */
  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    service: string;
    error?: string;
    timestamp: string;
  }> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return await response.json();
    } catch (error) {
      console.error('[AI CLIENT] Health check failed:', error);
      return {
        status: 'unhealthy',
        service: 'AI Intelligence',
        error: String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get skill recommendations for learning path
   * Suggests what to learn next to reach target role
   */
  async getSkillRecommendations(
    currentSkills: string[],
    targetRole: string,
    experienceBand: string = 'mid',
    token?: string
  ): Promise<AIIntelligenceResponse<any>> {
    try {
      console.log('[AI CLIENT] Getting skill recommendations for ', { targetRole, currentSkills });
      
      const response = await apiClient.post(
        `${this.baseURL}/skills/recommend-learning-path`,
        {
          current_skills: currentSkills,
          target_role: targetRole,
          experience_band: experienceBand,
        },
        token
      );
      
      console.log('[AI CLIENT] ✅ Got skill recommendations');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error getting skill recommendations:', error);
      throw error;
    }
  }

  /**
   * Get 5-year career vision and path
   * Shows career progression, salary growth, and skill development
   */
  async getCareerVision(
    targetRole?: string,
    aspirations?: string,
    token?: string
  ): Promise<AIIntelligenceResponse<any>> {
    try {
      console.log('[AI CLIENT] Generating 5-year career vision...');
      
      const response = await apiClient.post(
        `${this.baseURL}/career-vision/5-year-path`,
        {
          target_role: targetRole,
          aspirations: aspirations,
        },
        token
      );
      
      console.log('[AI CLIENT] ✅ Generated career vision');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error getting career vision:', error);
      throw error;
    }
  }

  /**
   * Validate education background
   * Analyzes degree strength, college tier, and career relevance
   */
  async validateEducation(
    degree: string,
    college: string,
    gpa?: number,
    graduationYear?: number,
    token?: string
  ): Promise<AIIntelligenceResponse<any>> {
    try {
      console.log('[AI CLIENT] Validating education...', { college, degree });
      
      const response = await apiClient.post(
        `${this.baseURL}/education/validate`,
        {
          degree,
          college,
          gpa,
          graduation_year: graduationYear,
        },
        token
      );
      
      console.log('[AI CLIENT] ✅ Education validated');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error validating education:', error);
      throw error;
    }
  }

  /**
   * Analyze experience timeline
   * Detects gaps, career progression, and interview talking points
   */
  async analyzeExperienceTimeline(
    experienceEntries: Array<{
      company: string;
      role: string;
      start_date: string;
      end_date: string;
      description?: string;
    }>,
    token?: string
  ): Promise<AIIntelligenceResponse<any>> {
    try {
      console.log('[AI CLIENT] Analyzing experience timeline...');
      
      const response = await apiClient.post(
        `${this.baseURL}/experience/analyze-timeline`,
        {
          experience_entries: experienceEntries,
        },
        token
      );
      
      console.log('[AI CLIENT] ✅ Experience analyzed');
      return response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error analyzing experience:', error);
      throw error;
    }
  }

  /**
   * Process conversational onboarding with natural language
   * User can type freely (like ChatGPT), AI extracts career info from natural text
   * Perfect for users who don't want to answer structured questions
   */
  async processConversationalOnboarding(
    userMessage: string,
    conversationHistory: Array<{ user: string; assistant: string }> = [],
    token?: string,
    askedQuestions: string[] = []
  ): Promise<{
    status: string;
    extracted_info: {
      employment_status: string | null;
      job_search_mode: string | null;
      notice_period_days: number | null;
      current_role: string | null;
      years_experience: number | null;
      willing_to_relocate: boolean | null;
      visa_sponsorship_needed: boolean | null;
      target_role?: string | null;
    };
    completeness_score: number;
    missing_critical_fields: string[];
    acknowledgment: string;  // 🆕 Personalized echo of what was understood
    next_question: string;
    confidence: number;
    extracted_keywords: string[];
    user_sentiment: string;
  }> {
    try {
      console.log('[AI CLIENT] Processing conversational input...', userMessage.substring(0, 60));

      const response = await apiClient.post(
        `${this.baseURL}/onboarding/conversational`,
        {
          user_message: userMessage,
          conversation_history: conversationHistory,
          asked_questions: askedQuestions,  // 🆕 Pass asked questions to prevent duplicates
        },
        token
      );

      console.log('[AI CLIENT] ✅ Conversational response:', {
        completeness: response?.data?.completeness_score,
        confidence: response?.data?.confidence,
        acknowledgment: response?.data?.acknowledgment?.substring(0, 60),  // 🆕 Log acknowledgment
      });
      
      // The endpoint wraps result in { status, data, timestamp }, extract the data
      return response?.data || response;
    } catch (error) {
      console.error('[AI CLIENT] ❌ Error in conversational onboarding:', error);
      throw error;
    }
  }
}

// Singleton instance
let client: AIIntelligenceClient | null = null;

export function getAIIntelligenceClient(): AIIntelligenceClient {
  if (!client) {
    client = new AIIntelligenceClient();
  }
  return client;
}

export default getAIIntelligenceClient;
