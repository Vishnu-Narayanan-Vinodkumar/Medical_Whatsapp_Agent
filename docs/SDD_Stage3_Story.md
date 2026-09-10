# STAGE 3: STORY (User Stories & Scenarios)
## WhatsApp Bot for Diagnostics  Detailed User Stories

**Document Type:** User Stories & Acceptance Scenarios  
**Project:** DiagnoBot WhatsApp Assistant  
**Version:** 1.0  
**Status:** Ready for Detailed Acceptance Criteria  
**Date:** September 2026  
**Owner:** Product Lead  

---

## 3.1 EPIC: PATIENT SELF-SERVICE REPORT INQUIRY

**Epic ID:** DIAG-E001  
**Epic Title:** Patient Self-Service Report Status Inquiry

**Epic Statement:**  
*"As a patient, I want to check my test report status instantly via WhatsApp without calling the centre, so I can save time and get immediate confirmation of report availability."*

**Business Value:**
- Reduces call-centre load by ~2540% (addresses top call reason)
- Improves patient satisfaction (instant response, 24/7 availability)
- Enables human agents to focus on complex cases
- Reduces operational cost (fewer calls to handle)

**Success Criteria:**
- [ ] Routine call volume decreases by 2540% from baseline
- [ ] 300 bot interactions/day by week 8
- [ ] 70% task completion rate
- [ ] Zero privacy incidents
- [ ] 4.0/5.0 patient satisfaction

---

## 3.2 USER STORY #1: PATIENT IDENTITY VERIFICATION

**Story ID:** DIAG-101  
**Title:** Patient Identity Verification via OTP  
**Priority:** CRITICAL (blocker for all other stories)

**As a** patient  
**I want to** securely verify my identity using OTP and registration details  
**So that** only I can access my confidential report information and prevent unauthorized access

**Background:**
- Patient has received a text/email confirmation of their appointment with a registration number
- Patient is now on WhatsApp and wants to check report status
- Patient knows their registration number and date of birth
- Patient has access to their WhatsApp phone

**Narrative:**
```
Patient opens WhatsApp and messages the DiagnoBot
Bot responds: "Hi! To access your reports securely, I need to verify your identity."
Patient provides registration number (REG-XXXXXX format)
Bot validates against LIS database
Bot asks for date of birth (DD-MM-YYYY)
Patient provides DOB
Bot validates DOB against LIS (1 day tolerance for data entry errors)
Bot generates 6-digit OTP and sends via WhatsApp
Patient receives OTP message
Patient enters OTP into WhatsApp chat
Bot validates OTP (max 3 attempts, 5-min window)
Bot confirms: "Identity verified "
Bot creates authenticated session (valid 30 min, context-aware)
Patient can now ask about report status without re-authenticating
```

### Acceptance Criteria

- [ ] **AC-101.1:** Bot requests registration number with clear format guidance
  - Prompt: "What's your registration number? (Format: REG-XXXXXX)"
  - Timeout: 5 min (re-prompt if no response)

- [ ] **AC-101.2:** Bot validates registration number against LIS
  - Query LIS: SELECT * FROM registration WHERE reg_number = ?
  - Success: Registration exists in LIS
  - Failure: "I can't find that registration. Please double-check or call us."

- [ ] **AC-101.3:** Bot requests date of birth (DD-MM-YYYY format)
  - Prompt: "Please confirm your date of birth (DD-MM-YYYY, e.g., 12-05-1985)"
  - Validation: Correct date format, not future date

- [ ] **AC-101.4:** Bot validates DOB against LIS record with tolerance
  - Query LIS: SELECT DOB FROM registration WHERE reg_number = ?
  - Tolerance: 1 day (account for data entry errors)
  - Failure (3x): Escalate to human agent with note "DOB verification failed"

- [ ] **AC-101.5:** Bot generates cryptographically secure OTP
  - Length: 6 digits (random)
  - Hashing: bcrypt(otp)  never store plaintext
  - Validity: 5 minutes exactly
  - Max attempts: 3 per OTP

- [ ] **AC-101.6:** Bot sends OTP via WhatsApp (not SMS)
  - Message: "Your verification code is: 123456 (Expires in 5 minutes)"
  - Channel: WhatsApp only (not fallback to SMS)

