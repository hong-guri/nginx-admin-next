'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { IconX } from '@tabler/icons-react';
import { Modal } from '@/components/ui/modal';

interface ProxyHost {
    id: number;
    domain_names: string[];
    forward_host: string;
    forward_port: number;
    ssl_forced: boolean;
    enabled: boolean;
    folders: Array<{ folder_id: number; name: string; color: string }>;
}

interface Folder {
    id: number;
    name: string;
    color: string;
}

export default function EditProxyHostPage() {
    const router = useRouter();
    const params = useParams();
    const hostId = params?.id ? parseInt(params.id as string) : null;

    const [host, setHost] = useState<ProxyHost | null>(null);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (hostId) {
            fetchData();
        }
    }, [hostId]);

    const fetchData = async () => {
        try {
            const [hostRes, foldersRes] = await Promise.all([
                fetch(`/api/proxy-hosts/${hostId}`).then((r) => r.json()),
                fetch('/api/folders').then((r) => r.json()),
            ]);

            setHost(hostRes);
            setFolders(Array.isArray(foldersRes) ? foldersRes : []);
            setSelectedFolderIds(
                hostRes.folders?.map((f: any) => f.folder_id) || []
            );
        } catch (error) {
            console.error('데이터 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!host) return;

        setSaving(true);
        try {
            const response = await fetch(`/api/proxy-hosts/${hostId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...host,
                    folderIds: selectedFolderIds,
                }),
            });

            if (response.ok) {
                router.push('/dashboard/proxy-hosts');
            } else {
                const errorData = await response.json();
                setError(errorData.error || '저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('저장 오류:', error);
            setError('저장 중 오류가 발생했습니다.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32">
                <div className="text-xs text-gray-600 dark:text-gray-400">로딩 중...</div>
            </div>
        );
    }

    if (!host) {
        return (
            <div className="text-center py-8">
                <p className="text-sm text-gray-600 dark:text-gray-400">프록시 호스트를 찾을 수 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        프록시 호스트 편집
                    </h1>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        {host.domain_names.join(', ')}
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/dashboard/proxy-hosts')}
                >
                    <IconX className="w-4 h-4" />
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>기본 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            도메인
                        </label>
                        <Input
                            value={host.domain_names.join(', ')}
                            readOnly
                            className="bg-gray-50 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            포워드 호스트
                        </label>
                        <Input
                            value={host.forward_host}
                            readOnly
                            className="bg-gray-50 dark:bg-gray-700"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            포워드 포트
                        </label>
                        <Input
                            type="number"
                            value={host.forward_port}
                            readOnly
                            className="bg-gray-50 dark:bg-gray-700"
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>폴더</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {folders.map((folder) => (
                            <label
                                key={folder.id}
                                className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedFolderIds.includes(folder.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedFolderIds([...selectedFolderIds, folder.id]);
                                        } else {
                                            setSelectedFolderIds(
                                                selectedFolderIds.filter((id) => id !== folder.id)
                                            );
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                                />
                                <div
                                    className="w-4 h-4 rounded"
                                    style={{ backgroundColor: folder.color }}
                                />
                                <span className="text-xs text-gray-900 dark:text-white">
                                    {folder.name}
                                </span>
                            </label>
                        ))}
                        {folders.length === 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                폴더가 없습니다. 먼저 폴더를 생성하세요.
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-2 justify-end">
                <Button
                    variant="secondary"
                    onClick={() => router.push('/dashboard/proxy-hosts')}
                >
                    취소
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                </Button>
            </div>
        </div>
    );
}

