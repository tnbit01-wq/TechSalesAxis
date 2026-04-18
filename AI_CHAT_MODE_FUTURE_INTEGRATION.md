# AI Chat Mode - Future Integration Guide

## Overview

Currently, the candidate onboarding flow uses **Guided Questions** (structured mode) as the default path. The **AI Chat Mode** feature has been designed and partially implemented but is not yet fully operational. This document explains the AI Chat Mode architecture and provides a roadmap for complete integration.

## Current Architecture

### Mode Selection Screen (Currently Disabled)

The onboarding page previously showed two options:
1. **Guided Questions** ✅ (Active)
2. **AI Chat Mode** ⏳ (Planned)

### Why AI Chat Mode is Disabled

The AI Chat Mode requires:
- Complete LLM integration with robust context extraction
- Complex natural language processing to extract structured data from conversational input
- Advanced error handling and data validation
- Comprehensive testing across various user input patterns

### Current User Flow

```
User Logs In
    ↓
Onboarding Page (/onboarding/candidate)
    ↓
Automatically Starts → Guided Questions Mode
    ↓
Answer Structured Questions → Build Profile
    ↓
Profile Saved → Dashboard Access
```

---

## AI Chat Mode - Technical Architecture

### Component Structure

#### 1. **Conversational Input Handler**
File: `apps/web/src/app/onboarding/candidate/page.tsx` (lines ~2594-2610)

```typescript
// Current placeholder for AI Chat Mode
const onboardingMode = "conversational" | "structured" | null;

// When AI Chat Mode is activated:
setOnboardingMode("conversational");
addMessage(
  `I'm here to understand your career goals in IT Tech Sales. 
   Tell me about yourself naturally...`,
  "bot"
);
```

#### 2. **Natural Language Processing Pipeline**

Location: `apps/web/src/app/onboarding/candidate/page.tsx` (lines ~530-620)

**Function**: `extractKeyDataFromNarrative(narrative: string)`

This function currently extracts key data from conversational input:

```typescript
// Extracts from user's natural text:
- Employment Status (employed, unemployed, active_transition)
- Years of Experience (numeric pattern matching)
- Skills (keyword detection)
- Location preferences
- Work type preferences
- Timeline information
```

#### 3. **AI Client Integration**

File: `apps/web/src/lib/aiIntelligenceClient.ts`

Currently integrates with:
- **OpenRouter API** for LLM calls
- **OpenAI GPT models** for intelligent extraction
- **Custom context prompts** for candidate data extraction

### Data Extraction Flow

```
User's Natural Text Input
    ↓
Send to aiIntelligenceClient.extractCandidateData()
    ↓
LLM Processes & Extracts Structured Data
    ↓
Return Extracted JSON
    {
      employment_status: "employed",
      years_experience: 5,
      skills: ["Sales", "CRM", "Lead Generation"],
      target_location: "Remote",
      job_search_mode: "opportunities"
    }
    ↓
Validate & Save to Database
```

---

## Integration Steps for AI Chat Mode

### Phase 1: Enable Mode Selection (1-2 days)

1. **Restore Mode Selection Screen**
   - Uncomment the choice between Guided Questions and AI Chat Mode
   - Allow users to select their preferred communication style
   
2. **Code Location**: `apps/web/src/app/onboarding/candidate/page.tsx` (line ~2535)

```typescript
// Change this condition from always hidden:
{state === "INITIAL" && !onboardingMode && (
  <div className="flex flex-col gap-6 justify-center items-center h-full">
    {/* Mode selection buttons visible again */}
  </div>
)}
```

### Phase 2: Validate LLM Integration (2-3 days)

1. **Test OpenRouter API Connection**
   ```bash
   # Verify API credentials in .env
   OPENROUTER_API_KEY=your_key_here
   OPENAI_API_KEY=your_key_here
   ```

