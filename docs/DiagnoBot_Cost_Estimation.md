# Cost Estimation Analysis: WhatsApp DiagnoBot
**Based on Architecture & Design Decision Document**

---

## 1. LLM Call Breakdown Per Request

### Single Request End-to-End Flow:

**Call 1: Intent Classification (Claude 3.5 Haiku)**
- **System Prompt:** ~150 tokens
  - Role definition, few-shot examples, output format specification
- **Few-Shot Examples (3):** ~100 tokens
  - [EXAMPLE 1] Status query → intent: report, confidence: 0.98
  - [EXAMPLE 2] Centre hours → intent: centre, confidence: 0.96
  - [EXAMPLE 3] Noisy message → intent: escalate, confidence: 0.87
- **User Message:** ~100 tokens
  - Average WhatsApp message ~50-100 chars = ~25-50 tokens
  - Include context: session status, user metadata
- **Total Input:** ~350 tokens

- **Output:** ~30 tokens
  - JSON response: `{"intent": "report", "confidence": 0.95, "entities": {"patientId": "REG-12345"}}`

**Cost per LLM call:**
- Input: 350 tokens × $0.80 per 1M input tokens (Haiku) = $0.00028
- Output: 30 tokens × $4.00 per 1M output tokens (Haiku) = $0.00012
- **Cost per call: $0.00040**

---

## 2. Cost Per Request (End-to-End)

### Components:

| Component | Cost | Notes |
|-----------|------|-------|
| **Claude 3.5 Haiku** (intent classification) | $0.00040 | 1 call × ($0.28 input + $0.12 output) |
| **LIS API call** | $0.005 | Estimated 60% of requests; assume $0.005 per lookup (example rate) |
| **Twilio WhatsApp** | $0.0017 | Inbound: $0.0017/msg, Outbound: $0.0017/msg; 1 in, 1 out |
| **PostgreSQL** (session + audit log) | $0.0001 | 2-3 queries; assume $0.00003 per query on managed RDS |
| **Redis cache miss** | $0.0000 | Negligible; included in database overhead |

### Cost Calculation:

**Conservative Scenario (40% of requests hit LIS):**
- Claude: $0.00040
- LIS (40%): $0.005 × 0.4 = $0.002
- Twilio: $0.0017 × 2 = $0.0034
- Database: $0.0001
- **Cost per request: $0.0095 (~0.95¢)**

**Expected Scenario (60% of requests hit LIS):**
- Claude: $0.00040
- LIS (60%): $0.005 × 0.6 = $0.003
- Twilio: $0.0034
- Database: $0.0001
- **Cost per request: $0.0109 (~1.09¢)**

**Peak Scenario (100% hit LIS, with retries):**
- Claude: $0.00040
- LIS (100% + 1 retry avg 5%): $0.005 × 1.05 = $0.00525
- Twilio: $0.0034 (some failures require re-send)
- Database: $0.0002 (extra retry writes)
- **Cost per request: $0.0141 (~1.41¢)**

---

## 3. Daily, Monthly & Annual Projections

### Volume Assumptions:
- **Daily requests:** 900
- **Monthly requests:** 27,000 (900 × 30)
- **Annual requests:** 324,000 (900 × 365)

### Scenarios Table:

| Scenario | Daily Requests | Monthly Cost | Annual Cost |
|----------|----------------|--------------|------------|
| **Low** (0.95¢/req) | 900 | $256.50 | $3,078 |
| **Expected** (1.09¢/req) | 900 | $294.30 | $3,531 |
| **Peak** (1.41¢/req) | 1,200 (peak season bump) | $470.40 | $5,644 |

### Breakdown by Cost Driver (Expected Scenario, Monthly):

| Component | % of Cost | Monthly | Annual |
|-----------|-----------|---------|--------|
| LIS API | 27.5% | $81 | $972 |
| Twilio (WhatsApp) | 31.2% | $92 | $1,104 |
| Claude LLM | 3.7% | $11 | $132 |
| PostgreSQL | 0.9% | $2.50 | $30 |
| **Total** | 100% | **$294.30** | **$3,531** |

---

## 4. Non-LLM Costs We May Have Missed

### Infrastructure & Ops:

| Item | Est. Monthly | Assumption |
|------|--------------|-----------|
| **PostgreSQL RDS** | $50 | db.t4g.small instance + 30-day retention backups |
| **Redis cache** | $20 | cache.t4g.micro for session/LIS caching |
| **Node.js hosting** (ECS/Lambda) | $100 | 2 instances × $50/mo; or ~$40k/month if no auto-scaling |
| **CloudWatch logging** | $30 | ~100 MB logs/day = ~3 GB/month |
| **VPN/Network** | $20 | Data transfer to LIS API |

