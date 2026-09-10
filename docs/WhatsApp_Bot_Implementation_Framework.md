# WhatsApp Bot Implementation Framework
## Diagnostics Chain - Call Centre Overload Mitigation

**Document Version:** 1.0  
**Prepared for:** Chief Medical Officer & Leadership  
**Date:** September 2026  
**Timeline:** Pre-Flu Season Deployment  

---

## EXECUTIVE SUMMARY

The diagnostics chain's call centre currently processes approximately **900 calls daily**, with the majority (estimated 60-75%) being routine enquiries for report status, centre timings, and pricing information. This volume creates bottlenecks that delay responses to complex clinical and non-routine requests, reducing patient satisfaction and operational efficiency.

We propose a **phased WhatsApp bot implementation** that provides automated, secure self-service responses to routine enquiries while maintaining human support for clinical questions, exceptions, and patient verification. This approach aims to reduce routine call volume by **25-40%** within 90 days of launch, freeing call-centre capacity for higher-value patient interactions.

The pilot is scoped to minimize compliance risk through strict PHI handling, third-party verification protocols, and continuous monitoring. Success is measured by call volume reduction, adoption metrics, zero privacy incidents, and stakeholder feedback.

---

## PART 1: CURRENT STATE ANALYSIS

### 1.1 The Problem Landscape

**Call Centre Load**
- **Daily call volume:** ~900 calls/day (peak: 8–10am and 6–8pm)
- **Current staffing:** Insufficient to handle volume during peak hours
- **Average call duration:** 3–5 minutes (routine) to 10+ minutes (complex)
- **Outcome:** Long wait times, missed calls, patient frustration

**Call Categorisation (Estimated)**
Based on typical diagnostics operations:

| Category | Estimated % | Minutes/Call | Annual Impact |
|----------|-------------|--------------|---------------|
| Report status enquiries | 35% | 3–4 min | 115k calls/year |
| Centre timings & locations | 15% | 2–3 min | 49k calls/year |
| Pricing & package info | 15% | 3–4 min | 49k calls/year |
| Appointment scheduling | 10% | 4–5 min | 33k calls/year |
| Clinical questions | 12% | 8–12 min | 39k calls/year |
| Billing & payments | 8% | 5–7 min | 26k calls/year |
| Complaints & escalations | 5% | 10–15 min | 16k calls/year |

**Routine Enquiries Subtotal:** ~65% of call volume (585 calls/day) — **addressable by automation**.

### 1.2 Root Causes of Overload

1. **Low Patient Portal Adoption**
   - Patients lack login credentials or forget registration numbers
   - Portal interface unclear or not mobile-optimized
   - No SMS/WhatsApp push notifications for report readiness

2. **No Self-Service Channel**
   - Patients default to calling for basic information
   - No automated report-status availability
   - IVR system absent or poorly configured

3. **Limited Call Analytics**
   - Call reasons not categorised systematically
   - No data on which enquiries occur most frequently
   - Peak-hour patterns unknown in detail

4. **Operational Constraints**
   - Staff turnover in call centre
   - No formal training on enquiry prioritisation
   - Uneven knowledge of centre-specific details across team

### 1.3 Current Patient Journey (Report Status Example)

```
Patient needs report → Searches for call centre number → Dials
   ↓
Waits in queue (avg 4–8 min during peak) → Call answered
   ↓
Provides name, phone, test date (2–3 min) → Agent searches system
   ↓
Verbal confirmation of report status → Call ends
   ↓
Patient hangs up (satisfied but time-intensive)
```

**Pain Points:**
- Long wait times during peak hours
- No out-of-hours self-service
- Patient frustration with repetitive questions
- Call-centre staff time spent on low-value interactions

### 1.4 Regulatory & Compliance Context

**Key Constraints:**
- **PHI Sensitivity:** Patient names, phone numbers, test dates, and results are Protected Health Information (PHI)
- **Data Protection Laws:** Compliance with HIPAA (if US operations), GDPR (if EU), and local data-protection regulations
- **Secure Authentication:** Identity verification required before sharing any report details
- **Audit Trail:** All interactions must be logged and retrievable for compliance audits
- **Third-Party Risk:** WhatsApp and bot vendor must be HIPAA-compliant or operate under Business Associate Agreements (BAAs)

---

## PART 2: PROBLEM STATEMENT (Framed)

### 2.1 Formal Problem Statement

**Situation:**  
The diagnostics chain's call centre receives approximately 900 calls daily, with an estimated 65% (585 calls) being routine enquiries for report status, centre timings, and pricing information. These routine calls consume significant staff time and create wait-time bottlenecks, delaying responses to complex clinical questions and non-routine requests.

**Complication:**  
During flu season and other high-demand periods, call volume increases by 20–30%, exacerbating wait times and reducing service quality. Patients also struggle with low portal adoption due to forgotten credentials, driving further phone dependence.

