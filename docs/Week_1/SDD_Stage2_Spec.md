# STAGE 2: SPEC (Technical Specification)
## WhatsApp Bot for Diagnostics Call Centre  Architecture & Design

**Document Type:** Technical Specification  
**Project:** DiagnoBot WhatsApp Assistant  
**Version:** 1.0  
**Status:** Ready for User Story Definition  
**Date:** September 2026  
**Owner:** Technical Lead  

---

## 2.1 SYSTEM ARCHITECTURE

### High-Level Architecture Diagram

```

                    WhatsApp Users                           
            (Patients on WhatsApp Mobile App)                

                         
                         

               WhatsApp Cloud API                            
        (Twilio or Meta - Message Routing)                   
    Handles authentication, message delivery, compliance     

                         
                         

         Bot Platform (NLU + Conversation Engine)            
     (Twilio Studio / Freshchat / Custom Node.js)           
   Intent detection, dialogue flow, session management       

                         
              
                                  
          
           Auth     LIS     Centre  
         Service    API      Info   
         (OTP)    (Report)  (DB)    
         Server             Cache   
          
                                  
              Validate   Query     Lookup
              OTP        Status    Hours
                                  
        
                        
    
      PostgreSQL Database       
       Sessions                
       Audit Logs              
       Centre Cache            
       User Preferences        
    
                 
    
     Monitoring & Alerting      
      Prometheus               
      Grafana Dashboards       
      Real-time Alerts         
    
```

---

## 2.2 TECHNOLOGY STACK SELECTION

### Messaging Layer
**Technology:** WhatsApp Cloud API (Twilio or Meta)
**Why?**
-  HIPAA-compliant infrastructure
-  Native WhatsApp integration (no custom SMS gateway)
-  Global scale, proven reliability
-  Business Associate Agreement (BAA) available
-  Webhook-based for real-time message handling

**Alternatives Considered:**
- SMS-based bot: No, WhatsApp preferred by patients
- Custom WhatsApp integration: No, too complex; third-party managed service better

---

### Bot Platform / NLU
**Technology:** Twilio Studio (low-code) + Node.js (custom logic)
**Why?**
-  Visual bot builder for quick prototyping
-  Native Twilio integration (same vendor)
-  Fallback to Node.js for custom workflows (OTP, LIS integration)
-  Managed service (no infrastructure management)
-  HIPAA-eligible hosting

**Alternatives Considered:**
- Freshchat: Yes, also good option; go with Twilio for consistency
- Dialogflow: Possible, but overkill for initial scope; defer to Phase 2
- Custom chatbot: No, time-to-market too long

---

### Authentication Service
**Technology:** Twilio SMS OTP + Custom Lookup Service
**Why?**
-  OTP sent via WhatsApp (secure, no separate SMS gateway)
-  Custom lookup queries LIS for registration validation
-  Bcrypt for OTP hashing (never store plaintext)
-  Rate-limiting on OTP generation (3 attempts/5 min)

**Data Flow:**
```
Patient enters: "Check report"
    
Bot: "Registration number?"
Patient: "REG-20260910-001"
    
Service validates against LIS (does registration exist?)
    
Bot: "Date of birth?"
Patient: "12-05-1985"
    
Service validates DOB against LIS 1 day tolerance
    
Generate OTP  Hash with bcrypt  Send via WhatsApp
    
Patient: "123456"
Service: Verify against hash
    
 Session created (30-min valid, no re-auth needed)
```

---

### Database Layer
**Technology:** PostgreSQL (AWS RDS HIPAA-eligible)
**Why?**
-  ACID compliance (transactional integrity)
-  Full-text search (audit log queries)
-  Row-level encryption (sensitive fields)
-  Automated backups, point-in-time recovery
-  HIPAA-compliant managed service (AWS RDS)

**Schema Overview:**
```sql
-- Sessions
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY,
  phone_hash VARCHAR(256) NOT NULL,
  patient_id INT,
  session_token VARCHAR(512),
  created_at TIMESTAMP,
  expires_at TIMESTAMP,
  authenticated BOOLEAN DEFAULT FALSE
);

-- Audit Logs (no PHI)
CREATE TABLE audit_logs (
  log_id UUID PRIMARY KEY,
  timestamp TIMESTAMP,
  action VARCHAR(50), -- MESSAGE_RECEIVED, AUTH_ATTEMPT, QUERY_LIS, etc.
  phone_hash VARCHAR(256),
  intent VARCHAR(50), -- CHECK_REPORT, CENTRE_INFO, etc.
  result VARCHAR(20), -- success, failure, timeout
  response_time_ms INT
);

-- Centre Cache
CREATE TABLE centres (
  centre_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200),
  address VARCHAR(500),
  phone VARCHAR(20),
  hours_json JSONB, -- Mon-Fri, Sat, Sun, holidays
  parking_info VARCHAR(500),
  maps_url VARCHAR(500),
  updated_at TIMESTAMP
);
```