- [ ] **AC-101.7:** Bot validates OTP entered by patient
  - Comparison: bcrypt.compare(userOTP, storedHash)
  - Attempt counter: Show "1 of 3", "2 of 3", "3 of 3"
  - On failure (3x): Escalate to agent with context "OTP failed 3x"

- [ ] **AC-101.8:** Bot creates authenticated session on OTP success
  - Session token: 32-byte cryptographically random
  - Validity: 30 minutes from creation
  - Context: Patient can ask multiple questions without re-authenticating
  - Timeout: Warn at 25 min; session ends at 30 min

- [ ] **AC-101.9:** No re-authentication within 30-minute session
  - Patient asks about report  no re-auth needed
  - Patient asks about centre timings  no re-auth needed
  - Patient asks about pricing  no re-auth needed

- [ ] **AC-101.10:** Session clearly indicates authenticated state
  - Message: " Identity verified. What would you like to know?"

### Definition of Done

- [ ] Code reviewed and approved by Tech Lead
- [ ] Unit tests: 95% coverage (auth module)
  - [ ] Test OTP generation (6-digit format)
  - [ ] Test OTP hashing (bcrypt comparison)
  - [ ] Test registration lookup (success + failure cases)
  - [ ] Test DOB validation (1 day tolerance)
  - [ ] Test session creation (token generation, expiry)
- [ ] Integration tests: OTP flow end-to-end
  - [ ] Send message  bot requests reg number  user provides  validated
  - [ ] User provides DOB  validated  OTP sent  user enters OTP  session created
- [ ] Security audit: 
  - [ ] OTP encryption (never logged plaintext)
  - [ ] Rate-limiting (3 attempts/5 min)
  - [ ] Session timeout (30 min + warning)
  - [ ] No PHI in logs
- [ ] Compliance Officer sign-off: HIPAA-approved auth method
- [ ] UAT passed with 10+ test patients
- [ ] Documentation: Authentication protocol in runbook

### Story Points: 8
### Sprint: Week 45
### Owner: Tech Lead
### Blockers: None

---

## 3.3 USER STORY #2: REPORT STATUS LOOKUP

**Story ID:** DIAG-102  
**Title:** Query Report Status from LIS

**As a** patient  
**I want to** check the status of my lab report (ready, processing, delayed)  
**So that** I know when I can download my results and can plan next steps accordingly

**Background:**
- Patient has completed a test 2448 hours ago
- Patient received a confirmation message with registration number
- Patient is now authenticated with bot (from Story DIAG-101)
- Patient wants to know: Is my report ready?

**Narrative:**
```
Patient (authenticated): "What's my report status?"
Bot: "Looking up your reports..."
Bot queries LIS API: GET /api/v1/reports/{patient_id}
LIS responds within 2 seconds with report data
Bot parses response:
  - Report ID: REP-20260912-001
  - Test name: 12-Test Blood Panel
  - Status: "ready"
  - Sample collected: 10-Sep-2026
  - Report generated: 12-Sep-2026, 2:30 PM
  - Download URL: https://secure.reports.com/download/{token}
  - URL expires: 12-Sep-2026, 11:30 AM (1 hour from now)
Bot formats human-friendly message:
  " Test: 12-Test Blood Panel
   Status:  READY FOR DOWNLOAD
   Sample collected: 10-Sep-2026
   Report generated: 12-Sep-2026, 2:30 PM
    Download: [Secure Link]
   What's next?
   [a] Check another report [b] Centre timings [c] Pricing [d] Agent"
Patient taps [a] to check another report (session still active)
```

### Acceptance Criteria

- [ ] **AC-102.1:** Bot accepts report status request
  - Trigger phrases: "Check report", "Report status?", "Is my result ready?"
  - Intent detection: HIGH confidence on "report" keyword

- [ ] **AC-102.2:** Bot queries LIS API in real-time
  - Endpoint: GET /api/v1/reports/{patient_id}
  - Timeout: 5 seconds maximum
  - On timeout: Show "System temporarily unavailable. Try again or call +91-XXXX"

- [ ] **AC-102.3:** Bot displays report status for each test
  - Status: "Ready", "Processing", "Delayed", "Error"
  - Icon:  (ready),  (processing),  (delayed)

