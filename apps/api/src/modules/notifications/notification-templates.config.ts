export interface NotificationTemplate {
  type: string;
  channel: string;
  title: string;
  body: string;
  variables: string[];
}

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  {
    type: 'ORDER_CONFIRMED',
    channel: 'in_app',
    title: 'Order {{orderNumber}} confirmed',
    body: 'Your order for {{totalAmount}} has been confirmed.',
    variables: ['orderNumber', 'totalAmount'],
  },
  {
    type: 'ORDER_READY',
    channel: 'in_app',
    title: 'Order {{orderNumber}} is ready',
    body: 'Your order is ready for pickup or delivery.',
    variables: ['orderNumber'],
  },
  {
    type: 'LOW_STOCK',
    channel: 'in_app',
    title: 'Low stock alert: {{itemName}}',
    body: '{{itemName}} is below reorder level ({{currentStock}} {{unit}}).',
    variables: ['itemName', 'currentStock', 'unit'],
  },
  {
    type: 'SHIFT_REMINDER',
    channel: 'in_app',
    title: 'Shift reminder',
    body: 'Your shift at {{outletName}} starts at {{startTime}}.',
    variables: ['outletName', 'startTime'],
  },
  {
    type: 'SUBSCRIPTION_EXPIRING',
    channel: 'in_app',
    title: 'Subscription expiring soon',
    body: 'Your {{planName}} plan expires on {{expiresAt}}.',
    variables: ['planName', 'expiresAt'],
  },
];

export function renderTemplate(
  template: NotificationTemplate,
  variables: Record<string, string>,
): { title: string; body: string } {
  const replace = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);

  return {
    title: replace(template.title),
    body: replace(template.body),
  };
}

export function getTemplate(type: string): NotificationTemplate | undefined {
  return NOTIFICATION_TEMPLATES.find((t) => t.type === type);
}
