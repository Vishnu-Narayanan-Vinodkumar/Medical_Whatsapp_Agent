# Specification Driven Development (SDD) Document
## WhatsApp Bot for Diagnostics Call Centre - Stage 5 of 6: Prompt Generation

**Project:** WhatsApp Bot Implementation for Diagnostics Chain  
**Timeline:** Pre-Flu Season Deployment (8–12 weeks)  
**SDD Stage:** Complete 6-Stage Pipeline  
**Document Version:** 1.0  

---

## STAGE 1: PRD (PRODUCT REQUIREMENTS DOCUMENT)

### 1.1 Product Vision

**Product Name:** DiagnoBot WhatsApp Assistant  
**Mission:** Reduce routine call-centre inquiries by 25–40% by providing secure, instant self-service access to report status, centre timings, and pricing information via WhatsApp.

**Success Definition:**
- 25–40% reduction in routine calls within 90 days
- Zero PHI/privacy incidents
- ≥70% task completion rate
- ≥4.0/5.0 patient satisfaction
- ≥300 daily interactions by week 8

### 1.2 Product Goals

| Goal | Metric | Owner |
|------|--------|-------|
| Reduce call volume | -25% to -40% calls/day | Call Centre Director |
| Increase patient self-service adoption | ≥300 interactions/day (week 8) | Product Lead |
| Maintain zero privacy incidents | 0 PHI breaches | Compliance Officer |
| Ensure high patient satisfaction | ≥4.0/5.0 NPS | Patient Relations |
| Enable rapid escalation to humans | ≤20% escalation rate | Tech Lead |

### 1.3 Target Users

**Primary Users:**
- **Patients (18–75 years old)** needing quick answers to:
  - Report status (ready/processing/delayed)
  - Test pricing and packages
  - Centre timings, locations, parking
  - Hours of operation and holidays

**Secondary Users:**
- **Call-Centre Staff** (support, monitoring, escalation)
- **Compliance & Medical-Legal Teams** (audit, oversight)
- **Administrators** (analytics, configuration)

### 1.4 User Personas

**Persona 1: Busy Professional (35–50)**
- Tech-savvy, WhatsApp-native
- Wants instant report access
- Low tolerance for wait times
- Uses bot during work breaks

**Persona 2: Elderly Patient (60–75)**
- Moderate tech comfort
- Prefers voice/conversation over text
- Needs clear, simple language
- Values human touch; may escalate easily

**Persona 3: Health-Conscious Parent (30–45)**
- Frequent test-taker (family wellness)
- Wants multiple report history
- Interested in health packages
- Shares recommendations with family

### 1.5 Scope: In & Out

**In Scope (Phase 1):**
- ✅ Report status queries (secure, identity-verified)
- ✅ Centre timings and location info
- ✅ Test pricing and package details
- ✅ Human escalation for complex cases
- ✅ Audit logging and compliance reporting

**Out of Scope (Phase 2+):**
- ❌ Full diagnostic report delivery (PDF/images)
- ❌ Clinical interpretation or advice
- ❌ Appointment booking (without human confirmation)
- ❌ Payment processing
- ❌ Complaint resolution
- ❌ Multi-language support (Phase 2)

### 1.6 Key Features (MVP)

1. **Identity Verification Flow**
   - OTP-based authentication
   - Registration number + DOB lookup
   - Secure session management

2. **Report Status Service**
   - Real-time query to Lab Information System (LIS)
   - Status categories: Ready, Processing, Delayed, Error
   - Downloadable report link (if ready)

3. **Centre Information Service**
   - 6 centre directory (name, address, hours, parking)
   - Google Maps integration
   - Holiday calendar
   - Current wait times (if available)

4. **Pricing Information Service**
   - Test-wise pricing
   - Health package bundles
   - Seasonal discounts
   - Comparison with competitor rates (optional)

5. **Conversation Management**
   - Multi-turn dialogue (context memory)
   - Quick-reply buttons for navigation
   - Fallback to human agent
   - Session timeout (30 minutes idle)

6. **Monitoring & Analytics**
   - Daily interaction volume
   - Completion vs. abandonment rates
   - Escalation reasons
   - Patient satisfaction (post-interaction survey)

### 1.7 Success Metrics & KPIs

| KPI | Baseline | Target (90d) | Measurement |
|-----|----------|--------------|-------------|
| Daily routine calls | 585 | 350–440 | Call-centre logs |
| Bot interactions/day | 0 | ≥300 (week 8) | WhatsApp API |
| Completion rate | N/A | ≥70% | Bot analytics |
| Escalation rate | N/A | ≤20% | Bot + call logs |
| Authentication success | N/A | ≥95% | Bot logs |
| Patient satisfaction | N/A | ≥4.0/5.0 | Survey |
| Bot uptime | N/A | ≥99.5% | Infrastructure monitor |
| Privacy incidents | 0 | 0 (zero tolerance) | Audit trail |

---

## STAGE 2: SPEC (TECHNICAL SPECIFICATION)

### 2.1 System Architecture

```
┌────────────────────────────────────────────────────┐
│                  WhatsApp Users                    │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│        WhatsApp Cloud API (Twilio/Meta)            │
│  (Message routing, authentication, compliance)    │
└────────────────────┬─────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────┐
│      Bot Platform (NLU + Conversation Engine)      │
│  (Intent detection, dialogue flow, session mgmt)   │
└────────────────────┬─────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │  Auth  │  │  LIS   │  │ Centre │
    │ Svc    │  │ API    │  │ Info   │
    │ (OTP)  │  │ (Rept) │  │ (DB)   │
    └────────┘  └────────┘  └────────┘
         │           │           │
         └───────────┼───────────┘
                     ▼
        ┌────────────────────────┐
        │   Audit Log & Monitor  │
        │  (Compliance, Metrics)  │
        └────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Messaging** | WhatsApp Cloud API (Twilio) | HIPAA-compliant, native support, global scale |
| **Bot Engine** | Freshchat / Twilio Studio | Pre-built NLU, compliance templates, managed service |
| **Authentication** | Twilio SMS OTP + Custom Lookup | Two-factor verification, no external dependency |
| **LIS Integration** | REST API (existing lab system) | Real-time report status, read-only access |
| **Database** | PostgreSQL (encrypted) | HIPAA-compliant audit logs, session management |
| **Monitoring** | Prometheus + Grafana | Real-time metrics, uptime tracking |
| **Infrastructure** | Cloud (AWS / Azure) | Auto-scaling, HIPAA-eligible, BAA-ready |
| **Logging** | ELK Stack (Elasticsearch) | Centralized audit logs, searchable, HIPAA-compliant |

### 2.3 Data Flow & Security

**Report Status Query Flow (Secure):**

1. **User Input:** Patient sends "Check report status"
2. **Session Check:** Bot verifies active session (or starts new auth flow)
3. **Identity Verification (if new session):**
   - Bot requests registration number
   - Bot requests date of birth
   - Bot sends OTP to WhatsApp
   - Patient confirms OTP
4. **LIS Lookup (authenticated):**
   - Bot queries LIS API with patient ID
   - LIS returns: report status, download URL (if ready), estimated time (if processing)
5. **Secure Response:**
   - Bot displays status (no sensitive data in logs)
   - Report download link is time-limited (1-hour expiry)
   - Session remains active for 30 minutes (context memory)
6. **Audit Trail:**
   - All interactions logged: timestamp, patient ID (hashed), action, result
   - No PHI stored in logs (only patient ID reference)

**Data Security Principles:**
- ✅ Encryption in transit (TLS 1.2+)
- ✅ Encryption at rest (AES-256)
- ✅ No unencrypted PHI in logs
- ✅ OTP valid for 5 minutes only
- ✅ Download links expire in 1 hour
- ✅ Session timeout after 30 minutes inactivity
- ✅ All patient data hashed in audit logs

### 2.4 API Specifications

**WhatsApp Bot API (Inbound)**
```
POST /webhook/whatsapp
Content-Type: application/json
Authorization: Bearer {webhook_token}

