import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const limit = Math.max(1, Math.min(1000, parseInt(searchParams.get('limit') || '100', 10))); // 1-1000 사이로 제한
    const eventType = searchParams.get('event_type');
    const proxyHostId = searchParams.get('proxy_host_id');

    let sql = 'SELECT * FROM security_events WHERE 1=1';
    const params: any[] = [];

    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }

    if (proxyHostId) {
      sql += ' AND proxy_host_id = ?';
      params.push(parseInt(proxyHostId, 10));
    }

    // LIMIT은 숫자로 직접 삽입 (SQL 인젝션 방지를 위해 숫자만 허용)
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const events = await query<{
      id: number;
      proxy_host_id: number | null;
      event_type: string;
      ip_address: string | null;
      path: string | null;
      user_agent: string | null;
      details: string | null;
      created_at: Date;
    }>(sql, params);

    return NextResponse.json(events);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('보안 이벤트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

