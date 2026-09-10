# STAGE 1: PRD (Product Requirements Document)
## WhatsApp Bot for Diagnostics Call Centre Overload Mitigation

**Document Type:** Product Requirements Document (PRD)
**Project:** DiagnoBot WhatsApp Assistant
**Version:** 1.0
**Status:** Ready for Technical Specification Phase
**Date:** September 2026  

---

## 1.1 PRODUCT VISION

**Product Name:** DiagnoBot WhatsApp Assistant

**Mission Statement:**  
Reduce routine call-centre inquiries by 2540% by providing secure, instant self-service access to report status, centre timings, and pricing information via WhatsApp, enabling patients to get answers 24/7 without waiting for call-centre availability.

**Problem Being Solved:**
- Current call centre processes ~900 calls/day
- Estimated 65% (585 calls) are routine enquiries (report status, pricing, timings)
- These routine calls create bottlenecks, delaying responses to complex clinical questions
- Patients frustrate easily due to long wait times during peak hours (8-10am, 6-8pm)

**Success Vision:**
- Routine call volume reduced by 2540% within 90 days
- Zero PHI/privacy incidents
- Patient satisfaction 4.0/5.0
- Call-centre staff freed to focus on higher-value interactions

---

## 1.2 PRODUCT GOALS & OKRs

### Objective 1: Reduce Call Centre Load
| Goal | Target Metric | Owner | Timeline |
|------|---------------|-------|----------|
| Decrease routine calls by 2540% | -235 calls/day minimum | Call Centre Director | 90 days |
| Shift inquiries to self-service | 300 bot interactions/day (week 8) | Product Lead | Week 8 |

### Objective 2: Ensure Patient Safety & Compliance
| Goal | Target Metric | Owner | Timeline |
|------|---------------|-------|----------|
| Maintain zero privacy incidents | 0 PHI breaches | Compliance Officer | Ongoing |
| Achieve 100% HIPAA compliance | Compliance audit pass | Compliance Officer | Pre-launch |

### Objective 3: Deliver Excellent Patient Experience
| Goal | Target Metric | Owner | Timeline |
|------|---------------|-------|----------|
| High patient satisfaction | 4.0/5.0 NPS | Patient Relations | 90 days |
| High task completion rate | 70% completion (not abandoned) | Product Lead | Week 8 |

### Objective 4: Enable Seamless Escalation
| Goal | Target Metric | Owner | Timeline |
|------|---------------|-------|----------|
| Quick human handoff | 20% escalation rate | Tech Lead | Week 8 |
| Zero escalation friction | <2 min wait for agent | Call Centre Director | Ongoing |

---

## 1.3 TARGET USERS & PERSONAS

### Primary User Group: Patients
**Demographics:**
- Age: 1875 years old
- Tech comfort: Low to High (diverse)
- Device: Primarily smartphone (WhatsApp-native)
- Time availability: Prefer off-peak hours (avoid calling during work)

---

### Persona 1: Busy Professional (Archetype)
**Name:** Rajesh, 38, Software Engineer

**Background:**
- Works 9-6 Monday through Friday
- Married, 2 kids; takes family health seriously
- Tech-savvy, WhatsApp power user
- Limited time during work hours

**Needs:**
- Quick answer to "Is my report ready?"
- Doesn't want to call during work
- Values instant gratification
- Won't tolerate waiting in queue

**Pain Points:**
- Can't call during work (manager/meetings)
- Calling after hours misses call-centre operating hours
- Takes 5-10 min per call; multiplied by family members

**Use Case:**
"I booked a test yesterday. Let me check if my report is ready... *sends WhatsApp message* ...great, it's ready! I can download during my lunch break."

---

### Persona 2: Elderly Patient (Archetype)
**Name:** Lakshmi, 72, Retired Teacher

**Background:**
- Retired; lives with adult children
- Moderate tech comfort; uses WhatsApp to chat with family
- Has multiple health tests (diabetes, cholesterol, thyroid)
- Prefers voice/conversation over text

**Needs:**
- Clear, simple language
- Doesn't want to feel "dumb" about technology
- Appreciates human touch
- Wants reassurance about privacy

