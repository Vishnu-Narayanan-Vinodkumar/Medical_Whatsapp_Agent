# STAGE 6: CODE (Implementation Blueprint & Pseudocode)
## WhatsApp Bot for Diagnostics  Architecture & Code Structure

**Document Type:** Code Architecture, Pseudocode, Deployment Guide  
**Project:** DiagnoBot WhatsApp Assistant  
**Version:** 1.0  
**Status:** Ready for Development  
**Date:** September 2026  
**Owner:** Technical Lead  

---

## 6.1 SYSTEM ARCHITECTURE OVERVIEW

### Technology Stack Selection

| Layer | Technology | Why | Compliance |
|-------|-----------|-----|-----------|
| **Messaging** | WhatsApp Cloud API (Twilio) | Global scale, HIPAA BAA |  HIPAA-eligible |
| **Bot Engine** | Twilio Studio + Node.js | Visual builder + custom logic |  HIPAA-eligible |
| **Authentication** | Twilio OTP + PostgreSQL | Secure, rate-limited |  Bcrypt hashing |
| **Database** | PostgreSQL (AWS RDS) | ACID, encrypted backups |  HIPAA-eligible |
| **API Gateway** | AWS API Gateway | TLS termination, logging |  HIPAA-eligible |
| **Compute** | AWS ECS (Docker) | Auto-scaling, managed |  HIPAA-eligible |
| **Monitoring** | Prometheus + Grafana | Real-time metrics, alerts |  Data retention |
| **Logging** | ELK Stack (Elasticsearch) | Audit logs, searchable |  2+ years retention |
| **Infrastructure** | Terraform + CloudFormation | IaC, version-controlled |  Audit-friendly |

---

## 6.2 PROJECT STRUCTURE

```
diagnobot-whatsapp/
 docker/
    Dockerfile                    # Bot service container
    docker-compose.yml            # Local dev environment
 k8s/                              # Kubernetes manifests (future)
 terraform/                        # Infrastructure as Code
    vpc.tf                        # Network setup
    rds.tf                        # Database
    ecs.tf                        # Container orchestration
    secrets.tf                    # Environment variables
    main.tf
 src/
    bot/
       handlers/
          authentication.js     # OTP, session mgmt
          report-status.js      # LIS query handler
          centre-info.js        # Centre data handler
          pricing.js            # Pricing display
          escalation.js         # Agent handoff
       middleware/
          auth-check.js         # Session validation
          rate-limit.js         # DDoS protection
          audit-log.js          # Compliance logging
       services/
          lis-api.js            # LIS integration
          session.js            # Session store
          otp.js                # OTP generation/validation
          encryption.js         # AES-256 encryption
       prompts/
          system-prompt.txt     # Core bot instructions
          error-messages.json   # Error response templates
          conversation-flows.json # Conversation flows
       app.js                    # Main Express app
    api/
       routes/
          webhook.js            # WhatsApp webhook
          health.js             # Health check endpoint
          metrics.js            # Prometheus metrics
       server.js
    database/
       migrations/
          001-init-schema.sql   # Initial schema
          002-add-audit-logs.sql
          003-add-indices.sql
       seeds/
          centres.sql           # 6 centres data
          pricing.sql           # Test pricing
       pool.js                   # Connection pool
    utils/
        logger.js                 # Structured logging
        validators.js             # Input validation
        formatters.js             # Message formatting
 tests/
    unit/
       authentication.test.js
       report-status.test.js
       encryption.test.js
       validators.test.js
    integration/
       lis-api.test.js
       escalation.test.js
       end-to-end.test.js
    load/
        load-test.js              # k6 load testing
        stress-test.js
 docs/
    API.md                        # API documentation
    DEPLOYMENT.md                 # Deployment guide
    RUNBOOK.md                    # Operations guide
    COMPLIANCE.md                 # Audit guide
 .env.example                      # Environment template
 .github/
    workflows/
        ci.yml                    # GitHub Actions CI
        deploy.yml                # Auto-deployment
 package.json
 package-lock.json
 README.md
```