**Key Question:**  
Can we deliver a secure, compliant self-service channel (WhatsApp bot) that addresses routine enquiries, thereby reducing call volume by 25–40% and freeing staff to focus on higher-value patient interactions?

**Our Hypothesis:**  
We believe that a WhatsApp bot providing automated, identity-verified responses to report status, centre timings, and pricing will shift routine enquiries to self-service, reduce call volume measurably, and maintain patient safety through strict PHI controls and human escalation for exceptions.

**Success Metric:**  
We will know this is working when:
- Routine call volume decreases by **at least 25%** from the measured baseline within 90 days of launch
- **Zero privacy or PHI exposure incidents** occur during the pilot
- Positive adoption rates (measured by bot interaction volume and patient feedback)
- Call-centre team reports improved focus on complex enquiries

**Constraints:**
- Strict PHI/privacy compliance required (no data breaches tolerated)
- No existing call-categorisation data (must collect baseline manually)
- Patient authentication must be reliable and frictionless
- Implementation timeline constrained by flu-season deadline (8–12 weeks)
- Third-party vendor and infrastructure must be compliant-ready

**First Deliverable:**  
A WhatsApp bot prototype capable of securely verifying patient identity and providing report status, centre timings, and pricing information, with human escalation for complex cases.

---

## PART 3: TARGET OUTCOMES & VISION

### 3.1 Phase 1 Outcomes (Pilot: 90 Days)

| Outcome | Target | Owner | Measurement |
|---------|--------|-------|-------------|
| Routine call reduction | 25–40% | Call Centre Supervisor | Daily call-volume tracking |
| Bot adoption | ≥300 interactions/day (by week 8) | Product Lead | WhatsApp API analytics |
| Privacy incidents | Zero | Compliance Officer | Audit log review |
| Patient satisfaction (bot) | ≥4.0/5.0 | Patient Relations | Post-interaction survey |
| Staff feedback | Positive sentiment | Call Centre Supervisor | Team surveys |

### 3.2 Phase 2 Vision (Months 4–6: Expansion)

If Phase 1 succeeds, expand to:
- **Appointment booking** (with human confirmation)
- **SMS reminders** for upcoming tests
- **Multi-centre support** across all 6 centres
- **Billing enquiries** (payment status, invoice requests)
- **Health package recommendations** (basic triage to specialists)

### 3.3 Long-Term Vision (6–12 Months)

- **Integrated patient portal** with WhatsApp as primary entry point
- **Appointment + payment bundling** (book and pay in one flow)
- **Proactive notifications** (results ready, appointment reminders)
- **Feedback loop** on bot performance and escalation patterns
- **Call-centre analytics dashboard** for real-time staffing decisions

---

## PART 4: SCOPE DEFINITION (Thin Slice)

### 4.1 Phase 1 Scope: What We Build

**Core Bot Capabilities:**

1. **Report Status Enquiries**
   - Patient initiates: "Hi, I'd like to check my report status"
   - Bot secures identity (OTP or registration number + DOB verification)
   - Bot queries back-end lab-information system (LIS)
   - Response: "Your blood test report is ready. Download here: [secure link]" or "Processing (Est. ready: 24 hours)"

2. **Centre Timings & Locations**
   - Patient: "What are your operating hours?"
   - Bot: "Select your preferred centre: [6 centre options]"
   - Bot: Provides hours, address, contact, parking info, directions link

3. **Test & Package Pricing**
   - Patient: "How much does a full blood check cost?"
   - Bot: Provides pricing for tests, packages, and health check-ups
   - Bot: "Book now for ₹X discount" or directs to pricing page

4. **Human Escalation**
   - Patient requests clinical advice, appointment, or payment
   - Bot: "This requires a specialist. Connecting you to an agent..."
   - Escalation to call centre with conversation context

### 4.2 Phase 1 Scope: What We Don't Build

**Intentionally Excluded (to minimize risk & complexity):**

- ❌ **Full diagnostic report delivery** via WhatsApp (PDF/images with results)
- ❌ **Clinical interpretation or advice** ("What does this result mean?")
- ❌ **Appointment booking without human confirmation** (liability risk)
- ❌ **Payment processing** (PCI-DSS complexity)
- ❌ **Complaint management or refunds** (require escalation)
- ❌ **Multi-language support** (Phase 2 expansion)
- ❌ **Multi-centre inventory or test availability** (complex LIS integration)

**Rationale:**  
These features increase compliance risk, require deeper LIS/payment-system integration, and involve clinical liability. Excluding them allows us to launch faster, test core demand, and expand only after validation.

---

## PART 5: CONSTRAINTS & GUARDRAILS

### 5.1 Compliance & Data Security Constraints