- [ ] **AC-102.4:** For ready reports: display download link
  - Link text: "Download [PDF]" or "Open Report"
  - Link security: Time-limited (1-hour expiry), single-use
  - Format: Secure HTTPS URL with token

- [ ] **AC-102.5:** For processing reports: show estimated time
  - Message: "Processing (Est. ready: 24 hours from now)"
  - Update: Estimated time refreshes with each query

- [ ] **AC-102.6:** For delayed reports: explain and escalate
  - Message: "Delayed - [Reason: High test volume / Technical issue]"
  - Action: Offer to escalate to agent

- [ ] **AC-102.7:** For no reports: inform and guide
  - Message: "No recent reports found. Please book a test or contact us."

- [ ] **AC-102.8:** Multiple reports displayed clearly
  - Separator: "---" or newline between reports
  - Numbering: "Test 1:", "Test 2:", etc.

- [ ] **AC-102.9:** Response time acceptable
  - Bot response: <2 sec (p50), <5 sec (p95)
  - Includes: LIS query + formatting + delivery

- [ ] **AC-102.10:** Session remains active after report query
  - Patient can ask about another report without re-authenticating
  - Patient can ask about centre info or pricing
  - Session expires after 30 min of inactivity

### Definition of Done

- [ ] Code reviewed
- [ ] Unit tests: LIS API mocking, response parsing, error handling
  - [ ] Test ready report (with download link)
  - [ ] Test processing report (with estimated time)
  - [ ] Test delayed report
  - [ ] Test LIS timeout (>5 sec)
  - [ ] Test LIS error (patient not found)
  - [ ] Test multiple reports (formatting)
- [ ] Integration tests: Real LIS API connection (staging environment)
  - [ ] Query 5 test patients with known reports
  - [ ] Verify response accuracy (matches LIS data)
- [ ] Load test: Response <2 sec for 500+ concurrent queries
- [ ] UAT: Test with 10 patients' real reports
- [ ] Compliance: 
  - [ ] No PHI logged
  - [ ] Download link encrypted and time-limited
  - [ ] Audit trail records query (not results)
- [ ] Runbook: Troubleshooting LIS timeout scenarios

### Story Points: 5
### Sprint: Week 56
### Owner: Tech Lead
### Blockers: LIS API availability, IT handoff

---

## 3.4 USER STORY #3: CENTRE INFORMATION LOOKUP

**Story ID:** DIAG-103  
**Title:** Display Centre Timings & Location

**As a** patient  
**I want to** find the operating hours, address, and parking details of a specific centre  
**So that** I can plan my visit conveniently and avoid travelling during closed hours

**Background:**
- Patient has completed a test and wants to visit a different centre (closer to home)
- Patient needs to know operating hours (open today?)
- Patient needs address and parking info
- Patient may want directions (Google Maps)

**Narrative:**
```
Patient: "What are your centre timings?"
Bot: "Which centre would you like to visit?"
Bot displays 6 quick-reply buttons:
  [1] Bangalore - MG Road
  [2] Bangalore - Whitefield
  [3] Bangalore - Indiranagar
  [4] Bangalore - Koramangala
  [5] Chennai - OMR Road
  [6] Hyderabad - Hitech City

Patient taps: [1] Bangalore - MG Road
Bot displays:
  " Bangalore - MG Road
   Address: 123 MG Road, Bangalore 560001
   Phone: +91-80-XXXX-XXXX (tap to call)
   
    Operating Hours:
   MonFri: 7:00 AM - 8:00 PM
   Sat: 7:00 AM - 8:00 PM
   Sun: 8:00 AM - 2:00 PM
   
    Parking: Free underground (50 spots)
    Directions: [Google Maps link]
   
   What's next?
   [a] Check another centre [b] Pricing [c] Report status [d] Agent"

Patient taps [a] to check another centre (session still active)
```

### Acceptance Criteria

- [ ] **AC-103.1:** Bot responds to centre inquiry
  - Triggers: "Centre timings", "Where are you?", "Hours?", "Address?"

- [ ] **AC-103.2:** Bot offers 6 centre options via quick-reply buttons
  - Button 1: Bangalore - MG Road
  - Button 2: Bangalore - Whitefield
  - Button 3: Bangalore - Indiranagar
  - Button 4: Bangalore - Koramangala
  - Button 5: Chennai - OMR Road
  - Button 6: Hyderabad - Hitech City