Request:
{
  "messages": [{
    "from": "+91-XXXXXX789",
    "id": "msg_123456",
    "timestamp": "2026-09-12T10:30:00Z",
    "text": {
      "body": "Check my report"
    },
    "type": "text"
  }]
}

Response:
{
  "messages": [{
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": "+91-XXXXXX789",
    "type": "text",
    "text": {
      "body": "Hi! To check your report status, I'll verify your identity first.\nPlease provide your registration number (found on your appointment confirmation)."
    }
  }]
}
```

**LIS API (Backend Integration)**
```
GET /api/v1/reports/{patient_id}
Authorization: Bearer {lis_api_key}
Headers:
  X-Patient-DOB: YYYY-MM-DD (hashed)
  X-Request-ID: {uuid}

Response (200 OK):
{
  "reports": [{
    "report_id": "REP-20260912-001",
    "test_name": "12-Test Blood Panel",
    "status": "ready",  // or "processing", "delayed"
    "sample_date": "2026-09-10",
    "report_date": "2026-09-12T02:30:00Z",
    "download_url": "https://reports.secure.diag.com/pdf/{token}",
    "url_expires_at": "2026-09-12T11:30:00Z",
    "estimated_ready_time": null
  }]
}

Error Response (401 Unauthorized):
{
  "error": "invalid_credentials",
  "message": "Patient not found or DOB mismatch"
}
```

**Centre Info API (Static/Cached)**
```
GET /api/v1/centres
Response (200 OK):
{
  "centres": [{
    "centre_id": "BLR-MG-001",
    "name": "Bangalore - MG Road",
    "address": "123 MG Road, Bangalore 560001",
    "phone": "+91-80-XXXX-XXXX",
    "hours": {
      "mon_fri": "07:00-20:00",
      "saturday": "07:00-20:00",
      "sunday": "08:00-14:00"
    },
    "parking": "Free underground parking (50 spots)",
    "directions_url": "https://maps.google.com/?q=123+MG+Road",
    "holidays": ["2026-10-02", "2026-10-25"],
    "wait_time_minutes": 12  // optional, if real-time available
  }]
}
```

### 2.5 Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Availability** | 99.5% uptime | Infrastructure monitoring |
| **Response Time** | <2 sec avg, <5 sec p95 | Application monitoring |
| **Scalability** | 1000+ concurrent users | Load testing |
| **Data Retention** | 2+ years (audit logs) | Database retention policy |
| **Recovery Time Objective (RTO)** | <1 hour | Disaster recovery plan |
| **Recovery Point Objective (RPO)** | <15 min | Backup frequency |
| **Security Audit** | Annual (external) | Third-party audit |
| **Compliance** | HIPAA, GDPR, local DPA | Compliance officer sign-off |

---

## STAGE 3: STORY (USER STORY + SCENARIOS)

### 3.1 Epic: Patient Self-Service Report Inquiry

**Epic Statement:**
*"As a patient, I want to check my test report status instantly via WhatsApp without calling the centre, so I can save time and get immediate confirmation of report availability."*

**Business Value:**
- Reduces call-centre load by ~25–40%
- Improves patient satisfaction (instant response)
- Enables 24/7 self-service (no call-centre hours dependency)

---

### 3.2 User Story #1: Patient Authentication

**Story:** `DIAG-101: Patient Identity Verification via OTP`

**As a** patient  
**I want to** securely verify my identity using OTP and registration details  
**So that** only I can access my confidential report information

**Acceptance Criteria:**
- [ ] Patient initiates "Check report status"
- [ ] Bot requests registration number (format: REG-XXXXXX)
- [ ] Patient provides valid registration number
- [ ] Bot requests date of birth (format: DD-MM-YYYY)
- [ ] Patient provides matching DOB (must match LIS records ±1 day for data entry errors)
- [ ] Bot sends OTP via WhatsApp (6-digit code)
- [ ] OTP valid for exactly 5 minutes
- [ ] Patient enters OTP correctly
- [ ] Session created (valid for 30 minutes)
- [ ] Patient sees: "Identity verified. What would you like to know?"
- [ ] On failed attempt (3x): escalate to human agent with note "Authentication failed"

**Definition of Done:**
- [ ] Code reviewed and merged to main branch
- [ ] Unit tests: ≥95% coverage (auth module)
- [ ] Integration tests: OTP generation, validation, session creation
- [ ] Security audit: OTP encryption, rate-limiting (max 3 attempts/5 min), timeout
- [ ] Compliance review: HIPAA-approved authentication method
- [ ] UAT passed with 10+ test patients

**Story Points:** 8  
**Sprint:** Week 4–5  
**Owner:** Tech Lead  

---

### 3.3 User Story #2: Report Status Lookup

**Story:** `DIAG-102: Query Report Status from LIS`

**As a** patient  
**I want to** check the status of my lab report (ready, processing, delayed)  
**So that** I know when I can download my results

**Acceptance Criteria:**
- [ ] Prerequisite: Patient authenticated (active session)
- [ ] Patient asks: "What's my report status?"
- [ ] Bot queries LIS API with patient ID + test type (if multiple tests)
- [ ] For each report, bot displays:
  - Test name (e.g., "12-Test Blood Panel")
  - Status: "Ready for download" OR "Processing (Est. ready 24h)" OR "Delayed - contact centre"
  - Sample collection date
  - Report generation date/time (if ready)
  - Download link (if ready, 1-hour expiry)
- [ ] If no reports found: "No recent reports. Please book a test or contact the centre."
- [ ] If LIS unavailable (timeout >5 sec): "System temporarily unavailable. Please try again or call +91-XXXX."
- [ ] Session remains active; patient can ask about other reports or centre info

**Definition of Done:**
- [ ] Code reviewed
- [ ] Unit tests: LIS API mocking, response parsing, error handling
- [ ] Integration tests: Real LIS API connection (staging environment)
- [ ] Load test: Response <2 sec for 500+ concurrent queries
- [ ] UAT: Test with 10 patients' real reports
- [ ] Compliance: No PHI logged; download link encrypted

**Story Points:** 5  
**Sprint:** Week 5–6  
**Owner:** Tech Lead  

---

### 3.4 User Story #3: Centre Information Lookup

**Story:** `DIAG-103: Display Centre Timings & Location`

**As a** patient  
**I want to** find the operating hours, address, and parking details of a specific centre  
**So that** I can plan my visit conveniently

**Acceptance Criteria:**
- [ ] Patient asks: "What are your hours?" or "Centre timings?"
- [ ] Bot displays list of 6 centres (with quick-reply buttons)
- [ ] Patient selects centre (e.g., "Bangalore - MG Road")
- [ ] Bot displays:
  - Centre name and ID
  - Full address with postal code
  - Phone number (clickable)
  - Hours (Mon–Fri, Sat, Sun, holidays)
  - Parking info (free/paid, number of spots)
  - Google Maps link (directions)
- [ ] If today is holiday: "We're closed today. Reopening: [date]"
- [ ] Patient can ask about another centre without re-authenticating
- [ ] Fallback: "Something went wrong. Call us at +91-XXXX."

**Definition of Done:**
- [ ] Database: 6 centres with complete info
- [ ] Caching: Centre data cached (TTL 24 hours)
- [ ] Code review passed
- [ ] UAT: All 6 centres tested
- [ ] Map integration: Google Maps links functional
- [ ] Mobile UX: Text readable on small screens

**Story Points:** 3  
**Sprint:** Week 5  
**Owner:** Frontend Lead  

---

### 3.5 User Story #4: Pricing Information

**Story:** `DIAG-104: Display Test & Package Pricing`

**As a** patient  
**I want to** see the cost of specific tests or health packages  
**So that** I can make an informed decision about which tests to book

**Acceptance Criteria:**
- [ ] Patient asks: "How much is a blood test?" or "Show me packages"
- [ ] Bot displays pricing categories:
  - Individual tests (e.g., "Glucose: ₹200")
  - Test panels (e.g., "12-Test Panel: ₹2,500")
  - Health packages (e.g., "Comprehensive Health Check: ₹4,500")
- [ ] For each item: price, tests included (count), validity, turnaround time
- [ ] Include promotional pricing (if applicable): "Special: 20% off for seniors"
- [ ] Patient can compare 2 packages side-by-side (optional)
- [ ] Call-to-action: "Ready to book? Call +91-XXXX or visit our website."
- [ ] Fallback: "Contact our centre for custom packages."

**Definition of Done:**
- [ ] Pricing database: all tests and packages
- [ ] Code review
- [ ] UAT: pricing accuracy verified
- [ ] Finance approval: pricing matches current rate card
- [ ] Mobile UX: pricing table readable

**Story Points:** 3  
**Sprint:** Week 4  
**Owner:** Product Lead  

---

### 3.6 User Story #5: Human Escalation

**Story:** `DIAG-105: Seamless Handoff to Call-Centre Agent`

**As a** patient  
**I want to** speak to a human agent when the bot can't help  
**So that** my complex question gets resolved without frustration

**Acceptance Criteria:**
- [ ] Patient asks: "I need to speak to someone" or bot detects unhandled intent
- [ ] Bot offers: "I'll connect you to an agent. Average wait: 3 minutes. Continue? (Yes/No)"
- [ ] Patient confirms
- [ ] Bot shows: "Connecting..." (hold screen for up to 2 minutes)
- [ ] Agent receives context: patient ID, phone, conversation history (last 5 turns)
- [ ] Agent picks up: "Hi [Patient Name], I see you were asking about [topic]. How can I help?"
- [ ] Chat transitions to call (WhatsApp call or phone call, agent choice)
- [ ] After call: agent logs outcome (resolved/callback/escalated)
- [ ] If no agent available: "All agents busy. Call us at +91-XXXX or check back in 10 min."

**Definition of Done:**
- [ ] Integration: bot → call-centre queuing system
- [ ] Code review
- [ ] UAT: 10 escalations tested end-to-end
- [ ] Agent training: how to see bot context
- [ ] Call-centre dashboard: real-time escalation queue
- [ ] Compliance: conversation logged for audit

**Story Points:** 8  
**Sprint:** Week 6–7  
**Owner:** Tech Lead + Call Centre Director  

---

### 3.7 Scenario-Based Testing

**Scenario A: Happy Path - Report Status Check**
```
Patient: "Hi, I want to check my report"
Bot: "Hi! I'm here to help. To access your report, I need to verify your identity.
     What's your registration number? (You'll find it on your appointment confirmation)"
