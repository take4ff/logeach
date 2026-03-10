import { NextResponse } from "next/server";
import { fetchMessages } from "@/src/lib/messages";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    const { sessionId } = await params;

    if (!sessionId) {
        return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    const messages = await fetchMessages(sessionId);
    return NextResponse.json({ messages });
}
