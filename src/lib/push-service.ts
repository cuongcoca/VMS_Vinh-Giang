/**
 * Push Notification Service — Firebase Cloud Messaging (FCM)
 *
 * Gửi push notification đến thiết bị iOS/Android qua Firebase Admin SDK.
 * Tích hợp với hệ thống notification hiện tại (notifications.ts).
 */

import admin from 'firebase-admin';
import { prisma } from './prisma';

// ─── Singleton Firebase Admin ───────────────────────────────────────────

let firebaseInitialized = false;

function getFirebaseApp(): admin.app.App {
  if (firebaseInitialized) {
    return admin.app();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[Push] Missing Firebase config. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

  firebaseInitialized = true;
  console.log('[Push] Firebase Admin initialized');
  return admin.app();
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>; // custom data (type, entity_id, link_url, ...)
}

// ─── Core: Gửi push đến danh sách tokens ───────────────────────────────

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  if (tokens.length === 0) return;

  try {
    getFirebaseApp();
    const messaging = admin.messaging();

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'wms-default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);

    // Xử lý token invalid → deactivate
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (resp.error) {
          const code = resp.error.code;
          // Token hết hạn hoặc không hợp lệ
          if (
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokens[idx]);
          }
          console.error(`[Push] Error sending to token ${idx}:`, resp.error.message);
        }
      });

      // Deactivate invalid tokens
      if (invalidTokens.length > 0) {
        await cleanupInvalidTokens(invalidTokens);
      }
    }

    console.log(
      `[Push] Sent: ${response.successCount} success, ${response.failureCount} failed (${tokens.length} total)`
    );
  } catch (error) {
    console.error('[Push] sendToTokens error:', error);
  }
}

// ─── Gửi push cho 1 user (tất cả devices) ──────────────────────────────

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const deviceTokens = await prisma.deviceToken.findMany({
    where: { user_id: userId, is_active: true },
    select: { token: true },
  });

  const tokens = deviceTokens.map((d) => d.token);
  await sendToTokens(tokens, payload);
}

// ─── Gửi push cho nhiều users ───────────────────────────────────────────

export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  const deviceTokens = await prisma.deviceToken.findMany({
    where: { user_id: { in: userIds }, is_active: true },
    select: { token: true },
  });

  const tokens = deviceTokens.map((d) => d.token);
  await sendToTokens(tokens, payload);
}

// ─── Gửi push cho tất cả users có role tương ứng ───────────────────────

export async function sendPushToRoles(roles: string[], payload: PushPayload): Promise<void> {
  if (roles.length === 0) return;

  const users = await prisma.user.findMany({
    where: { role: { in: roles as any[] }, is_locked: false },
    select: { id: true },
  });

  const userIds = users.map((u) => u.id);
  await sendPushToUsers(userIds, payload);
}

// ─── Cleanup: xóa token hết hạn/invalid ────────────────────────────────

async function cleanupInvalidTokens(tokens: string[]): Promise<void> {
  try {
    const result = await prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { is_active: false },
    });
    console.log(`[Push] Deactivated ${result.count} invalid tokens`);
  } catch (error) {
    console.error('[Push] cleanupInvalidTokens error:', error);
  }
}
