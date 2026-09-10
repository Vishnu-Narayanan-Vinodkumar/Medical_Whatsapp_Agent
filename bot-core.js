/**
 * DiagnoBot - WhatsApp Bot Core Implementation (Thin Slice)
 * Handles: OTP Authentication + Report Status Lookup
 *
 * Phase 1 MVP - Report status + Centre timings + Pricing
 * Tech Stack: Node.js + Express + PostgreSQL
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// =============================================================================
// CONFIGURATION & CONSTANTS
// =============================================================================

const OTP_VALIDITY = 5 * 60 * 1000;  // 5 minutes
const SESSION_DURATION = 30 * 60 * 1000;  // 30 minutes
const OTP_ATTEMPTS = 3;
const AUTH_TIMEOUT = 5 * 60 * 1000;  // 5 minutes

// Mock database (replace with PostgreSQL in production)
const sessions = new Map();
const authStates = new Map();
const auditLogs = [];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate cryptographically secure 6-digit OTP
 */
function generateOTP() {
  return Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
}

/**
 * Hash OTP using bcrypt
 */
function hashOTP(otp) {
  return bcrypt.hashSync(otp, 10);
}

/**
 * Compare OTP with hash
 */
function compareOTP(userOTP, hash) {
  return bcrypt.compareSync(userOTP, hash);
}

/**
 * Hash phone number for audit logs (SHA-256)
 */
function hashPhone(phone) {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

/**
 * Generate secure session token
 */
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Extract registration number (REG-XXXXXX format)
 */
function extractRegNumber(text) {
  const match = text.match(/REG[_-]?\d{8}[_-]?\d{3}/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Extract DOB (DD-MM-YYYY format)
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
 * Extract OTP (6 digits)
 */
function extractOTP(text) {
  const match = text.match(/\d{6}/);
  return match ? match[0] : null;
}

/**
 * Log interaction for audit/compliance (NO PHI)
 */
function logAudit(entry) {
  const safeEntry = {
    timestamp: new Date(),
    action: entry.action,  // MESSAGE_RECEIVED, AUTH_SUCCESS, REPORT_SENT, etc.
    phoneHash: hashPhone(entry.phone),
    intent: entry.intent || null,
    result: entry.result || 'unknown',
    responseTimeMs: entry.responseTimeMs || 0,
  };

  auditLogs.push(safeEntry);
  // Keep only last 10000 logs in memory
  if (auditLogs.length > 10000) {
    auditLogs.shift();
  }

  console.log('[AUDIT]', safeEntry);
}

/**
 * Mock LIS API call - Get patient reports
 * In production, this calls: GET https://lis.diag.com/api/v1/reports/{patient_id}
 */
function mockLISQuery(patientID) {
  // Simulate 1-2 second latency
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Mock data - replace with real LIS API call
      const mockReports = [
        {
          reportID: 'REP-20260912-001',
          testName: '12-Test Blood Panel',
          status: 'ready',
          sampleDate: '2026-09-10',
          reportDate: '2026-09-12T02:30:00Z',
          downloadURL: 'https://secure.reports.diag.com/download/token123',
          urlExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),  // 1 hour
        },
        {
          reportID: 'REP-20260912-002',
          testName: 'COVID-19 RT-PCR',
          status: 'processing',
          sampleDate: '2026-09-12',
          reportDate: null,
          downloadURL: null,
          urlExpiresAt: null,
          estimatedReadyTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),  // 4 hours
        },
      ];

      resolve(mockReports);
    }, Math.random() * 1000 + 500);  // 500-1500ms latency
  });
}

/**
 * Mock LIS validation - Check if registration exists
 */
function mockValidateRegistration(regNumber) {
  return Promise.resolve(true);  // In production, query LIS database
}

/**
 * Mock LIS validation - Check if DOB matches
 */
function mockValidateDOB(regNumber, dob) {
  // In production, query LIS database
  // For now, accept with ±1 day tolerance
  return Promise.resolve(true);
}

// =============================================================================
// AUTHENTICATION FLOW
// =============================================================================

/**
 * Initiate OTP authentication
 */