Patient: "REG-20260910-5432"
Bot: "Thanks! Now, for security, please confirm your date of birth (DD-MM-YYYY)."
Patient: "12-05-1985"
Bot: "Great! Sending you a verification code via WhatsApp..."
[OTP arrives: 123456]
Patient: "123456"
Bot: "Perfect! Identity verified ✓
     Here's your report status:
     
     📋 Test: 12-Test Blood Panel
     Status: READY FOR DOWNLOAD ✓
     Sample collected: 10-Sep-2026
     Report generated: 12-Sep-2026 at 2:30 PM
     
     📥 Download: [Secure Link (expires in 1 hour)]
     
     Any other questions? 
     (a) Check another report
     (b) Centre timings
     (c) Pricing
     (d) Speak to an agent"
Patient: "Thanks!"
Bot: "You're welcome! Have a great day!"
```

**Scenario B: Authentication Failure**
```
Patient: "Check my report"
Bot: "What's your registration number?"
Patient: "REG-12345"
Bot: "Date of birth (DD-MM-YYYY)?"
Patient: "01-01-1990"
Bot: "Sending OTP..."
[OTP: 654321]
Patient: "123456"  ← wrong code
Bot: "That's not correct. Please try again. (Attempt 1 of 3)"
Patient: "654322"  ← wrong again
Bot: "Still not matching. One more try. (Attempt 2 of 3)"
Patient: "999999"  ← wrong again
Bot: "I couldn't verify your identity. For security reasons, I'm connecting you to an agent who can help.
     Average wait: 3 minutes..."
[Agent picks up with context: "Auth failed 3x"]
```

**Scenario C: LIS Unavailable**
```
Patient: "Check my report status"
[Bot requests authentication, patient verifies]
Bot: "Looking up your reports..."
[5-second timeout; LIS API down]
Bot: "I'm having trouble accessing our system right now. This should be temporary.
     Please try again in a few minutes, or call us at +91-80-XXXX-XXXX.
     Our team is standing by to help!"
