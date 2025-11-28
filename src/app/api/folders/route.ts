import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const folders = await query<{
      id: number;
      name: string;
      parent_id: number | null;
      color: string;
      icon: string | null;
      created_at: Date;
      updated_at: Date;
    }>('SELECT * FROM folders ORDER BY name');

    return NextResponse.json(folders);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('폴더 조회 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const { name, parent_id, color, icon } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: '폴더 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO folders (name, parent_id, color, icon) 
       VALUES (?, ?, ?, ?)`,
      [name, parent_id || null, color || '#3b82f6', icon || null]
    );

    const folderId = (result as any).insertId;

    return NextResponse.json({ id: folderId });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('폴더 생성 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

