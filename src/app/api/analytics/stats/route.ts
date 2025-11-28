import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');
    const hours = parseInt(searchParams.get('hours') || '24');

    let sql = `
      SELECT 
        proxy_host_id,
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:00') as time_bucket,
        SUM(request_count) as total_requests,
        SUM(bytes_sent) as total_bytes_sent,
        SUM(bytes_received) as total_bytes_received,
        AVG(avg_response_time_ms) as avg_response_time,
        SUM(status_2xx) as status_2xx,
        SUM(status_4xx) as status_4xx,
        SUM(status_5xx) as status_5xx
      FROM traffic_stats
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;
    const params: any[] = [hours];

    if (proxyHostId) {
      sql += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId));
    }

    sql += ' GROUP BY proxy_host_id, time_bucket ORDER BY time_bucket DESC';

    const stats = await query(sql, params);

    return NextResponse.json(stats);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('통계 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

