const TIMER_NOTIFICATION_TAG = 'malzeit-active-timer';

type BadgingNavigator = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

export type TimerIndicatorPermission = NotificationPermission | 'unsupported';

export async function requestTimerIndicatorPermission(): Promise<TimerIndicatorPermission> {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  )
    return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return 'default';
  }
}

export async function showTimerIndicator({
  paintingTitle,
  startedAt,
  paused,
}: {
  paintingTitle: string;
  startedAt: number;
  paused: boolean;
}) {
  if (typeof window === 'undefined') return;

  const badging = navigator as BadgingNavigator;
  if (badging.setAppBadge) await badging.setAppBadge(1).catch(() => undefined);

  if (
    !('Notification' in window) ||
    Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  )
    return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const root = new URL('./', registration.scope).href;
    const start = new Date(startedAt).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    await registration.showNotification(
      paused ? 'Malzeit · Timer pausiert' : 'Malzeit · Timer läuft',
      {
        body: paused
          ? `${paintingTitle} · Tippe zum Fortsetzen`
          : `${paintingTitle} · Gestartet um ${start}`,
        tag: TIMER_NOTIFICATION_TAG,
        icon: new URL('icon-192.png', root).href,
        badge: new URL('timer-badge.png', root).href,
        data: { url: root },
        lang: 'de',
        requireInteraction: true,
        silent: true,
      },
    );
  } catch {
    // The timer remains authoritative even if the operating system declines
    // or removes its optional indicator.
  }
}

export async function clearTimerIndicator() {
  if (typeof window === 'undefined') return;

  const badging = navigator as BadgingNavigator;
  if (badging.clearAppBadge)
    await badging.clearAppBadge().catch(() => undefined);

  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return;
    const notifications = await registration.getNotifications({
      tag: TIMER_NOTIFICATION_TAG,
    });
    for (const notification of notifications) notification.close();
  } catch {
    // Some browsers expose only part of the Notifications API.
  }
}
