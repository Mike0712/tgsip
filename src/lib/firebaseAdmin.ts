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

function getFirebaseApp(): App {
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
        from: data.from,
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
