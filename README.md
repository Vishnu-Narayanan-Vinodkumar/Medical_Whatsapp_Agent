# DiagnoBot - WhatsApp Bot Implementation

A HIPAA-compliant WhatsApp bot for diagnostics chain call center automation during peak seasons (flu, COVID, etc.). Handles OTP-based authentication, report status queries, centre information, pricing inquiries, and intelligent escalation.

## Project Structure

```
diagnobot-whatsapp/
├── bot-core.js                    # Main Node.js/Express server
├── bot-metrics-dashboard.html     # Real-time metrics dashboard (no dependencies)
├── package.json                   # NPM dependencies
├── .env.example                   # Environment variables template
├── README.md                       # This file
├── docs/
│   ├── SDD_Stage1_PRD.md         # Product Requirements Document
│   ├── SDD_Stage2_Spec.md        # Technical Specifications
│   ├── SDD_Stage3_Story.md       # User Stories
│   ├── SDD_Stage4_AcceptCriteria.md  # Acceptance Criteria
│   ├── SDD_Stage5_Prompt.md      # System Prompt for Intent Recognition
│   └── SDD_Stage6_Code.md        # Code Architecture & Implementation
├── src/
│   ├── handlers/                  # Message handlers (report, centre, pricing)
│   ├── auth/                      # OTP & session management
│   ├── db/                        # Database schemas & migrations
│   └── utils/                     # Helper functions (logging, encryption)
├── tests/                         # Jest test suites
├── logs/                          # Application logs (gitignored)
└── node_modules/                  # Dependencies (created by npm install)
```

## Quick Start