**PHI Handling**
- Patient identifiable information (name, phone, test dates, results) must not be logged in unsecured systems
- All patient data must be encrypted in transit (TLS 1.2+) and at rest
- WhatsApp and bot vendor must be HIPAA-compliant or sign Business Associate Agreements (BAAs)

**Authentication Requirements**
- Identity verification must use approved methods (OTP + registration number, or OTP + DOB)
- Two-factor verification recommended for result downloads
- No patient data shared without verified identity

**Audit & Logging**
- All bot interactions logged with timestamps, patient ID, and bot response
- Logs retained for minimum 2 years (regulatory requirement)
- Real-time alerts for PHI exposure attempts or system errors

**Vendor Management**
- Third-party WhatsApp bot provider must undergo security audit
- Data hosting must be in-country (regulatory requirement)
- Incident response SLA required (≤4 hours for breaches)

### 5.2 Operational Constraints

**Timeline**
- Launch deadline: 8–12 weeks before flu season (early October 2026)
- Testing window: 2–3 weeks before pilot launch
- Pilot duration: 90 days minimum

**Integration Complexity**
- LIS (Lab Information System) API must provide real-time report status
- Requires IT/LIS team coordination
- No disruption to existing lab workflows

**Call Centre Constraints**
- Existing staff cannot be fully reassigned (hybrid model)
- Human escalation must remain available 24/7 (if current operations 24/7)
- Training window for new bot-aware call centre procedures

**Resource Constraints**
- Budget: Assume moderate (WhatsApp API + bot platform + 1 FTE coordinator)
- Team: 1 Product Lead, 1 Technical Lead, 1 Compliance Officer, 1 Call Centre Champion

### 5.3 Known Unknowns (Risks)

| Risk | Mitigation | Owner |
|------|-----------|-------|
| LIS API not real-time | Scope to manual batch updates if API unavailable | IT Lead |
| Low patient adoption | Test with pilot cohort first; offer WhatsApp promotion at centres | Product Lead |
| Authentication failure rate high | Design OTP fallback; measure abandonment | Tech Lead |
| Compliance approval delays | Engage Compliance Officer early; pre-approve vendor | CMO |
| Staff resistance | Involve call-centre team in design; emphasize value (less tedious work) | Call Centre Supervisor |

---

## PART 6: ASSUMPTIONS & HYPOTHESIS TESTING

### 6.1 Assumptions Ranked by Risk

**Assumption 1 (HIGH RISK):** Most routine calls are truly routine (report status, timings, pricing).

- **Why it matters:** If calls are actually complex or require human judgment, the bot won't reduce volume meaningfully.
- **How to test:**
  - Categorise all calls for 1–2 weeks (sample 50+ calls/day)
  - Identify % of calls per category
  - Compare to our estimated 65% routine calls
- **Success criterion:** ≥60% of calls are routine enquiries (report status, timings, pricing)
- **Owner:** Call Centre Supervisor + Patient Relations

**Assumption 2 (HIGH RISK):** Patients will use WhatsApp instead of calling.

- **Why it matters:** If adoption is low, call reduction won't materialize.
- **How to test:**
  - Launch bot to 500–1000 patients (cohort sampling)
  - Measure week-by-week adoption (new users, daily interactions)
  - Track completion rate (% of enquiries resolved vs. abandoned)
  - Measure escalation rate (% requiring human support)
- **Success criterion:** ≥50% of targeted patients try bot within first month; ≥70% completion rate
- **Owner:** Product Lead + Patient Relations

**Assumption 3 (MEDIUM RISK):** Report-status enquiries can be handled securely without clinical liability.

- **Why it matters:** If authentication fails or data is breached, liability and compliance violations arise.
- **How to test:**
  - Define approved identity-verification method with Compliance Officer and LIS vendor
  - Conduct penetration testing of bot authentication flow
  - Validate that report-status sharing (without interpretation) carries no clinical liability
  - Run dry-run with 20–30 patients
- **Success criterion:** Zero authentication failures in dry-run; Compliance Officer sign-off; zero liability concerns
- **Owner:** Compliance Officer + Tech Lead + Medical-Legal

**Assumption 4 (MEDIUM RISK):** LIS integration can provide real-time report status.

- **Why it matters:** If report status is delayed or unavailable, bot value diminishes.
- **How to test:**
  - Meet with IT/LIS team; review API capabilities
  - Test API latency, uptime, and data accuracy
  - Define fallback (e.g., "Check back in 2 hours" if report not yet processed)
- **Success criterion:** API available 99%+ of time; response latency <2 seconds
- **Owner:** IT Lead + LIS Vendor

**Assumption 5 (LOW RISK):** Call-centre staff will support the bot initiative.

