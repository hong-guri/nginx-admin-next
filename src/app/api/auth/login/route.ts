import { NextRequest, NextResponse } from 'next/server';
import { NPMClient } from '@/lib/npm-client';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // NPM API로 직접 로그인 시도
    const npmClient = new NPMClient();
    const loginResult = await npmClient.login(email, password);

    if (!loginResult.success || !loginResult.token) {
      return NextResponse.json(
        { error: '이메일 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 세션 토큰 생성 (이메일과 NPM 토큰 저장)
    const sessionData = {
      email,
      npmToken: loginResult.token,
      timestamp: Date.now(),
    };

    const sessionToken = Buffer.from(
      JSON.stringify(sessionData)
    ).toString('base64');

    const response = NextResponse.json({
      success: true,
      token: sessionToken,
    });

    // 쿠키에 토큰 저장 (자동 로그인용)
    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return response;
  } catch (error) {
    console.error('로그인 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

