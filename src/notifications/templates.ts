import {
  type NotificationChannel,
  type NotificationRenderInput,
  notificationRenderInputSchema,
  type NotificationTemplateId
} from "./schema.js";

type TemplateVariables = Record<string, string | number>;

export type RenderedNotification = {
  templateId: NotificationTemplateId;
  channel: NotificationChannel;
  subject?: string;
  body: string;
};

type TemplateDefinition = {
  subject?: string;
  body: string;
};

type TemplateRegistry = Record<
  NotificationTemplateId,
  Record<NotificationChannel, TemplateDefinition>
>;

const templateRegistry: TemplateRegistry = {
  booking_confirmation: {
    email: {
      subject: "Your stay at {{propertyName}} is confirmed",
      body: [
        "Hi {{guestFirstName}},",
        "",
        "Your booking for {{propertyName}} is confirmed for {{checkInDate}} to {{checkOutDate}}.",
        "",
        "Stay details:",
        "",
        "- Address: {{propertyAddress}}",
        "- Guests: {{guestCount}}",
        "- Check-in window: {{checkInTime}}",
        "- Check-out time: {{checkOutTime}}",
        "",
        "What happens next:",
        "",
        "- We will send check-in instructions {{checkInInstructionTiming}}.",
        "- If you need to update arrival details, reply to this message.",
        "- For urgent stay issues, contact {{supportPhone}}.",
        "",
        "We look forward to hosting you.",
        "",
        "AIRAA Guest Operations"
      ].join("\n")
    },
    sms: {
      body:
        "AIRAA: booking confirmed for {{propertyName}} from {{checkInDate}} to {{checkOutDate}}. Check-in {{checkInTime}}, check-out {{checkOutTime}}. Support: {{supportPhone}}."
    }
  },
  check_in_instructions: {
    email: {
      subject: "Check-in details for {{propertyName}}",
      body: [
        "Hi {{guestFirstName}},",
        "",
        "Here are your check-in details for {{propertyName}} on {{checkInDate}}.",
        "",
        "Access instructions:",
        "",
        "1. Arrival address: {{propertyAddress}}",
        "2. Building access: {{buildingAccessSteps}}",
        "3. Unit access: {{unitAccessSteps}}",
        "4. Wi-Fi: {{wifiName}} / {{wifiPassword}}",
        "",
        "Important reminders:",
        "",
        "- Check-in starts at {{checkInTime}}",
        "- Quiet hours: {{quietHours}}",
        "- Parking: {{parkingInstructions}}",
        "- House rules: {{houseRulesLink}}",
        "",
        "If anything is unclear or your arrival time changes, reply here before you travel.",
        "",
        "AIRAA Guest Operations"
      ].join("\n")
    },
    sms: {
      body:
        "AIRAA check-in for {{propertyName}} on {{checkInDate}}: {{propertyAddress}}. Building: {{buildingAccessSteps}}. Unit: {{unitAccessSteps}}. Wi-Fi {{wifiName}}/{{wifiPassword}}."
    }
  },
  standard_issue_response: {
    email: {
      subject: "We received your issue at {{propertyName}}",
      body: [
        "Hi {{guestFirstName}},",
        "",
        "Thanks for flagging this. We have logged your issue as {{issueType}} at {{propertyName}}.",
        "",
        "Next step:",
        "",
        "- Owner: {{ownerRole}}",
        "- Action: {{nextAction}}",
        "- Expected update by: {{nextUpdateTime}}",
        "",
        "If the issue becomes urgent or affects safety, access, heating, water, or security, contact us immediately at {{supportPhone}}.",
        "",
        "AIRAA Guest Operations"
      ].join("\n")
    },
    sms: {
      body:
        "AIRAA: we logged your {{issueType}} issue at {{propertyName}}. Owner: {{ownerRole}}. Next: {{nextAction}}. Update by {{nextUpdateTime}}. Urgent help: {{supportPhone}}."
    }
  },
  checkout_instructions: {
    email: {
      subject: "Checkout reminder for {{propertyName}}",
      body: [
        "Hi {{guestFirstName}},",
        "",
        "This is your checkout reminder for tomorrow.",
        "",
        "Before you leave:",
        "",
        "- Checkout time is {{checkOutTime}}",
        "- Place used towels in {{towelLocation}}",
        "- Load and start the dishwasher if applicable",
        "- Put rubbish in {{wasteInstructions}}",
        "- Close windows, switch off lights, and lock the door",
        "- Return keys or fobs using {{keyReturnSteps}}",
        "",
        "If you need a late checkout, reply before {{lateCheckoutCutoffTime}} and we will confirm availability.",
        "",
        "Thank you for staying with AIRAA."
      ].join("\n")
    },
    sms: {
      body:
        "AIRAA checkout reminder for {{propertyName}} tomorrow: out by {{checkOutTime}}. Towels: {{towelLocation}}. Waste: {{wasteInstructions}}. Keys: {{keyReturnSteps}}."
    }
  }
};

export function renderNotificationTemplate(
  input: NotificationRenderInput
): RenderedNotification {
  const parsed = notificationRenderInputSchema.parse(input);
  const definition = templateRegistry[parsed.templateId][parsed.channel];
  const variables = buildVariables(parsed);
  const renderedSubject = definition.subject
    ? interpolateTemplate(definition.subject, variables)
    : undefined;

  return {
    templateId: parsed.templateId,
    channel: parsed.channel,
    ...(renderedSubject ? { subject: renderedSubject } : {}),
    body: interpolateTemplate(definition.body, variables)
  };
}

function buildVariables(input: NotificationRenderInput): TemplateVariables {
  return {
    guestFullName: input.recipient.guestFullName,
    guestFirstName: input.recipient.guestFirstName,
    ...input.data
  };
}

function interpolateTemplate(
  template: string,
  variables: TemplateVariables
): string {
  return template.replaceAll(/{{(\w+)}}/g, (match, key: string) => {
    const value = variables[key];

    if (value === undefined) {
      throw new Error(`Missing notification template variable: ${key}`);
    }

    return String(value);
  });
}