- **Why it matters:** If staff see the bot as a threat, they may resist or undermine it.
- **How to test:**
  - Early engagement: invite call-centre team to design sprint
  - Emphasize: bot handles tedious calls, freeing time for complex cases
  - Involve team in success metrics and feedback loops
- **Success criterion:** ≥80% positive sentiment in team survey; zero passive resistance observed
- **Owner:** Call Centre Supervisor + HR

---

## PART 7: PHASED IMPLEMENTATION ROADMAP

### 7.1 Phase 1: Discovery & Planning (Weeks 1–3)

**Week 1: Stakeholder Alignment & Data Collection**
- [ ] Kickoff meeting: CMO, Compliance, IT, Call Centre Supervisor, Product Lead
- [ ] Begin 1-week call categorisation study (sample 50+ calls/day)
- [ ] Audit current LIS system and API availability
- [ ] Identify approved identity-verification methods with Compliance Officer

**Week 2: Vendor Evaluation & Technical Scoping**
- [ ] Shortlist 2–3 WhatsApp bot vendors (Twilio, Freshchat, custom)
- [ ] Evaluate vendor HIPAA compliance and BAA readiness
- [ ] Define bot architecture: cloud-hosted, on-premise, or hybrid
- [ ] Estimate API integration effort with IT team

**Week 3: Prototype & Proof-of-Concept**
- [ ] Design bot conversation flows (report status, timings, pricing)
- [ ] Wireframe user journeys and escalation paths
- [ ] Review with Compliance Officer for PHI handling
- [ ] Get CMO and call-centre team feedback on design

**Phase 1 Deliverables:**
- Call categorisation report (% routine vs. complex)
- WhatsApp vendor selection & BAA signed
- Bot architecture & data-flow diagram
- Risk assessment matrix (compliance, technical, operational)

---

### 7.2 Phase 2: Development & Testing (Weeks 4–7)

**Week 4: Bot Development**
- [ ] Develop bot conversation flows in chosen platform
- [ ] Integrate LIS API (report-status lookup)
- [ ] Build identity-verification flow (OTP + registration lookup)
- [ ] Implement audit logging and PHI controls

**Week 5: Security & Compliance Testing**
- [ ] Penetration testing (authentication, data encryption)
- [ ] Conduct Compliance audit of bot data handling
- [ ] Review audit logs and escalation procedures
- [ ] Compliance Officer sign-off

**Week 6: Internal Testing**
- [ ] QA testing: happy path and edge cases
- [ ] Load testing: simulate 500+ concurrent users
- [ ] Integration testing with LIS and call-centre systems
- [ ] Test escalation workflow and call-centre handoff

**Week 7: Pilot Cohort Setup**
- [ ] Recruit 500–1,000 pilot patients (from recent test appointments)
- [ ] Create WhatsApp bot link and QR code for easy access
- [ ] Train call-centre team on bot use and escalation procedures
- [ ] Set up analytics dashboard for pilot monitoring

**Phase 2 Deliverables:**
- Functional WhatsApp bot (report status, timings, pricing)
- Compliance audit checklist (100% sign-off)
- Pilot launch playbook and runbook

---

### 7.3 Phase 3: Pilot Launch & Monitoring (Weeks 8–20; 90 days)

**Week 8: Pilot Launch**
- [ ] Soft launch to 500 patients (via email + SMS + WhatsApp channel)
- [ ] Monitor daily: adoption rate, interaction volume, escalation %
- [ ] Daily standup with Product, Tech, and Call Centre leads
- [ ] Early feedback collection (first 100 interactions)

**Weeks 9–12: Active Monitoring & Iteration**
- [ ] Weekly reporting: bot interactions, call reduction %, patient feedback
- [ ] Bug fixes and conversation-flow refinements based on user data
- [ ] A/B test variations (authentication method, message tone)
- [ ] Expand pilot cohort to 1,000 patients (if metrics look good)

**Weeks 13–20: Scale-Up (Full 90 Days)**
- [ ] Roll out to all centres (if pilot metrics meet targets)
- [ ] Train all call-centre staff on bot and escalation
- [ ] Full-scale monitoring and weekly reporting
- [ ] Collect final data for go/no-go decision

**Phase 3 Deliverables:**
- Weekly pilot reports (adoption, call reduction, incident log)
- 90-day impact assessment (call volume reduction, ROI, lessons learned)
- Go/no-go recommendation for Phase 2 expansion

---

### 7.4 Phase 2: Expansion (Months 4–6, if pilot succeeds)

**Potential Expansions (ranked by priority):**

1. **Appointment Booking** (Medium complexity)
   - Patient selects test type and centre
   - Bot checks availability (LIS + booking system)
   - Human confirmation via call/email (liability mitigation)

2. **SMS Reminders** (Low complexity)
   - Automated SMS when report ready
   - Appointment reminder SMS (12, 24, 48 hours before)
   - High-value, low-risk addition

