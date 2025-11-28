import { NextRequest, NextResponse } from 'next/server';
import { getSession, getNPMClient } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // NPM 토큰 유효성 검사
    const npmClient = await getNPMClient();
    
    if (!npmClient) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      email: session.email,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}

