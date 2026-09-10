# STAGE 4: ACCEPT CRITERIA (Detailed Acceptance Criteria)
## WhatsApp Bot for Diagnostics  Testable Acceptance Conditions

**Document Type:** Detailed Acceptance Criteria & Test Conditions  
**Project:** DiagnoBot WhatsApp Assistant  
**Version:** 1.0  
**Status:** Ready for Prompt Engineering  
**Date:** September 2026  
**Owner:** QA Lead  

---

## 4.1 FUNCTIONAL ACCEPTANCE CRITERIA

### AC-SET-1: Report Status Query Flow

**Feature:** Report Status Lookup (Story DIAG-102)

---

#### AC-1.1: Bot queries LIS API successfully

**Given** a patient with verified identity in an active session  
**When** the patient requests report status  
**Then** the bot should:

- [ ] **Condition 1a:** Send request to LIS API
  - URL: `GET https://lis.diag.com/api/v1/reports/{patient_id}`
  - Headers: Include Authorization, X-Patient-DOB (hashed), X-Request-ID
  - Timeout: 5 seconds max
  - **Test:** Mock LIS API; call with valid patient ID
  - **Expected:** HTTP 200 response within 2 sec (p50)

- [ ] **Condition 1b:** Parse LIS response correctly
  - Response includes: report_id, test_name, status, sample_date, report_date, download_url, url_expires_at, estimated_ready_time
  - **Test:** Inject sample JSON; verify all fields parsed
  - **Expected:** All fields extracted without error

- [ ] **Condition 1c:** Handle timeout gracefully
  - If LIS doesn't respond in 5 sec: Show error message (not crash)
  - **Test:** Mock LIS with 6-sec delay
  - **Expected:** "System temporarily unavailable..." message shown at 5.1 sec

---

#### AC-1.2: Bot displays report status accurately

**Given** LIS API returns a report with status = "ready"  
**When** bot formats the response  
**Then:**

- [ ] **Condition 2a:** Show status icon and text
  - Status "ready"  Icon: , Text: "READY FOR DOWNLOAD"
  - Status "processing"  Icon: , Text: "PROCESSING"
  - Status "delayed"  Icon: , Text: "DELAYED"
  - **Test:** Provide sample reports with each status
  - **Expected:** Correct icon + text combination for each status

- [ ] **Condition 2b:** Display test name clearly
  - Format: " Test: [Test Name]"
  - Name: Patient-friendly (not medical jargon)
  - **Test:** Sample test name "12-Test Blood Panel"
  - **Expected:** " Test: 12-Test Blood Panel"

- [ ] **Condition 2c:** Show dates in readable format
  - Sample date: DD-MMM-YYYY (e.g., "10-Sep-2026")
  - Report date: DD-MMM-YYYY, HH:MM AM/PM (e.g., "12-Sep-2026, 2:30 PM")
  - **Test:** Provide ISO timestamp; verify formatting
  - **Expected:** Dates readable on mobile screen

- [ ] **Condition 2d:** Provide download link (if ready)
  - Link format: HTTPS, time-limited (1-hour expiry), single-use token
  - Display: "[Download PDF]" or "[Open Report]"
  - **Test:** Verify link is clickable, expires in 1 hour
  - **Expected:** Link functional for 60 min; 404 after expiry

- [ ] **Condition 2e:** Show estimated time (if processing)
  - Format: "Estimated ready: [DATE] at [TIME]"
  - **Test:** Processing report with 12-hour ETA
  - **Expected:** "Estimated ready: 12-Sep-2026 at 2:30 PM"

---

#### AC-1.3: Bot handles multiple reports

**Given** patient has 3 pending reports  
**When** bot displays results  
**Then:**

- [ ] **Condition 3a:** Display all reports in one message
  - **Test:** LIS returns 3 reports
  - **Expected:** All 3 shown, clearly separated

- [ ] **Condition 3b:** Numbering clear
  - Format: "Test 1:", "Test 2:", "Test 3:"
  - **Test:** Verify numbering visible
  - **Expected:** Easy to distinguish reports

- [ ] **Condition 3c:** Message length acceptable
  - Max length: 4,096 characters (WhatsApp limit)
  - **Test:** 10 reports returned
  - **Expected:** Split into 2 messages if needed

