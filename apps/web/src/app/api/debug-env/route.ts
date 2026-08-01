import { NextResponse } from 'next/server';

// Temporary diagnostic route to verify which AUTH_URL/NEXTAUTH_URL value the
// deployed serverless function actually sees at runtime. Delete once the
// redirect_uri_mismatch issue is confirmed resolved.
export async function GET() {
  return NextResponse.json({
    AUTH_URL: process.env.AUTH_URL ?? null,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
    AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
  });
}