**Pain Points:**
- Types slowly; frustrated by repetitive prompts
- Worried about sharing personal info on "the internet"
- Escalates easily if bot doesn't understand
- Has multiple test results to track

**Use Case:**
"I'll ask the bot where to go for my appointment... but if it's confusing, I'd rather call."

---

### Persona 3: Health-Conscious Parent (Archetype)
**Name:** Priya, 42, Marketing Manager

**Background:**
- Frequent test-taker (wellness checks, prevention)
- Books tests for self + kids + elderly parents
- Digitally native; uses WhatsApp for work
- Compares health providers and shares recommendations

**Needs:**
- Quick pricing comparison
- Test history for multiple family members
- Wellness packages and preventive health
- Ability to share results with family

**Pain Points:**
- Calling for each family member's results is tedious
- Wants to see all results in one place
- Compares pricing with other centres
- Values transparency and recommendations

**Use Case:**
"I need to check results for myself, my daughter, and my mom... let me ask the bot for all three."

---

## 1.4 SCOPE DEFINITION

### IN SCOPE (Phase 1  MVP)
 Report status queries (secure, identity-verified)
 Centre timings and location information
 Test pricing and health package details
 Human escalation for complex cases
 Audit logging and compliance reporting
 OTP-based patient authentication
 WhatsApp as primary channel

### OUT OF SCOPE (Phase 2+)
 Full diagnostic report delivery (PDF/images with results)
 Clinical interpretation or medical advice
 Appointment booking (without human confirmation)
 Payment processing (PCI-DSS complexity)
 Complaint resolution or refunds
 Multi-language support (Phase 2 expansion)
 Email or SMS channel (WhatsApp only for Phase 1)

**Rationale:**
Excluding these features minimizes compliance risk, allows faster launch, and lets us validate core hypothesis (do patients use WhatsApp for self-service?) before expanding.

---

## 1.5 KEY FEATURES (MVP FEATURE LIST)

### Feature 1: Identity Verification Flow
**Purpose:** Ensure only authorized patients access their confidential results.

**Functional Requirements:**
- Accept registration number (REG-XXXXXX format)
- Request date of birth for secondary verification
- Generate and send 6-digit OTP via WhatsApp
- Validate OTP (max 3 attempts, 5-min window)
- Create secure session (valid 30 minutes, no re-auth needed within window)

**Why:** Two-factor verification (registration + DOB + OTP) balances security with user experience.

---

### Feature 2: Report Status Service
**Purpose:** Allow patients to check report readiness without calling.

**Functional Requirements:**
- Query Lab Information System (LIS) in real-time
- Display status: "Ready for download", "Processing (Est. 24h)", "Delayed"
- Show sample collection date, report generation date
- Provide time-limited download link (1-hour expiry) if report ready
- Show multiple reports if patient has multiple pending tests

**Why:** This is the #1 call reason (~35% of volume). Real-time query eliminates uncertainty.

---

### Feature 3: Centre Information Service
**Purpose:** Help patients find centre location, hours, parking without calling.

**Functional Requirements:**
- Display 6 centre directory (name, address, phone, hours)
- Show operating hours (Mon-Fri, Sat, Sun, holidays)
- Provide parking information
- Show Google Maps integration for directions
- Support quick-reply navigation between centres

**Why:** This is the #2 call reason (~15% of volume). Static info doesn't change daily; cacheable.

---

### Feature 4: Pricing Information Service
**Purpose:** Enable patients to self-serve pricing without talking to sales team.

**Functional Requirements:**
- Display individual test pricing
- Show test panels and health packages
- Highlight promotional pricing (seasonal discounts)
- Show turnaround time and report validity
- Provide "Ready to book" call-to-action

**Why:** This is the #3 call reason (~15% of volume). Transparent pricing builds trust.

---

### Feature 5: Conversation Management
**Purpose:** Provide natural, context-aware dialogue experience.

