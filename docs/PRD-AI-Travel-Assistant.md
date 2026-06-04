# PRD: AI Travel Assistant Addon for Wndrly

**Status:** Draft for Review  
**Author:** Jarvis  
**Date:** 2026-06-04  
**Target Release:** TBD

---

## 1. Executive Summary

Add an AI-powered travel assistant to Wndrly that helps users plan trips by:
- Answering travel questions in natural language
- Searching hotels, flights, and activities via booking APIs
- Automatically adding places to trips using MCP integration
- Generating affiliate revenue through booking links

**Key Differentiation:** While TREK (upstream) has MCP integration, it doesn't have AI chat or booking API integration. This makes Wndrly a revenue-generating SaaS vs. open-source tool.

---

## 2. Goals & Non-Goals

### Goals
- ✅ Provide conversational AI interface for trip planning
- ✅ Integrate booking APIs (hotels, flights, activities) with affiliate links
- ✅ Use existing MCP tools to modify trips (add places, update budget, etc.)
- ✅ Generate affiliate revenue to fund Wndrly SaaS operations
- ✅ Maintain real-time sync with existing WebSocket architecture
- ✅ Mobile-friendly chat interface

### Non-Goals
- ❌ Booking checkout flow (redirect to partner sites)
- ❌ Payment processing
- ❌ Custom travel insurance
- ❌ User-to-user chat (this is AI-only)
- ❌ Voice/audio interface (v1)

---

## 3. User Stories

### As a trip planner, I want to:
1. **Ask travel questions**
   - "What's the best area to stay in Seoul?"
   - "How do I get from Incheon Airport to Myeongdong?"
   - "What are must-see places in Kyoto?"

2. **Search accommodations**
   - "Find hotels near Shibuya under $150/night for Aug 28-30"
   - AI returns 5 options with prices, ratings, affiliate links
   - Click "Add to trip" → automatically creates place in itinerary

3. **Search flights**
   - "Cheapest flights from Toronto to Seoul in August"
   - AI returns options with airlines, prices, booking links

4. **Search activities**
   - "Book a day tour of Kyoto temples"
   - Returns GetYourGuide/Viator options

5. **Modify trip via AI**
   - "Move Myeong-dong to Day 2"
   - "Add $50 to my food budget"
   - AI uses MCP tools to update trip directly

### As Wndrly (business), I want to:
- Track affiliate clicks and conversions
- A/B test AI prompts for higher conversion
- Analyze which booking types generate most revenue

---

## 4. Technical Architecture

### 4.1 Frontend Components

```
client/src/components/AIAssistant/
├── ChatPane.tsx           # Main chat UI (right sidebar)
├── ChatMessage.tsx        # Individual message bubble
├── BookingCard.tsx        # Hotel/flight result card with CTA
├── QuickActions.tsx       # Pre-built prompts ("Find hotels", etc.)
└── aiAssistantStore.ts    # Zustand state management
```

#### UI/UX:
- **Toggle button** in header (robot icon) to show/hide AI pane
- **Replaces existing right pane** (Places to Add list) when active
- **Message types:**
  - User text input
  - AI text responses
  - Booking result cards (image, price, rating, affiliate link, "Add to trip" button)
  - System messages ("Added Travelodge to Day 1")
- **Mobile:** Full-screen overlay with back button

### 4.2 Backend Routes

```
server/src/routes/ai.ts                # Main AI chat endpoint
server/src/routes/bookings/
├── hotels.ts                          # Booking.com API proxy
├── flights.ts                         # Skyscanner/Kiwi API proxy
└── activities.ts                      # GetYourGuide API proxy
```

#### API Endpoints:

**POST /api/trips/:tripId/ai/chat**
- Body: `{ message: string, conversationId?: string }`
- Response: `{ reply: string, bookingResults?: [], mcpActions?: [] }`
- Auth: Required (user must have trip access)

**GET /api/trips/:tripId/bookings/hotels**
- Query: `?city=Seoul&checkIn=2026-08-28&checkOut=2026-08-30&maxPrice=150`
- Response: Array of hotel objects with affiliate links
- Rate limit: 10 req/min per user