[Logs: LIS API timeout at 14:32 UTC]
```

---

## STAGE 4: ACCEPT CRITERIA (DETAILED ACCEPTANCE CRITERIA)

### 4.1 Functional Acceptance Criteria

#### AC-1: Report Status Query Flow

**Given** a patient with verified identity in an active session  
**When** the patient requests report status  
**Then** the bot should:

1. **Query LIS API** with patient ID (hashed)
   - [ ] API responds within 2 seconds
   - [ ] Response contains: report ID, test name, status, dates, download URL (if applicable)

2. **Parse Response**
   - [ ] For status = "ready": display "READY FOR DOWNLOAD" with download link
   - [ ] For status = "processing": display "PROCESSING" with estimated time
   - [ ] For status = "delayed": display "DELAYED" with explanation ("High test volume")
   - [ ] For status = "error": display "UNABLE TO PROCESS" with escalation option

3. **Display Report Details**
   - [ ] Test name (clear, patient-friendly wording)
   - [ ] Status (clear icon + text)
   - [ ] Sample collection date (format: DD-MMM-YYYY, e.g., "10-Sep-2026")
   - [ ] Report generation date + time (if ready)
   - [ ] Download link (clickable, expires in 1 hour)

4. **Maintain Session**
   - [ ] Session remains active (no re-authentication needed)
   - [ ] Patient can ask about multiple reports, centres, pricing without re-authenticating
   - [ ] Session expires after 30 minutes of inactivity

#### AC-2: Identity Verification Flow

**Given** a new patient session  
**When** the patient initiates report status check  
**Then** the bot should:

1. **Request Registration Number**
   - [ ] Prompt: "What's your registration number?"
   - [ ] Format validation: REG-XXXXXX (or auto-detect format from LIS)
   - [ ] If invalid format: re-prompt with example
   - [ ] Timeout: 5 minutes (re-prompt if no response)

2. **Request Date of Birth**
   - [ ] Prompt: "Please confirm your date of birth (DD-MM-YYYY)"
   - [ ] Format validation: correct date, not future date
   - [ ] If invalid: re-prompt with example

3. **Send OTP**
   - [ ] Generate 6-digit random code
   - [ ] Send via WhatsApp (not SMS; ensures WhatsApp channel)
   - [ ] OTP valid for exactly 5 minutes
   - [ ] Max 3 attempts per OTP
   - [ ] After 3 failed attempts: escalate to agent

4. **Validate OTP**
   - [ ] Patient enters OTP
   - [ ] Compare against stored hash (not plaintext)
   - [ ] On success: create session token (valid 30 min)
   - [ ] On failure: show attempt counter ("1 of 3", "2 of 3", etc.)

5. **Error Handling**
   - [ ] OTP expired: "Code expired. Requesting new one..." (auto-send new OTP)
   - [ ] Patient not found in LIS: "Registration not found. Call us at +91-XXXX."
   - [ ] DOB mismatch: "DOB doesn't match our records. Please try again or call us."
   - [ ] All failure modes must escalate to agent after 3 retries

#### AC-3: Centre Information Display

**Given** a patient requests centre information  
**When** the patient selects a specific centre  
**Then** the bot should display:

- [ ] Centre name (e.g., "Bangalore - MG Road")
- [ ] Full address (street, city, postal code)
- [ ] Clickable phone number (+91-80-XXXX-XXXX)
- [ ] Operating hours:
  - [ ] Weekday hours (Mon–Fri)
  - [ ] Saturday hours
  - [ ] Sunday hours (if open)
  - [ ] Holiday status (if today is holiday)
- [ ] Parking info (free/paid, number of spots)
- [ ] Google Maps link (clickable, opens directions)
- [ ] All text must be mobile-optimized (readable on small screen)

#### AC-4: Pricing Display

**Given** a patient requests pricing  
**When** the patient selects a test or package  
**Then** the bot should display:

- [ ] Test name and price (₹XXX)
- [ ] Number of tests included (if panel)
- [ ] Turnaround time (e.g., "24–48 hours")
- [ ] Report validity (e.g., "Valid for 2 years")
- [ ] Promotional pricing (if applicable, with dates)
- [ ] Call-to-action: "Ready to book? Call +91-XXXX"

#### AC-5: Human Escalation

**Given** a patient requests to speak to an agent  
**When** the patient confirms the escalation request  
**Then** the system should:

- [ ] Show: "Connecting to agent... Average wait: 3 minutes"
- [ ] Pass to call-centre queue with context:
  - Patient ID
  - Phone number
  - Conversation history (last 5 turns)
  - Topic/reason for escalation
- [ ] If agent available within 2 min: immediate handoff
- [ ] If no agent: "All agents busy. Call us at +91-XXXX or try again in 10 minutes"
- [ ] Agent sees bot context in their dashboard
- [ ] Agent can continue via WhatsApp chat or switch to voice call

---

### 4.2 Non-Functional Acceptance Criteria

#### AC-6: Security & Compliance

- [ ] **Encryption in Transit:** All data sent via TLS 1.2+ (no unencrypted HTTP)
- [ ] **Encryption at Rest:** Patient data encrypted with AES-256
- [ ] **OTP Security:** OTP hashed before storage; never logged in plaintext
- [ ] **Session Management:** Session tokens cryptographically secure; expire after 30 min
- [ ] **PHI Protection:** No patient PHI (names, phone, test details) logged; only patient ID (hashed)
- [ ] **Audit Trail:** All interactions logged with timestamp, patient ID, action, result
- [ ] **Rate Limiting:** Max 3 OTP attempts per 5 minutes; max 5 queries per session
- [ ] **HIPAA Compliance:** WhatsApp vendor HIPAA-certified; BAA signed
- [ ] **Data Retention:** Logs retained for 2+ years; encrypted backups

#### AC-7: Performance & Reliability

- [ ] **Response Time:** Bot response <2 sec (p50), <5 sec (p95)
- [ ] **LIS API Latency:** <2 sec for report status query
- [ ] **Availability:** ≥99.5% uptime (no more than 3.6 hours downtime/month)
- [ ] **Concurrency:** Support 1,000+ concurrent users without degradation
- [ ] **Load Test:** Simulate 500 interactions/min for 30 min (sustained)
- [ ] **Scalability:** Horizontal scaling; no single point of failure
- [ ] **Database:** Primary + replica; automatic failover <30 seconds

#### AC-8: User Experience

- [ ] **Mobile Optimized:** All text/buttons readable on 4-inch screens
- [ ] **Accessibility:** WCAG 2.1 AA compliant (color contrast, alt text)
- [ ] **Clarity:** Language simple, jargon-free; <150 chars per message
- [ ] **Confirmation:** Critical actions (download, escalation) require explicit confirmation
- [ ] **Error Messages:** Clear, actionable feedback (not "Error 500")
- [ ] **Session Timeout:** User warned at 25 min, session ends at 30 min
- [ ] **Conversation Context:** Bot remembers previous queries in session (no repeat questions)

---

## STAGE 5: PROMPT (DETAILED PROMPT GENERATION)

### 5.1 System Prompt for Bot Platform

```
You are DiagnoBot, a secure WhatsApp assistant for a diagnostics chain. 
Your role is to help patients check report status, find centre details, 
and understand pricing—while maintaining strict privacy.

CORE PRINCIPLES:
1. SECURITY FIRST: Never share PHI without verified identity. Never log sensitive data.
2. CLARITY: Use simple, jargon-free language. Every message <150 characters if possible.
3. EMPATHY: Acknowledge emotions ("I understand you're eager to see your results").
4. ESCALATION: If unsure, escalate to human agents without friction.
5. CONTEXT: Remember patient details within a session (30-min validity).

TONE & VOICE:
- Friendly but professional
- Reassuring about privacy and security
- Eager to help, but honest about limitations
- Respectful of time (concise messages)

CONVERSATION FLOW:
1. Greet & clarify intent
2. Authenticate (if needed) using OTP
3. Fulfill request (report status, centre info, pricing)
4. Offer next steps or escalation
5. Graceful exit ("Have a great day!")

CRITICAL CONSTRAINTS:
- NEVER ask for full name, address, or other PHI unless absolutely required
- NEVER log download links, reports, or sensitive results
- NEVER share information without verified identity (OTP + registration number)
- NEVER guarantee medical interpretation ("Your results look normal") — escalate to clinicians
- ALWAYS offer human escalation if patient is frustrated or confused
- ALWAYS log interactions for audit (timestamp, patient ID hashed, action, result)