- [ ] **AC-103.3:** Bot displays centre details clearly
  - Name, address, postal code
  - Phone number (clickable)
  - Operating hours (Mon-Fri, Sat, Sun)
  - Parking info (free/paid, number of spots)
  - Google Maps link

- [ ] **AC-103.4:** Bot shows holiday status
  - If today is holiday: "We're closed today. Reopening: [date]"
  - Holiday calendar: Updated quarterly

- [ ] **AC-103.5:** Text is mobile-optimized
  - Readable on 4-inch screens
  - No horizontal scrolling
  - Clear hierarchy (emojis, line breaks)

- [ ] **AC-103.6:** Phone number is clickable
  - Tap phone  WhatsApp call to centre (or dial)
  - Format: [clickable_phone]

- [ ] **AC-103.7:** Map integration functional
  - Tap "Directions"  Google Maps with address
  - Shows location, directions, nearby parking

- [ ] **AC-103.8:** Patient can ask about other centres
  - Quick-reply: [a] Check another centre
  - No re-authentication needed
  - Session remains active

- [ ] **AC-103.9:** Session continues after centre query
  - Can ask about report status, pricing, escalation

### Definition of Done

- [ ] Database: 6 centres with complete info updated
- [ ] Caching: Centre data cached (TTL 24 hours)
- [ ] Code review passed
- [ ] UAT: All 6 centres tested (hours, parking, maps link functional)
- [ ] Map integration: Google Maps links verified (open correct location)
- [ ] Mobile UX: Tested on iPhone 5 (smallest screen), text readable

### Story Points: 3
### Sprint: Week 5
### Owner: Frontend Lead

---

## 3.5 USER STORY #4: PRICING INFORMATION

**Story ID:** DIAG-104  
**Title:** Display Test & Package Pricing

**As a** patient  
**I want to** see the cost of specific tests or health packages  
**So that** I can make an informed decision about which tests to book and budget accordingly

**Background:**
- Patient is healthy and considering preventive health checks
- Patient wants to compare pricing of different packages
- Patient wants to understand what's included in each package
- Patient may want to know promotional pricing (seasonal discounts)

**Narrative:**
```
Patient: "How much is a blood test?"
Bot: "We offer several options. Which would you like to know more about?"
Bot displays pricing options:
   Individual Tests
   Test Panels
   Health Packages

Patient selects "Health Packages"
Bot displays:
  " Our Health Packages:
  
  1 Basic Health Check: 1,500
     10 tests included
     Turnaround: 24 hours
     Validity: 2 years
  
  2 Standard Blood Panel: 2,500
     25 tests included
     Turnaround: 2448 hours
     Validity: 2 years
  
  3 Comprehensive Health Check: 4,500
     50 tests + imaging
     Turnaround: 48 hours
     Validity: 2 years
     Special: 20% senior discount available
  
  Ready to book?
  [a] Book appointment [b] Check another package [c] Agent"

Patient: "I'm interested in the comprehensive check. How do I book?"
Bot: "Great choice! Let me connect you to an agent who can help with booking."
[Escalates to agent]
```

### Acceptance Criteria

- [ ] **AC-104.1:** Bot responds to pricing inquiry
  - Triggers: "How much?", "Pricing?", "Cost of...?", "Packages?"

- [ ] **AC-104.2:** Bot displays categorized pricing
  - Category 1: Individual Tests (e.g., "Glucose: 200")
  - Category 2: Test Panels (e.g., "12-Test Panel: 2,500")
  - Category 3: Health Packages (comprehensive bundles)

- [ ] **AC-104.3:** For each item: show complete info
  - Name, price (XXX)
  - Tests included (count or list)
  - Turnaround time (e.g., "2448 hours")
  - Report validity (e.g., "2 years")

- [ ] **AC-104.4:** Promotional pricing clearly displayed
  - Highlight: "Special: 20% off for seniors"
  - Expiry: "Valid until 30-Sep-2026"
  - Only show active promotions (not expired)

- [ ] **AC-104.5:** Call-to-action clear
  - Button: "[Ready to book] [Chat with agent]"
  - Or: "Call us at +91-XXXX for package customization"

- [ ] **AC-104.6:** Optional: Side-by-side comparison
  - Patient can compare 2 packages
  - Show: Price difference, tests difference, value proposition

