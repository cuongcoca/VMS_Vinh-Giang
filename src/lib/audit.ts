import * as jwt from "jsonwebtoken";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

import { getJwtSecret } from "@/lib/jwt";

export interface RequestActor {
  userId: string | null;
  role: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Trích actor (user + IP + UA) từ request — không throw nếu token thiếu/invalid,
 * trả về các field null để route vẫn ghi audit log "anonymous".
 */
export function getRequestActor(req: Request): RequestActor {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  let userId: string | null = null;
  let role: string | null = null;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, getJwtSecret()) as {
        userId?: string;
        role?: string;
      };
      userId = decoded.userId ?? null;
      role = decoded.role ?? null;
    } catch {
      // Token invalid hoặc expired — vẫn ghi audit với actor=null
    }
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ipAddress = forwarded
    ? forwarded.split(",")[0].trim()
    : req.headers.get("x-real-ip") || null;

  const userAgent = req.headers.get("user-agent")?.slice(0, 255) || null;

  return { userId, role, ipAddress, userAgent };
}

export interface AuditLogInput {
  entity_type: string;
  entity_id: string;
  action: string;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string | null;
}

/**
 * Ghi 1 dòng audit log với actor info trích từ request.
 * - Dùng client truyền vào (cho transaction) hoặc client mặc định.
 * - Không throw nếu insert lỗi (log ra console) để tránh chặn nghiệp vụ chính.
 */
export async function logAudit(
  req: Request,
  input: AuditLogInput,
  client: Prisma.TransactionClient | PrismaClient = defaultPrisma
) {
  const actor = getRequestActor(req);
  try {
    return await client.auditLog.create({
      data: {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        old_value: input.old_value as Prisma.InputJsonValue | undefined,
        new_value: input.new_value as Prisma.InputJsonValue | undefined,
        reason: input.reason ?? null,
        performed_by: actor.userId,
        performed_by_role: actor.role,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
      },
    });
  } catch (err) {
    console.error("logAudit error:", err, "input:", input);
    return null;
  }
}

/**
 * Ghi nhiều dòng audit log cùng 1 request (vd: chốt phiếu nhập sinh
 * nhiều pallet MOVE_TO_STORAGE).
 */
export async function logAuditMany(
  req: Request,
  inputs: AuditLogInput[],
  client: Prisma.TransactionClient | PrismaClient = defaultPrisma
) {
  if (inputs.length === 0) return { count: 0 };
  const actor = getRequestActor(req);
  try {
    return await client.auditLog.createMany({
      data: inputs.map((input) => ({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        action: input.action,
        old_value: input.old_value as Prisma.InputJsonValue | undefined,
        new_value: input.new_value as Prisma.InputJsonValue | undefined,
        reason: input.reason ?? null,
        performed_by: actor.userId,
        performed_by_role: actor.role,
        ip_address: actor.ipAddress,
        user_agent: actor.userAgent,
      })),
    });
  } catch (err) {
    console.error("logAuditMany error:", err, "count:", inputs.length);
    return { count: 0 };
  }
}