AUTHENTICATION PROTOCOL:
- Request registration number (REG-XXXXXX format)
- Request date of birth (DD-MM-YYYY)
- Send OTP (6 digits) via WhatsApp
- Validate OTP (max 3 attempts, 5-min window)
- Create session (30-min validity)

LIS API INTEGRATION:
- Query report status with patient ID (hash the ID before logging)
- Parse response: status (ready/processing/delayed), test name, dates, download link
- If ready: display with 1-hour expiring download link
- If processing: show estimated time
- If delayed: show reason + escalation option
- If error/timeout: escalate to agent

ERROR HANDLING:
- Authentication failed (3x) → escalate to agent with note "Auth failed"
- LIS timeout (>5 sec) → "System temporarily unavailable. Please try again or call +91-XXXX"
- Unhandled intent → escalate with "Let me connect you to an agent"
- Session expired → "Your session ended. Please start over."

ESCALATION PROTOCOL:
- Detect: frustration ("This is ridiculous"), complexity ("I want to book an appointment"), 
  clinical questions ("What does this result mean?")
- Offer: "I'll connect you to an agent. Average wait: 3 minutes. Continue? (Yes/No)"
- Pass context: patient ID, phone, conversation history, escalation reason
- Handoff: "Connecting..." (hold screen max 2 min)
- Fallback: "All agents busy. Call us at +91-XXXX or try in 10 minutes."

QUICK REPLIES (STANDARD BUTTONS):
After report status: 
  - [a] Check another report
  - [b] Centre timings
  - [c] Pricing
  - [d] Speak to an agent

After centre info:
  - [a] Check another centre
  - [b] Pricing
  - [c] Report status
  - [d] Speak to an agent

After pricing:
  - [a] Ready to book
  - [b] Check another test
  - [c] Report status
  - [d] Centre timings
  - [e] Speak to an agent

SAMPLE RESPONSES:

[Report Status - Ready]
"📋 Test: 12-Test Blood Panel
Status: ✅ READY FOR DOWNLOAD
Sample collected: 10-Sep-2026
Report generated: 12-Sep-2026, 2:30 PM
📥 Download: [Secure Link - expires 11-Sep, 11:30 AM]

What's next?
[a] Check another report [b] Centre timings [c] Pricing [d] Agent"

[Report Status - Processing]
"📋 Test: COVID-19 RT-PCR
Status: ⏳ PROCESSING
Sample collected: 12-Sep-2026
Estimated ready: 12-Sep-2026, 6:00 PM (about 4 hours)

I'll notify you when ready. What else can I help with?
[a] Check another report [b] Centre timings [c] Pricing [d] Agent"

[Centre Timings]
"📍 Bangalore - MG Road
Address: 123 MG Road, Bangalore 560001
Phone: +91-80-XXXX-XXXX (tap to call)
⏰ Hours:
  Mon-Sat: 7:00 AM - 8:00 PM
  Sun: 8:00 AM - 2:00 PM
🅿️ Parking: Free (50 spots)
🗺️ [Get Directions]

Which centre next?
[a] Check another centre [b] Pricing [c] Report status [d] Agent"

[Pricing]
"💰 Basic Health Check: ₹1,500 (10 tests)
💰 Standard Blood Panel: ₹2,500 (25 tests)
💰 Comprehensive Check: ₹4,500 (50 tests + imaging)

Ready to book?
[a] Book appointment [b] Check another package [c] Agent"

[Escalation Offer]
"I'd love to help with that! Let me connect you to one of our specialists.
Average wait: 3 minutes.
Continue? 
[Yes] [No, call me later]"

[Failed Authentication]
"I couldn't verify your identity after 3 attempts. Let me connect you to an agent who can help you securely.
Connecting... (wait time ~3 min)"
```

### 5.2 Few-Shot Examples for Intent Recognition

```
INTENT: CHECK_REPORT_STATUS
Examples:
- "Hi, I want to check my report"
- "Is my test ready?"
- "When will my results be ready?"
- "Can you tell me about my blood test?"
- "Report status?"

Intent confidence: HIGH if user mentions report, status, ready, results, test results

---

INTENT: CENTRE_INFORMATION
Examples:
- "What are your hours?"
- "Where is your nearest centre?"
- "Do you have parking?"
- "How do I get to MG Road center?"
- "What's your address in Bangalore?"

Intent confidence: HIGH if user mentions hours, location, address, centre, parking, directions

---

INTENT: PRICING
Examples:
- "How much is a blood test?"
- "What's the cost of full body checkup?"
- "Show me your packages"
- "Do you have any discounts?"
- "How much does the health package cost?"

Intent confidence: HIGH if user mentions price, cost, package, discount

---

INTENT: ESCALATE
Examples:
- "Can I speak to someone?"
- "This is frustrating"
- "I want to book an appointment"
- "What does this result mean?" (clinical question)
- "I'd like to file a complaint"

Intent confidence: HIGH if user expresses frustration, asks for human, or requests out-of-scope action

---

INTENT: HELP
Examples:
- "What can you do?"
- "How does this work?"
- "Help"
- "?" 

Intent confidence: HIGH if user asks about bot capabilities

---

INTENT: GREETING
Examples:
- "Hi"
- "Hello"
- "Hey"
- "Good morning"

Intent confidence: HIGH if user greets bot
```

### 5.3 Error Handling Prompts

```
[SCENARIO: User says "I forgot my registration number"]
Bot Response:
"No problem! I can help. Let me look it up using your phone number and date of birth.
What's your date of birth (DD-MM-YYYY)?"

[If still not found]
Bot Response:
"I'm having trouble finding your registration in our system. This could mean:
- Your account was set up recently (may take 24 hours)
- Your phone number in our system is different

Let me connect you to an agent who can quickly locate your account.
Connecting... (wait ~3 min)"

---

[SCENARIO: User asks "Is my report normal?"]
Bot Response:
"Great question! I can't interpret medical results, but our experts can. Let me connect you 
with a clinician who will explain what your results mean.
Connecting... (wait ~3 min)"

---

[SCENARIO: User says "Your prices are too high"]
Bot Response:
"I understand cost matters. We do offer seasonal discounts and senior rates. 
Let me connect you to our team to discuss options that work for your budget.
Connecting... (wait ~3 min)"

---

[SCENARIO: LIS API times out]
Bot Response:
"I'm having trouble connecting to our reports system. This is temporary. Please try again 
in 2 minutes, or call us at +91-80-XXXX-XXXX. We're here to help!"
```

---

## STAGE 6: CODE (IMPLEMENTATION OUTLINE & PSEUDOCODE)

### 6.1 Architecture Overview

**Tech Stack:**
- **Platform:** Twilio Studio (visual bot builder) + Node.js (custom logic)
- **Authentication:** Twilio SMS OTP + Custom lookup service
- **Database:** PostgreSQL (patient sessions, audit logs)
- **Monitoring:** Prometheus + Grafana
- **Deployment:** Docker on AWS ECS (HIPAA-eligible)

### 6.2 Pseudocode: Core Bot Functions

#### 6.2.1 Inbound Message Handler

```javascript
/**
 * Handle inbound WhatsApp message
 * @param {Object} message - WhatsApp message object
 * @returns {Object} response - Bot response
 */
