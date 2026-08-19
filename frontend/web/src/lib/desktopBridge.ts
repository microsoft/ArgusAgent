import type { DeliveryReceipt } from '../../../core/src/types';

export interface DesktopDeliveryNotification {
  deliveryId: string;
  title: string;
  summary: string;
  path?: string;
}

interface ArgusDesktopBridge {
  notifyDelivery?(payload: DesktopDeliveryNotification): Promise<boolean>;
  onOpenDelivery?(callback: (payload: DesktopDeliveryNotification) => void): () => void;
}

declare global {
  interface Window {
    argusDesktop?: ArgusDesktopBridge;
  }
}

function nonEmptyString(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export function deliveryNotificationPayload(
  delivery: DeliveryReceipt,
): DesktopDeliveryNotification | null {
  const deliveryId = nonEmptyString(delivery.delivery_id, 300);
  if (!deliveryId) return null;
  return {
    deliveryId,
    title: nonEmptyString(delivery.title, 240) || 'Argus',
    summary: nonEmptyString(delivery.summary, 1_000),
    ...(delivery.primary_target?.path
      ? { path: nonEmptyString(delivery.primary_target.path, 1_000) }
      : {}),
  };
}

export function notifyDesktopDelivery(delivery: DeliveryReceipt): Promise<boolean> {
  const payload = deliveryNotificationPayload(delivery);
  if (!payload || typeof window === 'undefined') return Promise.resolve(false);
  return window.argusDesktop?.notifyDelivery?.(payload) ?? Promise.resolve(false);
}

export function subscribeDesktopDelivery(
  callback: (payload: DesktopDeliveryNotification) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  return window.argusDesktop?.onOpenDelivery?.(callback) ?? (() => undefined);
}
