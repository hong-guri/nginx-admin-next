import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');
    const minutes = parseInt(searchParams.get('minutes') || '60');

    let sql = `
      SELECT 
        proxy_host_id,
        DATE_FORMAT(timestamp, '%Y-%m-%d %H:%i') as time_bucket,
        SUM(request_count) as total_requests,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) as data_points
      FROM realtime_traffic
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;
    const params: any[] = [minutes];

    if (proxyHostId) {
      sql += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId));
    }

    sql += ' GROUP BY proxy_host_id, time_bucket ORDER BY time_bucket DESC';

    const data = await query(sql, params);

    return NextResponse.json(data);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('실시간 트래픽 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

