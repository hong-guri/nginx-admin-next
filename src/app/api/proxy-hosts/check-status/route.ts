import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

async function checkHostStatus(domain: string, sslForced: boolean): Promise<{ statusCode: number | null; error?: string }> {
  try {
    const protocol = sslForced ? 'https' : 'http';
    const url = `${protocol}://${domain}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Nginx-Proxy-Manager-Status-Checker/1.0',
        },
      });
      
      clearTimeout(timeoutId);
      return { statusCode: response.status };
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        return { statusCode: null, error: 'Timeout' };
      }
      
      // 네트워크 오류나 SSL 오류 등
      return { statusCode: null, error: error.message || 'Connection failed' };
    }
  } catch (error: any) {
    return { statusCode: null, error: error.message || 'Unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    
    const { hostId, domain, sslForced } = await request.json();
    
    if (!hostId || !domain) {
      return NextResponse.json(
        { error: 'hostId와 domain이 필요합니다.' },
        { status: 400 }
      );
    }
    
    const result = await checkHostStatus(domain, sslForced || false);
    
    // DB에 상태 저장
    try {
      await query(
        `INSERT INTO proxy_host_status (proxy_host_id, status_code, status_error, checked_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           status_code = VALUES(status_code),
           status_error = VALUES(status_error),
           checked_at = NOW()`,
        [hostId, result.statusCode, result.error || null]
      );
    } catch (dbError) {
      console.error('상태 DB 저장 오류:', dbError);
      // DB 저장 실패해도 결과는 반환
    }
    
    return NextResponse.json({
      hostId,
      ...result,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('접속 상태 확인 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

