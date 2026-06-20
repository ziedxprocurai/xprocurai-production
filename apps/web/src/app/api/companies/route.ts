import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (user.companyId) {
    return NextResponse.json(
      { message: 'User already belongs to a company' },
      { status: 409 },
    );
  }

  try {
    const body = await req.json();
    const { legalName, website, country, city, industry, companySize, phoneNumber, email, description, roles } = body;

    if (!legalName || !country) {
      return NextResponse.json(
        { message: 'legalName and country are required' },
        { status: 400 },
      );
    }

    const company = await prisma.company.create({
      data: {
        legalName,
        website: website || null,
        country,
        city: city || null,
        industry: industry || null,
        companySize: companySize || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        description: description || null,
        roles: roles || ['BUYER'],
        onboardingStatus: 'COMPLETED',
        users: { connect: { id: user.id } },
      },
      include: {
        users: { select: { id: true, email: true, fullName: true } },
      },
    });

    // Mark user as onboarded
    await prisma.user.update({
      where: { id: user.id },
      data: { onboarded: true },
    });

    return NextResponse.json(company);
  } catch (err) {
    console.error('[api/companies] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create company' },
      { status: 500 },
    );
  }
}
