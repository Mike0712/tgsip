/**
 * Обёртка над Firebase Admin SDK — отправка data-only FCM push в мобильное
 * приложение (см. mobile/) для побудки из killed-состояния и показа
 * нативного экрана входящего звонка (react-native-callkeep).
 *
 * Сервис-аккаунт берём из env FIREBASE_SERVICE_ACCOUNT — весь JSON-ключ
 * (скачивается в Firebase Console → Project settings → Service accounts)
 * одной строкой, как уже сделано с другими секретами в этом проекте.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let app: App | null = null;

export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

// Exported (in addition to sendIncomingCallPush) so diagnostic tooling
// (src/scripts/send-test-push.ts) can call messaging.send() directly and see
// the raw Firebase error (.code, .errorInfo) instead of just the flattened
// .message string sendIncomingCallPush returns to callers.
export function getFirebaseApp(): App {
  if (app) return app;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured');
  }

  const serviceAccount = JSON.parse(raw);
  app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return app;
}

/**
 * Шлёт data-only push высокого приоритета — без блока `notification`,
 * иначе Android покажет свой дефолтный системный пуш вместо нашего
 * CallKeep-экрана входящего звонка.
 */
export async function sendIncomingCallPush(
  fcmToken: string,
  data: { from: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const messaging = getMessaging(getFirebaseApp());
    await messaging.send({
      token: fcmToken,
      data: {
        type: 'incoming_call',
        // "from" is a reserved FCM data-payload key (like "to",
        // "message_type", "collapse_key") — Google's send API rejects it
        // outright with 400 "Invalid data payload key: from". Renamed to
        // "caller"; mobile/index.ts and App.tsx read this same key.
        caller: data.from,
        ts: String(Date.now()),
      },
      android: {
        priority: 'high',
      },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