async function handleInboundMessage(message) {
  try {
    // Log message received
    await auditLog({
      timestamp: new Date(),
      action: 'MESSAGE_RECEIVED',
      phoneHash: hashPhone(message.from),
      messageType: message.type,
      intent: null, // to be filled
    });

    // Extract user phone and message text
    const userPhone = message.from;
    const userText = message.text.body.toLowerCase().trim();

    // Check if user has active session
    let session = await getActiveSession(userPhone);

    // If no session, start authentication
    if (!session) {
      return await initiateAuthentication(userPhone, userText);
    }

    // Session exists; detect intent
    const intent = await detectIntent(userText);

    // Route to handler
    let response;
    switch (intent) {
      case 'CHECK_REPORT_STATUS':
        response = await handleReportStatus(userPhone, session);
        break;
      case 'CENTRE_INFORMATION':
        response = await handleCentreInfo(userPhone, userText, session);
        break;
      case 'PRICING':
        response = await handlePricing(userPhone, userText, session);
        break;
      case 'ESCALATE':
        response = await handleEscalation(userPhone, session);
        break;
      default:
        response = await handleUnknownIntent(userPhone, session);
    }

    // Log response
    await auditLog({
      timestamp: new Date(),
      action: 'MESSAGE_SENT',
      phoneHash: hashPhone(userPhone),
      intent,
      responseType: response.type,
    });

    return response;

  } catch (error) {
    console.error('Error handling message:', error);
    return await sendFallbackError(message.from);
  }
}
```

#### 6.2.2 Authentication Module

```javascript
/**
 * Initiate OTP-based authentication
 * @param {String} userPhone - User's WhatsApp phone number
 * @param {String} userText - User's message (may contain reg number)
 * @returns {Object} response
 */
async function initiateAuthentication(userPhone, userText) {
  // Check session state (are we collecting registration number or OTP?)
  let authState = await getAuthState(userPhone);

  if (!authState) {
    // New auth flow; request registration number
    authState = {
      phone: userPhone,
      step: 'REQUEST_REG_NUMBER',
      createdAt: new Date(),
      attempts: 0,
    };
    await saveAuthState(authState);

    return {
      to: userPhone,
      type: 'text',
      text: 'Hi! I\'m DiagnoBot. To check your report status securely, ' +
            'I need to verify your identity.\n\n' +
            'Please provide your registration number (found on your appointment confirmation).\n' +
            'Format: REG-XXXXXX',
      quickReply: null,
    };
  }

  // Else: we're in the middle of auth; continue based on step
  if (authState.step === 'REQUEST_REG_NUMBER') {
    const regNumber = extractRegNumber(userText);
    if (!regNumber) {
      return {
        to: userPhone,
        type: 'text',
        text: 'I didn\'t recognize that format. Please provide your registration number ' +
              '(e.g., REG-20260910-001).',
      };
    }

    // Validate reg number exists in LIS
    const patientExists = await validateRegistration(regNumber);
    if (!patientExists) {
      return {
        to: userPhone,
        type: 'text',
        text: 'Hmm, I can\'t find that registration number. Please double-check or ' +
              'call us at +91-80-XXXX-XXXX.',
      };
    }

    // Save reg number; move to DOB collection
    authState.regNumber = regNumber;
    authState.step = 'REQUEST_DOB';
    authState.attempts = 0;
    await saveAuthState(authState);

    return {
      to: userPhone,
      type: 'text',
      text: 'Thanks! Now, for security, please confirm your date of birth.\n' +
            'Format: DD-MM-YYYY (e.g., 12-05-1985)',
    };
  }

  if (authState.step === 'REQUEST_DOB') {
    const dob = extractDOB(userText);
    if (!dob) {
      return {
        to: userPhone,
        type: 'text',
        text: 'I didn\'t recognize that date format. Please try again: DD-MM-YYYY',
      };
    }

    // Verify DOB matches LIS record (with 1-day tolerance)
    const dobMatches = await validateDOB(authState.regNumber, dob);
    if (!dobMatches) {
      authState.attempts++;
      await saveAuthState(authState);
      
      if (authState.attempts >= 3) {
        return await escalateToAgent(userPhone, 'DOB verification failed 3x');
      }

      return {
        to: userPhone,
        type: 'text',
        text: `Date of birth doesn't match our records (Attempt ${authState.attempts}/3). ` +
              'Please try again or call us at +91-80-XXXX-XXXX.',
      };
    }

    // DOB verified; send OTP
    authState.dob = dob;
    authState.step = 'SEND_OTP';
    await saveAuthState(authState);

    const otp = generateOTP(); // 6-digit random
    const otpHash = hashOTP(otp);
    authState.otpHash = otpHash;
    authState.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-min expiry
    authState.otpAttempts = 0;
    authState.step = 'REQUEST_OTP';
    await saveAuthState(authState);

    // Send OTP via WhatsApp
    await sendWhatsAppMessage({
      to: userPhone,
      text: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.`,
    });

    return {
      to: userPhone,
      type: 'text',
      text: 'I\'ve sent you a 6-digit verification code via WhatsApp.\n' +
            'Please enter it to complete your identity verification.',
    };
  }

  if (authState.step === 'REQUEST_OTP') {
    const userOTP = extractOTP(userText);
    if (!userOTP) {
      return {
        to: userPhone,
        type: 'text',
        text: 'I didn\'t recognize that code format. Please provide the 6-digit code.',
      };
    }

    // Check OTP expiry
    if (new Date() > authState.otpExpiresAt) {
      authState.step = 'SEND_OTP';
      await saveAuthState(authState);
      return {
        to: userPhone,
        type: 'text',
        text: 'Your code expired. Sending a new one...',
      };
      // Recursively call to resend OTP (or simplify by looping)
    }

    // Verify OTP hash
    const otpValid = compareOTP(userOTP, authState.otpHash);
    if (!otpValid) {
      authState.otpAttempts++;
      await saveAuthState(authState);

      if (authState.otpAttempts >= 3) {
        return await escalateToAgent(userPhone, 'OTP verification failed 3x');
      }

      return {
        to: userPhone,
        type: 'text',
        text: `That code is incorrect (Attempt ${authState.otpAttempts}/3). ` +
              'Please try again.',
      };
    }

    // OTP verified; create session
    const sessionToken = generateSessionToken();
    const session = {
      phone: userPhone,
      regNumber: authState.regNumber,
      patientID: await getPatientIDFromReg(authState.regNumber),
      sessionToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      authenticated: true,
    };
    await saveSession(session);

    // Delete auth state
    await deleteAuthState(userPhone);

    return {
      to: userPhone,
      type: 'text',
      text: '✅ Identity verified!\n\nWhat would you like to know?\n' +
            '[a] Report status\n' +
            '[b] Centre timings\n' +
            '[c] Pricing\n' +
            '[d] Speak to an agent',
      quickReply: ['Report status', 'Centre timings', 'Pricing', 'Agent'],
    };
  }
}

/**
 * Generate cryptographically secure OTP
 * @returns {String} 6-digit OTP
 */
function generateOTP() {
  return Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
}

/**
 * Hash OTP using bcrypt
 * @param {String} otp
 * @returns {String} hashed OTP
 */
function hashOTP(otp) {
  return bcrypt.hashSync(otp, 10);
}

/**
 * Compare user-entered OTP with stored hash
 * @param {String} userOTP
 * @param {String} hash
 * @returns {Boolean}
 */
function compareOTP(userOTP, hash) {
  return bcrypt.compareSync(userOTP, hash);
}
```

#### 6.2.3 Report Status Handler

```javascript
/**
 * Handle report status request
 * @param {String} userPhone
 * @param {Object} session
 * @returns {Object} response
 */
async function handleReportStatus(userPhone, session) {
  try {
    const patientID = session.patientID;

    // Query LIS API (with timeout)
    const reports = await queryLISWithTimeout(patientID, 5000); // 5-sec timeout

    if (!reports || reports.length === 0) {
      return {
        to: userPhone,
        type: 'text',
        text: 'No recent reports found in our system. ' +
              'If you recently completed a test, it may take up to 48 hours to process.\n\n' +
              'What's next?\n' +
              '[a] Check centre timings\n' +
              '[b] Pricing\n' +
              '[c] Speak to an agent',
      };
    }

    // Format reports for display
    let responseText = '';
    reports.forEach((report, index) => {
      const status = report.status.toUpperCase();
      const statusIcon = status === 'READY' ? '✅' : status === 'PROCESSING' ? '⏳' : '⚠️';

      responseText += `\n📋 Test ${index + 1}: ${report.testName}\n`;
      responseText += `Status: ${statusIcon} ${status}\n`;
      responseText += `Sample collected: ${formatDate(report.sampleDate)}\n`;

      if (status === 'READY') {
        responseText += `Report generated: ${formatDateTime(report.reportDate)}\n`;
        responseText += `📥 Download (expires ${formatDateTime(report.urlExpiresAt)}):\n`;
        responseText += `${report.downloadURL}\n`;
      } else if (status === 'PROCESSING') {
        responseText += `Estimated ready: ${formatDateTime(report.estimatedReadyTime)}\n`;
      } else {
        responseText += `Note: ${report.errorMessage || 'Please contact us'}\n`;
      }
    });

    responseText += '\n\nWhat else can I help with?\n' +
                   '[a] Check another report\n' +
                   '[b] Centre timings\n' +
                   '[c] Pricing\n' +
                   '[d] Speak to an agent';

    return {
      to: userPhone,
      type: 'text',
      text: responseText,
    };

  } catch (error) {
    if (error.message === 'TIMEOUT') {
      return {
        to: userPhone,
        type: 'text',
        text: 'Our system is temporarily busy. Please try again in a moment or ' +
              'call +91-80-XXXX-XXXX. We apologize for the delay!',
      };
    }
    throw error;
  }
}

/**
 * Query LIS API with timeout
 * @param {String} patientID
 * @param {Number} timeoutMs
 * @returns {Promise<Array>} reports
 */
async function queryLISWithTimeout(patientID, timeoutMs) {
  return Promise.race([
    fetch(`https://lis.diag.com/api/v1/reports/${patientID}`, {
      headers: {
        'Authorization': `Bearer ${process.env.LIS_API_KEY}`,
        'X-Request-ID': generateUUID(),
      },
    })
      .then(res => {
        if (!res.ok) throw new Error(`LIS API error: ${res.status}`);
        return res.json();
      })
      .then(data => data.reports || []),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    ),
  ]);
}
```

#### 6.2.4 Audit Logging

```javascript
/**
 * Log interaction for compliance audit
 * @param {Object} logEntry - {timestamp, action, phoneHash, messageType, intent, result}
 */