**GET /api/trips/:tripId/bookings/flights**
- Query: `?from=YYZ&to=ICN&date=2026-08-28&returnDate=2026-09-20`
- Response: Array of flight options with affiliate links

**GET /api/trips/:tripId/bookings/activities**
- Query: `?city=Kyoto&category=tours`
- Response: Array of activities with affiliate links

**POST /api/trips/:tripId/bookings/track**
- Body: `{ bookingId: string, provider: string, type: string }`
- Response: `{ tracked: true }`
- Purpose: Track affiliate click before redirect

### 4.3 AI Service

```typescript
// server/src/services/aiService.ts

interface AIContext {
  trip: Trip;          // Current trip data
  days: Day[];         // Itinerary days
  places: Place[];     // All places in trip
  budget: Budget;      // Budget info
  conversationHistory: Message[];
}

async function chatWithAI(
  message: string,
  context: AIContext,
  userId: number
): Promise<{
  reply: string;
  bookingResults?: BookingResult[];
  mcpActions?: MCPAction[];
}> {
  // 1. Call OpenAI/Anthropic with:
  //    - System prompt (travel assistant role)
  //    - Trip context (JSON summary)
  //    - Available tools:
  //        a. MCP tools (create_place, update_budget, etc.)
  //        b. Booking tools (search_hotels, search_flights, etc.)
  //    - Conversation history (last 10 messages)
  
  // 2. AI decides action:
  //    - Answer question → return text
  //    - Search bookings → call booking API → return results
  //    - Modify trip → call MCP tool → broadcast via WebSocket
  
  // 3. Return structured response
}
```

#### AI Provider:
- **Primary:** OpenAI GPT-4 Turbo (function calling)
- **Fallback:** Anthropic Claude 3.5 Sonnet (tool use)
- **Cost optimization:** Use streaming for long responses

#### System Prompt (Draft):
```
You are a helpful travel planning assistant for Wndrly. You help users:
1. Answer travel questions about destinations, logistics, and planning
2. Search for hotels, flights, and activities via booking APIs
3. Add places directly to their trip itinerary

Current trip context:
- Destination: {destinations}
- Dates: {startDate} to {endDate}
- Budget: {totalBudget} ({currency})
- Current itinerary: {days.length} days planned

Available tools:
- search_hotels(city, checkIn, checkOut, maxPrice)
- search_flights(from, to, date, returnDate)
- search_activities(city, category)
- create_place(name, address, day, category)
- update_budget(category, amount)

When user asks about accommodations, flights, or activities:
1. Use the appropriate search tool
2. Present 3-5 top options with clear details
3. Include affiliate links (handled automatically)
4. Offer to add selections to their trip

Always be concise, friendly, and actionable.
```

### 4.4 Booking API Integration

#### Hotel API Options:
| Provider | Affiliate Program | Commission | API Complexity |
|----------|------------------|------------|----------------|
| **Booking.com** | Partner Hub | 4-6% | Medium |
| Agoda | Affiliate API | 5-7% | Easy |
| Hotels.com | Expedia Affiliate | 4% | Medium |

**Recommendation:** Start with **Booking.com** (largest inventory, best commission).

#### Flight API Options:
| Provider | Affiliate Program | Commission | API Complexity |
|----------|------------------|------------|----------------|
| **Skyscanner** | Travel API | $5-15/booking | Medium |
| Kiwi.com | Tequila API | 3-5% | Easy |
| Kayak | Affiliate Network | Varies | Hard |

**Recommendation:** Start with **Kiwi.com** (easier API, better docs).

#### Activity API Options:
| Provider | Affiliate Program | Commission | API Complexity |
|----------|------------------|------------|----------------|
| **GetYourGuide** | Affiliate API | 8% | Easy |
| Viator | TripAdvisor Affiliate | 8-12% | Medium |
| Klook | Affiliate Program | 6-10% | Medium |

**Recommendation:** Start with **GetYourGuide** (easiest integration).

### 4.5 Affiliate Link Generation