---

## 6.3 CORE MODULES: PSEUDOCODE

### Module 1: Inbound Message Handler

**File:** `src/bot/app.js`

```javascript
/**
 * Main entry point for WhatsApp webhook
 * Receives inbound messages and routes to appropriate handler
 */

const express = require('express');
const { handleMessage } = require('./handlers/message-router');
const { auditLog } = require('./middleware/audit-log');
const { rateLimiter } = require('./middleware/rate-limit');

const app = express();

// Middleware
app.use(express.json());
app.use(rateLimiter);                    // DDoS protection
app.use(auditLog.beforeProcess);         // Log before processing

/**
 * WhatsApp Webhook: POST /webhook/whatsapp
 * Receives: { "messages": [{ "from": "+91-...", "text": { "body": "..." } }] }
 */
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    // Validate webhook signature (Twilio)
    const signature = req.headers['x-twilio-signature'];
    if (!validateWebhookSignature(signature, req.body)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Extract message
    const message = req.body.messages?.[0];
    if (!message) {
      return res.status(400).json({ error: 'No message' });
    }

    // Route to handler
    const response = await handleMessage(message);

    // Send response via WhatsApp API
    await sendWhatsAppMessage({
      to: message.from,
      text: response.text,
      buttons: response.buttons || null,
    });

    // Log after processing
    await auditLog.afterProcess({
      phone: message.from,
      intent: response.intent,
      result: 'success',
    });

    return res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    await auditLog.afterProcess({
      phone: req.body.messages?.[0]?.from,
      intent: 'unknown',
      result: 'error',
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Health Check: GET /health
 * Used by load balancer for availability checks
 */
app.get('/health', (req, res) => {
  return res.json({ status: 'healthy', timestamp: new Date() });
});

/**
 * Metrics: GET /metrics
 * Prometheus metrics for monitoring
 */
app.get('/metrics', (req, res) => {
  const metrics = getPrometheusMetrics();
  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DiagnoBot listening on port ${PORT}`);
});

module.exports = app;
```

---

### Module 2: Authentication Handler

**File:** `src/bot/handlers/authentication.js`

```javascript
/**
 * Handle OTP-based authentication flow
 * Steps: Registration number  DOB  OTP Generation  OTP Validation  Session
 */

const { generateOTP, hashOTP, compareOTP } = require('../services/otp');
const { validateRegistration, validateDOB } = require('../services/lis-api');
const { createSession } = require('../services/session');
const { encrypt, decrypt } = require('../services/encryption');

const AUTH_TIMEOUT = 5 * 60 * 1000;  // 5 minutes
const OTP_VALIDITY = 5 * 60 * 1000;  // 5 minutes
const OTP_ATTEMPTS = 3;

/**
 * Initiate OTP-based authentication for new session
 * @param {String} userPhone - User's WhatsApp phone
 * @param {String} userMessage - User's message (may contain reg number)
 * @returns {Object} response
 */
async function initiateAuthentication(userPhone, userMessage) {
  try {
    // Check if user has active session
    const existingSession = await getActiveSession(userPhone);
    if (existingSession) {
      // User already authenticated; skip to intent handling
      return { skip: true, session: existingSession };
    }

    // Get or create auth state
    let authState = await getAuthState(userPhone);
    if (!authState) {
      authState = {
        phone: userPhone,
        step: 'REQUEST_REG_NUMBER',
        createdAt: new Date(),
        attempts: 0,
      };
      await saveAuthState(authState);

      return {
        intent: 'START_AUTH',
        text: 'Hi! I\'m DiagnoBot. To check your report securely, ' +
              'I need to verify your identity.\n\n' +
              'What\'s your registration number? (Format: REG-XXXXXX)',
      };
    }

    // Continue auth based on current step
    if (authState.step === 'REQUEST_REG_NUMBER') {
      return await collectRegistrationNumber(authState, userMessage);
    }
    if (authState.step === 'REQUEST_DOB') {
      return await collectDOB(authState, userMessage);
    }
    if (authState.step === 'REQUEST_OTP') {
      return await validateOTP(authState, userMessage);
    }

  } catch (error) {
    console.error('Auth error:', error);
    return {
      error: true,
      text: 'An error occurred. Please try again or call us.',
    };
  }
}