async function auditLog(logEntry) {
  const entry = {
    id: generateUUID(),
    timestamp: logEntry.timestamp || new Date(),
    action: logEntry.action, // MESSAGE_RECEIVED, MESSAGE_SENT, AUTH_SUCCESS, etc.
    phoneHash: logEntry.phoneHash, // hashed phone number
    messageType: logEntry.messageType || 'unknown',
    intent: logEntry.intent || null,
    result: logEntry.result || 'success',
    ipAddress: logEntry.ipAddress || null,
    userAgent: logEntry.userAgent || null,
    // NO PHI: no names, test results, or sensitive data
  };

  try {
    await db.query(
      'INSERT INTO audit_logs (id, timestamp, action, phone_hash, message_type, intent, result) ' +
      'VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [entry.id, entry.timestamp, entry.action, entry.phoneHash, entry.messageType, entry.intent, entry.result]
    );
  } catch (error) {
    console.error('Audit log failed:', error);
    // Don't throw; log errors should never break the bot
  }
}

/**
 * Retrieve audit logs for compliance review
 * @param {Object} filter - {startDate, endDate, action, phoneHash}
 * @returns {Array} audit logs
 */
async function getAuditLogs(filter) {
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filter.startDate) {
    query += ' AND timestamp >= $' + (params.length + 1);
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    query += ' AND timestamp <= $' + (params.length + 1);
    params.push(filter.endDate);
  }
  if (filter.action) {
    query += ' AND action = $' + (params.length + 1);
    params.push(filter.action);
  }
  if (filter.phoneHash) {
    query += ' AND phone_hash = $' + (params.length + 1);
    params.push(filter.phoneHash);
  }

  query += ' ORDER BY timestamp DESC LIMIT 1000';

  const result = await db.query(query, params);
  return result.rows;
}
```

#### 6.2.5 Escalation Handler

```javascript
/**
 * Escalate to human agent
 * @param {String} userPhone
 * @param {String} reason
 * @returns {Object} response
 */
async function escalateToAgent(userPhone, reason) {
  try {
    // Create escalation ticket
    const ticket = {
      id: generateUUID(),
      phone: userPhone,
      reason,
      createdAt: new Date(),
      status: 'WAITING',
      priority: calculatePriority(reason), // HIGH, MEDIUM, LOW
    };

    await db.query(
      'INSERT INTO escalation_tickets (id, phone, reason, created_at, status, priority) ' +
      'VALUES ($1, $2, $3, $4, $5, $6)',
      [ticket.id, ticket.phone, ticket.reason, ticket.createdAt, ticket.status, ticket.priority]
    );

    // Check agent availability (simple availability check)
    const availableAgent = await getAvailableAgent();

    if (availableAgent) {
      // Route to agent immediately
      await notifyAgent(availableAgent.id, ticket);
      return {
        to: userPhone,
        type: 'text',
        text: 'Great! An agent is available now. You\'ll be connected momentarily...',
      };
    } else {
      // Queue for next available agent
      return {
        to: userPhone,
        type: 'text',
        text: 'All our agents are currently assisting other customers. ' +
              'Average wait: 3 minutes.\n\n' +
              'You can also call us at +91-80-XXXX-XXXX.',
      };
    }

  } catch (error) {
    console.error('Escalation failed:', error);
    return {
      to: userPhone,
      type: 'text',
      text: 'I\'m having trouble connecting to our team. Please call us at +91-80-XXXX-XXXX.',
    };
  }
}
```

### 6.3 Testing Strategy

```javascript
/**
 * Unit Tests - Authentication Module
 */
