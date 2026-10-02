import { NextRequest, NextResponse } from "next/server";

type DemoRequest = {
  name: string;
  center: string;
  email: string;
  phone: string;
  preferredTime?: string;
  collaborators?: string;
};

export async function POST(req: NextRequest) {
  let body: DemoRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.name || !body.center || !body.email || !body.phone) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Log the request for now — integrate with CRM/email/notification service here
  console.log("[Demo Request]", {
    name: body.name,
    center: body.center,
    email: body.email,
    phone: body.phone,
    preferredTime: body.preferredTime ?? "—",
    collaborators: body.collaborators ?? "—",
    submittedAt: new Date().toISOString(),
  });

  return NextResponse.json({ success: true });
}