/**
 * Collect and validate registration number
 */
async function collectRegistrationNumber(authState, userMessage) {
  const regNumber = extractRegNumber(userMessage);
  
  if (!regNumber) {
    return {
      text: 'I didn\'t recognize that format. ' +
            'Please provide your registration number (e.g., REG-20260910-001).',
    };
  }

  // Validate reg number in LIS
  const patientExists = await validateRegistration(regNumber);
  if (!patientExists) {
    return {
      text: 'I can\'t find that registration. ' +
            'Please double-check or call us at +91-80-XXXX-XXXX.',
    };
  }

  // Save reg number; move to DOB collection
  authState.regNumber = regNumber;
  authState.step = 'REQUEST_DOB';
  authState.attempts = 0;
  await updateAuthState(authState);

  return {
    text: 'Thanks! Now, for security, please confirm your date of birth.\n' +
          'Format: DD-MM-YYYY (e.g., 12-05-1985)',
  };
}

/**
 * Collect and validate date of birth
 */
async function collectDOB(authState, userMessage) {
  const dob = extractDOB(userMessage);
  
  if (!dob) {
    return {
      text: 'I didn\'t recognize that date format. ' +
            'Please try again: DD-MM-YYYY',
    };
  }

  // Validate DOB in LIS (1 day tolerance)
  const dobMatches = await validateDOB(authState.regNumber, dob);
  if (!dobMatches) {
    authState.attempts++;
    await updateAuthState(authState);

    if (authState.attempts >= 3) {
      // Escalate after 3 failures
      return await escalateToAgent(authState.phone, 'DOB_FAILED_3X');
    }

    return {
      text: `Date of birth doesn't match. ` +
            `(Attempt ${authState.attempts}/3). ` +
            `Try again or call +91-80-XXXX-XXXX.`,
    };
  }

  // DOB verified; generate and send OTP
  authState.dob = dob;
  authState.step = 'REQUEST_OTP';
  const otp = generateOTP();  // 6-digit random
  const otpHash = hashOTP(otp);

  authState.otpHash = otpHash;
  authState.otpExpiresAt = new Date(Date.now() + OTP_VALIDITY);
  authState.otpAttempts = 0;
  await updateAuthState(authState);

  // Send OTP via WhatsApp
  await sendWhatsAppMessage({
    to: authState.phone,
    text: `Your verification code is: ${otp}\n\nThis expires in 5 minutes.`,
  });

  return {
    text: 'I\'ve sent you a 6-digit code via WhatsApp.\n' +
          'Please enter it to verify your identity.',
  };
}

/**
 * Validate OTP and create session
 */
async function validateOTP(authState, userMessage) {
  const userOTP = extractOTP(userMessage);

  if (!userOTP) {
    return {
      text: 'I didn\'t recognize that code format. Please enter the 6-digit code.',
    };
  }

  // Check expiry
  if (new Date() > authState.otpExpiresAt) {
    // Resend OTP
    authState.step = 'SEND_OTP';
    await updateAuthState(authState);
    return {
      text: 'Your code expired. Sending a new one...',
      // Recursive call to regenerate OTP
    };
  }

  // Verify OTP hash
  const otpValid = compareOTP(userOTP, authState.otpHash);
  if (!otpValid) {
    authState.otpAttempts++;
    await updateAuthState(authState);

    if (authState.otpAttempts >= OTP_ATTEMPTS) {
      return await escalateToAgent(authState.phone, 'OTP_FAILED_3X');
    }

    return {
      text: `That code is incorrect. ` +
            `(Attempt ${authState.otpAttempts}/${OTP_ATTEMPTS}). ` +
            `Please try again.`,
    };
  }

  // OTP verified! Create session
  const patientID = await getPatientIDFromReg(authState.regNumber);
  const sessionToken = generateSessionToken();  // 32-byte crypto-random

  const session = {
    phone: authState.phone,
    regNumber: authState.regNumber,
    patientID,
    sessionToken,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),  // 30 min
    authenticated: true,
  };

  await createSession(session);
  await deleteAuthState(authState.phone);

  return {
    intent: 'AUTH_SUCCESS',
    text: ' Identity verified!\n\n' +
          'What would you like to know?\n' +
          '[a] Report status [b] Centre timings [c] Pricing [d] Agent',
    session,
  };
}

