import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session_token')?.value;

  // 공개 API 경로 (인증 불필요)
  const publicApiPaths = [
    '/api/auth/',
    '/api/traffic/log-parser',
    '/api/traffic/webhook',
    '/api/traffic/collect', // 외부 시스템에서 호출 가능
  ];

  const isPublicApi = publicApiPaths.some(path => pathname.startsWith(path));

  // API 라우트는 인증 체크 (공개 API 제외)
  if (pathname.startsWith('/api/') && !isPublicApi) {
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // 대시보드 라우트는 인증 체크
  if (pathname.startsWith('/dashboard')) {
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};