3. **Multi-Centre Inventory** (High complexity)
   - Bot shows real-time test availability across centres
   - Requires inventory-system integration
   - Deferred to Phase 2 based on demand

4. **Billing Enquiries** (Medium complexity)
   - Payment status, invoice requests
   - Requires ERP/billing system integration
   - Human escalation for disputes

---

## PART 8: SUCCESS CRITERIA & GUARDRAILS

### 8.1 Quantitative Success Metrics

| Metric | Baseline | Target (90 days) | Measurement |
|--------|----------|------------------|-------------|
| Daily routine calls | ~585 calls | 350–440 calls (-25% to -40%) | Call-centre ACD logs |
| Bot interactions | 0 | ≥300/day (week 8+) | WhatsApp API analytics |
| Bot completion rate | N/A | ≥70% (not abandoned) | Bot analytics |
| Escalation rate | N/A | ≤20% of interactions | Bot logs + call-centre data |
| Privacy incidents | 0 | 0 (zero tolerance) | Audit log review + incident tracking |
| Patient satisfaction (bot) | N/A | ≥4.0/5.0 | Post-interaction survey (500+ responses) |
| Bot uptime | N/A | ≥99.5% | Infrastructure monitoring |
| Authentication success rate | N/A | ≥95% (first attempt) | Bot logs |
| Staff training completion | N/A | 100% | Training tracker |

### 8.2 Qualitative Success Indicators

- ✅ Call-centre team reports improved job satisfaction (less tedious calls)
- ✅ No patient complaints about bot privacy or data sharing
- ✅ Compliance Officer confirms zero PHI exposure incidents
- ✅ CMO endorses expansion to Phase 2 (appointment booking, etc.)
- ✅ Positive media/word-of-mouth ("Easy to check reports on WhatsApp")

### 8.3 Guardrails (Go/No-Go Criteria)

**We CONTINUE to Phase 2 only if:**
- Routine call volume decreases by ≥25% from baseline
- Privacy incident count = 0
- Bot adoption reaches ≥300 interactions/day by week 8
- Patient satisfaction ≥3.8/5.0
- Compliance Officer gives written approval

**We PAUSE and INVESTIGATE if:**
- Call volume reduction <15% (re-examine targeting or bot UX)
- Any PHI exposure incident occurs (immediate halt; breach audit)
- Escalation rate >40% (bot not equipped for use case)
- Authentication failure rate >10% (friction too high)
- Staff sentiment remains negative (change-management issue)

**We STOP if:**
- Multiple security incidents despite remediation
- Patient satisfaction <3.0/5.0
- Bot adoption stalls at <100 interactions/day after week 4
- Compliance Officer withdraws approval

---

## PART 9: GOVERNANCE & DECISION-MAKING

### 9.1 Steering Committee & Decision Rights

**Steering Committee (meets weekly during pilot):**
- **Chief Medical Officer** (CMO) — Clinical sponsor; go/no-go decision maker
- **Compliance Officer** — PHI/privacy approval; incident response
- **Chief Information Officer (CIO) / IT Lead** — Technical feasibility; LIS integration
- **Call Centre Director** — Operational impact; staff readiness; adoption tracking
- **Patient Relations Lead** — Patient feedback; satisfaction metrics

**Decision Matrix:**

| Decision | Owner | Criteria | Timeline |
|----------|-------|----------|----------|
| Vendor selection | CMO + CIO | HIPAA compliance, cost, integration readiness | Week 2 |
| Bot go-live (pilot) | CMO + Compliance | Security audit complete; Compliance sign-off | Week 8 |
| Scale-up (full rollout) | CMO + Call Centre Director | 25%+ call reduction; zero incidents; adoption >300/day | Week 20 |
| Phase 2 expansion | CMO + CFO | Pilot success metrics met; business case ROI >25% | Month 4 |

### 9.2 Risk Escalation Path

**Low Risk (manage within team):**
- Minor bot conversation bugs
- Single authentication failure (without data breach)
- Staff training delays (<1 week)

**Medium Risk (escalate to steering committee):**
- 5–10% lower-than-expected call reduction
- Minor compliance concern (quickly remediated)
- Adoption slower than expected (modify targeting/promotion)

**High Risk (immediate escalation to CMO):**
- Any PHI exposure incident (halt pilot immediately)
- Compliance Officer requests changes to bot design
- LIS integration failure (cannot access real-time report status)
- Regulatory inquiry or audit notification

---

## PART 10: RESOURCE PLAN & BUDGET OUTLINE

### 10.1 Core Team (Full-Time or Allocated)