---

### Monitoring & Logging
**Technology:** Prometheus + Grafana + ELK Stack
**Why?**
-  Real-time metrics (latency, error rates, uptime)
-  Dashboards for Steering Committee reporting
-  Alerts for SLA violations
-  Centralized logging (audit, debug, security)
-  Data retention for 2+ years (compliance)

**Key Metrics to Track:**
- Message volume (daily interactions)
- Authentication success/failure rates
- LIS API response times and error rates
- Escalation volume and reasons
- Session timeout frequency
- Database query performance

---

## 2.3 DATA FLOW & SECURITY MODEL

### End-to-End Report Status Query (Secure Flow)

```
 STEP 1: User Message Received 
 Patient WhatsApp: "Check my report status"      
 Incoming to: https://bot.diag.com/webhook       

                     
 STEP 2: Session Validation 
 Check if phone_hash has active session           
 If NO session: Initiate authentication           
 If YES session: Skip to Step 5                   

                     
 STEP 3: Identity Verification (if new session)
 a) Request & validate registration number       
    Query: SELECT * FROM registration            
    WHERE reg_number = 'REG-20260910-001'       
                                                 
 b) Request & validate date of birth             
    Query: SELECT DOB FROM registration          
    WHERE reg_number = ?                         
    Tolerance: 1 day (data entry errors)       
                                                 
 c) Generate OTP                                 
    - Generate: 6-digit random code              
    - Hash: bcrypt(otp)                          
    - Store hash (never plaintext)                
    - Expiry: 5 minutes                          
    - Max attempts: 3                            
                                                 
 d) Send OTP via WhatsApp                        
    WhatsApp message: "Your code: 123456"       
    (Not SMS; ensures WhatsApp channel)          
                                                 
 e) Validate OTP entered by patient              
    - Compare: bcrypt.compare(userOTP, hash)    
    - On success: Create session                 
    - On failure: Increment attempts             
    - 3 failures: Escalate to agent              

                     
 STEP 4: Session Creation 
 sessionToken = generateCryptoToken()            
 INSERT INTO sessions:                           
   session_id: UUID                              
   phone_hash: SHA256(phone_number)              
   patient_id: (looked up from LIS)              
   session_token: (crypto-random)                
   created_at: NOW()                             
   expires_at: NOW() + 30 minutes                
   authenticated: true                           

                     
 STEP 5: Query LIS API (Report Status) 
 GET https://lis.diag.com/api/v1/reports/{pid}  
 Headers:                                        
   Authorization: Bearer {LIS_API_KEY}           
   X-Patient-DOB: SHA256(dob) -- hashed          
   X-Request-ID: {uuid}                          
   X-Timeout: 5000 (milliseconds)                
                                                 
 Response (success, 200 OK):                     
 {                                               
   "reports": [                                  
     {                                           
       "report_id": "REP-20260912-001",          
       "test_name": "12-Test Blood Panel",       
       "status": "ready",                        
       "sample_date": "2026-09-10",              
       "report_date": "2026-09-12T02:30:00Z",   
       "download_url": "https://.../{token}",   
       "url_expires_at": "2026-09-12T11:30Z",   
       "estimated_ready_time": null              
     }                                           
   ]                                             
 }                                               
                                                 
 Error Response (timeout):                       
 "System temporarily unavailable. Try again or  
  call +91-XXXX. We apologize for the delay!"  

                     
 STEP 6: Format & Send Response 
 Build user-friendly message:                    
                                                 
 " Test: 12-Test Blood Panel                  
  Status:  READY FOR DOWNLOAD                 
  Sample collected: 10-Sep-2026                 
  Report generated: 12-Sep-2026, 2:30 PM        
   Download: [Secure Link]                    
                                                 
  What's next?                                   
  [a] Check another report                       
  [b] Centre timings                             
  [c] Pricing                                    
  [d] Speak to an agent"                         

                     
 STEP 7: Audit Logging (no PHI) 
 INSERT INTO audit_logs:                         
   timestamp: NOW()                              
   action: "REPORT_STATUS_SENT"                  
   phone_hash: SHA256(phone)                     
   intent: "CHECK_REPORT_STATUS"                 
   result: "success"                             
   response_time_ms: 234                         
                                                 
 NOTE: No test results, no names, no PHI        
       Only action + anonymized phone + metrics  

```