2. **Run Extraction Tests**
   ```typescript
   // Test extractCandidateData() with sample narratives
   const testInput = "I've been working in sales for 5 years, 
                      specialized in tech startups, looking for 
                      remote opportunities";
   
   const extracted = await aiIntelligenceClient.extractCandidateData(testInput);
   console.log(extracted); // Verify output
   ```

3. **Validate Data Types**
   - Ensure extracted data matches expected schema
   - Test edge cases (incomplete info, ambiguous text, multiple interpretations)

### Phase 3: Enhance Error Handling (2-3 days)

1. **Fallback Extraction Methods**
   - Implement regex-based extraction as secondary method
   - Create user-friendly error messages if extraction fails
   - Offer manual entry option if AI extraction insufficient

2. **Add Confidence Scoring**
   ```typescript
   // Example response structure
   {
     data: { ... extracted fields ... },
     confidence: 0.92, // 0-1 scale
     extracted_fields: ["employment_status", "years_experience"],
     uncertain_fields: ["location"], // Requires clarification
   }
   ```

3. **Implement Clarification Workflow**
   ```typescript
   if (response.confidence < 0.85) {
     addMessage("I caught some info but want to clarify a few things...", "bot");
     // Ask follow-up questions for uncertain fields
   }
   ```

### Phase 4: Frontend Enhancements (2-3 days)

1. **Conversational Context Preservation**
   - Store conversation history for context awareness
   - Allow multi-turn interactions (user provides info gradually)

2. **Visual Feedback Improvements**
   ```typescript
   // Show extraction indicators
   "✓ Employment Status: Employed
    ✓ Years of Experience: 5 years
    ? Location: Unclear - Remote or Hybrid?"
   ```

3. **User Education**
   - Add tooltips explaining what AI is extracting
   - Provide example inputs to guide users
   - Show real-time extraction progress

### Phase 5: Backend Validation (1-2 days)

1. **Data Validation Layer**
   ```python
   # apps/api/src/schemas/candidate.py
   # Add validation for AI-extracted data
   class AIExtractedData(BaseModel):
       employment_status: str  # Validate enum
       years_experience: int   # Validate range 0-70
       skills: List[str]       # Validate against skill database
   ```

2. **Duplicate Prevention**
   - Ensure same data isn't captured twice
   - Handle user corrections gracefully

### Phase 6: Testing & QA (3-5 days)

1. **Test Scenarios**
   - Fresh candidates with complex narratives
   - Candidates with minimal information
   - Non-native English speakers
   - Edge cases (very experienced, very junior, career changers)

2. **Integration Testing**
   - Verify data flows correctly to database
   - Test profile picture, resume, and other attachments
   - Ensure all downstream features work with AI-extracted data

3. **Performance Testing**
   - LLM API response times (should be <5 seconds)
   - Handle simultaneous onboarding users
   - Cache strategies for repeated scenarios

---

## AI Chat Mode - Complete User Flow

### Proposed User Experience (Post-Implementation)

```
User Logs In
    ↓
Onboarding Page Appears
    ↓
User Sees Two Options:
  • Guided Questions (structured)
  • AI Chat Mode (conversational)
    ↓
User Selects AI Chat Mode
    ↓
AI Introduction:
"Hi! I'm here to understand your career goals.
 Tell me about yourself naturally..."
    ↓
User Types Narrative:
"I've been in tech sales for 5 years, 
 mostly focused on enterprise clients.
 Looking for remote opportunities in startups."
    ↓
AI Extracts & Confirms:
"I gathered:
 ✓ Employment: Currently Employed
 ✓ Experience: 5 years in Tech Sales
 ✓ Focus: Enterprise clients
 ? Location Preference: Remote (Confirmed)
 ? Company Size: Startups (Confirmed)

 Anything else I should know?"
    ↓
User Provides Additional Info (if needed)
    ↓
AI Asks Clarification Questions
    ↓
Profile Built Progressively
    ↓
Dashboard Access
```

---

## Implementation Checklist

### Before Enabling AI Chat Mode:

