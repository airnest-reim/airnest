# Guest Operations Runbook

This document defines the baseline guest communication system for AIRAA's concierge operations.
It covers reusable templates, escalation ownership, service-level agreements, human handoff rules, and the common-issue runbook for frontline teams.

## Operating Principles

- Reply fast, resolve clearly, and never leave the guest guessing about next steps.
- Use automation for standard confirmations and reminders.
- Escalate to a human as soon as there is risk to guest safety, access, habitability, or reputation.
- Close each interaction with owner, next action, and timing.
- Log every guest-impacting incident in the operating system before shift handoff.

## Communication Templates

### 1. Booking Confirmation

**Trigger:** Reservation confirmed and payment authorized.

**Channel:** Email immediately, SMS summary within 15 minutes for same-week arrivals.

**Template**

> Subject: Your stay at {{property_name}} is confirmed
>
> Hi {{guest_first_name}},
>
> Your booking for {{property_name}} is confirmed for {{check_in_date}} to {{check_out_date}}.
>
> Stay details:
> - Address: {{property_address}}
> - Guests: {{guest_count}}
> - Check-in window: {{check_in_time}}
> - Check-out time: {{check_out_time}}
>
> What happens next:
> - We will send check-in instructions {{check_in_instruction_timing}}.
> - If you need to update arrival details, reply to this message.
> - For urgent stay issues, contact {{support_phone}}.
>
> We look forward to hosting you.
>
> AIRAA Guest Operations

### 2. Check-In Instructions

**Trigger:** 48 hours before arrival or immediately after same-day booking confirmation.

**Channel:** Email plus SMS summary.

**Template**

> Subject: Check-in details for {{property_name}}
>
> Hi {{guest_first_name}},
>
> Here are your check-in details for {{property_name}} on {{check_in_date}}.
>
> Access instructions:
> 1. Arrival address: {{property_address}}
> 2. Building access: {{building_access_steps}}
> 3. Unit access: {{unit_access_steps}}
> 4. Wi-Fi: {{wifi_name}} / {{wifi_password}}
>
> Important reminders:
> - Check-in starts at {{check_in_time}}
> - Quiet hours: {{quiet_hours}}
> - Parking: {{parking_instructions}}
> - House rules: {{house_rules_link}}
>
> If anything is unclear or your arrival time changes, reply here before you travel.
>
> AIRAA Guest Operations

### 3. Standard Issue Response

**Trigger:** Guest reports a non-emergency issue.

**Channel:** Same inbound channel when possible.

**Template**

> Hi {{guest_first_name}},
>
> Thanks for flagging this. We have logged your issue as {{issue_type}} at {{property_name}}.
>
> Next step:
> - Owner: {{owner_role}}
> - Action: {{next_action}}
> - Expected update by: {{next_update_time}}
>
> If the issue becomes urgent or affects safety, access, heating, water, or security, contact us immediately at {{support_phone}}.
>
> AIRAA Guest Operations

### 4. Checkout Instructions

**Trigger:** 18:00 local time on the day before departure.

**Channel:** Email plus SMS summary.

**Template**

> Subject: Checkout reminder for {{property_name}}
>
> Hi {{guest_first_name}},
>
> This is your checkout reminder for tomorrow.
>
> Before you leave:
> - Checkout time is {{check_out_time}}
> - Place used towels in {{towel_location}}
> - Load and start the dishwasher if applicable
> - Put rubbish in {{waste_instructions}}
> - Close windows, switch off lights, and lock the door
> - Return keys or fobs using {{key_return_steps}}
>
> If you need a late checkout, reply before {{late_checkout_cutoff_time}} and we will confirm availability.
>
> Thank you for staying with AIRAA.

## Escalation Matrix

| Trigger | Severity | First Owner | Escalate To | SLA to First Response | SLA to Human Ownership | Resolution Target |
| --- | --- | --- | --- | --- | --- | --- |
| Routine arrival or departure question | Low | Guest Experience Coordinator | Operations Lead if unresolved after 2 replies | 15 min during service hours | 60 min | Same shift |
| Missing amenity, housekeeping quality issue | Medium | Guest Experience Coordinator | Housekeeping Lead | 15 min | 30 min | 4 hours |
| Lockout or access failure | High | Duty Operations Manager | Field Operations / local runner | 5 min | 10 min | 30 min |
| Wi-Fi, appliance, heating, or hot water outage | High | Duty Operations Manager | Maintenance Lead | 5 min | 15 min | 2 hours workaround, 12 hours fix |
| Active leak, electrical smell, fire, gas concern | Critical | Duty Operations Manager | Emergency services + CEO for major incident visibility | 2 min | Immediate | Emergency protocol |
| Noise complaint involving guest behavior | High | Duty Operations Manager | Security partner / local field rep | 10 min | 15 min | 30 min |
| Safety complaint or injury allegation | Critical | Duty Operations Manager | CEO and legal/insurance contact | 5 min | Immediate | Incident-controlled |
| Payment dispute or refund request above policy threshold | Medium | Guest Experience Coordinator | COO | 30 min | 4 hours | 1 business day |
| Review threat tied to unresolved issue | High | Guest Experience Coordinator | COO | 10 min | 30 min | Same day |
| Host/owner escalation affecting stay continuity | High | COO | CEO for commercial or reputational risk | 15 min | 30 min | Same day |

## Roles and Ownership

