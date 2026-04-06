# Notification Event Contract

This document defines the payloads expected by the notification layer before booking and issue lifecycle wiring is added.
The source of truth for validation is [src/notifications/schema.ts](../src/notifications/schema.ts).

## Supported Event Types

### `booking.confirmed`

- Purpose: send booking confirmation after reservation confirmation
- Required identifiers: `eventId`, `reservationId`, `propertyId`
- Channels: `email`, optional `sms`
- Template: `booking_confirmation`

### `booking.check_in_instructions_requested`

- Purpose: send pre-arrival access details
- Required identifiers: `eventId`, `reservationId`, `propertyId`
- Channels: `email` and `sms`
- Template: `check_in_instructions`

### `booking.checkout_reminder_requested`

- Purpose: send departure reminder on the day before checkout
- Required identifiers: `eventId`, `reservationId`, `propertyId`
- Channels: `email` and `sms`
- Template: `checkout_instructions`

### `service_request.reported`

- Purpose: acknowledge a non-emergency guest issue and set expectations
- Required identifiers: `eventId`, `serviceRequestId`, `propertyId`
- Channels: whichever inbound-contact channels are available
- Template: `standard_issue_response`

## Shared Envelope

Every event includes:

- `eventType`
- `eventId`
- `occurredAt`
- `propertyId`
- `recipient`
- `channels`
- `template`

The `recipient` object carries the notification destination and locale metadata:

- `guestFullName`
- `guestFirstName`
- `email` when email delivery is possible
- `phone` when SMS delivery is possible
- `locale`
- `timezone`

## Template Payload Expectations

Template payloads stay normalized and presentation-ready. Upstream lifecycle code should resolve raw domain records into values the guest can receive directly, such as:

- formatted property name and address
- guest-visible dates and operational windows
- support phone numbers
- owner role and next-action messaging for issue acknowledgements
- access, Wi-Fi, parking, and checkout instruction strings

The renderer is intentionally dumb: it validates and interpolates supplied values, but it does not query repositories or derive operational text on its own.