/**
 * Helper: Extract registration number from user input
 */
function extractRegNumber(text) {
  const match = text.match(/REG[_-]?\d{8}[_-]?\d{3}/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Helper: Extract date of birth (DD-MM-YYYY)
 */
function extractDOB(text) {
  const match = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (!match) return null;
  
  const [_, day, month, year] = match;
  const date = new Date(year, month - 1, day);
  
  // Validate
  if (date.getFullYear() !== parseInt(year) ||
      date.getMonth() !== parseInt(month) - 1 ||
      date.getDate() !== parseInt(day) ||
      date > new Date()) {
    return null;
  }
  
  return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
}

/**
 * Helper: Extract OTP (6 digits)
 */
function extractOTP(text) {
  const match = text.match(/\d{6}/);
  return match ? match[0] : null;
}

module.exports = {
  initiateAuthentication,
  extractRegNumber,
  extractDOB,
  extractOTP,
};
```

---

### Module 3: Report Status Handler

**File:** `src/bot/handlers/report-status.js`

```javascript
/**
 * Handle report status queries
 * Query LIS, parse response, format for display
 */

const { queryLIS } = require('../services/lis-api');

/**
 * Handle report status request
 * @param {Object} session - Authenticated session
 * @returns {Object} response
 */
async function handleReportStatus(session) {
  try {
    const patientID = session.patientID;

    // Query LIS with 5-second timeout
    const reports = await queryLISWithTimeout(patientID, 5000);

    if (!reports || reports.length === 0) {
      return {
        intent: 'REPORT_STATUS',
        text: 'No recent reports found. ' +
              'If you recently completed a test, it may take up to 48 hours.\n\n' +
              'What\'s next?\n' +
              '[a] Check centre timings [b] Pricing [c] Speak to agent',
      };
    }

    // Format each report
    let responseText = '';
    reports.forEach((report, index) => {
      const status = report.status.toUpperCase();
      const statusIcon = getStatusIcon(status);

      responseText += `\n Test ${index + 1}: ${report.testName}\n`;
      responseText += `Status: ${statusIcon} ${formatStatus(status)}\n`;
      responseText += `Sample: ${formatDate(report.sampleDate)}\n`;

      if (status === 'READY') {
        responseText += `Report: ${formatDateTime(report.reportDate)}\n`;
        responseText += ` Download (expires ${formatDateTime(report.urlExpiresAt)}):\n`;
        responseText += `${report.downloadURL}\n`;
      } else if (status === 'PROCESSING') {
        responseText += `Est. ready: ${formatDateTime(report.estimatedReadyTime)}\n`;
      } else if (status === 'DELAYED') {
        responseText += `Issue: ${report.errorMessage || 'Contact us'}\n`;
      }
    });

    responseText += '\n\nWhat's next?\n' +
                   '[a] Check another report [b] Centre timings [c] Pricing [d] Agent';

    return {
      intent: 'REPORT_STATUS',
      text: responseText,
    };

  } catch (error) {
    if (error.code === 'TIMEOUT') {
      return {
        intent: 'REPORT_STATUS',
        text: 'System temporarily unavailable. Please try again or call +91-80-XXXX-XXXX.',
        error: true,
      };
    }
    throw error;
  }
}

/**
 * Query LIS with timeout protection
 */
async function queryLISWithTimeout(patientID, timeoutMs) {
  return Promise.race([
    queryLIS(patientID),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    ),
  ]);
}

/**
 * Helper: Get icon for status
 */
function getStatusIcon(status) {
  const icons = {
    'READY': '',
    'PROCESSING': '',
    'DELAYED': '',
    'ERROR': '',
  };
  return icons[status] || '';
}

/**
 * Helper: Format status for display
 */
function formatStatus(status) {
  const labels = {
    'READY': 'READY FOR DOWNLOAD',
    'PROCESSING': 'PROCESSING',
    'DELAYED': 'DELAYED',
    'ERROR': 'ERROR',
  };
  return labels[status] || status;
}

/**
 * Helper: Format date (DD-MMM-YYYY)
 */
function formatDate(iso) {
  const date = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()}-${months[date.getMonth()]}-${date.getFullYear()}`;
}

/**
 * Helper: Format datetime (DD-MMM-YYYY, HH:MM AM/PM)
 */
function formatDateTime(iso) {
  const date = new Date(iso);
  const dateStr = formatDate(iso);
  const hours = date.getHours() % 12 || 12;
  const mins = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${dateStr}, ${hours}:${mins} ${ampm}`;
}

