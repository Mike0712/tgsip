/**
 * Diagnostic CLI for the incoming-call wake push — sends one FCM push
 * directly through Firebase Admin, bypassing Asterisk/asterserver/the HTTP
 * route entirely, and prints the *raw* Firebase error (code + message)
 * instead of the flattened string sendIncomingCallPush() returns to
 * wake-push.ts. Use this to isolate "is it Firebase/the token" from
 * "is it the Asterisk → asterserver → wake-push chain".
 *
 * Run with the same env as the main app (FIREBASE_SERVICE_ACCOUNT, DB_*):
 *   npx tsx src/scripts/send-test-push.ts --user-id 2
 *   npx tsx src/scripts/send-test-push.ts --token <raw-fcm-token> [--from 79991234567]
 */
import { getMessaging } from 'firebase-admin/messaging';
import { closeDatabase, pushTokenService } from '../lib/database';
import { getFirebaseApp, isFirebaseConfigured } from '../lib/firebaseAdmin';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = value;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const userId = args['user-id'];
  const explicitToken = args['token'];
  const from = args['from'] || '70000000000';

  if (!userId && !explicitToken) {
    console.error('Usage: tsx src/scripts/send-test-push.ts --user-id <id> | --token <fcm-token> [--from <number>]');
    process.exitCode = 1;
    return;
  }

  console.log('isFirebaseConfigured():', isFirebaseConfigured());
  if (!isFirebaseConfigured()) {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set in this process env — stopping here.');
    return;
  }

  let token = explicitToken;
  if (!token && userId) {
    const record = await pushTokenService.findByUserId(parseInt(userId, 10));
    if (!record) {
      console.error(`No push_tokens row for user_id=${userId}.`);
      return;
    }
    console.log('Found push token row:', {
      platform: record.platform,
      updated_at: record.updated_at,
      token_preview: `${record.fcm_token.slice(0, 20)}...${record.fcm_token.slice(-10)}`,
    });
    token = record.fcm_token;
  }

  try {
    const messageId = await getMessaging(getFirebaseApp()).send({
      token: token!,
      data: { type: 'incoming_call', from, ts: String(Date.now()) },
      android: { priority: 'high' },
    });
    console.log('Sent OK, messageId:', messageId);
  } catch (error) {
    // Firebase Admin errors carry a machine-readable .code (e.g.
    // "messaging/registration-token-not-registered",
    // "messaging/mismatched-credential") that .message alone doesn't always
    // make obvious — this is the whole point of this script.
    console.error('Firebase send failed:');
    console.error('  code:   ', (error as { code?: string }).code);
    console.error('  message:', error instanceof Error ? error.message : error);
    console.error('  raw:    ', error);
  }
}

main()
  .catch((error) => console.error('Unexpected error:', error))
  .finally(() => closeDatabase());
