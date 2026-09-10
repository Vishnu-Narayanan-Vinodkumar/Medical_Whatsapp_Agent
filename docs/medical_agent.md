# Medical Agent: Problem Framing Canvas

Six diagnostic centres provide blood work, imaging, and health packages. The nine-person call centre handles approximately 900 calls per day. The CMO wants a WhatsApp bot before flu season.


## Framed Problem Statement

Today, patients and caregivers call the diagnostic-centre call centre for report status, pricing, timings, and report-access support approximately 900 times per day, especially during peak hours, which causes a nine-person call centre to become overloaded and makes routine enquiries difficult to handle promptly.

We believe that a compliant WhatsApp bot for report status, centre timings, and test or package pricing will reduce avoidable routine calls and give patients a faster self-service channel.

We will know we are right when, after call reasons are measured, the pilot produces at least a 25% reduction in routine calls against the measured routine-call baseline, with the proposed broader target of 25-40%, and there are zero privacy incidents.

This is constrained by protected health information and privacy-compliance requirements, and by the lack of call-categorisation data and limitations in the existing patient portal and supporting systems.

The first thing we will build is a WhatsApp bot for report status, centre timings, and test or package pricing, to test whether most calls are routine enquiries, whether patients will use WhatsApp instead of calling, and which approved identity-verification method can protect report-status support.



## DECODE Summary

- **Define:** Patients are calling for reports, timings, prices, and other support.
- **Establish:** There are approximately 900 calls per day, peak periods are 8am-10am and 6pm-8pm, portal use is low, registration numbers are often lost, and call reasons are not recorded.
- **Clarify:** PHI, authentication, existing systems, and the flu-season deadline constrain the solution.
- **Outcome:** Reduce avoidable routine calls while retaining human support.
- **Decide and Execute:** Test a narrow WhatsApp prototype, then expand only when call data, patient use, and Compliance approval support it.

## Problem Framing Canvas

### Trigger

The call centre handles approximately 900 calls per day and is overloaded. The CMO wants a WhatsApp bot before flu season.

### Actor and Moment

Patients seek report status, pricing, centre timings, or report-access support, especially during 8am-10am and 6pm-8pm.

### Current State

Patients call for routine information. The portal is underused because many patients lose the registration number required to log in.

### Metric

- **Baseline:** Approximately 900 calls per day; call reasons are not categorised.
- **Target to validate:** The proposed pilot target is a 25-40% reduction in routine calls. First measure how many calls are routine.
- **Guardrail:** Zero privacy incidents and no unauthorised disclosure of protected health information.

### Constraints

- Protected health information and privacy compliance.
- No call-categorisation data.
- Portal and system limitations, including the lost registration number.
- An unspecified flu-season deadline.
- Identity verification and report access require Compliance review.
- No diagnosis or clinical interpretation in the first slice.

### Assumptions Ranked by Risk

1. **Most calls are routine enquiries.**
   - **Test within one week:** Categorise calls into report status, pricing, timings, appointments, preparation, clinical questions, complaints, and billing.

2. **Patients will use WhatsApp instead of calling.**
   - **Test within one week:** Show a prototype to staff and patients; measure starts, completions, abandonment, satisfaction, and escalation.

3. **Report-status queries can be handled securely.**
   - **Test within one week:** Ask Compliance and the system owner which identity-verification method is approved. Do not assume OTP is available or sufficient.

### Thin Slice

Build a WhatsApp bot for report status, centre timings, and test or package pricing.

This targets likely routine calls while keeping PHI exposure low and providing human escalation for identity, clinical, and exceptional cases.

## Incremental Updates

The work will progress in two tracks so the client can see both what is being built and what decisions are needed.

| Step | Development / technical work | Decision / client work |
| --- | --- | --- |
| 1. Discover | Add simple call-reason categories and create a test conversation. | Call Centre Supervisor confirms the top call reasons and baseline. |
| 2. Prove content | Add approved timings and a small set of test/package prices. | Front-Desk Executive confirms the information is correct and identifies an owner for updates. |
| 3. Prove identity | Add a safe report-status support flow without sending report contents. | Compliance Officer approves the identity-verification method and escalation rules. |
| 4. Pilot | Test the WhatsApp thin slice with a small user group and record completion, escalation, and errors. | CMO reviews the results and decides whether to expand before flu season. |

Each step should be allowed to stop or change the scope if the evidence does not support the next step.

### Not Building in the First Slice

- Direct delivery of full diagnostic reports through WhatsApp.
- Clinical interpretation, diagnosis, treatment advice, or symptom triage.
- A bot that answers every possible question or replaces the call centre.
- Automated booking, payment, cancellation, refund, or complex complaint handling.
- A full production integration across all six centres before call reasons, authentication, and content ownership are validated.

This is appropriate because it tests the highest-risk assumptions with limited PHI exposure and keeps human handling for clinical, identity, and exceptional cases.

### Success and Sign-off

- **Success:** Measure the baseline first, then test the proposed 25-40% reduction in routine calls, with zero privacy incidents.
- **Request owner and clinical sign-off:** Chief Medical Officer (CMO).
- **Compliance sign-off:** Compliance Officer.
- **Operational validation:** Call Centre Supervisor.
- **Centre-information validation:** Front-Desk Executive at the busiest centre.

### Open Questions

1. **What are the top call reasons and what proportion of calls are routine enquiries?**
   - Ask the Call Centre Supervisor.

2. **How is patient identity verified today, and what authentication method is approved for report-status support?**
   - Ask the Compliance Officer.

3. **What are the most common front-desk queries, and which routine information should be prioritised for the first prototype?**
   - Ask the Front-Desk Executive at the busiest centre.

