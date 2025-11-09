import { CSVProcessor } from "@/lib/processor";
import { qboAuthService } from "@/lib/qbo-auth";
import { CSVRow, ProcessingSettings, UploadedFile } from "@/lib/types";
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

    // Parse multipart form data
    const formData = await request.formData();
    const rowsJson = formData.get("rows") as string;
    const settingsJson = formData.get("settings") as string;

    const rows: CSVRow[] = JSON.parse(rowsJson);
    const settings: ProcessingSettings = JSON.parse(settingsJson);

    // Extract uploaded files
    const attachments = new Map<string, UploadedFile>();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_")) {
        const file = value as File;
        const arrayBuffer = await file.arrayBuffer();
        attachments.set(file.name, {
          name: file.name,
          size: file.size,
          type: file.type,
          data: arrayBuffer,
        });
      }
    }

    // Create processor and execute
    console.log("Creating processor with settings:", settings);
    console.log("Number of rows to process:", rows.length);
    console.log("Number of attachments:", attachments.size);

    const processor = new CSVProcessor(tokens, settings);
    const results = await processor.processAll(rows, attachments);

    console.log("Processing complete. Results:", results.length);

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("Processing error:", error);
    console.error("Error stack:", error.stack);
    return NextResponse.json(
      { error: error.message || "Processing failed" },
      { status: 500 }
    );
  }
}
