import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const globalPathBlacklist = await query<{
      id: number;
      path_pattern: string;
      description: string | null;
      is_active: boolean;
    }>('SELECT * FROM global_path_blacklist ORDER BY created_at DESC');

    return NextResponse.json(globalPathBlacklist);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('전역 경로 블랙리스트 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { path_pattern, description } = await request.json();

    if (!path_pattern) {
      return NextResponse.json(
        { error: '경로 패턴을 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO global_path_blacklist (path_pattern, description) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE 
       description = VALUES(description), 
       is_active = TRUE`,
      [path_pattern, description || null]
    );

    const id = (result as any).insertId || (await query(
      'SELECT id FROM global_path_blacklist WHERE path_pattern = ?',
      [path_pattern]
    ) as any)[0]?.id;

    return NextResponse.json({ id });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('전역 경로 블랙리스트 추가 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

