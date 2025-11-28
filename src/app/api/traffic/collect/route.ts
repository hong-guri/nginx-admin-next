import { NextRequest, NextResponse } from 'next/server';
import { collectTrafficData, findProxyHostIdByDomain } from '@/lib/traffic-collector';

/**
 * 트래픽 데이터 수집 API
 * 수동 호출 또는 외부 시스템에서 호출 가능
 * 
 * 사용법:
 * - proxyHostId를 직접 제공하거나
 * - host 헤더를 통해 자동으로 프록시 호스트 ID 찾기
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
      return NextResponse.json(
        { error: '프록시 호스트 ID를 찾을 수 없습니다. proxyHostId 또는 host 헤더를 제공해주세요.' },
        { status: 400 }
      );
    }

    if (!body.url) {
      return NextResponse.json(
        { error: 'url 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // IP 주소 추출
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      body.ipAddress ||
      '';

    // 트래픽 데이터 수집
    await collectTrafficData({
      proxyHostId,
      url: body.url,
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
    console.error('트래픽 데이터 수집 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

