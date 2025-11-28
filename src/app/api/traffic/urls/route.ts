import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

// 접속 URL 통계 조회
export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get('limit') || '50', 10))); // 1-1000 사이로 제한

    // access_logs 테이블에서 실제 접속 데이터 조회
    let sql = `
      SELECT 
        url,
        COUNT(*) as access_count,
        COUNT(DISTINCT ip_address) as unique_ips,
        MAX(created_at) as last_access,
        AVG(response_time_ms) as avg_response_time,
        SUM(bytes_sent) as total_bytes_sent
      FROM access_logs
      WHERE url IS NOT NULL AND url != ''
    `;
    const params: any[] = [];

    if (proxyHostId) {
      sql += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId, 10));
    }

    // LIMIT은 숫자로 직접 삽입 (SQL 인젝션 방지를 위해 숫자만 허용)
    sql += ` GROUP BY url ORDER BY access_count DESC LIMIT ${limit}`;

    const urls = await query(sql, params);

    return NextResponse.json(urls);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('URL 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