```typescript
// server/src/services/affiliateService.ts

interface AffiliateLink {
  originalUrl: string;
  affiliateUrl: string;
  provider: string;
  bookingId: string;
  expiresAt: Date;
}

function generateAffiliateLink(
  provider: string,
  originalUrl: string,
  metadata: BookingMetadata
): AffiliateLink {
  // Wrap with affiliate tracking parameters
  // Example: https://www.booking.com/hotel/...?aid=YOUR_AFFILIATE_ID
  
  // Store in DB for conversion tracking
  // Return trackable link
}
```

**Database Schema Addition:**
```sql
CREATE TABLE affiliate_clicks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  trip_id INTEGER NOT NULL,
  provider TEXT NOT NULL,         -- 'booking_com', 'kiwi', 'getyourguide'
  booking_type TEXT NOT NULL,     -- 'hotel', 'flight', 'activity'
  booking_id TEXT NOT NULL,       -- External booking ID
  affiliate_url TEXT NOT NULL,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN DEFAULT 0,
  conversion_amount DECIMAL(10,2),
  conversion_currency TEXT,
  converted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id)
);
```

### 4.6 MCP Integration

TREK already has MCP server implementation. Wndrly inherits these tools:

**Available MCP Tools (from TREK):**
- `create_place` → Add place to itinerary
- `update_place` → Modify place details
- `delete_place` → Remove place
- `create_day` → Add day to trip
- `update_budget` → Modify budget categories
- `list_places` → Get all places in trip
- `get_trip` → Get trip summary

**AI Service will:**
1. Parse user intent ("Add this hotel to Day 2")
2. Call appropriate MCP tool via internal API
3. Broadcast change via WebSocket (existing TREK functionality)
4. Confirm action to user ("Added Travelodge Myeongdong to Day 2")

---

## 5. Revenue Model

### Commission Structure (Estimates):
- **Hotels:** 4-6% commission per booking
  - Average booking: $200/night × 3 nights = $600
  - Commission: $24-36 per booking
  
- **Flights:** $5-15 per booking (flat fee)
  - International: ~$10-15
  - Domestic: ~$5-10
  
- **Activities:** 8-12% commission
  - Average activity: $80
  - Commission: $6.40-9.60 per booking

### Projected Revenue (Conservative):
Assumptions:
- 100 active users/month
- 30% use AI assistant
- 10% booking conversion rate
- Average 1 hotel + 1 flight + 2 activities per trip

**Monthly Revenue:**
- Hotels: 30 users × 10% × $30 commission = $90
- Flights: 30 users × 10% × $12 commission = $36
- Activities: 30 users × 10% × 2 bookings × $8 commission = $48
- **Total: ~$174/month**

**At Scale (1,000 users):**
- **~$1,740/month** or **~$21K/year**

### Premium Tier (Optional Future):
- Free: 10 AI messages/day
- Premium ($7/mo): Unlimited AI, priority support, early access
- Target: 10% conversion → $700/mo at 1,000 users

---

## 6. Implementation Phases

### Phase 1: MVP (2 weeks)
**Goal:** Proof of concept with one booking API

**Deliverables:**
- [ ] Chat UI component (right sidebar)
- [ ] AI service (OpenAI integration)
- [ ] One booking API (Booking.com hotels only)
- [ ] Basic affiliate link tracking
- [ ] MCP integration (add place to trip)
- [ ] Mobile-responsive design

**Success Criteria:**
- User can ask "Find hotels in Seoul"
- AI returns 3-5 results with prices
- User can click affiliate link (tracked)
- User can add hotel to trip (appears in itinerary)

### Phase 2: Multi-Provider (1 week)
**Deliverables:**
- [ ] Flight API integration (Kiwi.com)
- [ ] Activity API integration (GetYourGuide)
- [ ] Improved AI prompts (better results)
- [ ] Conversation history (context retention)

### Phase 3: Revenue & Analytics (1 week)
**Deliverables:**
- [ ] Conversion tracking (click → booking)
- [ ] Admin dashboard (revenue metrics)
- [ ] A/B testing framework (test AI prompts)
- [ ] Email notifications (booking confirmations)