module.exports = {
  handleReportStatus,
  formatDate,
  formatDateTime,
};
```

---

### Module 4: Audit Logging (Compliance)

**File:** `src/bot/middleware/audit-log.js`

```javascript
/**
 * Audit logging for HIPAA compliance
 * CRITICAL: Never log PHI (names, results, phone numbers)
 * Only log: timestamp, action, hashed phone, intent, result
 */

const { hash } = require('../services/encryption');

/**
 * Log interaction (no PHI)
 * @param {Object} entry - {timestamp, action, phone, intent, result}
 */
async function logInteraction(entry) {
  const safeEntry = {
    id: generateUUID(),
    timestamp: entry.timestamp || new Date(),
    action: entry.action,  // MESSAGE_RECEIVED, AUTH_SUCCESS, REPORT_SENT, etc.
    phoneHash: hash(entry.phone),  // SHA-256 hash, not plaintext
    messageType: entry.messageType || 'unknown',
    intent: entry.intent || null,  // CHECK_REPORT_STATUS, CENTRE_INFO, etc.
    result: entry.result || 'unknown',  // success, failure, timeout
    responseTimeMs: entry.responseTimeMs || null,
    errorCode: entry.errorCode || null,
    // NO PHI: no names, no test results, no phone numbers
  };

  try {
    await db.query(
      `INSERT INTO audit_logs 
       (id, timestamp, action, phone_hash, intent, result, response_time_ms, error_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [safeEntry.id, safeEntry.timestamp, safeEntry.action, safeEntry.phoneHash,
       safeEntry.intent, safeEntry.result, safeEntry.responseTimeMs, safeEntry.errorCode]
    );
  } catch (dbError) {
    console.error('Audit log failed (non-fatal):', dbError);
    // Don't throw; audit log failures should not break the bot
  }
}

/**
 * Retrieve audit logs for compliance audits
 * Filter by date range, action, phone hash
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

  query += ' ORDER BY timestamp DESC LIMIT 10000';

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Middleware: Log before processing
 */
async function beforeProcess(req, res, next) {
  req.startTime = Date.now();
  next();
}

/**
 * Middleware: Log after processing
 */
async function afterProcess(entry) {
  const duration = Date.now() - (entry.startTime || 0);
  await logInteraction({
    ...entry,
    timestamp: new Date(),
    responseTimeMs: duration,
  });
}

module.exports = {
  logInteraction,
  getAuditLogs,
  beforeProcess,
  afterProcess,
};
```

---

## 6.4 DATABASE SCHEMA

**File:** `src/database/migrations/001-init-schema.sql`

```sql
-- Sessions (active user sessions)
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash VARCHAR(256) NOT NULL,
  patient_id INT NOT NULL,
  session_token VARCHAR(512) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  authenticated BOOLEAN NOT NULL DEFAULT FALSE,
  INDEX idx_phone_hash (phone_hash),
  INDEX idx_expires_at (expires_at)
);

-- Audit logs (HIPAA-compliant, NO PHI)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  action VARCHAR(50) NOT NULL,  -- MESSAGE_RECEIVED, AUTH_SUCCESS, REPORT_SENT, etc.
  phone_hash VARCHAR(256) NOT NULL,  -- Hashed, not plaintext
  intent VARCHAR(50),  -- CHECK_REPORT_STATUS, CENTRE_INFO, etc.
  result VARCHAR(20),  -- success, failure, timeout, error
  response_time_ms INT,
  error_code VARCHAR(20),
  INDEX idx_timestamp (timestamp),
  INDEX idx_action (action),
  INDEX idx_phone_hash (phone_hash)
);

-- Centres directory
CREATE TABLE centres (
  centre_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  address VARCHAR(500) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  hours_json JSONB NOT NULL,  -- {"mon_fri": "07:00-20:00", "saturday": "07:00-20:00", ...}
  parking_info VARCHAR(500),
  maps_url VARCHAR(500),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Auth state (temporary, cleaned up after session created)
CREATE TABLE auth_state (
  phone_hash VARCHAR(256) PRIMARY KEY,
  step VARCHAR(50),  -- REQUEST_REG_NUMBER, REQUEST_DOB, REQUEST_OTP
  reg_number VARCHAR(50),
  otp_hash VARCHAR(256),  -- Bcrypt hash, not plaintext
  otp_expires_at TIMESTAMP,
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_created_at (created_at)
);

-- Escalation tickets
CREATE TABLE escalation_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash VARCHAR(256) NOT NULL,
  reason VARCHAR(200) NOT NULL,
  priority VARCHAR(20),  -- HIGH, MEDIUM, LOW
  status VARCHAR(50) DEFAULT 'WAITING',  -- WAITING, ASSIGNED, RESOLVED
  assigned_to VARCHAR(100),  -- Agent ID
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Data retention policies
-- Sessions: Deleted after expiry (30 min)
-- Auth state: Deleted after session creation (or 5 min timeout)
-- Audit logs: Retained for 2+ years (encrypted archival to S3 after 1 year)
-- Escalation tickets: Retained for 1 year

```

---

## 6.5 DEPLOYMENT CONFIGURATION

### Docker Configuration

**File:** `docker/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY config ./config

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start app
CMD ["node", "src/bot/app.js"]
```

**File:** `docker-compose.yml`

```yaml
version: '3.8'
services:
  bot:
    build: ./docker
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/diagnobot
      - TWILIO_API_KEY=${TWILIO_API_KEY}
      - LIS_API_KEY=${LIS_API_KEY}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - LOG_LEVEL=info
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    restart: always

  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=diagnobot
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/database/migrations:/docker-entrypoint-initdb.d
    restart: always

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./config/prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
    restart: always

volumes:
  postgres_data:
```

---

## 6.6 TESTING STRATEGY

### Unit Tests Example

**File:** `tests/unit/authentication.test.js`

```javascript
const { generateOTP, hashOTP, compareOTP } = require('../../src/services/otp');
const { extractRegNumber, extractDOB, extractOTP } = require('../../src/bot/handlers/authentication');

describe('Authentication Module', () => {

  test('Should generate 6-digit OTP', () => {
    const otp = generateOTP();
    expect(otp).toMatch(/^\d{6}$/);
  });

  test('Should hash OTP securely', () => {
    const otp = '123456';
    const hash = hashOTP(otp);
    expect(hash).not.toBe(otp);  // Not plaintext
    expect(compareOTP(otp, hash)).toBe(true);  // Hash matches
  });

  test('Should extract valid registration number', () => {
    expect(extractRegNumber('My reg is REG-20260910-001')).toBe('REG-20260910-001');
    expect(extractRegNumber('REG12345')).toBeNull();
  });

  test('Should extract valid DOB', () => {
    expect(extractDOB('My DOB is 12-05-1985')).toBe('12-05-1985');
    expect(extractDOB('1985-05-12')).toBeNull();  // Wrong format
  });

  test('Should extract OTP', () => {
    expect(extractOTP('My code is 123456')).toBe('123456');
    expect(extractOTP('code12345')).toBeNull();
  });
});
```

### Integration Tests Example

**File:** `tests/integration/lis-api.test.js`

```javascript
const { queryLIS } = require('../../src/services/lis-api');

describe('LIS API Integration', () => {

  test('Should query LIS and return reports', async () => {
    const reports = await queryLIS('PATIENT-001');
    expect(Array.isArray(reports)).toBe(true);
    expect(reports[0]).toHaveProperty('testName');
    expect(reports[0]).toHaveProperty('status');
  });

  test('Should handle LIS timeout gracefully', async () => {
    expect(() => queryLISWithTimeout('PATIENT-002', 100)).rejects.toThrow('TIMEOUT');
  });

  test('Should return 401 for invalid patient', async () => {
    const response = await queryLIS('INVALID-PATIENT');
    expect(response.error).toBe('patient_not_found');
  });
});
```

---

## 6.7 DEPLOYMENT RUNBOOK

### Pre-Deployment Checklist

- [ ] All unit tests pass (>95% coverage)
- [ ] All integration tests pass
- [ ] Load test passes (500+ msgs/sec, <5sec p95)
- [ ] Security audit passed (no PHI in logs)
- [ ] Compliance Officer sign-off
- [ ] Database backup verified
- [ ] Rollback procedure documented

### Deployment Steps

1. **Build Docker image**
   ```bash
   docker build -f docker/Dockerfile -t diagnobot:v1.0.0 .
   docker tag diagnobot:v1.0.0 ECR_REGISTRY/diagnobot:v1.0.0
   docker push ECR_REGISTRY/diagnobot:v1.0.0
   ```

2. **Deploy to ECS**
   ```bash
   aws ecs update-service --cluster diagnobot-prod --service bot-service \
     --force-new-deployment
   ```

3. **Verify deployment**
   ```bash
   # Health check
   curl https://bot.diag.com/health
   
   # Monitor logs
   aws logs tail /ecs/diagnobot-prod --follow
   ```

4. **Run smoke tests**
   - Send test message: "Hi"
   - Verify response within 2 sec
   - Check audit logs for successful entry

5. **Monitor for 24 hours**
   - Watch Grafana dashboard
   - Check error rates (should be <0.1%)
   - Monitor LIS API latency

---

## 6.8 OPERATIONS GUIDE

### Health Checks

```bash
# Application health
curl https://bot.diag.com/health

# Database health
psql -h db.diag.com -U diagnobot -d diagnobot -c "SELECT NOW();"

# LIS API connectivity
curl -H "Authorization: Bearer $LIS_API_KEY" \
  https://lis.diag.com/api/v1/reports/TEST-PATIENT
```

### Troubleshooting

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| High latency (>5 sec) | LIS API slow | Check LIS status; scale ECS if needed |
| Auth failures | OTP timeout | Check system clock; verify Twilio quota |
| Escalation stuck | Call-centre system down | Route to fallback phone number |
| Database locked | Heavy load | Increase connection pool; add read replicas |

---

**Project Status:**  READY FOR DEVELOPMENT

**Estimated Timeline:**
- Week 12: Setup infrastructure, database
- Week 34: Core authentication + report status
- Week 5: Centre info + pricing
- Week 67: Escalation + testing
- Week 8: UAT + launch

---

**Document Status:**  COMPLETE - ALL 6 STAGES FINISHED  
**Last Updated:** September 2026  
**Owner:** Technical Lead
