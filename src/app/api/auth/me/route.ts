import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vinhgiang_super_secret_key_2026";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      sessionId?: string;
      iat?: number;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        full_name: true,
        role: true,
        phone: true,
        email: true,
        is_locked: true,
        password_changed_at: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (user.is_locked) {
      return NextResponse.json({ success: false, error: "Account locked" }, { status: 403 });
    }

    // TC_T03_21: Check nếu password đã đổi sau khi token được cấp
    if (user.password_changed_at && decoded.iat) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (tokenIssuedAt < user.password_changed_at) {
        return NextResponse.json(
          { success: false, error: "Password changed. Please login again." },
          { status: 401 }
        );
      }
    }

    // Check session validity nếu có sessionId
    if (decoded.sessionId) {
      const session = await prisma.session.findFirst({
        where: {
          id: decoded.sessionId,
          user_id: decoded.userId,
          is_active: true,
        },
      });

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session expired" },
          { status: 401 }
        );
      }

      // Update last_active
      await prisma.session.update({
        where: { id: decoded.sessionId },
        data: { last_active: new Date() },
      });
    }

    const userData = {
        id: user.id,
        full_name: user.full_name,
        fullName: user.full_name,
        role: user.role,
        phone: user.phone,
        email: user.email,
      };

    return NextResponse.json({
      success: true,
      data: userData,
      user: userData,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
  }
}