- Guest Experience Coordinator: owns routine guest messaging, booking support, and non-urgent issue triage.
- Duty Operations Manager: owns live incidents, after-hours judgment calls, and cross-functional coordination.
- Housekeeping Lead: owns cleanliness, linen, turnover recovery, and consumable replenishment.
- Maintenance Lead: owns habitability, utilities, repair vendors, and temporary workaround plans.
- Field Operations / Local Runner: owns in-person access support, key exchange, visual inspection, and urgent supply drops.
- COO: owns refund exceptions, policy decisions, staffing gaps, and service recovery patterns.
- CEO: owns strategic exceptions, legal exposure, brand-level incidents, and major partner escalations.

## Automation to Human Handoff

### Automation Handles

- Booking confirmation
- Pre-arrival reminders
- Check-in instruction delivery
- Checkout reminders
- Basic FAQ replies where confidence is high and no policy exception is needed

### Mandatory Human Handoff Triggers

- Guest message sentiment is angry, distressed, or mentions a public review
- Any mention of safety, injury, security, discrimination, or illegal activity
- Access failure, lockout, or inability to enter the property
- Maintenance issue affecting sleep, sanitation, heating, cooling, electricity, or water
- Guest asks for compensation, refund, relocation, or policy exception
- Same issue persists after one automated response
- Automation confidence below accepted threshold
- VIP stay, owner stay, or manually flagged high-risk reservation

### Handoff Process

1. Automation tags the conversation with issue type, severity, and reservation ID.
2. System assigns the case to the correct queue based on the escalation matrix.
3. Human owner sends acknowledgment within the SLA window using the standard issue response template.
4. Owner updates the guest every time there is a new action, vendor ETA, or timing slip.
5. Owner closes the loop with resolution summary and any approved recovery gesture.
6. Shift lead reviews unresolved high-severity cases at handoff and reassigns named ownership.

## Runbook for Common Guest Issues

### 1. Lockout / Access Failure

- Severity: High
- Owner: Duty Operations Manager
- Steps:
  - Verify reservation identity and active stay dates.
  - Confirm which access step failed: building, lockbox, smart lock, unit key.
  - Retry remotely if smart access is available.
  - Dispatch field support if remote recovery fails within 10 minutes.
  - Offer safe waiting guidance and revised ETA every 10 minutes.

### 2. Property Not Clean at Check-In

- Severity: High
- Owner: Housekeeping Lead
- Steps:
  - Request photos and verify turnover status.
  - Dispatch reclean or backup cleaner immediately.
  - Offer luggage hold or waiting instructions if guest is onsite.
  - Approve service recovery credit per policy if guest entry is delayed.

### 3. No Hot Water

- Severity: High
- Owner: Maintenance Lead
- Steps:
  - Confirm full outage versus temporary delay.
  - Check known building outage or boiler reset path.
  - Dispatch technician if not resolved in 15 minutes.
  - Offer workaround or relocation assessment if repair exceeds 12 hours.

### 4. Heating / Air Conditioning Failure

- Severity: High
- Owner: Maintenance Lead
- Steps:
  - Verify indoor temperature and weather conditions.
  - Troubleshoot thermostat, breaker, and unit settings remotely.
  - Dispatch technician if no recovery within 15 minutes.
  - Escalate to COO for relocation decision when conditions are not habitable.

### 5. Wi-Fi Outage

- Severity: Medium to High
- Owner: Guest Experience Coordinator, then Maintenance Lead if persistent
- Steps:
  - Confirm router power, outage scope, and provider status.
  - Guide guest through one reboot path only.
  - Escalate to provider or onsite support if not restored within 20 minutes.
  - Offer backup hotspot solution for business-critical stays where available.

### 6. Noise Complaint Against Another Occupant

- Severity: High
- Owner: Duty Operations Manager
- Steps:
  - Gather unit, timing, and nature of complaint.
  - Contact the allegedly noisy party once with a documented warning.
  - Escalate to local security or field support for repeat disturbance.
  - Keep complainant updated and log all interventions.

### 7. Lost Key / Access Device

- Severity: High
- Owner: Duty Operations Manager
- Steps:
  - Confirm whether guest still has property access.
  - Disable digital credential or re-secure lockbox if relevant.
  - Arrange replacement key/fob delivery.
  - Record replacement fee only if policy supports it and the guest was informed.

### 8. Water Leak / Plumbing Emergency

- Severity: Critical
- Owner: Duty Operations Manager
- Steps:
  - Instruct guest on immediate safety action if safe to do so.
  - Contact emergency vendor and building representative.
  - Assess whether the guest must leave the unit.
  - Escalate to CEO if property damage, relocation, or insurer contact is likely.

### 9. Appliance Failure (Fridge, Cooker, Washer)

- Severity: Medium
- Owner: Maintenance Lead
- Steps:
  - Confirm affected appliance and impact on stay.
  - Provide immediate workaround if possible.
  - Dispatch repair only if the issue materially affects the stay.
  - Approve replacement or compensation path for long-stay impact.

### 10. Late Checkout Request

- Severity: Low
- Owner: Guest Experience Coordinator
- Steps:
  - Verify same-day turnover, cleaner schedule, and occupancy constraints.
  - Approve only within published policy limits unless COO authorizes exception.
  - Confirm approved time in writing and notify housekeeping.

## Shift Handoff Standard

- Every open high or critical case must have a named owner and next update time.
- Handoff note must include reservation ID, issue summary, current guest sentiment, actions taken, and pending dependencies.
- No case moves across shifts without an outbound guest update in the thread.

## Metrics to Track

- First response time by channel
- Time to human handoff
- Time to resolution by issue type
- Reopen rate within 24 hours
- Refund and compensation rate
- Guest satisfaction after incident resolution
- Review mentions tied to operational failures

## Implementation Notes

- Store templates in the CRM or messaging platform as controlled snippets with version history.
- Restrict compensation approval thresholds by role.
- Review incident categories weekly and update the matrix when a new issue type exceeds 3 occurrences in a month.