- [ ] OpenRouter API keys configured and tested
- [ ] `extractCandidateData()` function in aiIntelligenceClient.ts working reliably
- [ ] Database schema supports AI-extracted metadata and confidence scores
- [ ] Error handling for LLM failures implemented
- [ ] Fallback to guided questions if AI extraction fails
- [ ] User consent for AI-based data extraction added
- [ ] Comprehensive test data set prepared (20+ test cases)
- [ ] Performance benchmarks met (<5s response times)
- [ ] A/B testing infrastructure ready (measure conversion rates)
- [ ] Support documentation prepared (help users with AI mode)

---

## File References

### Core Files for AI Chat Mode Integration

| File | Purpose | Status |
|------|---------|--------|
| `apps/web/src/app/onboarding/candidate/page.tsx` | Main onboarding UI & logic | ✅ Ready (disabled mode selection) |
| `apps/web/src/lib/aiIntelligenceClient.ts` | LLM integration & extraction | 🔄 Partially implemented |
| `apps/api/src/schemas/candidate.py` | Data validation | ✅ Ready |
| `apps/api/src/api/candidate.py` | Backend storage | ✅ Ready |
| `.env` | OpenRouter/OpenAI credentials | ⚠️ Needs configuration |

### Example: Enabling Mode Selection

**File**: `apps/web/src/app/onboarding/candidate/page.tsx`

**Current (Disabled)**: Always goes to Guided Questions
**Future (Enabled)**: Show choice screen, allow user selection

---

## Future Enhancements

### 1. **Multi-Turn Intelligence**
- Maintain context across multiple messages
- Ask smart follow-up questions based on missing info
- Self-correct if user provides conflicting info

### 2. **Resume Intelligence**
- Upload resume + have AI chat about it
- Auto-fill fields from resume + verify with user
- Extract achievements and quantify impact

### 3. **Voice Integration**
- Transcribe voice input to text
- AI extracts from voice transcription
- Support multiple languages

### 4. **Industry-Specific Guidance**
- AI provides role-specific suggestions
- Recommends skills based on target roles
- Personalized learning path recommendations

### 5. **Skill Recommendation Engine**
- Analyze user's background
- Suggest high-demand skills for their profile
- Provide learning resources

---

## Support & Documentation

### For Candidates
- "AI Chat Mode Guide" - How to use conversational onboarding
- "Tips for Better AI Extraction" - What to include in your narrative
- "Fallback Options" - What happens if AI doesn't understand

### For Development Team
- "AI Integration Troubleshooting"
- "LLM API Error Handling"
- "Data Extraction Validation Tests"

---

## Timeline Estimate

- **Phase 1**: 1-2 days (mode selection)
- **Phase 2**: 2-3 days (LLM validation)
- **Phase 3**: 2-3 days (error handling)
- **Phase 4**: 2-3 days (frontend enhancements)
- **Phase 5**: 1-2 days (backend validation)
- **Phase 6**: 3-5 days (testing & QA)

**Total Estimated Timeline**: 13-21 days for full AI Chat Mode integration

---

## Success Metrics

Post-implementation, track:
- Onboarding completion rate (AI vs Guided)
- Average time to complete onboarding
- Data quality/accuracy from AI extraction
- User satisfaction scores
- Error rates & fallback usage
- LLM API cost per user

---

## Questions & Decisions

**Q: Should AI Chat Mode be default?**
- A: No, start with Guided Questions as default. Let users opt into AI mode.

**Q: What if AI extraction fails?**
- A: Graceful fallback to guided questions for that section + manual entry option.

**Q: How to handle PII in LLM processing?**
- A: Use OpenRouter's privacy-focused endpoints, never store raw input to logs.

---

## Conclusion

AI Chat Mode is architecturally sound and ready for phased integration. The current implementation with **Guided Questions** is production-ready. When resources permit, follow the 6-phase plan above to enable AI Chat Mode as an optional, user-selected experience.

**Current Status**: ✅ Guided Questions Active | ⏳ AI Chat Mode Ready for Implementation