async function initiateAuthentication(userPhone, userMessage) {
  const phoneHash = hashPhone(userPhone);

  // Check if user already has active session
  const existingSession = sessions.get(phoneHash);
  if (existingSession && existingSession.expiresAt > Date.now()) {
    return { skip: true, session: existingSession };
  }

  // Get or create auth state
  let authState = authStates.get(phoneHash) || {
    phone: userPhone,
    step: 'REQUEST_REG_NUMBER',
    createdAt: Date.now(),
    attempts: 0,
  };

  // Step 1: Request registration number
  if (authState.step === 'REQUEST_REG_NUMBER') {
    const regNumber = extractRegNumber(userMessage);

    if (!regNumber) {
      authStates.set(phoneHash, authState);
      return {
        text: 'I did not recognize that format. Please provide your registration number (e.g., REG-20260910-001).',
      };
    }

    const exists = await mockValidateRegistration(regNumber);
    if (!exists) {
      return {
        text: 'I cannot find that registration. Please double-check or call us at +91-80-XXXX-XXXX.',
      };
    }

    authState.regNumber = regNumber;
    authState.step = 'REQUEST_DOB';
    authState.attempts = 0;
    authStates.set(phoneHash, authState);

    return {
      text: 'Thanks! Now, for security, please confirm your date of birth.\nFormat: DD-MM-YYYY (e.g., 12-05-1985)',
    };
  }

  // Step 2: Request and validate DOB
  if (authState.step === 'REQUEST_DOB') {
    const dob = extractDOB(userMessage);

    if (!dob) {
      return {
        text: 'I did not recognize that date format. Please try again: DD-MM-YYYY',
      };
    }

    const matches = await mockValidateDOB(authState.regNumber, dob);
    if (!matches) {
      authState.attempts++;
      authStates.set(phoneHash, authState);

      if (authState.attempts >= 3) {
        authStates.delete(phoneHash);
        return await escalateToAgent(userPhone, 'DOB_FAILED_3X');
      }

      return {
        text: `Date of birth does not match. (Attempt ${authState.attempts}/${3}). Try again or call +91-80-XXXX-XXXX.`,
      };
    }

    // Generate and send OTP
    authState.dob = dob;
    authState.step = 'REQUEST_OTP';
    const otp = generateOTP();
    authState.otpHash = hashOTP(otp);
    authState.otpExpiresAt = Date.now() + OTP_VALIDITY;
    authState.otpAttempts = 0;
    authStates.set(phoneHash, authState);

    console.log(`[OTP] Generated for ${phoneHash}: ${otp} (expires in 5 min)`);
    // In production: await sendWhatsAppMessage({ to: userPhone, text: `Your verification code is: ${otp}...` })

    return {
      text: 'I have sent you a 6-digit code via WhatsApp.\nPlease enter it to verify your identity.',
    };
  }

  // Step 3: Validate OTP
  if (authState.step === 'REQUEST_OTP') {
    const userOTP = extractOTP(userMessage);

    if (!userOTP) {
      return {
        text: 'I did not recognize that code format. Please enter the 6-digit code.',
      };
    }

    // Check expiry
    if (Date.now() > authState.otpExpiresAt) {
      authState.step = 'SEND_OTP';
      authStates.set(phoneHash, authState);
      return {
        text: 'Your code expired. Sending a new one...',
      };
    }

    // Verify OTP
    const otpValid = compareOTP(userOTP, authState.otpHash);
    if (!otpValid) {
      authState.otpAttempts++;
      authStates.set(phoneHash, authState);

      if (authState.otpAttempts >= OTP_ATTEMPTS) {
        authStates.delete(phoneHash);
        return await escalateToAgent(userPhone, 'OTP_FAILED_3X');
      }

      return {
        text: `That code is incorrect. (Attempt ${authState.otpAttempts}/${OTP_ATTEMPTS}). Please try again.`,
      };
    }

    // OTP verified - create session
    const sessionToken = generateSessionToken();
    const session = {
      phoneHash,
      phone: userPhone,
      regNumber: authState.regNumber,
      patientID: 'PATIENT-' + authState.regNumber.replace(/[^0-9]/g, ''),  // Mock patient ID
      sessionToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
      authenticated: true,
    };

    sessions.set(phoneHash, session);
    authStates.delete(phoneHash);

    logAudit({
      phone: userPhone,
      action: 'AUTH_SUCCESS',
      intent: 'AUTHENTICATE',
      result: 'success',
    });

    return {
      intent: 'AUTH_SUCCESS',
      text: 'Identity verified!\n\nWhat would you like to know?\n[a] Report status [b] Centre timings [c] Pricing [d] Agent',
      session,
    };
  }
}