### Security Principles

**Encryption in Transit:**
- All API calls use TLS 1.2+ (HTTPS only)
- No unencrypted HTTP endpoints
- WhatsApp messages encrypted end-to-end (WhatsApp native)

**Encryption at Rest:**
- Patient data in database encrypted with AES-256
- Sensitive fields: phone_hash, OTP_hash, session_token
- Backups encrypted; point-in-time recovery enabled

**PHI Protection:**
- No patient names logged in audit trails
- No test results stored in bot database
- Only patient ID (hashed) used for correlation
- Download links are time-limited (1 hour) and single-use

**Rate Limiting:**
- Max 3 OTP generation attempts per 5 minutes (prevent brute force)
- Max 5 report queries per session (prevent resource exhaustion)
- Max 100 messages/day per user (prevent spam/abuse)

**Session Management:**
- Session tokens cryptographically secure (32 bytes random)
- Sessions expire after 30 minutes of inactivity
- Session context cleared on logout
- Concurrent session prevention (1 active session per phone)

---

## 2.4 API SPECIFICATIONS

### WhatsApp Inbound API (Webhook)

**Endpoint:** `POST /webhook/whatsapp`  
**Authentication:** Bearer Token (in Authorization header)  
**Content-Type:** application/json

**Request Format:**
```json
{
  "messages": [
    {
      "from": "+91-9876543210",
      "id": "msg_abc123",
      "timestamp": "2026-09-12T10:30:00Z",
      "text": {
        "body": "Check my report status"
      },
      "type": "text"
    }
  ]
}
```

**Response Format (Success):**
```json
{
  "messages": [
    {
      "messaging_product": "whatsapp",
      "recipient_type": "individual",
      "to": "+91-9876543210",
      "type": "text",
      "text": {
        "body": "Hi! To check your report status, I need to verify your identity...\n\nWhat's your registration number?"
      }
    }
  ]
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": {
    "code": 400,
    "message": "Invalid webhook signature",
    "type": "INVALID_SIGNATURE"
  }
}
```

---

### LIS API (Backend Integration)

**Endpoint:** `GET /api/v1/reports/{patient_id}`  
**Authentication:** Bearer Token (LIS_API_KEY from environment)  
**Timeout:** 5 seconds maximum

**Request Headers:**
```
Authorization: Bearer {LIS_API_KEY}
X-Patient-DOB: {SHA256_HASH_OF_DOB}
X-Request-ID: {UUID}
Accept: application/json
```

**Response (200 OK - Reports Found):**
```json
{
  "status": "success",
  "reports": [
    {
      "report_id": "REP-20260912-001",
      "test_name": "12-Test Blood Panel",
      "status": "ready",
      "sample_date": "2026-09-10",
      "report_date": "2026-09-12T02:30:00Z",
      "download_url": "https://secure.reports.com/download/{token}",
      "url_expires_at": "2026-09-12T11:30:00Z",
      "estimated_ready_time": null
    },
    {
      "report_id": "REP-20260912-002",
      "test_name": "COVID-19 RT-PCR",
      "status": "processing",
      "sample_date": "2026-09-12",
      "report_date": null,
      "download_url": null,
      "url_expires_at": null,
      "estimated_ready_time": "2026-09-12T18:00:00Z"
    }
  ]
}
```

**Response (401 Unauthorized - Patient Not Found):**
```json
{
  "status": "error",
  "error": "patient_not_found",
  "message": "No reports found for this patient ID"
}
```

**Response (503 Service Unavailable - LIS Down):**
```json
{
  "status": "error",
  "error": "service_unavailable",
  "message": "LIS is currently under maintenance. Please try again later."
}
```

---

### Centre Info API (Internal Cache Query)

**Endpoint:** `GET /api/v1/centres`  
**Authentication:** Internal service (no auth required)  
**Caching:** 24-hour TTL

