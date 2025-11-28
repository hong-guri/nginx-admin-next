import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const proxyHostId = searchParams.get('proxy_host_id');

    let pathBlacklist;
    if (proxyHostId) {
      pathBlacklist = await query<{
        id: number;
        proxy_host_id: number;
        path_pattern: string;
        description: string | null;
        is_active: boolean;
      }>(
        'SELECT * FROM path_blacklist WHERE proxy_host_id = ? ORDER BY created_at DESC',
        [parseInt(proxyHostId)]
      );
    } else {
      pathBlacklist = await query<{
        id: number;
        proxy_host_id: number;
        path_pattern: string;
        description: string | null;
        is_active: boolean;
      }>('SELECT * FROM path_blacklist ORDER BY created_at DESC');
    }

    return NextResponse.json(pathBlacklist);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('경로 블랙리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { proxy_host_id, path_pattern, description } = await request.json();

    if (!proxy_host_id || !path_pattern) {
      return NextResponse.json(
        { error: '프록시 호스트 ID와 경로 패턴을 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO path_blacklist (proxy_host_id, path_pattern, description) 
       VALUES (?, ?, ?)`,
      [proxy_host_id, path_pattern, description || null]
    );

    const id = (result as any).insertId;

    return NextResponse.json({ id });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('경로 블랙리스트 추가 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