---

#### AC-1.4: Session remains active after report query

**Given** bot has just sent report status  
**When** patient asks about centre timings  
**Then:**

- [ ] **Condition 4a:** No re-authentication required
  - Session still valid (created <30 min ago)
  - **Test:** Query report  Ask about timings
  - **Expected:** Timings shown without OTP re-entry

- [ ] **Condition 4b:** Session context preserved
  - Patient's patient_id, registration, session_token all valid
  - **Test:** Check session table in database
  - **Expected:** Session row still exists, expires_at > NOW()

- [ ] **Condition 4c:** Conversation history retained
  - Bot remembers previous queries
  - **Test:** Ask multiple questions in sequence
  - **Expected:** Bot doesn't repeat introduction/verification

---

### AC-SET-2: Identity Verification Flow

**Feature:** OTP-Based Authentication (Story DIAG-101)

---

#### AC-2.1: Bot requests registration number

**Given** a new patient session  
**When** bot initiates authentication  
**Then:**

- [ ] **Condition 1a:** Clear prompt for registration number
  - Message: "What's your registration number? (Format: REG-XXXXXX)"
  - **Test:** Bot receives message from unauthenticated user
  - **Expected:** Prompt shown within 1 sec

- [ ] **Condition 1b:** Format validation
  - Accepts: "REG-20260910-001", "REG-XXXXXX"
  - Rejects: "12345", "REG123", "ABC-DEF"
  - **Test:** Try various formats
  - **Expected:** Valid formats accepted, invalid re-prompted

- [ ] **Condition 1c:** Registration lookup in LIS
  - Query: `SELECT * FROM registration WHERE reg_number = ?`
  - **Test:** REG-20260910-001 exists; REG-99999999-999 doesn't
  - **Expected:** Valid reg found; invalid reg shows "I can't find that registration"

---

#### AC-2.2: Bot requests and validates date of birth

**Given** registration number validated  
**When** bot requests DOB  
**Then:**

- [ ] **Condition 2a:** Clear prompt for DOB
  - Format: DD-MM-YYYY
  - Example: "12-05-1985"
  - **Test:** Bot asks for DOB after reg validation
  - **Expected:** Prompt includes format example

- [ ] **Condition 2b:** Format validation
  - Accepts: "12-05-1985"
  - Rejects: "1985-05-12", "12/05/1985", "12 May 1985"
  - **Test:** Try various formats
  - **Expected:** DD-MM-YYYY only accepted

- [ ] **Condition 2c:** Logical validation
  - Rejects: Future dates, dates >150 years ago
  - Accepts: "01-01-1950" (valid), rejects "01-01-2030" (future)
  - **Test:** Try edge cases
  - **Expected:** Logical validation enforced

- [ ] **Condition 2d:** LIS validation with tolerance
  - Query: `SELECT DOB FROM registration WHERE reg_number = ?`
  - Tolerance: 1 day (account for data entry errors)
  - **Test:** Patient's real DOB 12-05-1985; user enters 11-05-1985 or 13-05-1985
  - **Expected:** Accepted (tolerance applied)

- [ ] **Condition 2e:** Failure escalation after 3 attempts
  - After 3 failed DOB attempts: Escalate to agent
  - **Test:** Enter wrong DOB 3 times
  - **Expected:** Escalation triggered; message shows reason "DOB verification failed"

---

#### AC-2.3: Bot generates and sends OTP

**Given** registration and DOB verified  
**When** bot generates OTP  
**Then:**

- [ ] **Condition 3a:** OTP generation
  - Length: 6 digits (0-9)
  - Randomness: Cryptographically secure
  - **Test:** Generate 100 OTPs; verify no duplicates, all 6-digit
  - **Expected:** All unique, all 6 digits

- [ ] **Condition 3b:** OTP hashing
  - Never stored plaintext
  - Hashed with bcrypt(otp, rounds=10)
  - **Test:** Check database; verify OTP_HASH  plaintext
  - **Expected:** Only hash stored, not plaintext