- [ ] **AC-104.7:** Finance accuracy verified
  - All pricing matches current rate card
  - Finance team sign-off: "Prices approved as of Sept 2026"

- [ ] **AC-104.8:** Mobile formatting optimized
  - Pricing table readable on small screens
  - No horizontal scrolling
  - Clear differentiation between tiers

### Definition of Done

- [ ] Pricing database: all tests and packages populated
- [ ] Code review passed
- [ ] UAT: pricing accuracy verified (matches finance sheet)
- [ ] Finance approval: sign-off on pricing display
- [ ] Mobile UX: table tested on multiple devices

### Story Points: 3
### Sprint: Week 4
### Owner: Product Lead

---

## 3.6 USER STORY #5: HUMAN ESCALATION

**Story ID:** DIAG-105  
**Title:** Seamless Handoff to Call-Centre Agent

**As a** patient  
**I want to** speak to a human agent when the bot can't help  
**So that** my complex question gets resolved quickly without frustration

**Background:**
- Patient has a question the bot can't handle (clinical advice, complaint, appointment)
- Patient is frustrated with bot (doesn't understand)
- Patient needs to speak to a human

**Narrative:**
```
Patient: "I need to book an appointment"
Bot: "I can't book appointments directly, but I'd love to connect you with an agent. 
     Average wait: 3 minutes. Shall I connect you? (Yes/No)"

Patient: "Yes"
Bot: "Connecting to an agent..."
[Escalation ticket created in call-centre queue]
[Agent receives context: patient ID, phone, conversation history]

Agent picks up (within 3 min):
"Hi [Patient Name], I see you want to book an appointment. 
I have your recent test results here. How can I help?"

Patient and agent complete conversation on WhatsApp or call

After interaction:
Agent logs outcome: "Appointment booked for 15-Sep-2026, 10 AM"
```

### Acceptance Criteria

- [ ] **AC-105.1:** Bot detects escalation-worthy situations
  - Unhandled intent (clinical question, complaint)
  - Patient frustration (repeated re-prompts)
  - Explicit request ("Speak to an agent")

- [ ] **AC-105.2:** Bot offers escalation option
  - Message: "I can connect you to an agent. Average wait: 3 minutes. Continue? (Yes/No)"
  - Allow patient to decline: "No, thanks" (return to normal chat)

- [ ] **AC-105.3:** Escalation ticket created in queue
  - Ticket ID: UUID
  - Phone: user's WhatsApp number
  - Reason: reason for escalation
  - Priority: LOW (routine), MEDIUM (urgent), HIGH (complaint/medical)

- [ ] **AC-105.4:** Context passed to agent
  - Patient ID
  - Phone number
  - Conversation history (last 5 exchanges)
  - Topic/reason for escalation
  - Authentication status (verified identity)

- [ ] **AC-105.5:** Agent dashboard shows escalation queue
  - New tickets appear in real-time
  - Agent can accept or decline
  - Context visible: patient name, phone, reason, conversation

- [ ] **AC-105.6:** Patient sees waiting state
  - Message: "Connecting..." (hold message)
  - Update every 30 sec: "Still connecting..." or "Average wait: 2 minutes now"
  - Max wait message: If agent not available in 2 min, show fallback

- [ ] **AC-105.7:** Agent handoff smooth
  - Agent picks up and immediately sees bot context
  - Agent can say: "I see you were asking about..." (shows familiarity)
  - Conversation continues naturally (not repeated)

- [ ] **AC-105.8:** Fallback if no agents available
  - Message: "All agents are busy right now. 
             Please call us at +91-XXXX or try again in 10 minutes."

- [ ] **AC-105.9:** Agent can escalate further
  - If patient issue requires medical review: escalate to clinician
  - If payment issue: escalate to finance team

- [ ] **AC-105.10:** Post-escalation outcome logged
  - Agent logs: Outcome, resolution, next steps
  - Audit trail: escalation reason + resolution

### Definition of Done

- [ ] Integration: bot  call-centre queuing system (tested)
- [ ] Code review passed
- [ ] UAT: 10 escalations tested end-to-end
  - Bot detects need to escalate
  - Ticket created
  - Agent receives context
  - Agent picks up
  - Conversation continues naturally
- [ ] Agent training: How to see bot context, how to continue conversation
- [ ] Call-centre dashboard: real-time escalation queue visible
- [ ] Compliance: Conversation logged for audit

### Story Points: 8
### Sprint: Week 67
### Owner: Tech Lead + Call Centre Director

---

## 3.7 SCENARIO-BASED TESTING

### Scenario A: Happy Path  Report Status Check

```
Timestamp: 2026-09-12, 10:00 AM
Patient: "Hi, I want to check my report"

Bot: "Hi! I'm here to help. To access your report securely, 
     I need to verify your identity.
     What's your registration number? 
     (Format: REG-XXXXXX)"

Patient: "REG-20260910-5432"

Bot: "Thanks! Now, for security, please confirm your date of birth 
     (DD-MM-YYYY)."

Patient: "12-05-1985"

Bot: "Great! Sending you a verification code via WhatsApp..."
[OTP arrives in 2 seconds: 123456]

Patient: "123456"

Bot: "Perfect! Identity verified 
     
     Here's your report status:
     
      Test: 12-Test Blood Panel
     Status:  READY FOR DOWNLOAD
     Sample collected: 10-Sep-2026
     Report generated: 12-Sep-2026, 2:30 PM
     
      Download: [Secure Link (expires in 1 hour)]
     
     Any other questions?
     [a] Check another report
     [b] Centre timings
     [c] Pricing
     [d] Speak to an agent"

Patient: "Thanks!"

Bot: "You're welcome! Have a great day! "
```

**Expected Behavior:**  PASS
- Bot responds within 2 sec each turn
- OTP sent and validated successfully
- Download link provided
- Patient satisfied

---

### Scenario B: Authentication Failure  Three Wrong OTPs

```
Patient: "Check my report"
Bot: [requests registration + DOB as before]
Patient: [provides valid reg and DOB]
Bot: "Sending OTP..."
[OTP: 654321]

Patient: "123456"   WRONG
Bot: "That's not correct. Please try again. (Attempt 1 of 3)"

Patient: "654322"   WRONG AGAIN
Bot: "Still not matching. One more try. (Attempt 2 of 3)"

Patient: "999999"   WRONG AGAIN
Bot: "I couldn't verify your identity. For security reasons, 
     I'm connecting you to an agent who can help.
     Average wait: 3 minutes..."

[Escalation ticket created: AUTH_FAILED_3X]
[Agent picks up with context]
Agent: "Hi! I see authentication failed. Let me verify you directly..."
```

**Expected Behavior:**  PASS
- Bot counts attempts correctly
- Escalation triggered after 3 failures
- Agent receives context

---

### Scenario C: LIS Unavailable  Timeout

```
Patient: [authenticated]
Patient: "Check my report"
Bot: "Looking up your reports..."
[Waiting for LIS API response...]
[5-second timeout reached; LIS server down]

Bot: "I'm having trouble accessing our system right now. 
     This should be temporary. Please try again in a few minutes, 
     or call us at +91-80-XXXX-XXXX.
     Our team is standing by to help!"

[Audit log: LIS_TIMEOUT at 14:32 UTC]
```

**Expected Behavior:**  PASS
- Timeout handled gracefully (no blank message)
- User offered alternative (call centre)
- Error logged for monitoring

---

## 3.8 SUMMARY: STORY POINTS & SPRINT PLANNING

| Story | ID | Points | Sprint | Owner | Dependencies |
|-------|----|---------|----|-------|--------------|
| Identity Verification | DIAG-101 | 8 | W45 | Tech Lead | LIS API access |
| Report Status Lookup | DIAG-102 | 5 | W56 | Tech Lead | DIAG-101, LIS integration |
| Centre Information | DIAG-103 | 3 | W5 | Frontend | Database setup |
| Pricing Information | DIAG-104 | 3 | W4 | Product Lead | Finance approval |
| Human Escalation | DIAG-105 | 8 | W67 | Tech + Ops | Call-centre system integration |

**Total Points:** 27  
**Total Sprints:** 3 (Weeks 47)  
**Velocity Assumption:** 9 points/week

---

**Next Phase:** Stage 4  Detailed Acceptance Criteria

---

**Document Status:**  READY FOR ACCEPTANCE CRITERIA DEFINITION  
**Last Updated:** September 2026  
**Owner:** Product Lead