| Role | FTE | Responsibility | Timeline |
|------|-----|-----------------|----------|
| Product Lead / Bot Manager | 1.0 | Vision, user research, feature prioritization, stakeholder management | Weeks 1–20 ongoing |
| Technical Lead / Architect | 1.0 | Bot platform setup, LIS integration, security, scalability | Weeks 1–20 |
| Compliance Officer | 0.5 | PHI controls, audit, vendor BAA, risk assessment | Weeks 1–8 (intensive); then ongoing |
| Call Centre Champion | 0.5 | Staff training, escalation workflows, feedback collection | Weeks 6–20 |
| QA / Tester | 0.5 | Bot testing, edge cases, load testing, compliance audits | Weeks 4–8 |
| Data Analyst | 0.3 | Pilot monitoring, metrics, weekly reporting | Weeks 8–20 |

**Total Resource Estimate:** ~4.3 FTE over 20 weeks

### 10.2 Technology Costs (Rough Estimate)

| Component | Est. Cost | Notes |
|-----------|-----------|-------|
| WhatsApp bot platform (3 months) | $5,000–$15,000 | Vendor: Twilio, Freshchat, or custom |
| LIS API integration (dev hours) | $8,000–$15,000 | IT effort + external contractor if needed |
| Security audit / penetration testing | $3,000–$5,000 | Third-party compliance firm |
| Training & change management | $2,000–$3,000 | Materials, sessions, external facilitator |
| Contingency (20%) | $4,000–$8,000 | |
| **Total Pilot Phase (3 months)** | **$22,000–$46,000** | |

**ROI Calculation (illustrative):**
- Current call-centre cost: ~₹50 per call (staff + infrastructure)
- Calls reduced: 585 → 350 = 235 calls/day saved
- Monthly savings: 235 × 25 × 50 = ₹294,000/month
- 90-day payback: ₹294,000 × 3 = ₹882,000 (vs. ₹22k–₹46k pilot cost)
- **Payback period: <4 weeks**

---

## PART 11: CHANGE MANAGEMENT & STAKEHOLDER ENGAGEMENT

### 11.1 Stakeholder Communication Plan

**Patients:**
- In-centre posters and QR codes (weeks 6–8): "Try our new WhatsApp bot for instant report status"
- Email & SMS invitations to pilot cohort (week 8): Personalized link
- FAQ guide on security and authentication
- Feedback survey (weeks 8–20): "How can we improve?"