### Prerequisites
- Node.js 16+ (download from https://nodejs.org/)
- PostgreSQL 12+ (for production)
- Twilio Account with WhatsApp Business API access

### Installation

1. Clone/extract the project:
```bash
cd diagnobot-whatsapp
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file:
```bash
cp .env.example .env
```

4. Edit .env with your credentials:
```
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
DB_HOST=localhost
DB_USER=diagnobot_user
DB_PASSWORD=your_password
```

5. Start the server:
```bash
npm start
```

Server runs on http://localhost:3000

## File Explanations

### bot-core.js
The main application file containing:
- Express server setup
- OTP generation & validation (bcrypt hashing)
- Session management (30-minute expiry)
- WhatsApp message handler (/webhook/whatsapp)
- Report status lookup (5-second LIS API timeout)
- Centre information & pricing handlers
- HIPAA-compliant audit logging (zero PHI stored)
- Health check endpoint (/health)
- Metrics endpoint (/metrics) - feeds the dashboard

**No external dependencies needed for this file to run** (only Express, bcrypt, crypto which are in package.json)

### bot-metrics-dashboard.html
Interactive HTML dashboard showing:
- Active sessions count
- Pending authentication states
- Pie charts: Request status distribution & intent distribution
- Audit log (last 10 entries)
- Performance metrics (latency, success rate)
- Auto-refreshes every 5 seconds

**This is a static HTML file with no build process or node_modules required.** Just open in browser or embed in web app.

### SDD Pipeline Documents (docs/ folder)
Complete specification-driven development pipeline:

1. **Stage1_PRD.md** - What to build (product vision, user personas, success metrics)
2. **Stage2_Spec.md** - How to build it (architecture, APIs, tech stack)
3. **Stage3_Story.md** - User stories with acceptance scenarios
4. **Stage4_AcceptCriteria.md** - Testable acceptance criteria
5. **Stage5_Prompt.md** - System prompt for bot's intent recognition
6. **Stage6_Code.md** - Implementation roadmap, schema, deployment

## Running the Bot

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Run Tests
```bash
npm test
```

## API Endpoints

### POST /webhook/whatsapp
WhatsApp inbound message handler.

Example request body:
```json
{
  "from": "+919999999999",
  "text": "What is my report status?",
  "messageId": "wamid.abc123"
}
```

### GET /health
Health check for load balancers. Returns 200 if operational.

### GET /metrics
Real-time statistics in JSON format:
```json
{
  "activeSessions": 8,
  "pendingAuthCount": 3,
  "auditLogsCount": 247,
  "successCount": 312,
  "errorCount": 8,
  "timeoutCount": 5,
  "avgResponseTime": 1240,
  "intents": {
    "auth_success": 78,
    "report_status": 156,
    "centre_info": 52,
    "pricing_inquiry": 18,
    "escalation": 8
  }
}
```

## Architecture Overview

```
WhatsApp User
    |
    v
Twilio Cloud API
    |
    v
Node.js Express Server (bot-core.js)
    |
    +-> OTP Authentication (bcrypt)
    +-> Session Management (Map-based, PostgreSQL in prod)
    +-> LIS API Integration (5s timeout)
    +-> Centre Info Lookup
    +-> Audit Logging (SHA-256 phone hashing)
    |
    v
Response -> Twilio -> WhatsApp User
```

## Security & HIPAA Compliance

- **OTP Hashing**: bcrypt with salt rounds=10 (never stored plaintext)
- **Session Tokens**: 32-byte crypto-random generation
- **Audit Logging**: SHA-256 phone hashing (zero PHI in logs)
- **Encryption**: AES-256 for sensitive data in production
- **TLS 1.2+**: All API communications
- **Rate Limiting**: 3-attempt limits on OTP/DOB validation
- **Session Expiry**: 30-minute timeout with 25-minute warning

## Database Schema (PostgreSQL)

### sessions table
```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  phone_hash VARCHAR(64) NOT NULL,
  patient_id VARCHAR(20),
  authenticated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### audit_logs table
```sql
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  phone_hash VARCHAR(64) NOT NULL,
  action VARCHAR(50) NOT NULL,
  intent VARCHAR(50),
  response_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retention: 90 days (HIPAA requirement)
-- Index on phone_hash and created_at for queries
```

## Environment Setup (Development)

### Using Docker (Optional)
```bash
docker-compose up
```

Creates PostgreSQL container automatically.

### Manual PostgreSQL Setup
```bash
# Create database
createdb diagnobot_prod

# Create user
createuser diagnobot_user --password

# Run migrations (TBD in src/db/migrations/)
psql diagnobot_prod < src/db/schema.sql
```

## Monitoring & Logging

Application logs are written to:
- **Console**: Real-time output during development
- **File**: logs/app.log (production)

Log levels: debug, info, warn, error

Example:
```
2026-09-10T14:32:45Z [INFO] Session created: phoneHash=a7f2..., sessionToken=abc123...
2026-09-10T14:31:22Z [INFO] Report status query: patientID=REG-12345, responseTime=1890ms
2026-09-10T14:30:15Z [ERROR] LIS API timeout: patientID=REG-54321, duration=5000ms
```

## Performance Targets (Non-Functional Requirements)

- Uptime: 99.5% (peak season)
- Response time: <2 seconds (P95)
- Concurrent sessions: 100+
- Audit log retention: 90 days (HIPAA)
- Message throughput: 900 calls/day during flu season

## Deployment Checklist

- [ ] Configure Twilio webhook URL
- [ ] Set up PostgreSQL database with migrations
- [ ] Generate strong encryption keys & secrets
- [ ] Enable HTTPS/TLS for all endpoints
- [ ] Configure firewall for port 3000
- [ ] Set up monitoring & alerting
- [ ] Enable audit log archival (S3/Cloud Storage)
- [ ] Configure backup strategy
- [ ] Test OTP flow end-to-end
- [ ] Load test with 100+ concurrent sessions
- [ ] HIPAA compliance audit

## Troubleshooting

### Port 3000 already in use
```bash
lsof -i :3000
kill -9 <PID>
```

### Database connection fails
- Check PostgreSQL is running: `psql -U diagnobot_user -d diagnobot_prod`
- Verify .env credentials
- Ensure database exists: `createdb diagnobot_prod`

### OTP not being sent
- Verify Twilio credentials in .env
- Check Twilio webhook URL points to your server
- Review logs for Twilio API errors

### Dashboard shows no metrics
- Ensure bot-core.js is running on port 3000
- Check /metrics endpoint: `curl http://localhost:3000/metrics`
- Verify browser console for CORS issues

## Contributing

1. Follow SDD pipeline for new features (PRD -> Spec -> Stories -> Criteria)
2. Write tests in tests/ folder
3. Run linter before commit: `npm run lint`
4. Update docs/ as specifications change

## License

MIT - See LICENSE file

## Support

For issues or questions:
- Email: vishnunarayanan.vinodkumar@ust.com
- Review docs/ folder for detailed specifications
- Check logs/ for debugging information
