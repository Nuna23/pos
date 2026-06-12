// Web Push subscription helper. Produces the {endpoint, p256dh, auth} the
// backend stores on an order so it can push a "crepe ready" notification even
// when the customer's phone is locked.
//
// NOTE: delivery also requires the backend to run on PHP >= 7.3 (the 5.6 host
// can't encrypt the payload, so it's a logged no-op). The subscription is still
// captured here so push works the moment the backend is upgraded.

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

export interface PushKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

// VAPID public key is base64url; the Push API wants a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// Registers the service worker, ensures notification permission, and returns a
// push subscription's keys — or null if push isn't available/allowed. Never
// throws: the order must proceed regardless.
export async function getPushSubscription(): Promise<PushKeys | null> {
  try {
    if (typeof window === 'undefined') return null;
    if (!VAPID_PUBLIC) return null; // no key configured -> skip silently
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    if (!('Notification' in window)) return null;

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission !== 'granted') return null;

    // Reuse an existing subscription, or create one.
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const keys = json.keys ?? {};
    if (!json.endpoint || !keys.p256dh || !keys.auth) return null;
    return { endpoint: json.endpoint, p256dh: keys.p256dh, auth: keys.auth };
  } catch {
    return null;
  }
}