**Call-Centre Staff:**
- Weeks 1–3: Involve team in design sprint (show they're heard)
- Week 5: Training on bot use, escalation procedures, and new workflows
- Ongoing: Weekly updates on bot metrics and staff feedback loop
- Messaging: "The bot handles repetitive calls, so you focus on complex cases and better patient care"

**Medical & Clinical Staff:**
- CMO briefing (week 1): Strategic rationale, compliance safeguards, expected outcomes
- Compliance Officer detailed security walkthrough (weeks 2–4)
- Clinical-liability review (week 3): Confirm report sharing carries no clinical risk
- Physicians: "The bot reduces administrative calls, freeing patient-care time"

**IT & LIS Team:**
- IT lead integration kickoff (week 2): Define API requirements, timelines, testing
- Weekly syncs on integration progress (weeks 4–7)
- LIS vendor involvement: data security, uptime SLAs, support model

### 11.2 Resistance Management

**Potential Resistance: Call-centre staff fear job loss**
- **Response:** Frame bot as tool, not replacement. Show data: bot handles 25–40% of calls; many still require humans (clinical, complaints, escalations). Offer upskilling (e.g., training in technical support, customer retention).

**Potential Resistance: Compliance Officer concerns about PHI risk**
- **Response:** Engage early; involve in every design decision. Show security controls, audit trails, vendor certifications. Offer Phase 1 scope: no full report delivery, just status queries. Assign Compliance Officer approval gate for go-live.

**Potential Resistance: Patients reluctant to share data via WhatsApp**
- **Response:** Emphasize security (encryption, OTP, no data storage). Offer opt-out (continue using phone). Gather feedback and iterate on messaging.

---

## PART 12: OPEN QUESTIONS & NEXT STEPS

### 12.1 Critical Questions Requiring Immediate Answers

| Question | Owner | Priority | Timeline |
|----------|-------|----------|----------|
| What % of current calls are routine enquiries (report status, timings, pricing)? | Call Centre Supervisor | CRITICAL | Week 1 (1-week call audit) |
| Which identity-verification method is compliant-approved for report-status queries? | Compliance Officer | CRITICAL | Week 2 |
| Can the LIS API provide real-time report status with <2-sec latency? | IT Lead | CRITICAL | Week 2 |
| What is the target flu-season go-live date (to set firm deadline)? | CMO | CRITICAL | Week 1 |
| Do we have budget authority for $25k–$50k pilot investment? | CFO / CMO | HIGH | Week 1 |
| Which WhatsApp bot vendor has strongest HIPAA compliance track record? | CIO | HIGH | Week 2 |
| What is current call-centre staffing, and can we redeploy freed capacity? | Call Centre Director | HIGH | Week 1 |
| Are there regulatory (HIPAA, DPA) approval gates required before launch? | Compliance Officer | MEDIUM | Week 2 |

### 12.2 Immediate Next Steps (Week 1)

1. **Schedule Kickoff Meeting** (CMO, Compliance, IT, Call Centre Supervisor, Product Lead)
   - Confirm timeline, budget, and success metrics
   - Assign action owners and steering committee roles

2. **Launch Call Categorisation Study**
   - Sample 50+ calls/day for 1 week
   - Categorise each call (report status, pricing, timings, etc.)
   - Produce summary report by end of week 2

3. **Identify Compliance Requirements**
   - Compile list of PHI handling rules (HIPAA, local DPA, internal policy)
   - Clarify approved identity-verification methods
   - Outline audit and incident-response procedures

4. **IT Assessment: LIS Integration**
   - Meet with IT/LIS team
   - Review API capabilities and timelines
   - Confirm data-security requirements (encryption, access controls)

5. **Procurement Prep**
   - Finance: confirm $25k–$50k budget availability
   - Legal: prepare BAA template for vendor signature
   - Vendor RFQ: shortlist 2–3 WhatsApp platforms (Twilio, Freshchat, custom)

---

## PART 13: APPENDICES

### Appendix A: Regulatory Compliance Checklist

**Data Security:**
- [ ] WhatsApp bot vendor is HIPAA-compliant (or signs BAA)
- [ ] Data in transit encrypted (TLS 1.2+)
- [ ] Data at rest encrypted (AES-256)
- [ ] No patient data logged in unsecured systems
- [ ] Audit logs retained for 2+ years

**Patient Privacy:**
- [ ] Identity verification required before any data sharing
- [ ] Patient consent obtained (opt-in WhatsApp channel)
- [ ] Clear privacy policy (what data is collected, how it's used)
- [ ] Patient right to delete personal data (GDPR compliance)
- [ ] Data minimization (collect only essential info)

**Incident Response:**
- [ ] Breach notification procedure documented
- [ ] Incident response SLA: ≤4 hours for HIPAA breaches
- [ ] Real-time alerts configured for PHI exposure
- [ ] Designated Compliance Officer for incident oversight

### Appendix B: Bot Conversation Flow Examples

**Example 1: Report Status Enquiry**
```
Patient: "Hi, I'd like to check my report status"
Bot: "Hi! I'm here to help. To check your report status, I'll need to verify your identity.
     Please provide your registration number (from your test appointment confirmation)."
Patient: "My registration number is REG123456"
Bot: "Thank you. Now, please provide your date of birth (DD-MM-YYYY) for verification."
Patient: "01-05-1985"
Bot: "Great! One last step. We'll send you a one-time password (OTP) to +91-XXXXXX789.
     Please confirm and you'll receive the OTP."
Patient: "Confirm"
Bot: [OTP sent to WhatsApp]
Patient: "123456"
Bot: "Perfect! Your identity is verified.
     Blood test (12-test panel): READY FOR DOWNLOAD
     Sample collection date: 10-Sep-2026
     Report generated: 12-Sep-2026, 2:30 PM
     Download link: [secure link]
     Questions? Reply or tap 'Speak to Agent' below."
Patient: "Thanks!"
Bot: "You're welcome! Need anything else? (a) Check another report (b) Centre timings (c) Pricing (d) Speak to agent"
```

**Example 2: Centre Timings & Locations**
```
Patient: "What are your operating hours?"
Bot: "Which centre would you like to visit?"
     [6 centre options displayed as quick-reply buttons]
Patient: [Taps "Bangalore - MG Road"]
Bot: "Bangalore - MG Road
     📍 Address: 123 MG Road, Bangalore 560001
     ⏰ Timings: Mon-Sat 7:00 AM - 8:00 PM | Sun 8:00 AM - 2:00 PM
     📞 Phone: +91-80-XXXX-XXXX
     🅿️ Parking: Free (underground, 50 spots)
     🔗 Directions: [Google Maps link]
     Need anything else? (a) Check timings at other centres (b) Pricing (c) Speak to agent"
```

**Example 3: Pricing Enquiry**
```
Patient: "How much does a full blood test cost?"
Bot: "We offer several options:
     • Basic Health Check: ₹1,500 (10 tests)
     • Standard Blood Panel: ₹2,500 (25 tests)
     • Comprehensive Health Check: ₹4,500 (50 tests + imaging)
     • Diabetes Screening: ₹800 (fasting glucose + HbA1c)
     Which would you like to know more about? (Tap to select)"
Patient: [Taps "Comprehensive Health Check"]
Bot: "Comprehensive Health Check - ₹4,500
     Includes: 50 blood tests + imaging (chest X-ray, ultrasound abdomen)
     Results ready: 48 hours
     Report: Digital + printable
     Valid for: 2 years
     Ready to book? (a) Book appointment (b) Check other packages (c) Speak to agent"
```

**Example 4: Escalation to Human Agent**
```
Patient: "I have a clinical question about my results"
Bot: "This requires a specialist to discuss. Let me connect you with an agent.
     [Escalating to call centre...]
     An agent will be with you shortly. Average wait time: 3 minutes.
     You can also:
     • Call our centre directly: +91-80-XXXX-XXXX
     • Email: reports@diagnosticschain.com
     Waiting for agent..."
[Agent picks up; bot context shared (patient ID, conversation summary)]
Agent: "Hi! I see you have a question about your blood work. How can I help?"
```

### Appendix C: Sample Pilot Metrics Dashboard

**Real-Time Metrics (Updated hourly):**
```
┌─────────────────────────────────────────┐
│ WhatsApp Bot - Pilot Dashboard (Day 12) │
├─────────────────────────────────────────┤
│ Total Interactions: 3,847                │
│ Daily Avg (Week 1-2): 215 interactions  │
│ Adoption Target (Week 8): 300/day       │
│ Status: ON TRACK (71% of target)        │
├─────────────────────────────────────────┤
│ Completion Rate: 74% ✓                  │
│ Abandonment Rate: 12%                   │
│ Escalation Rate: 14% ✓                  │
├─────────────────────────────────────────┤
│ Authentication Success (1st try): 96% ✓ │
│ Avg Response Time: 1.2 sec ✓            │
│ Bot Uptime: 99.8% ✓                     │
├─────────────────────────────────────────┤
│ CALL CENTRE IMPACT:                     │
│ Daily calls (Week 1): 585 calls         │
│ Daily calls (Week 2): 520 calls         │
│ Reduction: 11% (early signal)           │
│ Target: 25% by Week 12 ▶                │
├─────────────────────────────────────────┤
│ Patient Satisfaction (50 surveys): 4.3/5│
│ Staff Sentiment: Positive (85%)         │
│ Privacy Incidents: 0 ✓                  │
└─────────────────────────────────────────┘
```

### Appendix D: Compliance Audit Checklist (Pre-Launch)

- [ ] **Vendor HIPAA Compliance**
  - Vendor provides HIPAA compliance documentation
  - Business Associate Agreement (BAA) signed
  - Data processor agreement in place
  - Incident response SLA: ≤4 hours

- [ ] **Data Security**
  - Encryption in transit (TLS 1.2+)
  - Encryption at rest (AES-256)
  - Access controls (role-based, audit logging)
  - No unencrypted PHI in logs
  - Data retention policy (2+ years for audit, then delete)

- [ ] **Authentication & Authorization**
  - Two-factor verification (OTP + registration lookup)
  - Patient consent documented (WhatsApp opt-in)
  - No data sharing without verified identity

- [ ] **Audit & Incident Response**
  - Audit logs capture: timestamp, user ID, action, result
  - Real-time alerts for PHI exposure attempts
  - Incident response procedure documented
  - Breach notification timeline (24–72 hours)

- [ ] **Testing & Sign-Off**
  - Penetration testing completed (no vulnerabilities)
  - Compliance Officer security review complete
  - Medical-Legal review (clinical liability assessment)
  - Formal approval to launch (signed by CMO + Compliance Officer)

---

## CONCLUSION

This WhatsApp bot pilot offers a low-risk, high-impact opportunity to address the diagnostics chain's call-centre overload. By automating 25–40% of routine enquiries (report status, centre timings, pricing), we can improve patient experience, reduce staff burnout, and maintain clinical focus.

The phased approach minimizes compliance risk: Phase 1 focuses on identity-verified report-status queries only, with strict PHI controls and human escalation for exceptions. Phase 2 expands to appointment booking and billing—only after Phase 1 proves successful and compliant.

**Success hinges on:**
1. ✅ Early validation that 60%+ of calls are routine (call categorisation audit)
2. ✅ Strict compliance governance (Compliance Officer at every gate)
3. ✅ Strong patient and staff adoption (clear communication and training)
4. ✅ Rapid feedback loops (weekly reporting and iteration)

**Timeline:** 8–12 weeks to launch before flu season. **Investment:** ~$25k–$50k for pilot (3-month payback). **Expected Outcome:** 25–40% reduction in routine calls, zero privacy incidents, and a blueprint for scaling to all 6 centres and future capabilities.

---

**Document Prepared By:** [Your Name]  
**Approved By:** _____________________ (CMO)  
**Compliance Sign-Off:** _____________________ (Compliance Officer)  
**Date:** September 2026