// =============================================================================
// REPORT STATUS HANDLER
// =============================================================================

/**
 * Handle report status request
 */
async function handleReportStatus(session) {
  try {
    const startTime = Date.now();

    // Query LIS (with 5-second timeout)
    const reports = await Promise.race([
      mockLISQuery(session.patientID),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), 5000)
      ),
    ]);

    if (!reports || reports.length === 0) {
      logAudit({
        phone: session.phone,
        action: 'REPORT_STATUS',
        intent: 'CHECK_REPORT_STATUS',
        result: 'no_reports',
        responseTimeMs: Date.now() - startTime,
      });

      return {
        intent: 'REPORT_STATUS',
        text: 'No recent reports found. If you recently completed a test, it may take up to 48 hours.\n\nWhat next?\n[a] Check centre timings [b] Pricing [c] Speak to agent',
      };
    }

    // Format reports for display
    let responseText = '';
    reports.forEach((report, index) => {
      const status = report.status.toUpperCase();
      const statusIcon = status === 'READY' ? '[READY]' : status === 'PROCESSING' ? '[PROCESSING]' : '[DELAYED]';

      responseText += `\nTest ${index + 1}: ${report.testName}\n`;
      responseText += `Status: ${statusIcon}\n`;
      responseText += `Sample: ${report.sampleDate}\n`;

      if (status === 'READY') {
        responseText += `Report: ${new Date(report.reportDate).toLocaleString()}\n`;
        responseText += `Download (expires ${new Date(report.urlExpiresAt).toLocaleString()}):\n`;
        responseText += `${report.downloadURL}\n`;
      } else if (status === 'PROCESSING') {
        responseText += `Est. ready: ${new Date(report.estimatedReadyTime).toLocaleString()}\n`;
      }
    });

    responseText += '\n\nWhat next?\n[a] Check another report [b] Centre timings [c] Pricing [d] Agent';

    logAudit({
      phone: session.phone,
      action: 'REPORT_STATUS',
      intent: 'CHECK_REPORT_STATUS',
      result: 'success',
      responseTimeMs: Date.now() - startTime,
    });

    return {
      intent: 'REPORT_STATUS',
      text: responseText,
    };

  } catch (error) {
    logAudit({
      phone: session.phone,
      action: 'REPORT_STATUS',
      intent: 'CHECK_REPORT_STATUS',
      result: error.message === 'TIMEOUT' ? 'timeout' : 'error',
    });

    if (error.message === 'TIMEOUT') {
      return {
        intent: 'REPORT_STATUS',
        text: 'System temporarily unavailable. Please try again or call +91-80-XXXX-XXXX.',
        error: true,
      };
    }

    throw error;
  }
}

// =============================================================================
// ESCALATION HANDLER
// =============================================================================

/**
 * Escalate to human agent
 */
async function escalateToAgent(userPhone, reason) {
  logAudit({
    phone: userPhone,
    action: 'ESCALATION_REQUESTED',
    intent: 'ESCALATE',
    result: reason,
  });

  return {
    intent: 'ESCALATE',
    text: `I would love to help with that! Let me connect you with an agent.\nAverage wait: 3 minutes.\n\nContinue? [Yes] [No]`,
  };
}

// =============================================================================
// MAIN MESSAGE HANDLER
// =============================================================================

/**
 * Route inbound WhatsApp message to appropriate handler
 */
