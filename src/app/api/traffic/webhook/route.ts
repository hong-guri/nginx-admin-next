import { NextRequest, NextResponse } from 'next/server';
import { collectTrafficData, findProxyHostIdByDomain } from '@/lib/traffic-collector';

/**
 * NPM이나 외부 시스템에서 트래픽 데이터를 전송하는 웹훅 엔드포인트
 * Nginx 로그 파서나 다른 시스템에서 호출 가능
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Host 헤더에서 도메인 추출
    const host = request.headers.get('host') || 
                 request.headers.get('x-forwarded-host') ||
                 body.host ||
                 '';
    
    // 프록시 호스트 ID 찾기
    let proxyHostId = body.proxyHostId;
    if (!proxyHostId && host) {
      proxyHostId = await findProxyHostIdByDomain(host);
    }

    if (!proxyHostId) {
      // 프록시 호스트를 찾을 수 없으면 수집하지 않음
      return NextResponse.json({ 
        success: false, 
        message: '프록시 호스트를 찾을 수 없습니다.' 
      }, { status: 400 });
    }

    // IP 주소 추출
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      body.ipAddress ||
      '';

    // 트래픽 데이터 수집 (비동기)
    await collectTrafficData({
      proxyHostId,
      url: body.url || body.path || '/',
      method: body.method || 'GET',
      statusCode: body.statusCode || body.status || 200,
      responseTime: body.responseTime || body.response_time_ms || 0,
      bytesSent: body.bytesSent || body.bytes_sent || 0,
      ipAddress,
      userAgent: body.userAgent || body.user_agent || request.headers.get('user-agent') || undefined,
      referer: body.referer || body.referrer || request.headers.get('referer') || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('트래픽 웹훅 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