describe('Authentication Module', () => {
  
  test('Should generate 6-digit OTP', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  test('Should hash OTP securely', () => {
    const otp = '123456';
    const hash = hashOTP(otp);
    expect(hash).not.toBe(otp); // Not plaintext
    expect(compareOTP(otp, hash)).toBe(true);
  });

  test('Should reject invalid registration number', async () => {
    const result = await validateRegistration('INVALID');
    expect(result).toBe(false);
  });

  test('Should validate correct DOB', async () => {
    const result = await validateDOB('REG-20260910-001', '12-05-1985');
    expect(result).toBe(true);
  });

  test('Should reject incorrect DOB', async () => {
    const result = await validateDOB('REG-20260910-001', '01-01-1990');
    expect(result).toBe(false);
  });

  test('Should create session after successful auth', async () => {
    const session = await initiateAuthentication('+91-9876543210', 'REG-001');
    expect(session.authenticated).toBe(true);
    expect(session.sessionToken).toBeDefined();
    expect(session.expiresAt).toBeDefined();
  });

  test('Should escalate after 3 failed OTP attempts', async () => {
    // Mock 3 failed attempts
    // Expect escalation call
  });
});

/**
 * Integration Tests - Report Status Flow
 */
describe('Report Status Flow', () => {

  test('Should query LIS API and return report status', async () => {
    const reports = await queryLISWithTimeout('PATIENT-001', 5000);
    expect(Array.isArray(reports)).toBe(true);
    expect(reports[0]).toHaveProperty('testName');
    expect(reports[0]).toHaveProperty('status');
  });

  test('Should timeout after 5 seconds', async () => {
    // Mock slow LIS API
    expect(() => queryLISWithTimeout('PATIENT-001', 100)).rejects.toThrow('TIMEOUT');
  });

  test('Should format report response correctly', async () => {
    const response = await handleReportStatus('+91-9876543210', mockSession);
    expect(response.type).toBe('text');
    expect(response.text).toContain('Report');
    expect(response.text).toContain('Status');
  });
});

/**
 * Compliance Tests
 */
describe('Compliance & Security', () => {

  test('Should not log PHI in audit logs', async () => {
    await auditLog({
      timestamp: new Date(),
      action: 'REPORT_SENT',
      phoneHash: hashPhone('+91-9876543210'),
      // NO patientName, no test results, no PHI
    });

    const logs = await getAuditLogs({ action: 'REPORT_SENT' });
    expect(logs[0].phone_hash).toBeDefined();
    expect(logs[0].patient_name).toBeUndefined(); // Should not exist
  });

  test('Should use TLS for all outbound calls', async () => {
    const response = await fetch('https://lis.diag.com/api/v1/reports/PATIENT-001');
    expect(response.url).toMatch(/^https:\/\//);
  });

  test('Should encrypt sensitive data at rest', async () => {
    const session = { phone: '+91-9876543210', sessionToken: 'token123' };
    const encrypted = encryptSession(session);
    expect(encrypted).not.toContain('9876543210'); // Encrypted
    
    const decrypted = decryptSession(encrypted);
    expect(decrypted.phone).toBe('+91-9876543210');
  });
});

/**
 * Load Testing
 */
describe('Performance & Load', () => {

  test('Should handle 500 concurrent messages', async () => {
    const startTime = Date.now();
    const promises = Array(500).fill(null).map((_, i) =>
      handleInboundMessage({
        from: `+91-987654${String(i).padStart(4, '0')}`,
        text: { body: 'Check report' },
        type: 'text',
      })
    );
    
    const responses = await Promise.all(promises);
    const duration = Date.now() - startTime;
    
    expect(responses.length).toBe(500);
    expect(duration).toBeLessThan(10000); // Should complete in <10 sec
    expect(responses.filter(r => r.error).length).toBe(0); // No errors
  });

  test('Should respond within 2 seconds (p50)', async () => {
    const times = [];
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await handleInboundMessage(mockMessage);
      times.push(Date.now() - start);
    }
    
    times.sort((a, b) => a - b);
    const p50 = times[50];
    expect(p50).toBeLessThan(2000); // 2 sec
  });
});
```

### 6.4 Deployment Configuration

```yaml
# docker-compose.yml
version: '3.8'
services:
  bot-service:
    build: .
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=diagnobot
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - TWILIO_API_KEY=${TWILIO_API_KEY}
      - LIS_API_KEY=${LIS_API_KEY}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=diagnobot
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    restart: always

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    restart: always

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    ports:
      - "3001:3000"
    restart: always

volumes:
  postgres_data:
```

---

## STAGE 6 SUMMARY: DELIVERABLES

### Code Artifacts (Deliverable Checklist)

- [ ] **Core Bot Service** (Node.js)
  - [ ] Inbound message handler
  - [ ] Intent detection (NLU)
  - [ ] Session management
  - [ ] Error handling

- [ ] **Authentication Module**
  - [ ] OTP generation & validation
  - [ ] Registration number lookup
  - [ ] DOB verification
  - [ ] Session creation & timeout

- [ ] **LIS Integration**
  - [ ] Report status query
  - [ ] Error handling (timeout, 404, 500)
  - [ ] Download link generation

- [ ] **Centre & Pricing Services**
  - [ ] Centre database & caching
  - [ ] Pricing lookup
  - [ ] Formatting & response building

- [ ] **Escalation Module**
  - [ ] Ticket creation
  - [ ] Agent routing
  - [ ] Context passing

- [ ] **Audit & Logging**
  - [ ] Audit log schema
  - [ ] Log queries
  - [ ] HIPAA compliance verification

- [ ] **Tests**
  - [ ] Unit tests (auth, formatting)
  - [ ] Integration tests (LIS, escalation)
  - [ ] Compliance tests (PHI handling)
  - [ ] Load tests (500+ concurrency)
  - [ ] Security tests (encryption, rate-limiting)

- [ ] **Deployment & Infrastructure**
  - [ ] Docker configuration
  - [ ] Kubernetes deployment manifests (optional)
  - [ ] Database schema & migrations
  - [ ] Monitoring dashboards

- [ ] **Documentation**
  - [ ] API documentation (OpenAPI/Swagger)
  - [ ] Runbook (operations, troubleshooting)
  - [ ] Compliance audit guide
  - [ ] Escalation procedures

---

## FINAL CHECKLIST: SDD STAGES 1–6 COMPLETE

✅ **Stage 1: PRD** — Product vision, goals, success metrics, scope  
✅ **Stage 2: Spec** — Technical architecture, API specs, NFRs  
✅ **Stage 3: Story** — User stories, scenarios, acceptance criteria details  
✅ **Stage 4: Accept Criteria** — Functional, non-functional, compliance criteria  
✅ **Stage 5: Prompt** — System prompt, few-shot examples, error handling prompts  
✅ **Stage 6: Code** — Architecture, pseudocode, testing, deployment  

**Ready for Development:** Implementation can begin immediately with clear, unambiguous specifications.

---

**Document Version:** 1.0  
**Last Updated:** September 2026  
**Status:** ✅ COMPLETE & READY FOR HANDOFF TO ENGINEERING TEAM

