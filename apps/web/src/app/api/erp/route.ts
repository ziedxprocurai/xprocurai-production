import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json(null, { status: 200 });
  }

  try {
    const connection = await prisma.eRPConnection.findUnique({
      where: { companyId: user.company.id },
    });

    return NextResponse.json(connection);
  } catch (err) {
    console.error('[api/erp] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to fetch ERP connection' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { erpSystem, connectionString, apiKey, credentials } = body;

    if (!erpSystem) {
      return NextResponse.json({ message: 'ERP system is required' }, { status: 400 });
    }

    const existing = await prisma.eRPConnection.findUnique({
      where: { companyId: user.company.id },
    });

    if (existing) {
      return NextResponse.json({ message: 'ERP connection already exists. Use PUT to update.' }, { status: 409 });
    }

    const connection = await prisma.eRPConnection.create({
      data: {
        erpSystem,
        connectionString: connectionString || null,
        apiKey: apiKey || null,
        credentials: credentials || null,
        isActive: true,
        companyId: user.company.id,
      },
    });

    return NextResponse.json(connection);
  } catch (err) {
    console.error('[api/erp] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to create ERP connection' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company' }, { status: 403 });
  }

  try {
    const body = await req.json();

    const existing = await prisma.eRPConnection.findUnique({
      where: { companyId: user.company.id },
    });

    if (!existing) {
      return NextResponse.json({ message: 'No ERP connection found' }, { status: 404 });
    }

    const updated = await prisma.eRPConnection.update({
      where: { companyId: user.company.id },
      data: {
        ...(body.erpSystem && { erpSystem: body.erpSystem }),
        ...(body.connectionString !== undefined && { connectionString: body.connectionString }),
        ...(body.apiKey !== undefined && { apiKey: body.apiKey }),
        ...(body.credentials !== undefined && { credentials: body.credentials }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[api/erp] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to update ERP connection' },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
  }

  if (!user.company) {
    return NextResponse.json({ message: 'User must belong to a company' }, { status: 403 });
  }

  try {
    const existing = await prisma.eRPConnection.findUnique({
      where: { companyId: user.company.id },
    });

    if (!existing) {
      return NextResponse.json({ message: 'No ERP connection found' }, { status: 404 });
    }

    await prisma.eRPConnection.delete({ where: { companyId: user.company.id } });

    return NextResponse.json({ message: 'ERP connection deleted successfully' });
  } catch (err) {
    console.error('[api/erp] Database error:', err);
    return NextResponse.json(
      { message: 'Failed to delete ERP connection' },
      { status: 500 },
    );
  }
}
