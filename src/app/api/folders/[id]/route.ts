import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const folderId = parseInt(id);

    const folder = await queryOne<{
      id: number;
      name: string;
      parent_id: number | null;
      color: string;
      icon: string | null;
    }>('SELECT * FROM folders WHERE id = ?', [folderId]);

    if (!folder) {
      return NextResponse.json(
        { error: '폴더를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(folder);
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const folderId = parseInt(id);
    const { name, parent_id, color, icon } = await request.json();

    await query(
      `UPDATE folders 
       SET name = ?, parent_id = ?, color = ?, icon = ? 
       WHERE id = ?`,
      [name, parent_id || null, color, icon, folderId]
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('폴더 업데이트 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const folderId = parseInt(id);

    await query('DELETE FROM folders WHERE id = ?', [folderId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('폴더 삭제 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