- [ ] **Condition 3c:** OTP delivery via WhatsApp
  - Channel: WhatsApp (not SMS)
  - Message: "Your verification code is: 123456 (Expires in 5 minutes)"
  - **Test:** Send OTP; verify receives in WhatsApp (not SMS)
  - **Expected:** OTP arrives in WhatsApp within 2 sec

- [ ] **Condition 3d:** OTP validity window
  - Valid for: Exactly 5 minutes from generation
  - **Test:** Generate OTP at T=0; verify valid at T=4:59, invalid at T=5:01
  - **Expected:** Time window enforced

- [ ] **Condition 3e:** OTP attempt limiting
  - Max 3 attempts per OTP
  - After 3 failures: Escalate (don't regenerate)
  - **Test:** Attempt wrong OTP 3 times
  - **Expected:** 3rd failure triggers escalation, not error message

---

#### AC-2.4: Bot validates OTP

**Given** OTP sent to patient  
**When** patient enters OTP  
**Then:**

- [ ] **Condition 4a:** OTP comparison (hashed)
  - Compare: `bcrypt.compare(userOTP, storedHash)`
  - **Test:** User enters correct OTP
  - **Expected:** Hash comparison successful

- [ ] **Condition 4b:** Failure messaging with counter
  - 1st fail: "That's not correct. Please try again. (Attempt 1 of 3)"
  - 2nd fail: "Still not matching. One more try. (Attempt 2 of 3)"
  - 3rd fail: Escalate to agent
  - **Test:** Enter wrong OTP 1x, 2x, 3x
  - **Expected:** Correct counter shown; escalation on 3rd

- [ ] **Condition 4c:** OTP expiry handling
  - If OTP expired: "Code expired. Sending new one..."
  - Automatically regenerate and resend new OTP
  - **Test:** Wait 5+ min; user enters old OTP
  - **Expected:** New OTP generated and sent automatically

---

#### AC-2.5: Bot creates authenticated session

**Given** OTP validated successfully  
**When** session is created  
**Then:**

- [ ] **Condition 5a:** Session token generation
  - Token: 32 bytes, cryptographically random
  - Format: Hexadecimal string
  - **Test:** Generate 10 tokens; verify uniqueness
  - **Expected:** All unique, 64-char hexadecimal

- [ ] **Condition 5b:** Session validity
  - Duration: 30 minutes from creation
  - Stored: `INSERT INTO sessions (session_token, expires_at=NOW()+30min)`
  - **Test:** Create session; check database
  - **Expected:** expires_at = NOW() + 30 minutes

- [ ] **Condition 5c:** Session context available
  - Bot remembers: patient_id, registration, phone_hash
  - Subsequent queries don't require re-entry
  - **Test:** Query report without re-entering registration
  - **Expected:** Report queried using session context

- [ ] **Condition 5d:** Confirmation message
  - Message: " Identity verified. What would you like to know?"
  - **Test:** OTP validated
  - **Expected:** Confirmation shown with quick-reply buttons

---

### AC-SET-3: Centre Information Display

**Feature:** Centre Timings & Location (Story DIAG-103)

---

#### AC-3.1: Centre information displayed correctly

**Given** patient selects a centre  
**When** bot retrieves and displays info  
**Then:**

- [ ] **Condition 1a:** Centre name and ID
  - Example: " Bangalore - MG Road"
  - **Test:** Lookup centre BLR-MG-001
  - **Expected:** Name displayed correctly

- [ ] **Condition 1b:** Full address
  - Format: Street address, city, postal code
  - Example: "123 MG Road, Bangalore 560001"
  - **Test:** Verify address matches corporate records
  - **Expected:** Correct address shown

- [ ] **Condition 1c:** Clickable phone number
  - Format: Clickable link
  - Number: +91-80-XXXX-XXXX
  - Action: Tap  Call or WhatsApp
  - **Test:** Tap phone number
  - **Expected:** Phone call initiated or WhatsApp conversation opens

- [ ] **Condition 1d:** Operating hours
  - Mon-Fri: "07:00-20:00"
  - Saturday: "07:00-20:00"
  - Sunday: "08:00-14:00"
  - Format: 24-hour time, readable
  - **Test:** Display hours for each day type
  - **Expected:** Hours displayed clearly

- [ ] **Condition 1e:** Holiday status
  - If today is holiday: "We're closed today. Reopening: [date]"
  - Holiday calendar updated quarterly
  - **Test:** Query centre on 2-Oct (Gandhi Jayanti - holiday)
  - **Expected:** "We're closed today. Reopening: 3-Oct-2026"

- [ ] **Condition 1f:** Parking information
  - Format: "Free underground (50 spots)" or "Paid (50/hour)"
  - **Test:** Display parking for each centre
  - **Expected:** Info matches actual centre

- [ ] **Condition 1g:** Google Maps integration
  - Link: Clickable "Directions" button
  - Action: Tap  Google Maps with address
  - **Test:** Tap link
  - **Expected:** Google Maps opens with location

---

#### AC-3.2: Text is mobile-optimized

**Given** centre information displayed  
**When** patient views on mobile (4-inch screen)  
**Then:**

- [ ] **Condition 2a:** No horizontal scrolling needed
  - Max line length: 40 characters
  - **Test:** Display on iPhone 5 (4-inch screen)
  - **Expected:** All text visible without scroll

- [ ] **Condition 2b:** Clear hierarchy with emojis
  -  = Address
  -  = Hours
  -  = Parking
  -  = Directions
  -  = Phone
  - **Test:** Verify emoji usage consistent
  - **Expected:** Quick visual scanning possible

- [ ] **Condition 2c:** Line breaks for readability
  - Each info block separated
  - **Test:** Display centre info
  - **Expected:** Readable on small screen

---

### AC-SET-4: Pricing Information Display

**Feature:** Test & Package Pricing (Story DIAG-104)

---

#### AC-4.1: Pricing displayed accurately

**Given** patient requests pricing  
**When** bot displays test/package pricing  
**Then:**

- [ ] **Condition 1a:** Test name and price
  - Format: "[Test Name]: [Price]"
  - Example: "Glucose: 200"
  - **Test:** Display sample tests
  - **Expected:** Format consistent

- [ ] **Condition 1b:** Tests included in panel
  - Format: "[Count] tests included"
  - Example: "12-Test Panel: 2,500 (25 tests)"
  - **Test:** Display panel with test count
  - **Expected:** Count accurate

- [ ] **Condition 1c:** Turnaround time shown
  - Format: "Turnaround: [X] hours"
  - Example: "2448 hours" or "24 hours"
  - **Test:** Verify TAT matches actual lab SLA
  - **Expected:** TAT accurate

- [ ] **Condition 1d:** Report validity displayed
  - Format: "Valid for: [X] years"
  - Example: "Valid for: 2 years"
  - **Test:** Verify validity matches policy
  - **Expected:** Validity accurate

- [ ] **Condition 1e:** Promotional pricing highlighted
  - Format: "Special: [X]% off for [Group]"
  - Example: "Special: 20% off for seniors"
  - Expiry: "Valid until: [Date]"
  - **Test:** Display active promotion
  - **Expected:** Promotion shown; expired promos hidden

---

#### AC-4.2: Finance approval verified

**Given** pricing displayed  
**When** finance team audits  
**Then:**

- [ ] **Condition 2a:** All prices match current rate card
  - Rate card date: "Effective from Sept 2026"
  - **Test:** Finance compares displayed pricing vs. rate card
  - **Expected:** 100% match

- [ ] **Condition 2b:** Discounts/promos accurate
  - Senior discount: 20% (verified)
  - Student discount: 15% (verified)
  - **Test:** Apply discounts; verify math
  - **Expected:** Discounts calculated correctly

- [ ] **Condition 2c:** No stale pricing
  - Pricing updated within 24 hours of rate card change
  - **Test:** Change rate card; verify bot reflects change within 24h
  - **Expected:** Bot pricing aligns with source of truth

---

### AC-SET-5: Human Escalation

**Feature:** Seamless Handoff to Agent (Story DIAG-105)

---

#### AC-5.1: Escalation triggered appropriately

**Given** patient requests escalation or bot cannot help  
**When** bot detects escalation-worthy situation  
**Then:**

- [ ] **Condition 1a:** Unhandled intent triggers escalation
  - Examples: Clinical question, complaint, appointment booking
  - **Test:** Ask "What does this result mean?" (clinical)
  - **Expected:** Escalation offered

- [ ] **Condition 1b:** Patient frustration detected
  - Metric: 3+ re-prompts without progress
  - **Test:** Deliberately give irrelevant answers 3 times
  - **Expected:** Escalation offered

- [ ] **Condition 1c:** Explicit escalation request
  - Trigger: "Speak to an agent", "I want to talk to someone"
  - **Test:** Say "I want to speak to someone"
  - **Expected:** Escalation offered immediately

---

#### AC-5.2: Escalation option presented clearly

**Given** escalation-worthy situation detected  
**When** bot offers escalation  
**Then:**

- [ ] **Condition 2a:** Clear offer message
  - Message: "I'd love to help! Let me connect you to an agent. Average wait: 3 minutes. Continue? (Yes/No)"
  - **Test:** Bot shows escalation offer
  - **Expected:** Message clear and professional

- [ ] **Condition 2b:** Patient can decline
  - Option: "[No thanks]"
  - **Test:** Decline escalation
  - **Expected:** Return to normal chat flow

- [ ] **Condition 2c:** Patient can confirm
  - Option: "[Yes, connect me]"
  - **Test:** Confirm escalation
  - **Expected:** Escalation ticket created

---

#### AC-5.3: Escalation context passed to agent

**Given** escalation confirmed  
**When** ticket created and routed  
**Then:**

- [ ] **Condition 3a:** Ticket contains context
  - Patient ID, phone, conversation history (last 5 turns)
  - Topic: Reason for escalation (unhandled intent, frustration, etc.)
  - **Test:** Create escalation; check ticket in agent dashboard
  - **Expected:** All context fields populated

- [ ] **Condition 3b:** Agent dashboard shows ticket
  - Real-time: Ticket appears within 1 second
  - Visible info: Patient name, phone, reason, wait time
  - **Test:** Create escalation; check agent dashboard
  - **Expected:** Ticket visible immediately

- [ ] **Condition 3c:** Agent can see conversation history
  - Last 5 bot turns visible to agent
  - Agent sees: User questions + Bot responses
  - **Test:** Agent opens ticket
  - **Expected:** Conversation history visible in agent interface

---

#### AC-5.4: Escalation wait state managed

**Given** escalation ticket created  
**When** patient waits for agent  
**Then:**

- [ ] **Condition 4a:** Patient sees waiting message
  - Message: "Connecting to an agent..." (initial)
  - Update: Every 30 sec with wait time estimate
  - **Test:** Escalate; observe messages every 30 sec
  - **Expected:** Messages appear as promised

- [ ] **Condition 4b:** Agent assignment
  - If agent free: Assign immediately
  - If all busy: Queue with time estimate
  - **Test:** With agents available vs. all busy
  - **Expected:** Appropriate action taken

- [ ] **Condition 4c:** Max wait timeout
  - If wait >2 min without agent: Show fallback option
  - Message: "All agents are busy. Call us at +91-XXXX or try again in 10 min."
  - **Test:** Escalate with all agents unavailable
  - **Expected:** Fallback shown at 2-min mark

---

#### AC-5.5: Agent handoff smooth

**Given** agent accepts escalation ticket  
**When** agent picks up  
**Then:**

- [ ] **Condition 5a:** Agent sees bot context immediately
  - Patient name, phone, previous conversation
  - **Test:** Agent clicks ticket
  - **Expected:** Context loads within 1 sec

- [ ] **Condition 5b:** Agent can reference previous conversation
  - Agent says: "I see you were asking about your report. Is that still your question?"
  - **Test:** Agent has context; customer confirms
  - **Expected:** Natural conversation continuation (not repetition)

- [ ] **Condition 5c:** Conversation medium chosen
  - Agent offers: WhatsApp chat or phone call
  - Patient selects preference
  - **Test:** Agent and patient agree on medium
  - **Expected:** Conversation continues in chosen medium

- [ ] **Condition 5d:** Conversation logged for audit
  - All agent-customer interaction logged
  - Timestamp, agent ID, duration, outcome
  - **Test:** Check audit trail after escalation
  - **Expected:** Escalation fully logged

---

## 4.2 NON-FUNCTIONAL ACCEPTANCE CRITERIA

### AC-SET-6: Security & Compliance

**Feature:** PHI Protection, Encryption, HIPAA Compliance

---

#### AC-6.1: Encryption in transit

- [ ] **Condition 1a:** All API calls use TLS 1.2+
  - Protocol: HTTPS only (no HTTP)
  - Cipher strength: 256-bit minimum
  - **Test:** NMAP/SSL scan bot endpoints
  - **Expected:** TLS 1.2+ enforced, no weak ciphers

- [ ] **Condition 1b:** WhatsApp messages encrypted
  - WhatsApp native E2E encryption
  - No plaintext storage of message content
  - **Test:** Verify WhatsApp API uses encryption
  - **Expected:** Messages encrypted in transit

- [ ] **Condition 1c:** No unencrypted HTTP redirects
  - Test: Try HTTP://  should not redirect or accept
  - **Expected:** 301 redirect to HTTPS, then 200 OK

---

#### AC-6.2: Encryption at rest

- [ ] **Condition 2a:** Patient data encrypted in database
  - Algorithm: AES-256
  - Sensitive fields: phone_hash, otp_hash, session_token, patient_id
  - **Test:** Check database; attempt to read encrypted columns
  - **Expected:** Only ciphertext visible (not plaintext)

- [ ] **Condition 2b:** Encryption key management
  - Keys stored in AWS Secrets Manager (not in code)
  - Key rotation: Every 90 days
  - **Test:** Verify keys in environment, not in repo
  - **Expected:** Keys externalized and rotated

- [ ] **Condition 2c:** Backups encrypted
  - All database backups encrypted with KMS
  - Offline backups stored in S3 with encryption
  - **Test:** Download backup; verify unreadable without KMS key
  - **Expected:** Backup encrypted

---

#### AC-6.3: PHI not logged

- [ ] **Condition 3a:** No patient names in logs
  - Log: "Audit action=REPORT_SENT at 14:30" ( OK)
  - Not: "Audit action=REPORT_SENT for Rajesh at 14:30" ( WRONG)
  - **Test:** Search audit logs for patient names
  - **Expected:** No names found

- [ ] **Condition 3b:** No test results in logs
  - Log: "Audit action=LIS_QUERY success" ( OK)
  - Not: "Audit action=LIS_QUERY returned Glucose=95 mg/dL" ( WRONG)
  - **Test:** Search audit logs for medical values
  - **Expected:** No results found

- [ ] **Condition 3c:** No phone numbers in plaintext logs
  - Phone hashed: SHA256(phone)
  - **Test:** Search logs for "+91-" pattern
  - **Expected:** No phone numbers (only hashes)

- [ ] **Condition 3d:** Only anonymized identifiers logged
  - Logged: phone_hash, patient_id (numeric)
  - **Test:** Inspect audit logs
  - **Expected:** Only anonymized identifiers

---

#### AC-6.4: OTP security

- [ ] **Condition 4a:** OTP never logged plaintext
  - Logged: "OTP_GENERATED" (action only)
  - Not logged: Actual OTP code
  - **Test:** Search logs for 6-digit codes
  - **Expected:** No OTP codes found

- [ ] **Condition 4b:** OTP rate limiting
  - Max 3 attempts per 5 minutes
  - **Test:** Try generating OTP 4 times in 5 min
  - **Expected:** 4th attempt rejected with rate-limit message

- [ ] **Condition 4c:** OTP timeout enforced
  - Valid: Exactly 5 minutes
  - **Test:** Generate OTP; wait 4:59; try  success; wait 2 more sec; try  fail
  - **Expected:** Expiry time enforced

---

#### AC-6.5: Session management security

- [ ] **Condition 5a:** Session tokens cryptographically secure
  - Token: 32 bytes, crypto-random
  - No predictable patterns
  - **Test:** Generate 1,000 tokens; analyze for patterns
  - **Expected:** No patterns detected; all unique

- [ ] **Condition 5b:** Session timeout enforced
  - Timeout: 30 minutes of inactivity
  - **Test:** Create session; wait 31 min; try to use  fail
  - **Expected:** Session expired

- [ ] **Condition 5c:** Session warning before timeout
  - At 25 min: "Session expiring in 5 minutes"
  - At 30 min: Session ends; re-auth required
  - **Test:** Observe session at 25-min mark
  - **Expected:** Warning shown

- [ ] **Condition 5d:** Concurrent session prevention
  - Max 1 active session per phone number
  - **Test:** Open session on 2 devices with same phone  2nd should fail
  - **Expected:** Only 1 active session allowed

---

#### AC-6.6: HIPAA compliance

- [ ] **Condition 6a:** Vendor HIPAA certification
  - WhatsApp (Twilio): HIPAA certified 
  - LIS vendor: HIPAA certified 
  - AWS: HIPAA eligible 
  - **Test:** Review compliance certificates
  - **Expected:** All vendors certified

- [ ] **Condition 6b:** Business Associate Agreements (BAAs) signed
  - Twilio: BAA signed 
  - LIS vendor: BAA signed 
  - AWS: BAA signed 
  - **Test:** Verify BAA file in compliance folder
  - **Expected:** All BAAs on file

- [ ] **Condition 6c:** Audit trail complete
  - All interactions logged: timestamp, action, actor, result
  - Retention: 2+ years
  - **Test:** Query audit logs
  - **Expected:** All interactions documented

- [ ] **Condition 6d:** Breach notification procedure in place
  - Procedure: Documented and tested
  - Timeline: 2472 hours for notification
  - **Test:** Review breach notification plan
  - **Expected:** Procedure documented and approved

---

### AC-SET-7: Performance & Reliability

**Feature:** Response Time, Uptime, Scalability

---

#### AC-7.1: Response time acceptable

- [ ] **Condition 1a:** Average response time
  - Target: <2 seconds (p50  median of 1,000 requests)
  - **Test:** Send 1,000 messages; measure p50 latency
  - **Expected:** 2 sec

- [ ] **Condition 1b:** 95th percentile latency
  - Target: <5 seconds (p95)
  - **Test:** Measure latency distribution; find 95th percentile
  - **Expected:** 5 sec

- [ ] **Condition 1c:** 99th percentile latency
  - Target: <10 seconds (p99)
  - **Test:** Measure latency distribution; find 99th percentile
  - **Expected:** 10 sec

- [ ] **Condition 1d:** LIS API latency
  - Target: <2 seconds
  - **Test:** 100 LIS queries; measure response time
  - **Expected:** 2 sec (p95)

- [ ] **Condition 1e:** Database query time
  - Target: <100 milliseconds (p95)
  - **Test:** 1,000 database queries (session lookups, inserts)
  - **Expected:** 100 ms (p95)

---

#### AC-7.2: System uptime & availability

- [ ] **Condition 2a:** Uptime target
  - Target: 99.5% (3.6 hours downtime/month)
  - Measured: 30-day rolling window
  - **Test:** Infrastructure monitoring
  - **Expected:** 99.5%

- [ ] **Condition 2b:** Scheduled maintenance window
  - When: Off-peak hours (e.g., 23 AM IST, once/week)
  - Duration: Max 1 hour
  - Notice: 48-hour advance notice to users
  - **Test:** Verify maintenance scheduled off-peak
  - **Expected:** No business impact

- [ ] **Condition 2c:** Unplanned downtime recovery
  - RTO (Recovery Time Objective): <1 hour
  - RPO (Recovery Point Objective): <15 minutes
  - **Test:** Simulate database failure; measure recovery time
  - **Expected:** Service restored within 1 hour; data loss <15 min

---

#### AC-7.3: Scalability under load

- [ ] **Condition 3a:** Concurrent users supported
  - Target: 1,000+ simultaneous connections
  - **Test:** Load test with 1,000 concurrent users
  - **Expected:** System remains responsive (no error spike)

- [ ] **Condition 3b:** Message throughput
  - Target: 500 messages/sec sustained
  - **Test:** Sustained load test for 30 minutes
  - **Expected:** All messages processed; no queue backlog

- [ ] **Condition 3c:** Database scalability
  - Target: 500 queries/sec (p95)
  - **Test:** Load test with 500 concurrent DB queries
  - **Expected:** Queries processed in <100 ms (p95)

- [ ] **Condition 3d:** Auto-scaling works
  - Trigger: CPU >70% or queue length >100
  - Action: Spin up additional instances
  - **Test:** Trigger auto-scaling
  - **Expected:** New instances deploy within 2 min

---

### AC-SET-8: User Experience

**Feature:** Mobile Optimization, Accessibility, Error Handling

---

#### AC-8.1: Mobile optimization

- [ ] **Condition 1a:** Text readable on 4-inch screen (iPhone 5)
  - Max line length: 40 characters
  - Font: 12pt equivalent
  - **Test:** Display on iPhone 5
  - **Expected:** No horizontal scrolling; text readable

- [ ] **Condition 1b:** Buttons clickable on small touch screens
  - Button size: 44px  44px (Apple HIG standard)
  - Spacing: 8px between buttons
  - **Test:** Touch buttons on mobile
  - **Expected:** Easy to tap without mistakes

- [ ] **Condition 1c:** Images and emojis render correctly
  - Emojis: Displayed consistently across platforms
  - **Test:** Send message with emojis; view on different phones
  - **Expected:** Emojis display as intended

- [ ] **Condition 1d:** No horizontal scrolling
  - Message width: device width
  - **Test:** Display longest message on 4-inch screen
  - **Expected:** No horizontal scroll needed

---

#### AC-8.2: Accessibility (WCAG 2.1 AA)

- [ ] **Condition 2a:** Color contrast
  - Ratio: 4.5:1 for normal text, 3:1 for large text
  - **Test:** Use contrast checker tool
  - **Expected:** Meets WCAG AA standard

- [ ] **Condition 2b:** Alt text for images/emojis
  - Emoji "" alt: "Check mark" or "Success"
  - **Test:** Screen reader reads alt text
  - **Expected:** Alt text provided and meaningful

- [ ] **Condition 2c:** Keyboard navigation
  - All buttons navigable via Tab key
  - No keyboard traps
  - **Test:** Use only keyboard to navigate
  - **Expected:** Can interact with bot fully via keyboard

- [ ] **Condition 2d:** Clear language
  - No jargon; <12th-grade reading level
  - Sentences <20 words
  - **Test:** Use readability tool (Flesch-Kincaid)
  - **Expected:** 60 (Readable)

---

#### AC-8.3: Error messages

- [ ] **Condition 3a:** Clear and actionable
  - Bad: "Error 500"
  - Good: "System temporarily unavailable. Please try again or call +91-XXXX."
  - **Test:** Trigger errors; observe messages
  - **Expected:** User knows what happened and what to do

- [ ] **Condition 3b:** No jargon
  - Bad: "HIPAA validation failed"
  - Good: "I couldn't verify your identity. Please try again or call us."
  - **Test:** User reads error; understands problem
  - **Expected:** No technical jargon

- [ ] **Condition 3c:** Offer next steps
  - Message includes: What went wrong + What to do next
  - **Test:** Trigger error
  - **Expected:** User empowered to proceed

---

## 4.3 DATA QUALITY ACCEPTANCE CRITERIA

#### AC-9.1: Centre information accuracy

- [ ] All 6 centres have complete, accurate information
  - Address: Matches corporate records
  - Hours: Current (verified with each centre)
  - Parking: Accurate (checked monthly)
  - **Test:** Finance/Ops team audits centre data monthly
  - **Expected:** 100% accuracy

#### AC-9.2: Pricing accuracy

- [ ] All pricing matches current rate card
  - Rate card date: "Effective from Sept 2026"
  - **Test:** Finance team compares displayed pricing vs. rate card
  - **Expected:** 100% match

#### AC-9.3: Report status accuracy

- [ ] Bot report status matches LIS system
  - **Test:** 100 random reports; compare bot display vs. LIS source
  - **Expected:** 99%+ match (tolerance for timing delays)

---

## 4.4 ACCEPTANCE SIGN-OFF

**Acceptance Owner:** QA Lead + Product Lead  
**Compliance Approval:** Compliance Officer  
**Launch Gate:** All AC-SET-1 through AC-SET-8 must be satisfied

---

**Next Phase:** Stage 5  Prompt Engineering

---

**Document Status:**  READY FOR PROMPT ENGINEERING  
**Last Updated:** September 2026  
**Owner:** QA Lead