**Functional Requirements:**
- Support multi-turn conversation (remember context)
- Offer quick-reply button navigation
- Maintain session state (patient doesn't re-authenticate within 30 min)
- Support fallback to human agent
- Graceful session timeout with warning

**Why:** Better UX than stateless exchanges; reduces cognitive load.

---

### Feature 6: Monitoring & Analytics
**Purpose:** Track success metrics and iterate based on data.

**Functional Requirements:**
- Daily interaction volume tracking
- Completion vs. abandonment rates
- Escalation reasons and patterns
- Patient satisfaction (post-interaction NPS survey)
- System performance (response time, uptime)
- Real-time alerts for errors/breaches

**Why:** Data-driven decisions; identify bottlenecks; measure ROI.

---

## 1.6 SUCCESS METRICS & KPIs

### Primary Metrics (Go/No-Go Decision Criteria)

| KPI | Baseline | Target (90d) | Measurement Method | Owner |
|-----|----------|--------------|-------------------|-------|
| **Routine call reduction** | 585 calls/day | 350440 calls/day (-25% to -40%) | Call-centre ACD logs | Call Centre Director |
| **Bot daily interactions** | 0 | 300 interactions/day (week 8) | WhatsApp API analytics | Product Lead |
| **Privacy incidents** | 0 | 0 (zero tolerance) | Audit trail review | Compliance Officer |
| **Patient satisfaction** | N/A | 4.0/5.0 (NPS) | Post-interaction survey | Patient Relations |

### Secondary Metrics (Health Indicators)

| KPI | Target | Measurement Method | Owner |
|-----|--------|-------------------|-------|
| **Task completion rate** | 70% (not abandoned) | Bot analytics | Product Lead |
| **Escalation rate** | 20% of interactions | Bot + call-centre logs | Tech Lead |
| **Authentication success (1st try)** | 95% | Bot logs | Tech Lead |
| **Bot uptime** | 99.5% | Infrastructure monitoring | IT Operations |
| **Average response time** | <2 sec (p50), <5 sec (p95) | Application monitoring | Tech Lead |
| **Staff satisfaction with bot** | 80% positive sentiment | Team survey | Call Centre Director |

### Leading Indicators (Early Signals)

| KPI | Target | Measurement | Frequency |
|-----|--------|-------------|-----------|
| **Bot adoption rate** | 50% of pilot cohort tries within 1 week | Unique users | Daily |
| **Feature usage** | Report status (60%), pricing (20%), timings (15%), escalation (5%) | Feature breakdown | Weekly |
| **Escalation patterns** | Top 3 reasons identified and addressable | Escalation logs | Weekly |

---

## 1.7 ASSUMPTIONS & RISKS

### High-Risk Assumptions

**Assumption 1:** Most calls are truly routine (report status, timings, pricing).
- **Risk:** If calls are actually complex, bot won't reduce volume meaningfully.
- **Mitigation:** Conduct 1-week call audit; categorize 50+ calls/day before building.
- **Acceptance Criteria:** 60% of calls are routine enquiries.

**Assumption 2:** Patients will use WhatsApp instead of calling.
- **Risk:** Adoption may be low if UX is poor or trust is low.
- **Mitigation:** Beta test with 5001,000 patients; gather feedback; iterate.
- **Acceptance Criteria:** 50% of pilot cohort tries bot within first month.

**Assumption 3:** Report-status enquiries can be handled securely without clinical liability.
- **Risk:** If authentication fails or data is breached, legal/compliance consequences.
- **Mitigation:** Security audit, penetration testing, Compliance Officer sign-off.
- **Acceptance Criteria:** Zero authentication failures in dry-run; Compliance approval.

### Medium-Risk Assumptions

**Assumption 4:** LIS integration can provide real-time report status.
- **Risk:** API unavailable, slow, or inconsistent.
- **Mitigation:** Meet with IT/LIS team; test API; define fallback.
- **Acceptance Criteria:** API available 99%+ of time; <2 sec latency.

**Assumption 5:** Call-centre staff will support the bot initiative.
- **Risk:** Staff may see bot as job threat; passive/active resistance.
- **Mitigation:** Early engagement, involve in design, communicate value.
- **Acceptance Criteria:** 80% positive sentiment in team survey.

---

## 1.8 CONSTRAINTS & DEPENDENCIES

### Hard Constraints (Cannot be changed)
- **PHI/Privacy Compliance:** HIPAA-compliant; no unencrypted data; audit trails required
- **Timeline:** Must launch before flu season (812 weeks from now)
- **Budget:** Assume moderate investment (~$25k$50k pilot budget)
- **Vendor:** Third-party WhatsApp bot provider must have HIPAA certification

### Soft Constraints (Can be negotiated)
- **Call-centre staffing:** Some staff redeployment possible, but not 100%
- **LIS integration:** Real-time preferred, but batch updates acceptable if necessary
- **Multi-centre:** Phase 1 can start with 12 centres, expand to all 6 in Phase 2

### Dependencies
- **External:** WhatsApp Cloud API (Twilio/Meta), LIS vendor cooperation, Compliance Officer approval
- **Internal:** Call-centre team training, IT infrastructure, database setup

---

## 1.9 OUT-OF-SCOPE: WHY WE'RE NOT DOING X

### Why NOT Appointment Booking (Phase 1)?
- **Complexity:** Requires real-time availability, calendar sync, payment confirmation
- **Liability:** Booking errors lead to no-shows, cancellations, patient frustration
- **Timeline:** Integration would add 4+ weeks to launch
- **Decision:** Defer to Phase 2 (after validating report status demand)

### Why NOT Clinical Interpretation?
- **Liability:** Only qualified physicians can interpret results; bot risks misdiagnosis
- **Regulation:** Medical device classification, approval timelines
- **Decision:** Always escalate clinical questions to agent

### Why NOT Multi-Language?
- **Complexity:** Requires translation, cultural adaptation, testing
- **Timeline:** Would delay Phase 1 launch by 2+ weeks
- **Decision:** Phase 2 expansion (post-launch, based on demand)

---

## 1.10 ROADMAP OVERVIEW

### Phase 1: MVP (Weeks 120, Pre-Flu Season)
**Focus:** Core features, compliance, pilot validation

**Key Deliverables:**
-  Report status query + download
-  Centre info (6 locations)
-  Pricing display
-  OTP authentication
-  Human escalation
-  Audit logging

**Success Criteria:** 25%+ call reduction, zero privacy incidents

---

### Phase 2: Expansion (Months 46)
**Focus:** Appointment booking, SMS reminders, multi-centre optimization

**Potential Features:**
-  Appointment booking (with human confirmation)
-  SMS reminders (results ready, appointment reminder)
-  Multi-centre inventory (real-time test availability)
-  Billing enquiries (payment status, invoices)

---

### Phase 3: Intelligence (Months 612)
**Focus:** Proactive notifications, health recommendations, analytics

**Potential Features:**
-  Proactive notifications (results ready, health reminders)
-  Health triage (basic recommendation engine)
-  Analytics dashboard (call-centre insights, patient trends)

---

## 1.11 STAKEHOLDER SIGN-OFF

| Role | Name | Signature | Date | Approval |
|------|------|-----------|------|----------|
| Chief Medical Officer | [CMO] | _________________ | __/__/__ |  Approved  Pending |
| Compliance Officer | [Compliance] | _________________ | __/__/__ |  Approved  Pending |
| Call Centre Director | [Ops] | _________________ | __/__/__ |  Approved  Pending |
| Chief Information Officer | [IT] | _________________ | __/__/__ |  Approved  Pending |
| Product Lead | [Product] | _________________ | __/__/__ |  Approved  Pending |

---

## 1.12 NEXT STEPS

**Immediate Actions (Week 1):**
1. [ ] Finalize PRD with stakeholder review (this document)
2. [ ] Schedule Steering Committee kickoff
3. [ ] Launch call categorization audit (1-week study)
4. [ ] Begin vendor evaluation (WhatsApp bot platforms)
5. [ ] Assign project leads for each workstream

**Next Phase:** Stage 2  Technical Specification

---

**Document Status:**  READY FOR TECHNICAL SPECIFICATION PHASE  
**Last Updated:** September 2026  
**Owner:** Product Lead  
**Questions?** Contact: [Product Lead Email]