**Response:**
```json
{
  "centres": [
    {
      "centre_id": "BLR-MG-001",
      "name": "Bangalore - MG Road",
      "address": "123 MG Road, Bangalore 560001",
      "phone": "+91-80-XXXX-XXXX",
      "hours": {
        "mon_fri": "07:00-20:00",
        "saturday": "07:00-20:00",
        "sunday": "08:00-14:00",
        "holidays": ["2026-10-02", "2026-10-25"]
      },
      "parking": "Free underground (50 spots)",
      "directions_url": "https://maps.google.com/?q=123+MG+Road",
      "wait_time_minutes": 12
    }
  ]
}
```

---

## 2.5 NON-FUNCTIONAL REQUIREMENTS

### Performance Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Average Response Time** | <2 seconds (p50) | Application logs |
| **95th Percentile Latency** | <5 seconds (p95) | Application logs |
| **99th Percentile Latency** | <10 seconds (p99) | Application logs |
| **LIS API Latency** | <2 seconds | LIS monitoring |
| **Database Query Time** | <100 ms (p95) | Database logs |

### Availability & Reliability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **System Uptime** | 99.5% (3.6h downtime/month) | Infrastructure monitoring |
| **Scheduled Maintenance Window** | 1 hour/week (off-peak hours) | Maintenance calendar |
| **RTO (Recovery Time Objective)** | <1 hour | Disaster recovery plan |
| **RPO (Recovery Point Objective)** | <15 minutes | Backup frequency |

### Scalability

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Concurrent Users** | 1,000+ simultaneous | Load testing |
| **Daily Message Volume** | 2,000+ messages/day (scales 3x during flu season) | Analytics |
| **Database Throughput** | 500 queries/sec (p95) | Database monitoring |
| **Horizontal Scaling** | Auto-scale based on load | Kubernetes/ECS |

### Security & Compliance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Encryption in Transit** | TLS 1.2+ (all connections) | SSL/TLS audit |
| **Encryption at Rest** | AES-256 (all sensitive data) | Database audit |
| **Authentication Success Rate** | 95% (first attempt) | Bot logs |
| **Failed Auth Escalation** | 100% (3 failed attempts  agent) | Audit trail |
| **Audit Log Retention** | 2+ years (encrypted backups) | Database retention policy |
| **HIPAA Compliance** | 100% (external audit) | Third-party audit |

### Data Quality

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| **Data Accuracy (Centre Info)** | 100% (manual verification) | Manual audit |
| **Pricing Accuracy** | 100% (finance approved) | Finance sign-off |
| **Report Status Accuracy** | 99%+ (matches LIS) | Reconciliation report |
| **Log Completeness** | 100% (all interactions logged) | Audit trail verification |

---

## 2.6 DISASTER RECOVERY & BACKUP STRATEGY

### Backup Schedule
- **Database:** Continuous replication (hot standby) + Daily snapshots + Weekly offline backup
- **Configuration:** Version-controlled (Git); immutable backups
- **Audit Logs:** Encrypted archival to S3 (Glacier for 2+ years)

### Failover Procedure
1. **Automated:** Database failover to replica (<30 sec)
2. **Manual:** Disaster recovery playbook for multi-region failover (if needed)
3. **Communication:** Automated alerts to Ops team; status page updated

---

## 2.7 DEPENDENCIES & ASSUMPTIONS

### External Dependencies
-  WhatsApp Cloud API (Twilio/Meta)  HIPAA BAA required
-  LIS API  Must provide real-time report status (<5 sec)
-  Internet connectivity  For API calls, no offline mode

### Internal Dependencies
-  Call-centre system  For escalation routing
-  Database infrastructure  PostgreSQL HIPAA-eligible
-  IT Operations  For monitoring, on-call support

### Assumptions
-  LIS API is stable and available 99%+ of the time
-  Patient phone numbers are valid and reachable via WhatsApp
-  Call-centre team can handle escalations trained

---

## 2.8 DEPLOYMENT ARCHITECTURE

### Cloud Infrastructure (AWS)
- **ECS (Elastic Container Service):** Bot service (auto-scaling)
- **RDS (Relational Database Service):** PostgreSQL (HIPAA-eligible)
- **ALB (Application Load Balancer):** Request routing, SSL termination
- **CloudWatch:** Monitoring, logging, alerts
- **VPC:** Isolated network, private subnets for database

### Network Security
-  HTTPS only (no HTTP)
-  WAF (Web Application Firewall) for DDoS protection
-  Private database subnet (not publicly accessible)
-  VPN for administrative access

---

**Next Phase:** Stage 3  User Stories & Scenarios

---

**Document Status:**  READY FOR USER STORY DEFINITION  
**Last Updated:** September 2026  
**Owner:** Technical Lead  