### Phase 4: Advanced Features (2 weeks)
**Deliverables:**
- [ ] Multi-language support (match TREK's 15 languages)
- [ ] Voice input (Web Speech API)
- [ ] Smart recommendations (based on trip context)
- [ ] Rate limiting & abuse prevention
- [ ] Premium tier (unlimited AI)

---

## 7. Open Questions & Decisions Needed

### 7.1 UI/UX Decisions
- **Q:** Should AI pane be persistent (always visible) or toggle?
  - **Option A:** Always visible on desktop (split-pane layout)
  - **Option B:** Toggle button (replaces "Places to Add" pane)
  - **Recommendation:** Option B (less cluttered, mobile-friendly)

- **Q:** Where should conversation history live?
  - **Option A:** Per-trip (separate conversation per trip)
  - **Option B:** Global (one conversation across all trips)
  - **Recommendation:** Option A (trip context matters)

### 7.2 Technical Decisions
- **Q:** Which AI provider?
  - **Option A:** OpenAI GPT-4 Turbo ($0.01/1K tokens)
  - **Option B:** Anthropic Claude 3.5 Sonnet ($0.003/1K tokens)
  - **Option C:** Both (fallback strategy)
  - **Recommendation:** Start with OpenAI (better function calling), add Anthropic fallback

- **Q:** How to handle API rate limits?
  - **Option A:** User-based limits (10 searches/day)
  - **Option B:** Premium tier (unlimited)
  - **Option C:** Pay-per-use (credits system)
  - **Recommendation:** Option A for MVP, Option B later

- **Q:** Where to store conversation history?
  - **Option A:** SQLite (same DB as trip data)
  - **Option B:** Redis (faster, ephemeral)
  - **Option C:** Don't store (stateless)
  - **Recommendation:** Option A (persistence matters for context)

### 7.3 Business Decisions
- **Q:** Affiliate program signup priority?
  - **Recommended order:**
    1. Booking.com (hotels) — largest inventory
    2. Kiwi.com (flights) — easiest API
    3. GetYourGuide (activities) — good commission
  - **Timeline:** All three by end of Phase 2

- **Q:** Premium tier pricing?
  - **Option A:** $5/mo (100 AI messages/day)
  - **Option B:** $10/mo (unlimited AI + early access)
  - **Option C:** Usage-based ($0.10/search)
  - **Recommendation:** Decide after Phase 1 metrics

- **Q:** Revenue split if we hire contractors?
  - **Current:** You own 100% (self-funded)
  - **Future:** Define equity/revenue share if team grows

### 7.4 Legal/Compliance
- **Q:** Do we need affiliate disclosure?
  - **Answer:** YES (legally required in most countries)
  - **Solution:** Add "We may earn commissions from bookings" disclaimer in footer + AI messages

- **Q:** GDPR compliance for EU users?
  - **Required:** Cookie consent, data export, right to deletion
  - **Solution:** Inherit TREK's existing user data handling + add affiliate click tracking to data export

---

## 8. Success Metrics

### Phase 1 (MVP) Metrics:
- **Engagement:**
  - % of users who open AI assistant
  - Average messages per conversation
  - % of conversations with booking search
  
- **Conversion:**
  - Click-through rate (AI result → affiliate link)
  - Booking conversion rate (click → confirmed booking)
  
- **Technical:**
  - AI response time (<2s)
  - API error rate (<1%)
  - MCP action success rate (>95%)

### Long-term Metrics:
- **Revenue:** Monthly affiliate commissions
- **User growth:** MAU with AI assistant enabled
- **Retention:** % of users who return to AI assistant
- **NPS:** User satisfaction with AI recommendations

---

## 9. Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Booking API rate limits** | High | Medium | Implement caching + user limits |
| **Low booking conversion** | High | Medium | A/B test prompts, improve UX |
| **AI costs exceed revenue** | Medium | Low | Set per-user limits, add premium tier |
| **Affiliate program rejection** | High | Low | Have backup providers ready |
| **Legal issues (disclosure)** | Medium | Low | Add clear disclaimers |
| **Upstream TREK updates break fork** | Medium | High | Automate merge testing |

---

## 10. Appendix

### A. Example Conversations

**Scenario 1: Hotel Search**
```
User: Find hotels near Shibuya Station under $120/night for Aug 28-30

AI: I found 5 hotels near Shibuya Station for Aug 28-30:

[Hotel Card 1]
📍 Hotel Sunroute Plaza Shinjuku
⭐ 4.2/5 (1,240 reviews)
💵 $98/night
📏 0.3km from Shibuya Station
[View Details] [Add to Trip]

[Hotel Card 2]
📍 Shibuya Excel Hotel Tokyu
⭐ 4.5/5 (890 reviews)
💵 $115/night
📏 0.1km from Shibuya Station
[View Details] [Add to Trip]

[3 more cards...]

Would you like me to add any of these to your itinerary?

User: Add Hotel Sunroute to Day 3

AI: ✅ Added Hotel Sunroute Plaza Shinjuku to Day 3 (Aug 30).
Your accommodation for that night is now set!
```

**Scenario 2: Flight Search**
```
User: Cheapest flights from Toronto to Seoul in late August

AI: I found 3 flight options for Toronto (YYZ) → Seoul (ICN):

✈️ Air Canada (1 stop, Vancouver)
📅 Aug 28 - Sep 20
💵 $1,240 CAD
⏱️ 16h 30m
[View Flight] [Add to Budget]

✈️ Korean Air (Direct)
📅 Aug 28 - Sep 20
💵 $1,580 CAD
⏱️ 13h 15m
[View Flight] [Add to Budget]

[1 more option...]

The Korean Air direct flight saves 3 hours. Which one interests you?
```

**Scenario 3: Trip Modification**
```
User: Move Myeong-dong shopping to Day 2 and add $100 to food budget

AI: Done! I've made two changes:
1. ✅ Moved "Myeong-dong Shopping" from Day 1 to Day 2
2. ✅ Increased Food budget by $100 (now $450 total)

Your Day 2 now has 3 activities. Want me to suggest lunch spots nearby?
```

### B. Database Schema

```sql
-- New tables for AI assistant

CREATE TABLE ai_conversations (
  id INTEGER PRIMARY KEY,
  trip_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME,
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE ai_messages (
  id INTEGER PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,              -- 'user' or 'assistant'
  content TEXT NOT NULL,
  metadata TEXT,                   -- JSON: booking results, MCP actions, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id)
);

CREATE TABLE affiliate_clicks (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  trip_id INTEGER NOT NULL,
  conversation_id INTEGER,
  provider TEXT NOT NULL,
  booking_type TEXT NOT NULL,
  booking_id TEXT NOT NULL,
  affiliate_url TEXT NOT NULL,
  clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  converted BOOLEAN DEFAULT 0,
  conversion_amount DECIMAL(10,2),
  conversion_currency TEXT,
  converted_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (trip_id) REFERENCES trips(id),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id)
);

CREATE INDEX idx_affiliate_clicks_user ON affiliate_clicks(user_id);
CREATE INDEX idx_affiliate_clicks_trip ON affiliate_clicks(trip_id);
CREATE INDEX idx_affiliate_clicks_converted ON affiliate_clicks(converted);
```

---

## Comments & Feedback

**Instructions for Review:**
1. Add inline comments using GitHub's comment feature
2. Tag sections that need clarification with `<!-- QUESTION: ... -->`
3. Suggest alternatives with `<!-- ALTERNATIVE: ... -->`
4. Approve sections with `<!-- LGTM -->`

**Key areas for feedback:**
- [ ] Section 3: User Stories — Are these the right priorities?
- [ ] Section 4.3: AI Service — System prompt too long/short?
- [ ] Section 5: Revenue Model — Projections realistic?
- [ ] Section 6: Implementation Phases — Timeline feasible?
- [ ] Section 7: Open Questions — Which decisions need your input first?

---

**Next Steps After Approval:**
1. Set up affiliate program accounts
2. Prototype chat UI (Phase 1 Week 1)
3. Integrate first booking API (Phase 1 Week 2)
4. Test with your Asia trip as demo case
