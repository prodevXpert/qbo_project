import { CSVProcessor } from "@/lib/processor";
import { qboAuthService } from "@/lib/qbo-auth";
import { CSVRow, ProcessingSettings } from "@/lib/types";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const cookieStore = await cookies();
    const session = cookieStore.get("qbo_session");

    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Decrypt tokens
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);
    const { payload } = await jwtVerify(session.value, secret);
    let tokens = payload.tokens as any;

    // Refresh token if expired
    try {
      tokens = await qboAuthService.getValidToken(tokens);

      // Update cookie with refreshed tokens
      const encryptedTokens = await new SignJWT({ tokens })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("30d")
        .sign(secret);

      cookieStore.set("qbo_session", encryptedTokens, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    } catch (refreshError: any) {
      console.error("Token refresh failed:", refreshError);
      return NextResponse.json(
        { error: "Authentication expired. Please reconnect to QuickBooks." },
        { status: 401 }
      );
    }

    // Parse request
    const { rows, settings } = (await request.json()) as {
      rows: CSVRow[];
      settings: ProcessingSettings;
    };

    // Create processor and run dry-run
    const processor = new CSVProcessor(tokens, settings);
    const dryRunResults = await processor.dryRun(rows);

    return NextResponse.json({ results: dryRunResults });
  } catch (error: any) {
    console.error("Dry-run error:", error);
    return NextResponse.json(
      { error: error.message || "Dry-run failed" },
      { status: 500 }
    );
  }
}
