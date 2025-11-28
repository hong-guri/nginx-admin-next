'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal, ConfirmModal } from '@/components/ui/modal';

interface Folder {
    id: number;
    name: string;
    parent_id: number | null;
    color: string;
    icon: string | null;
}

export default function FoldersPage() {
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        parent_id: null as number | null,
        color: '#3b82f6',
        icon: '',
    });

    useEffect(() => {
        fetchFolders();
    }, []);

    const fetchFolders = async () => {
        try {
            const response = await fetch('/api/folders');
            const data = await response.json();
            setFolders(data);
        } catch (error) {
            console.error('폴더 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setShowCreateModal(false);
                setFormData({ name: '', parent_id: null, color: '#3b82f6', icon: '' });
                fetchFolders();
            }
        } catch (error) {
            console.error('폴더 생성 오류:', error);
        }
    };

    const handleDeleteClick = (id: number) => {
        setDeleteTarget(id);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;

        try {
            const response = await fetch(`/api/folders/${deleteTarget}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchFolders();
                setDeleteTarget(null);
            }
        } catch (error) {
            console.error('폴더 삭제 오류:', error);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="text-xs text-gray-600 dark:text-gray-400">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        폴더 관리
                    </h1>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        프록시 호스트를 폴더로 정리하세요
                    </p>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                    + 새 폴더
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {folders.map((folder) => (
                    <Card key={folder.id} className="hover:shadow-md transition-all">
                        <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                        style={{ backgroundColor: folder.color }}
                                    >
                                        {folder.icon || folder.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white text-xs">
                                            {folder.name}
                                        </h3>
                                        {folder.parent_id && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                하위
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteClick(folder.id)}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    삭제
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Modal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="새 폴더 만들기"
                size="sm"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => setShowCreateModal(false)}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={(e) => {
                                e.preventDefault();
                                handleCreate(e as any);
                            }}
                        >
                            만들기
                        </Button>
                    </div>
                }
            >
                <form onSubmit={handleCreate} className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            이름
                        </label>
                        <Input
                            type="text"
                            value={formData.name}
                            onChange={(e) =>
                                setFormData({ ...formData, name: e.target.value })
                            }
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            색상
                        </label>
                        <input
                            type="color"
                            value={formData.color}
                            onChange={(e) =>
                                setFormData({ ...formData, color: e.target.value })
                            }
                            className="w-full h-10 rounded cursor-pointer"
                        />
                    </div>
                </form>
            </Modal>

            <ConfirmModal
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="폴더 삭제"
                message="이 폴더를 삭제하시겠습니까? 폴더에 속한 프록시 호스트는 삭제되지 않습니다."
                confirmText="삭제"
                cancelText="취소"
                variant="danger"
            />
        </div>
    );
}