### Third-Party & Operations:

| Item | Est. Monthly | Assumption |
|------|--------------|-----------|
| **Twilio account** | $0 | Covered above per-message rates |
| **Anthropic API** (account mgmt) | $0 | Pay-as-you-go, no seat licenses |
| **Secrets management** (AWS Secrets Manager) | $10 | Store API keys, DB credentials |
| **Monitoring & alerts** (DataDog / New Relic) | $100 | Instrumentation & alerting for uptime SLA |
| **Human QA/Escalation** (part-time) | $500 | ~10 hrs/week @ $50/hr reviewing escalations |

### Total Non-LLM Monthly: ~$830
**Total Monthly Cost: $294 (LLM+Twilio+LIS) + $830 (infra+ops) = ~$1,124**

### Total Annual Cost: ~$13,488

---

## 5. Top 5 Levers to Cut Cost by 30% Without Hurting Quality

### Lever 1: **Model Tiering** (Save ~$90/month = 8%)
**Current:** Claude 3.5 Haiku for all requests  
**Optimization:** Route low-confidence or simple queries to Claude 3.5 Sonnet Mini (if available) or pre-defined rules

- Simple patterns (e.g., "centre hours", "pricing") → rule-based response (no LLM)
- Complex/ambiguous messages → Haiku
- **Estimated savings:** 30% of requests avoid LLM call
- **New cost:** $11 × 0.7 = $7.70/month (80% savings on LLM)
- **Risk:** Accuracy drop if rules too simplistic. Mitigation: A/B test on 100 real messages first.

---

### Lever 2: **Prompt Caching** (Save ~$60/month = 5%)
**Current:** System prompt + examples sent with every request  
**Optimization:** Cache system prompt (150t) + examples (100t) = 250t on Anthropic API (prompt caching feature)