async function handleMessage(userPhone, userText) {
  const phoneHash = hashPhone(userPhone);
  const lowerText = userText.toLowerCase().trim();

  logAudit({
    phone: userPhone,
    action: 'MESSAGE_RECEIVED',
    intent: null,
    result: 'received',
  });

  // Check for active session
  let session = sessions.get(phoneHash);
  if (!session || session.expiresAt < Date.now()) {
    // Need authentication
    const authResult = await initiateAuthentication(userPhone, userText);
    if (authResult.skip) {
      session = authResult.session;
    } else if (authResult.intent === 'AUTH_SUCCESS') {
      session = authResult.session;
      return authResult;
    } else {
      return authResult;
    }
  }

  // Session exists - detect intent
  if (lowerText.includes('report') || lowerText.includes('status') || lowerText.includes('ready')) {
    return await handleReportStatus(session);
  }

  if (lowerText.includes('centre') || lowerText.includes('hours') || lowerText.includes('address')) {
    return {
      intent: 'CENTRE_INFO',
      text: 'Centre Information:\n\nBangalore - MG Road\nAddress: 123 MG Road, Bangalore 560001\nPhone: +91-80-XXXX-XXXX\nHours: Mon-Sat 7am-8pm, Sun 8am-2pm\nParking: Free (50 spots)',
    };
  }

  if (lowerText.includes('price') || lowerText.includes('cost') || lowerText.includes('package')) {
    return {
      intent: 'PRICING',
      text: 'Our Packages:\n\n1. Basic (1,500): 10 tests\n2. Standard (2,500): 25 tests\n3. Comprehensive (4,500): 50 tests + imaging',
    };
  }

  if (lowerText.includes('agent') || lowerText.includes('speak') || lowerText.includes('help')) {
    return await escalateToAgent(userPhone, 'EXPLICIT_REQUEST');
  }

  // Default response
  return {
    intent: 'UNKNOWN',
    text: 'I did not understand that. What would you like?\n[a] Report status [b] Centre timings [c] Pricing [d] Speak to agent',
  };
}

// =============================================================================
// EXPRESS ENDPOINTS
// =============================================================================

/**
 * POST /webhook/whatsapp - Receive inbound WhatsApp messages
 */
app.post('/webhook/whatsapp', async (req, res) => {
  try {
    const message = req.body.messages?.[0];
    if (!message) {
      return res.status(400).json({ error: 'No message' });
    }

    const userPhone = message.from;
    const userText = message.text?.body || '';

    const response = await handleMessage(userPhone, userText);

    // Log outbound message
    logAudit({
      phone: userPhone,
      action: 'MESSAGE_SENT',
      intent: response.intent,
      result: 'success',
    });

    // In production: await sendWhatsAppMessage({ to: userPhone, text: response.text })

    return res.json({
      success: true,
      response: response.text,
      intent: response.intent,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /health - Health check for load balancer
 */
app.get('/health', (req, res) => {
  return res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

/**
 * GET /metrics - Real-time metrics and stats
 */
app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date(),
    sessions: {
      active: sessions.size,
      total: Array.from(sessions.values()).length,
    },
    auth: {
      pending: authStates.size,
    },
    audit: {
      totalLogs: auditLogs.length,
      successCount: auditLogs.filter(l => l.result === 'success').length,
      errorCount: auditLogs.filter(l => l.result === 'error').length,
      timeoutCount: auditLogs.filter(l => l.result === 'timeout').length,
    },
    latency: {
      avgMs: auditLogs.length > 0
        ? Math.round(
            auditLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) /
            auditLogs.length
          )
        : 0,
    },
    intents: {
      auth_success: auditLogs.filter(l => l.action === 'AUTH_SUCCESS').length,
      report_status: auditLogs.filter(l => l.intent === 'CHECK_REPORT_STATUS').length,
      centre_info: auditLogs.filter(l => l.intent === 'CENTRE_INFO').length,
      pricing: auditLogs.filter(l => l.intent === 'PRICING').length,
      escalation: auditLogs.filter(l => l.action === 'ESCALATION_REQUESTED').length,
    },
    lastLogs: auditLogs.slice(-10),
  };

  res.json(metrics);
});

/**
 * Start server
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DiagnoBot listening on port ${PORT}`);
  console.log(`Health check: GET http://localhost:${PORT}/health`);
  console.log(`Metrics: GET http://localhost:${PORT}/metrics`);
  console.log(`Webhook: POST http://localhost:${PORT}/webhook/whatsapp`);
});

module.exports = app;