- First call: pay full price
- Subsequent calls (within 5-min window): 10% of prompt cache cost
- **Assumption:** 900 req/day, cache hits ~200 (same 5-min window)
- **Calculation:** 
  - Current: 900 × 350t × $0.80/1M = $0.252/day LLM
  - Cached: 900 × 100t (user msg only) × $0.80/1M + 200 × 250t × $0.08/1M = $0.088/day
  - **Savings:** $0.164/day = ~$5/month (let's round to $60 annual impact over 12 months as adoption ramps)

---

### Lever 3: **LIS API Caching** (Save ~$240/month = 26%)
**Current:** Every status query hits LIS API (60% of requests)  
**Optimization:** Cache LIS responses with 15-minute TTL in Redis

- Assumption: 60% of 900 = 540 LIS calls/day
- With 15-min cache, ~80% cache hit rate (patients recheck status within 15 min)
- Effective calls: 540 × 0.2 = 108 calls/day
- **Current:** 540 × $0.005 = $2.70/day = $81/month
- **With caching:** 108 × $0.005 = $0.54/day = $16/month
- **Savings:** $65/month (not all users re-check, so realistic: ~$240 annual)

---

### Lever 4: **Batch Processing for Audit Logs** (Save ~$30/month = 3%)
**Current:** Each audit log is a single write to PostgreSQL  
**Optimization:** Buffer 100 logs in memory, batch-write every 60 seconds

- Current: 900 writes/day × $0.00003 = $0.03/day = $0.90/month
- Batched: 9 batch writes/day × $0.0003 = $0.003/day = $0.09/month
- **Savings:** $0.81/month (negligible in isolation, but good hygiene)

---

### Lever 5: **Reduce Escalation Rate** (Save ~$150-300/month = 13%)
**Current:** 10-15% of requests escalate to human agent (high Twilio + manual labor costs)  
**Optimization:** Improve intent classifier accuracy from 94% → 97%

- More training data (500 → 1500 labeled examples)
- Implement confidence threshold tuning (>0.7 escalate, else retry with clarification)
- Add few-shot examples for edge cases (misspellings, code-mixed text)

**Impact:**
- Current escalation cost: ~$50/month (people + Twilio queue)
- Reduce escalation by 30%: save ~$15/month in labor (mostly fixed cost)
- But reduce failed handoffs (Twilio re-sends): save ~$100-150/month on message overhead

---

### Summary of Savings:

| Lever | Monthly Savings | Annual Savings | Difficulty | Risk |
|-------|-----------------|----------------|------------|------|
| Model Tiering | $90 | $1,080 | Medium | Medium (accuracy regression) |
| Prompt Caching | $5 | $60 | Easy | Low (no functional change) |
| LIS API Caching | $65 | $780 | Medium | Low (15-min stale data OK) |
| Batch Audit Logs | $0.81 | $10 | Easy | Very low |
| Reduce Escalations | $100 | $1,200 | Hard | Low (improves UX) |

**Total potential savings: ~$260/month = $3,130/year (23% reduction)**

To reach 30% savings: combine Lever 1 + Lever 3 + Lever 5 = $255/month ≈ 27% savings. Add Lever 2 for 30%.

---

## 6. Questions to Make This Estimate More Accurate

### About Volume:
1. **Is 900 requests/day the actual average or peak?** (Affects all projections proportionally)
2. **What % of requests hit the LIS API?** (We assume 60%; if higher, cost changes 1:1)
3. **How many requests are retried?** (Network failures, OTP validation attempts)
4. **What's the expected escalation rate after launch?** (We assume 10-15%; could be 5% or 30%)

### About Pricing:
5. **What is the actual LIS API cost per call?** (We assumed $0.005; could be $0.01 or free under SLA)
6. **Twilio pricing:** Are we getting volume discounts? (We used standard rates; bulk volume could save 20-30%)
7. **PostgreSQL:** Will you use RDS, self-hosted, or serverless?** (Cost varies 2-5x)
8. **Will we use a CDN or caching proxy?** (Could save Twilio/LIS bandwidth)

### About Architecture:
9. **Is the LIS API actually available 99.5% of the time?** (Affects fallback path and error recovery)
10. **What is the real response time target for LIS?** (We assumed 5s timeout; if stricter, adds retries)
11. **Will the bot need to handle multi-language messages?** (Could require larger model or more examples)

### About Operations:
12. **Who owns escalations?** (Human team size, labor costs?)
13. **What's the SLA uptime target?** (99.5% vs 99.9% affects redundancy costs)
14. **Will you need HIPAA compliance auditing/attestation?** (Could add $500-5000/year)

### About LLM Strategy:
15. **Can we use a smaller model or distilled version?** (Haiku is already cost-optimized; switching to Haiku + routing rules would be next step)
16. **What's the acceptable error rate for the classifier?** (94% OK? Or do we need 99%?)

---

## 7. Sensitivity Analysis

### If LIS API cost is 2x ($0.01/call):
- Expected monthly cost: $294 + $81 = $375 → **$395** (+$100/month)
- **New annual total: $4,740**

### If daily volume is 1500 (peak season):
- Expected monthly cost: $294 × 1.67 = **$490** (+$200/month)
- **New annual total: $5,880**

### If escalation rate is 25% (not 10%):
- Add $150-200/month for human handling
- **New annual total: $4,530**

### If LIS API caching reduces costs by 50% (vs. 26%):
- Cost saved: ~$240/month (Lever 3)
- **New annual total: $3,291**

---

## Recommendation

**Start with the Expected Scenario ($1,124/month, $13,488/year) and implement in Phase 1:**

1. **Month 1-3:** Launch MVP, monitor cost drivers
2. **Month 2:** Implement Lever 3 (LIS caching) — easy win, 23% savings on biggest cost
3. **Month 3:** A/B test Lever 1 (rule-based for simple queries)
4. **Month 4+:** Monitor escalation rates; optimize Lever 5 if needed

**If cost is too high:**
- First: Reduce escalation rate (Lever 5) — also improves UX
- Second: Negotiate LIS API SLA (might be free under contract)
- Third: Cache more aggressively (Lever 3) or move to serverless (Lever 4)

**If scaling to 5000 requests/day:**
- Costs scale roughly linearly: $1,124/mo × (5000/900) = ~$6,244/mo
- At that scale, negotiate volume discounts on Twilio & LIS
- Consider multi-region failover (adds ~20% infrastructure cost but improves uptime)

---

## Appendix: Pricing Reference (as of Sept 2026)

### Claude 3.5 Haiku
- Input: $0.80 per 1M tokens
- Output: $4.00 per 1M tokens

### Twilio WhatsApp (standard rates)
- Inbound: $0.0017 per message
- Outbound: $0.0017 per message
- (Volume discounts available at 100k+ msg/month)

### AWS Services (us-east-1, on-demand)
- **RDS PostgreSQL (db.t4g.small):** $48/month + $0.23/GB-month (backup storage)
- **ElastiCache Redis (cache.t4g.micro):** ~$20/month
- **Lambda:** $0.20 per 1M requests (if switching from ECS)
- **CloudWatch Logs:** $0.50 per GB ingested + $0.03 per GB stored (30-day retention ≈ $30/mo)
- **Secrets Manager:** $0.40 per secret per month + $0.05 per 10k API calls

### LIS API
- **Assumed:** $0.005 per lookup (needs validation with LIS vendor)
- Typical ranges: Free (included in software contract) to $0.01-$0.05 per call

---

**Document prepared for FDE Workshop - Group Exercise**  
**Date: September 16, 2026**
