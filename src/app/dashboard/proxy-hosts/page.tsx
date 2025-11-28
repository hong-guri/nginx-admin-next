'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { Toggle } from '@/components/ui/toggle';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconChevronDown, IconChevronRight, IconRefresh, IconLock, IconLockOff, IconTrash, IconPower, IconPlayerStop, IconX } from '@tabler/icons-react';

interface ProxyHost {
    id: number;
    domain_names: string[];
    forward_host: string;
    forward_port: number;
    ssl_forced: boolean;
    enabled: boolean;
    folders: Array<{ folder_id: number; name: string; color: string }>;
    statusCode?: number | null;
    statusError?: string;
    statusChecking?: boolean;
}

export default function ProxyHostsPage() {
    const router = useRouter();
    const [hosts, setHosts] = useState<ProxyHost[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [groupByFolder, setGroupByFolder] = useState(true);
    const [folders, setFolders] = useState<Array<{ id: number; name: string; color: string }>>([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingHost, setEditingHost] = useState<ProxyHost | null>(null);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'ssl' | 'advanced'>('details');
    const [editActiveTab, setEditActiveTab] = useState<'details' | 'ssl' | 'advanced'>('details');
    const [certificates, setCertificates] = useState<Array<{ id: number; nice_name: string; domain_names: string[] }>>([]);
    const [requestingCertificate, setRequestingCertificate] = useState(false);
    const [userEmail, setUserEmail] = useState<string>('');
    const [formData, setFormData] = useState({
        domain_names: '',
        forward_scheme: 'http' as 'http' | 'https',
        forward_host: '',
        forward_port: 80,
        certificate_id: 0,
        requestNewCertificate: false,
        ssl_forced: false,
        enabled: true,
        block_exploits: false,
        caching_enabled: false,
        allow_websocket_upgrade: false,
        advanced_config: '',
    });
    const [editFormData, setEditFormData] = useState({
        forward_scheme: 'http' as 'http' | 'https',
        forward_host: '',
        forward_port: 80,
        certificate_id: 0,
        requestNewCertificate: false,
        ssl_forced: false,
        enabled: true,
        block_exploits: false,
        caching_enabled: false,
        allow_websocket_upgrade: false,
        advanced_config: '',
    });
    const [editSelectedFolderIds, setEditSelectedFolderIds] = useState<number[]>([]);
    const [createSelectedFolderIds, setCreateSelectedFolderIds] = useState<number[]>([]);
    const [draggedHost, setDraggedHost] = useState<ProxyHost | null>(null);
    const [dragOverFolder, setDragOverFolder] = useState<number | null>(null);
    const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set());
    const [showFolderCreateModal, setShowFolderCreateModal] = useState(false);
    const [showMissingFoldersModal, setShowMissingFoldersModal] = useState(false);
    const [missingFolders, setMissingFolders] = useState<string[]>([]);
    const [folderFormData, setFolderFormData] = useState({
        name: '',
        color: '#3b82f6',
    });
    const [isCheckingStatus, setIsCheckingStatus] = useState(false);
    const [currentCheckingIndex, setCurrentCheckingIndex] = useState<number | null>(null);
    const [selectedHostIds, setSelectedHostIds] = useState<Set<number>>(new Set());
    const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
    const [filterSSL, setFilterSSL] = useState<'all' | 'ssl' | 'no-ssl'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'ok' | 'error' | 'unknown'>('all');

    useEffect(() => {
        fetchHosts();
        fetchCertificates();
        fetchUserEmail();
    }, []);

    const fetchUserEmail = async () => {
        try {
            const response = await fetch('/api/auth/session');
            if (response.ok) {
                const session = await response.json();
                setUserEmail(session.email || '');
            } else if (response.status === 401) {
                console.warn('세션이 만료되었습니다. 다시 로그인해주세요.');
                setUserEmail('');
            } else {
                console.error('사용자 이메일 조회 실패:', response.status);
                setUserEmail('');
            }
        } catch (error) {
            console.error('사용자 이메일 조회 오류:', error);
            setUserEmail('');
        }
    };

    const fetchHosts = async () => {
        try {
            const [hostsRes, foldersRes] = await Promise.all([
                fetch('/api/proxy-hosts').then((r) => r.json()),
                fetch('/api/folders').then((r) => r.json()),
            ]);
            setHosts(Array.isArray(hostsRes) ? hostsRes : []);
            setFolders(Array.isArray(foldersRes) ? foldersRes : []);
        } catch (error) {
            console.error('프록시 호스트 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCertificates = async () => {
        try {
            const certsRes = await fetch('/api/certificates').then((r) => r.json());
            setCertificates(Array.isArray(certsRes) ? certsRes : []);
        } catch (error) {
            console.error('인증서 조회 오류:', error);
        }
    };

    const handleRequestCertificate = async (domainNames: string[], isEdit: boolean = false) => {
        setRequestingCertificate(true);
        try {
            const response = await fetch('/api/certificates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'letsencrypt',
                    domain_names: domainNames,
                    meta: {
                        letsencrypt_agree: true,
                        dns_challenge: false,
                    },
                }),
            });

            if (response.ok) {
                const cert = await response.json();
                await fetchCertificates();
                if (isEdit) {
                    setEditFormData({ ...editFormData, certificate_id: cert.id });
                } else {
                    setFormData({ ...formData, certificate_id: cert.id });
                }
                alert('인증서가 발급되었습니다.');
            } else {
                const error = await response.json();
                alert(`인증서 발급 실패: ${error.error || '알 수 없는 오류'}`);
            }
        } catch (error) {
            console.error('인증서 발급 오류:', error);
            alert('인증서 발급 중 오류가 발생했습니다.');
        } finally {
            setRequestingCertificate(false);
        }
    };

    const filteredHosts = hosts.filter((host) => {
        // 검색어 필터
        const matchesSearch = host.domain_names.some((domain) =>
            domain.toLowerCase().includes(searchTerm.toLowerCase())
        );
        if (!matchesSearch) return false;

        // 활성화 상태 필터
        if (filterEnabled === 'enabled' && !host.enabled) return false;
        if (filterEnabled === 'disabled' && host.enabled) return false;

        // SSL 필터
        if (filterSSL === 'ssl' && !host.ssl_forced) return false;
        if (filterSSL === 'no-ssl' && host.ssl_forced) return false;

        // 상태 코드 필터
        if (filterStatus === 'ok' && (host.statusCode === undefined || host.statusCode === null || host.statusCode < 200 || host.statusCode >= 300)) return false;
        if (filterStatus === 'error' && (host.statusCode === undefined || host.statusCode === null || (host.statusCode >= 200 && host.statusCode < 400))) return false;
        if (filterStatus === 'unknown' && host.statusCode !== undefined && host.statusCode !== null) return false;

        return true;
    });

    // 폴더별 그룹화 (데이터가 없는 폴더도 표시)
    const groupedByFolder = folders.map((folder) => {
        const folderHosts = filteredHosts.filter((host) =>
            host.folders.some((f) => f.folder_id === folder.id)
        );
        return { folder, hosts: folderHosts };
    });

    const ungroupedHosts = filteredHosts.filter((host) => host.folders.length === 0);

    const toggleFolderCollapse = (folderId: number) => {
        setCollapsedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const extractRootDomain = (domain: string): string => {
        const trimmed = domain.trim().toLowerCase();
        if (!trimmed) return '';

        const parts = trimmed.split('.');
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }
        return trimmed;
    };

    const normalizeDomainForFolder = (domain: string): string => {
        const rootDomain = extractRootDomain(domain);
        if (!rootDomain) return '';

        const parts = rootDomain.split('.');
        if (parts.length === 2) {
            return rootDomain;
        }
        return rootDomain;
    };

    const findMatchingFolder = (domain: string, existingFolders: Array<{ id: number; name: string; color: string }>): number | null => {
        const normalizedDomain = normalizeDomainForFolder(domain);
        if (!normalizedDomain) return null;

        const domainParts = normalizedDomain.split('.');
        const domainName = domainParts.length > 0 ? domainParts[0] : '';
        const fullDomain = normalizedDomain;

        let genericFolder: number | null = null;
        const genericFolderNames = ['customer', 'customers', 'other', '기타', '기타도메인', 'etc'];

        for (const folder of existingFolders) {
            const folderName = folder.name.toLowerCase();

            if (genericFolderNames.includes(folderName)) {
                genericFolder = folder.id;
            }

            if (folderName === fullDomain || folderName === domainName) {
                return folder.id;
            }

            const folderParts = folderName.split('.');
            const folderDomainName = folderParts.length > 0 ? folderParts[0] : '';

            if (folderDomainName === domainName && (folderName.includes('.') || fullDomain.includes('.'))) {
                return folder.id;
            }
        }

        return genericFolder;
    };

    const handleCreateFolder = async () => {
        if (!folderFormData.name.trim()) return;

        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: folderFormData.name,
                    color: folderFormData.color,
                }),
            });

            if (response.ok) {
                const newFolder = await response.json();
                setFolders([...folders, newFolder]);
                setFolderFormData({ name: '', color: '#3b82f6' });
                setShowFolderCreateModal(false);
            }
        } catch (error) {
            console.error('폴더 생성 오류:', error);
        }
    };

    const checkHostStatus = async (host: ProxyHost): Promise<void> => {
        if (!host.enabled || !host.domain_names || host.domain_names.length === 0) {
            setHosts((prev) =>
                prev.map((h) =>
                    h.id === host.id
                        ? { ...h, statusCode: null, statusError: '비활성화됨', statusChecking: false }
                        : h
                )
            );
            return;
        }

        const primaryDomain = host.domain_names[0];
        try {
            const response = await fetch('/api/proxy-hosts/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    hostId: host.id,
                    domain: primaryDomain,
                    sslForced: host.ssl_forced,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                setHosts((prev) =>
                    prev.map((h) =>
                        h.id === host.id
                            ? {
                                ...h,
                                statusCode: result.statusCode,
                                statusError: result.error,
                                statusChecking: false,
                            }
                            : h
                    )
                );
            } else {
                setHosts((prev) =>
                    prev.map((h) =>
                        h.id === host.id
                            ? { ...h, statusCode: null, statusError: '확인 실패', statusChecking: false }
                            : h
                    )
                );
            }
        } catch (error) {
            console.error('접속 상태 확인 오류:', error);
            setHosts((prev) =>
                prev.map((h) =>
                    h.id === host.id
                        ? { ...h, statusCode: null, statusError: '오류 발생', statusChecking: false }
                        : h
                )
            );
        }
    };

    const handleCheckAllStatus = async () => {
        if (isCheckingStatus) return;

        setIsCheckingStatus(true);
        setCurrentCheckingIndex(null);

        const enabledHosts = hosts.filter((h) => h.enabled && h.domain_names && h.domain_names.length > 0);

        // 모든 호스트를 checking 상태로 설정
        setHosts((prev) =>
            prev.map((h) => ({
                ...h,
                statusChecking: h.enabled && h.domain_names && h.domain_names.length > 0,
            }))
        );

        // 순차적으로 하나씩 확인
        for (let i = 0; i < enabledHosts.length; i++) {
            setCurrentCheckingIndex(i);
            await checkHostStatus(enabledHosts[i]);
            // 각 요청 사이에 약간의 딜레이 (서버 부하 방지)
            if (i < enabledHosts.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }

        setCurrentCheckingIndex(null);
        setIsCheckingStatus(false);
    };

    const handleToggleSelect = (hostId: number, e?: React.ChangeEvent<HTMLInputElement>) => {
        e?.stopPropagation();
        setSelectedHostIds((prev) => {
            const next = new Set(prev);
            if (next.has(hostId)) {
                next.delete(hostId);
            } else {
                next.add(hostId);
            }
            return next;
        });
    };

    const handleSelectAll = (e?: React.ChangeEvent<HTMLInputElement>) => {
        e?.stopPropagation();
        if (selectedHostIds.size === filteredHosts.length) {
            setSelectedHostIds(new Set());
        } else {
            setSelectedHostIds(new Set(filteredHosts.map((h) => h.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedHostIds.size === 0) return;
        if (!confirm(`선택한 ${selectedHostIds.size}개의 프록시 호스트를 삭제하시겠습니까?`)) return;

        const ids = Array.from(selectedHostIds);
        try {
            await Promise.all(
                ids.map((id) =>
                    fetch(`/api/proxy-hosts/${id}`, {
                        method: 'DELETE',
                    })
                )
            );
            setSelectedHostIds(new Set());
            fetchHosts();
        } catch (error) {
            console.error('삭제 오류:', error);
            alert('일부 호스트 삭제에 실패했습니다.');
        }
    };

    const handleToggleEnabledSelected = async (enabled: boolean) => {
        if (selectedHostIds.size === 0) return;

        const ids = Array.from(selectedHostIds);
        try {
            await Promise.all(
                ids.map(async (id) => {
                    const host = hosts.find((h) => h.id === id);
                    if (!host) return;

                    const response = await fetch(`/api/proxy-hosts/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            forward_scheme: (host as any).forward_scheme || 'http',
                            forward_host: host.forward_host,
                            forward_port: host.forward_port,
                            certificate_id: (host as any).certificate_id || 0,
                            ssl_forced: host.ssl_forced,
                            enabled: enabled,
                            block_exploits: (host as any).block_exploits || false,
                            caching_enabled: (host as any).caching_enabled || false,
                            allow_websocket_upgrade: (host as any).allow_websocket_upgrade || false,
                            advanced_config: (host as any).advanced_config || '',
                            folderIds: host.folders.map((f) => f.folder_id),
                        }),
                    });
                    return response.ok;
                })
            );
            setSelectedHostIds(new Set());
            fetchHosts();
        } catch (error) {
            console.error('상태 변경 오류:', error);
            alert('일부 호스트 상태 변경에 실패했습니다.');
        }
    };

    const handleAutoOrganize = async () => {
        if (!confirm('모든 프록시 호스트를 도메인별로 자동 정리하시겠습니까?\n\n기존 폴더만 사용하며, 필요한 폴더가 없으면 먼저 생성해야 합니다.')) {
            return;
        }

        try {
            const currentFolders = [...folders];
            const domainToFolderMap = new Map<string, number>();
            const missingFolderSet = new Set<string>();

            for (const folder of currentFolders) {
                const normalized = normalizeDomainForFolder(folder.name);
                if (normalized) {
                    domainToFolderMap.set(normalized.toLowerCase(), folder.id);
                }
                domainToFolderMap.set(folder.name.toLowerCase(), folder.id);
            }

            for (const host of hosts) {
                if (host.domain_names.length === 0) continue;

                const rootDomain = extractRootDomain(host.domain_names[0]);
                if (!rootDomain) continue;

                const normalizedDomain = normalizeDomainForFolder(host.domain_names[0]);
                if (!normalizedDomain) continue;

                const matchingFolder = findMatchingFolder(host.domain_names[0], currentFolders);
                const domainKey = normalizedDomain.toLowerCase();

                if (!matchingFolder && !domainToFolderMap.has(domainKey)) {
                    missingFolderSet.add(normalizedDomain);
                }
            }

            if (missingFolderSet.size > 0) {
                setMissingFolders(Array.from(missingFolderSet).sort());
                setShowMissingFoldersModal(true);
                return;
            }

            await performAutoOrganize();
        } catch (error) {
            console.error('자동 정리 오류:', error);
        }
    };

    const performAutoOrganize = async () => {
        try {
            const currentFolders = [...folders];
            const domainToFolderMap = new Map<string, number>();

            for (const folder of currentFolders) {
                const normalized = normalizeDomainForFolder(folder.name);
                if (normalized) {
                    domainToFolderMap.set(normalized.toLowerCase(), folder.id);
                }
                domainToFolderMap.set(folder.name.toLowerCase(), folder.id);
            }

            for (const host of hosts) {
                if (host.domain_names.length === 0) continue;

                const rootDomain = extractRootDomain(host.domain_names[0]);
                if (!rootDomain) continue;

                const normalizedDomain = normalizeDomainForFolder(host.domain_names[0]);
                if (!normalizedDomain) continue;

                let targetFolderId: number | null = null;

                const matchingFolder = findMatchingFolder(host.domain_names[0], currentFolders);
                if (matchingFolder) {
                    targetFolderId = matchingFolder;
                } else {
                    const domainKey = normalizedDomain.toLowerCase();
                    if (domainToFolderMap.has(domainKey)) {
                        targetFolderId = domainToFolderMap.get(domainKey)!;
                    }
                }

                if (targetFolderId) {
                    const currentFolderIds = host.folders.map((f) => f.folder_id);
                    if (!currentFolderIds.includes(targetFolderId)) {
                        await fetch(`/api/proxy-hosts/${host.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                folderIds: [...currentFolderIds, targetFolderId],
                            }),
                        });
                    }
                }
            }

            fetchHosts();
        } catch (error) {
            console.error('자동 정리 실행 오류:', error);
        }
    };

    const handleEditClick = async (host: ProxyHost) => {
        setEditingHost(host);
        setEditSelectedFolderIds(host.folders.map((f) => f.folder_id));
        setEditFormData({
            forward_scheme: (host as any).forward_scheme || 'http',
            forward_host: host.forward_host,
            forward_port: host.forward_port,
            certificate_id: (host as any).certificate_id || 0,
            requestNewCertificate: false,
            ssl_forced: host.ssl_forced || false,
            enabled: host.enabled !== false,
            block_exploits: (host as any).block_exploits || false,
            caching_enabled: (host as any).caching_enabled || false,
            allow_websocket_upgrade: (host as any).allow_websocket_upgrade || false,
            advanced_config: (host as any).advanced_config || '',
        });
        setShowEditModal(true);
    };

    const handleEditSave = async () => {
        if (!editingHost) return;

        setSaving(true);
        try {
            let certificateId = editFormData.certificate_id || 0;

            // 새 인증서 발급이 요청된 경우
            if (editFormData.requestNewCertificate) {
                const domains = editingHost.domain_names;
                if (domains.length === 0) {
                    alert('도메인이 없습니다.');
                    setSaving(false);
                    return;
                }

                setRequestingCertificate(true);
                try {
                    const certResponse = await fetch('/api/certificates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            provider: 'letsencrypt',
                            domain_names: domains,
                            meta: {
                                letsencrypt_agree: true,
                                dns_challenge: false,
                            },
                        }),
                    });

                    if (certResponse.ok) {
                        const cert = await certResponse.json();
                        certificateId = cert.id;
                        await fetchCertificates();
                    } else {
                        const error = await certResponse.json();
                        alert(`인증서 발급 실패: ${error.error || '알 수 없는 오류'}`);
                        setSaving(false);
                        setRequestingCertificate(false);
                        return;
                    }
                } catch (error) {
                    console.error('인증서 발급 오류:', error);
                    alert('인증서 발급 중 오류가 발생했습니다.');
                    setSaving(false);
                    setRequestingCertificate(false);
                    return;
                } finally {
                    setRequestingCertificate(false);
                }
            }

            const response = await fetch(`/api/proxy-hosts/${editingHost.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    forward_scheme: editFormData.forward_scheme,
                    forward_host: editFormData.forward_host,
                    forward_port: editFormData.forward_port,
                    certificate_id: certificateId,
                    ssl_forced: editFormData.ssl_forced,
                    enabled: editFormData.enabled,
                    block_exploits: editFormData.block_exploits,
                    caching_enabled: editFormData.caching_enabled,
                    allow_websocket_upgrade: editFormData.allow_websocket_upgrade,
                    advanced_config: editFormData.advanced_config || undefined,
                    folderIds: editSelectedFolderIds,
                }),
            });

            if (response.ok) {
                setShowEditModal(false);
                setEditingHost(null);
                setEditSelectedFolderIds([]);
                fetchHosts();
            } else {
                const errorData = await response.json();
                console.error('저장 실패:', errorData.error || '저장에 실패했습니다.');
            }
        } catch (error) {
            console.error('저장 오류:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDragStart = (e: React.DragEvent, host: ProxyHost) => {
        setDraggedHost(host);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, folderId: number | null) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolder(folderId);
    };

    const handleDragLeave = () => {
        setDragOverFolder(null);
    };

    const handleDrop = async (e: React.DragEvent, targetFolderId: number | null) => {
        e.preventDefault();
        setDragOverFolder(null);

        if (!draggedHost) return;

        const newFolderIds = targetFolderId
            ? [targetFolderId]
            : [];

        try {
            // 폴더만 변경하므로 NPM API 필드는 보내지 않음
            const response = await fetch(`/api/proxy-hosts/${draggedHost.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderIds: newFolderIds,
                }),
            });

            if (response.ok) {
                fetchHosts();
            } else {
                const errorData = await response.json();
                console.error('폴더 이동 실패:', errorData.error || '폴더 이동에 실패했습니다.');
            }
        } catch (error) {
            console.error('폴더 이동 오류:', error);
        } finally {
            setDraggedHost(null);
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
                        프록시 호스트
                    </h1>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        총 {hosts.length}개의 프록시 호스트
                        {isCheckingStatus && currentCheckingIndex !== null && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400">
                                (확인 중: {currentCheckingIndex + 1}/{hosts.filter((h) => h.enabled && h.domain_names && h.domain_names.length > 0).length})
                            </span>
                        )}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="secondary"
                        onClick={handleCheckAllStatus}
                        disabled={isCheckingStatus}
                    >
                        <IconRefresh className={`w-4 h-4 mr-1 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                        접속 확인
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => setShowFolderCreateModal(true)}
                    >
                        + 폴더 추가
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handleAutoOrganize}
                    >
                        자동 정리
                    </Button>
                    <Button onClick={() => setShowCreateModal(true)}>
                        + 새 프록시 호스트
                    </Button>
                </div>
            </div>

            <Card>
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
                    <Input
                        type="text"
                        placeholder="도메인으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="flex gap-2 flex-wrap">
                        <div className="w-[140px]">
                            <Select
                                value={filterEnabled}
                                onChange={(value) => setFilterEnabled(value as 'all' | 'enabled' | 'disabled')}
                                options={[
                                    { value: 'all', label: '전체 상태' },
                                    { value: 'enabled', label: '활성화' },
                                    { value: 'disabled', label: '비활성화' },
                                ]}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="w-[140px]">
                            <Select
                                value={filterSSL}
                                onChange={(value) => setFilterSSL(value as 'all' | 'ssl' | 'no-ssl')}
                                options={[
                                    { value: 'all', label: '전체 SSL' },
                                    { value: 'ssl', label: 'SSL 활성화' },
                                    { value: 'no-ssl', label: 'SSL 비활성화' },
                                ]}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="w-[160px]">
                            <Select
                                value={filterStatus}
                                onChange={(value) => setFilterStatus(value as 'all' | 'ok' | 'error' | 'unknown')}
                                options={[
                                    { value: 'all', label: '전체 상태 코드' },
                                    { value: 'ok', label: '정상 (2xx)' },
                                    { value: 'error', label: '오류 (4xx/5xx)' },
                                    { value: 'unknown', label: '미확인' },
                                ]}
                                className="h-8 text-xs"
                            />
                        </div>
                        {selectedHostIds.size > 0 && (
                            <button
                                onClick={() => setSelectedHostIds(new Set())}
                                className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            >
                                선택 해제 ({selectedHostIds.size})
                            </button>
                        )}
                    </div>
                </div>

                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredHosts.length > 0 && (
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                            <Checkbox
                                checked={selectedHostIds.size > 0 && selectedHostIds.size === filteredHosts.length}
                                onChange={handleSelectAll}
                                label={`전체 선택 (${selectedHostIds.size}/${filteredHosts.length})`}
                            />
                        </div>
                    )}
                    {groupedByFolder.map(({ folder, hosts: folderHosts }) => {
                        const isCollapsed = collapsedFolders.has(folder.id);
                        return (
                            <div
                                key={folder.id}
                                className={`p-3 border-b border-gray-200 dark:border-gray-700 ${dragOverFolder === folder.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                    }`}
                                onDragOver={(e) => handleDragOver(e, folder.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, folder.id)}
                            >
                                <div
                                    className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => toggleFolderCollapse(folder.id)}
                                >
                                    {isCollapsed ? (
                                        <IconChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    ) : (
                                        <IconChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                                    )}
                                    <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: folder.color }}
                                    />
                                    <Link
                                        href="/dashboard/folders"
                                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-[var(--color-primary)] transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            router.push('/dashboard/folders');
                                        }}
                                    >
                                        {folder.name}
                                    </Link>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        ({folderHosts.length})
                                    </span>
                                </div>
                                {!isCollapsed && (
                                    <div className="ml-6 space-y-2">
                                        {folderHosts.length === 0 ? (
                                            <div className="p-2 text-xs text-gray-400 dark:text-gray-500 italic">
                                                이 폴더에 프록시 호스트가 없습니다.
                                            </div>
                                        ) : (
                                            folderHosts.map((host) => (
                                                <div
                                                    key={host.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, host)}
                                                    className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded transition-colors cursor-move ${draggedHost?.id === host.id ? 'opacity-50' : ''
                                                        }`}
                                                >
                                                    {renderHostItem(host)}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {ungroupedHosts.length > 0 && (
                        <div
                            className={`p-3 ${dragOverFolder === null ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                            onDragOver={(e) => handleDragOver(e, null)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, null)}
                        >
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                                폴더 없음 ({ungroupedHosts.length})
                            </h3>
                            <div className="ml-6 space-y-2">
                                {ungroupedHosts.map((host) => (
                                    <div
                                        key={host.id}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, host)}
                                        className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded transition-colors cursor-move ${draggedHost?.id === host.id ? 'opacity-50' : ''
                                            }`}
                                    >
                                        {renderHostItem(host)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {filteredHosts.length === 0 && (
                        <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400">
                            프록시 호스트가 없습니다.
                        </div>
                    )}
                </div>
            </Card>

            <Modal
                open={showCreateModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setFormData({
                        domain_names: '',
                        forward_scheme: 'http',
                        forward_host: '',
                        forward_port: 80,
                        certificate_id: 0,
                        requestNewCertificate: false,
                        ssl_forced: false,
                        enabled: true,
                        block_exploits: false,
                        caching_enabled: false,
                        allow_websocket_upgrade: false,
                        advanced_config: '',
                    });
                    setCreateSelectedFolderIds([]);
                }}
                title="새 프록시 호스트 만들기"
                size="lg"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowCreateModal(false);
                                setFormData({
                                    domain_names: '',
                                    forward_scheme: 'http',
                                    forward_host: '',
                                    forward_port: 80,
                                    certificate_id: 0,
                                    requestNewCertificate: false,
                                    ssl_forced: false,
                                    enabled: true,
                                    block_exploits: false,
                                    caching_enabled: false,
                                    allow_websocket_upgrade: false,
                                    advanced_config: '',
                                });
                                setCreateSelectedFolderIds([]);
                                setActiveTab('details');
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={async () => {
                                try {
                                    setSaving(true);

                                    let certificateId = formData.certificate_id || 0;

                                    // 새 인증서 발급이 요청된 경우
                                    if (formData.requestNewCertificate) {
                                        const domains = formData.domain_names.split(',').map(d => d.trim()).filter(Boolean);
                                        if (domains.length === 0) {
                                            alert('도메인을 먼저 입력해주세요.');
                                            setSaving(false);
                                            return;
                                        }

                                        setRequestingCertificate(true);
                                        try {
                                            const certResponse = await fetch('/api/certificates', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    provider: 'letsencrypt',
                                                    domain_names: domains,
                                                    meta: {
                                                        letsencrypt_agree: true,
                                                        dns_challenge: false,
                                                    },
                                                }),
                                            });

                                            if (certResponse.ok) {
                                                const cert = await certResponse.json();
                                                certificateId = cert.id;
                                                await fetchCertificates();
                                            } else {
                                                const error = await certResponse.json();
                                                alert(`인증서 발급 실패: ${error.error || '알 수 없는 오류'}`);
                                                setSaving(false);
                                                setRequestingCertificate(false);
                                                return;
                                            }
                                        } catch (error) {
                                            console.error('인증서 발급 오류:', error);
                                            alert('인증서 발급 중 오류가 발생했습니다.');
                                            setSaving(false);
                                            setRequestingCertificate(false);
                                            return;
                                        } finally {
                                            setRequestingCertificate(false);
                                        }
                                    }

                                    const response = await fetch('/api/proxy-hosts', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            domain_names: formData.domain_names.split(',').map(d => d.trim()),
                                            forward_scheme: formData.forward_scheme,
                                            forward_host: formData.forward_host,
                                            forward_port: formData.forward_port,
                                            certificate_id: certificateId,
                                            ssl_forced: formData.ssl_forced,
                                            enabled: formData.enabled,
                                            block_exploits: formData.block_exploits,
                                            caching_enabled: formData.caching_enabled,
                                            allow_websocket_upgrade: formData.allow_websocket_upgrade,
                                            advanced_config: formData.advanced_config || undefined,
                                            folderIds: createSelectedFolderIds,
                                        }),
                                    });

                                    if (response.ok) {
                                        setShowCreateModal(false);
                                        setFormData({
                                            domain_names: '',
                                            forward_scheme: 'http',
                                            forward_host: '',
                                            forward_port: 80,
                                            certificate_id: 0,
                                            requestNewCertificate: false,
                                            ssl_forced: false,
                                            enabled: true,
                                            block_exploits: false,
                                            caching_enabled: false,
                                            allow_websocket_upgrade: false,
                                            advanced_config: '',
                                        });
                                        setActiveTab('details');
                                        setCreateSelectedFolderIds([]);
                                        fetchHosts();
                                    }
                                } catch (error) {
                                    console.error('프록시 호스트 생성 오류:', error);
                                } finally {
                                    setSaving(false);
                                }
                            }}
                            disabled={saving || requestingCertificate}
                        >
                            {saving || requestingCertificate ? '처리 중...' : '만들기'}
                        </Button>
                    </div>
                }
            >
                <div>
                    {/* 탭 네비게이션 */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                        {(['details', 'ssl', 'advanced'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab
                                    ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                            >
                                {tab === 'details' ? 'Details' : tab === 'ssl' ? 'SSL' : 'Advanced'}
                            </button>
                        ))}
                    </div>

                    {/* Details 탭 */}
                    {activeTab === 'details' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Domain Names (도메인)
                                </label>
                                <Input
                                    type="text"
                                    value={formData.domain_names}
                                    onChange={(e) => setFormData({ ...formData, domain_names: e.target.value })}
                                    placeholder="example.com, www.example.com"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    여러 도메인은 쉼표로 구분하세요
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Forward Scheme (프로토콜)
                                </label>
                                <Select
                                    value={formData.forward_scheme}
                                    onChange={(value) => setFormData({ ...formData, forward_scheme: value as 'http' | 'https' })}
                                    options={[
                                        { value: 'http', label: 'HTTP' },
                                        { value: 'https', label: 'HTTPS' },
                                    ]}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Forward Hostname / IP (호스트/IP)
                                </label>
                                <Input
                                    type="text"
                                    value={formData.forward_host}
                                    onChange={(e) => setFormData({ ...formData, forward_host: e.target.value })}
                                    placeholder="127.0.0.1 또는 컨테이너 이름"
                                    required
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    IP 주소 또는 Docker 컨테이너 이름을 입력하세요
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Forward Port (포트)
                                </label>
                                <Input
                                    type="number"
                                    value={formData.forward_port}
                                    onChange={(e) => setFormData({ ...formData, forward_port: parseInt(e.target.value) || 80 })}
                                    placeholder="80"
                                    required
                                />
                            </div>

                            <div>
                                <Toggle
                                    id="enabled"
                                    checked={formData.enabled}
                                    onChange={(checked) => setFormData({ ...formData, enabled: checked })}
                                    label="활성화"
                                    description="프록시 호스트를 활성화합니다. 비활성화 시 모든 요청이 차단됩니다."
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    폴더
                                </label>
                                <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2">
                                    {folders.length === 0 ? (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            폴더가 없습니다.
                                        </p>
                                    ) : (
                                        folders.map((folder) => (
                                            <div
                                                key={folder.id}
                                                className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                            >
                                                <Toggle
                                                    id={`create-folder-${folder.id}`}
                                                    checked={createSelectedFolderIds.includes(folder.id)}
                                                    onChange={(checked) => {
                                                        if (checked) {
                                                            setCreateSelectedFolderIds([...createSelectedFolderIds, folder.id]);
                                                        } else {
                                                            setCreateSelectedFolderIds(
                                                                createSelectedFolderIds.filter((id) => id !== folder.id)
                                                            );
                                                        }
                                                    }}
                                                />
                                                <div
                                                    className="w-3 h-3 rounded"
                                                    style={{ backgroundColor: folder.color }}
                                                />
                                                <span className="text-xs text-gray-900 dark:text-white">
                                                    {folder.name}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SSL 탭 */}
                    {activeTab === 'ssl' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    SSL Certificate (SSL 인증서)
                                </label>
                                <Select
                                    value={formData.requestNewCertificate ? 'new' : (formData.certificate_id || 0)}
                                    onChange={(selectedValue) => {
                                        if (selectedValue === 'new') {
                                            // 플래그만 설정, 실제 발급은 저장 시 수행
                                            setFormData({ ...formData, requestNewCertificate: true, certificate_id: 0 });
                                        } else {
                                            setFormData({ ...formData, certificate_id: typeof selectedValue === 'number' ? selectedValue : parseInt(String(selectedValue)) || 0, requestNewCertificate: false });
                                        }
                                    }}
                                    options={[
                                        { value: 0, label: 'None (인증서 없음)' },
                                        { value: 'new', label: '현재 주소로 새로 발급' },
                                        ...certificates.map((cert) => ({
                                            value: cert.id,
                                            label: cert.nice_name || cert.domain_names?.join(', ') || `Certificate #${cert.id}`,
                                        })),
                                    ]}
                                    placeholder="인증서를 선택하세요"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    기존 인증서를 선택하거나 현재 도메인으로 새로 발급할 수 있습니다
                                </p>
                            </div>

                            <div>
                                <Toggle
                                    id="ssl_forced"
                                    checked={formData.ssl_forced}
                                    onChange={(checked) => setFormData({ ...formData, ssl_forced: checked })}
                                    label="Force SSL (SSL 강제)"
                                    description="HTTP 요청을 HTTPS로 자동 리다이렉트합니다. SSL 인증서가 설정되어 있어야 합니다."
                                />
                            </div>
                        </div>
                    )}

                    {/* Advanced 탭 */}
                    {activeTab === 'advanced' && (
                        <div className="space-y-6">
                            <div>
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                    Security (보안)
                                </h4>
                                <div className="space-y-4">
                                    <Toggle
                                        id="block_exploits"
                                        checked={formData.block_exploits}
                                        onChange={(checked) => setFormData({ ...formData, block_exploits: checked })}
                                        label="Block Common Exploits (악용 차단)"
                                        description="일반적인 웹 공격 패턴(SQL Injection, XSS 등)을 차단합니다."
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                    Performance (성능)
                                </h4>
                                <div className="space-y-4">
                                    <Toggle
                                        id="caching_enabled"
                                        checked={formData.caching_enabled}
                                        onChange={(checked) => setFormData({ ...formData, caching_enabled: checked })}
                                        label="Cache Assets (캐싱 활성화)"
                                        description="정적 자산(이미지, CSS, JS 등)을 캐싱하여 성능을 향상시킵니다."
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                    WebSocket
                                </h4>
                                <div className="space-y-4">
                                    <Toggle
                                        id="allow_websocket_upgrade"
                                        checked={formData.allow_websocket_upgrade}
                                        onChange={(checked) => setFormData({ ...formData, allow_websocket_upgrade: checked })}
                                        label="Websockets Support (WebSocket 업그레이드 허용)"
                                        description="WebSocket 연결을 지원합니다. 실시간 애플리케이션에 필요합니다."
                                    />
                                </div>
                            </div>

                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                    Custom Nginx Configuration (커스텀 Nginx 설정)
                                </h4>
                                <div>
                                    <textarea
                                        value={formData.advanced_config}
                                        onChange={(e) => setFormData({ ...formData, advanced_config: e.target.value })}
                                        placeholder="# Nginx 고급 설정을 여기에 입력하세요..."
                                        rows={8}
                                        className="flex w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent font-mono"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Nginx 설정을 직접 입력할 수 있습니다. 선택 사항입니다.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            폴더
                        </label>
                        <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2">
                            {folders.length === 0 ? (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    폴더가 없습니다.
                                </p>
                            ) : (
                                folders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        className="flex items-center gap-2 p-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                    >
                                        <Toggle
                                            id={`create-folder-${folder.id}`}
                                            checked={createSelectedFolderIds.includes(folder.id)}
                                            onChange={(checked) => {
                                                if (checked) {
                                                    setCreateSelectedFolderIds([...createSelectedFolderIds, folder.id]);
                                                } else {
                                                    setCreateSelectedFolderIds(
                                                        createSelectedFolderIds.filter((id) => id !== folder.id)
                                                    );
                                                }
                                            }}
                                        />
                                        <div
                                            className="w-3 h-3 rounded"
                                            style={{ backgroundColor: folder.color }}
                                        />
                                        <span className="text-xs text-gray-900 dark:text-white">
                                            {folder.name}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* 편집 모달 */}
            <Modal
                open={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingHost(null);
                    setEditSelectedFolderIds([]);
                    setEditFormData({
                        forward_scheme: 'http',
                        forward_host: '',
                        forward_port: 80,
                        certificate_id: 0,
                        requestNewCertificate: false,
                        ssl_forced: false,
                        enabled: true,
                        block_exploits: false,
                        caching_enabled: false,
                        allow_websocket_upgrade: false,
                        advanced_config: '',
                    });
                }}
                title="프록시 호스트 편집"
                size="lg"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowEditModal(false);
                                setEditingHost(null);
                                setEditSelectedFolderIds([]);
                                setEditFormData({
                                    forward_scheme: 'http',
                                    forward_host: '',
                                    forward_port: 80,
                                    certificate_id: 0,
                                    requestNewCertificate: false,
                                    ssl_forced: false,
                                    enabled: true,
                                    block_exploits: false,
                                    caching_enabled: false,
                                    allow_websocket_upgrade: false,
                                    advanced_config: '',
                                });
                                setEditActiveTab('details');
                            }}
                        >
                            취소
                        </Button>
                        <Button onClick={handleEditSave} disabled={saving}>
                            {saving ? '저장 중...' : '저장'}
                        </Button>
                    </div>
                }
            >
                {editingHost && (
                    <div>
                        {/* 탭 네비게이션 */}
                        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
                            {(['details', 'ssl', 'advanced'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setEditActiveTab(tab)}
                                    className={`px-4 py-2 text-sm font-medium transition-colors ${editActiveTab === tab
                                        ? 'border-b-2 border-[var(--color-primary)] text-[var(--color-primary)]'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    {tab === 'details' ? 'Details' : tab === 'ssl' ? 'SSL' : 'Advanced'}
                                </button>
                            ))}
                        </div>

                        {/* Details 탭 */}
                        {editActiveTab === 'details' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Domain Names (도메인)
                                    </label>
                                    <Input
                                        value={editingHost.domain_names.join(', ')}
                                        readOnly
                                        className="bg-gray-50 dark:bg-gray-700"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        도메인은 편집할 수 없습니다
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Forward Scheme (프로토콜)
                                    </label>
                                    <Select
                                        value={editFormData.forward_scheme}
                                        onChange={(value) => setEditFormData({ ...editFormData, forward_scheme: value as 'http' | 'https' })}
                                        options={[
                                            { value: 'http', label: 'HTTP' },
                                            { value: 'https', label: 'HTTPS' },
                                        ]}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Forward Hostname / IP (호스트/IP)
                                    </label>
                                    <Input
                                        value={editFormData.forward_host}
                                        onChange={(e) => setEditFormData({ ...editFormData, forward_host: e.target.value })}
                                        placeholder="127.0.0.1 또는 컨테이너 이름"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        IP 주소 또는 Docker 컨테이너 이름을 입력하세요
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        Forward Port (포트)
                                    </label>
                                    <Input
                                        type="number"
                                        value={editFormData.forward_port}
                                        onChange={(e) => setEditFormData({ ...editFormData, forward_port: parseInt(e.target.value) || 80 })}
                                        placeholder="80"
                                        required
                                    />
                                </div>

                                <div>
                                    <Toggle
                                        id="edit-enabled"
                                        checked={editFormData.enabled}
                                        onChange={(checked) => setEditFormData({ ...editFormData, enabled: checked })}
                                        label="활성화"
                                        description="프록시 호스트를 활성화합니다. 비활성화 시 모든 요청이 차단됩니다."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        폴더
                                    </label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2">
                                        {folders.length === 0 ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                폴더가 없습니다. 먼저 폴더를 생성하세요.
                                            </p>
                                        ) : (
                                            folders.map((folder) => (
                                                <div
                                                    key={folder.id}
                                                    className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                                >
                                                    <Toggle
                                                        id={`edit-folder-${folder.id}`}
                                                        checked={editSelectedFolderIds.includes(folder.id)}
                                                        onChange={(checked) => {
                                                            if (checked) {
                                                                setEditSelectedFolderIds([...editSelectedFolderIds, folder.id]);
                                                            } else {
                                                                setEditSelectedFolderIds(
                                                                    editSelectedFolderIds.filter((id) => id !== folder.id)
                                                                );
                                                            }
                                                        }}
                                                    />
                                                    <div
                                                        className="w-4 h-4 rounded"
                                                        style={{ backgroundColor: folder.color }}
                                                    />
                                                    <span className="text-xs text-gray-900 dark:text-white">
                                                        {folder.name}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SSL 탭 */}
                        {editActiveTab === 'ssl' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                        SSL Certificate (SSL 인증서)
                                    </label>
                                    <Select
                                        value={editFormData.requestNewCertificate ? 'new' : (editFormData.certificate_id || 0)}
                                        onChange={(selectedValue) => {
                                            if (selectedValue === 'new') {
                                                // 플래그만 설정, 실제 발급은 저장 시 수행
                                                setEditFormData({ ...editFormData, requestNewCertificate: true, certificate_id: 0 });
                                            } else {
                                                setEditFormData({ ...editFormData, certificate_id: typeof selectedValue === 'number' ? selectedValue : parseInt(String(selectedValue)) || 0, requestNewCertificate: false });
                                            }
                                        }}
                                        options={[
                                            { value: 0, label: 'None (인증서 없음)' },
                                            { value: 'new', label: '현재 주소로 새로 발급' },
                                            ...certificates.map((cert) => ({
                                                value: cert.id,
                                                label: cert.nice_name || cert.domain_names?.join(', ') || `Certificate #${cert.id}`,
                                            })),
                                        ]}
                                        placeholder="인증서를 선택하세요"
                                    />
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        기존 인증서를 선택하거나 현재 도메인으로 새로 발급할 수 있습니다
                                    </p>
                                </div>

                                <div>
                                    <Toggle
                                        id="edit-ssl_forced"
                                        checked={editFormData.ssl_forced}
                                        onChange={(checked) => setEditFormData({ ...editFormData, ssl_forced: checked })}
                                        label="Force SSL (SSL 강제)"
                                        description="HTTP 요청을 HTTPS로 자동 리다이렉트합니다. SSL 인증서가 설정되어 있어야 합니다."
                                    />
                                </div>
                            </div>
                        )}

                        {/* Advanced 탭 */}
                        {editActiveTab === 'advanced' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                        Security (보안)
                                    </h4>
                                    <div className="space-y-4">
                                        <Toggle
                                            id="edit-block_exploits"
                                            checked={editFormData.block_exploits}
                                            onChange={(checked) => setEditFormData({ ...editFormData, block_exploits: checked })}
                                            label="Block Common Exploits (악용 차단)"
                                            description="일반적인 웹 공격 패턴(SQL Injection, XSS 등)을 차단합니다."
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                        Performance (성능)
                                    </h4>
                                    <div className="space-y-4">
                                        <Toggle
                                            id="edit-caching_enabled"
                                            checked={editFormData.caching_enabled}
                                            onChange={(checked) => setEditFormData({ ...editFormData, caching_enabled: checked })}
                                            label="Cache Assets (캐싱 활성화)"
                                            description="정적 자산(이미지, CSS, JS 등)을 캐싱하여 성능을 향상시킵니다."
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                        WebSocket
                                    </h4>
                                    <div className="space-y-4">
                                        <Toggle
                                            id="edit-allow_websocket_upgrade"
                                            checked={editFormData.allow_websocket_upgrade}
                                            onChange={(checked) => setEditFormData({ ...editFormData, allow_websocket_upgrade: checked })}
                                            label="Websockets Support (WebSocket 업그레이드 허용)"
                                            description="WebSocket 연결을 지원합니다. 실시간 애플리케이션에 필요합니다."
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                                    <h4 className="text-xs font-semibold text-gray-900 dark:text-white mb-3">
                                        Custom Nginx Configuration (커스텀 Nginx 설정)
                                    </h4>
                                    <div>
                                        <textarea
                                            value={editFormData.advanced_config}
                                            onChange={(e) => setEditFormData({ ...editFormData, advanced_config: e.target.value })}
                                            placeholder="# Nginx 고급 설정을 여기에 입력하세요..."
                                            rows={8}
                                            className="flex w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent font-mono"
                                        />
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Nginx 설정을 직접 입력할 수 있습니다. 선택 사항입니다.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* 폴더 생성 모달 */}
            <Modal
                open={showFolderCreateModal}
                onClose={() => {
                    setShowFolderCreateModal(false);
                    setFolderFormData({ name: '', color: '#3b82f6' });
                }}
                title="새 폴더 만들기"
                size="sm"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowFolderCreateModal(false);
                                setFolderFormData({ name: '', color: '#3b82f6' });
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleCreateFolder}
                            disabled={!folderFormData.name.trim()}
                        >
                            만들기
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            폴더 이름
                        </label>
                        <Input
                            type="text"
                            value={folderFormData.name}
                            onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                            placeholder="폴더 이름을 입력하세요"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            색상
                        </label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="color"
                                value={folderFormData.color}
                                onChange={(e) => setFolderFormData({ ...folderFormData, color: e.target.value })}
                                className="w-12 h-8 p-1"
                            />
                            <Input
                                type="text"
                                value={folderFormData.color}
                                onChange={(e) => setFolderFormData({ ...folderFormData, color: e.target.value })}
                                placeholder="#3b82f6"
                                className="flex-1"
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            {/* 필요한 폴더 없음 모달 */}
            <ConfirmModal
                open={showMissingFoldersModal}
                onClose={() => setShowMissingFoldersModal(false)}
                onConfirm={() => {
                    setShowMissingFoldersModal(false);
                    setShowFolderCreateModal(true);
                }}
                title="필요한 폴더가 없습니다"
                message={
                    <div className="space-y-2">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            다음 폴더가 필요합니다. 먼저 폴더를 생성해주세요:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1 max-h-40 overflow-y-auto">
                            {missingFolders.map((folder) => (
                                <li key={folder}>{folder}</li>
                            ))}
                        </ul>
                    </div>
                }
                confirmText="폴더 생성하기"
                cancelText="취소"
            />

            {/* 선택된 항목 하단 툴바 */}
            {selectedHostIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
                    <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {selectedHostIds.size}개 선택됨
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const selectedHosts = hosts.filter((h) => selectedHostIds.has(h.id));
                                    const allEnabled = selectedHosts.every((h) => h.enabled);
                                    handleToggleEnabledSelected(!allEnabled);
                                }}
                            >
                                {hosts.filter((h) => selectedHostIds.has(h.id)).every((h) => h.enabled) ? (
                                    <>
                                        <IconPlayerStop className="w-4 h-4 mr-1" />
                                        비활성화
                                    </>
                                ) : (
                                    <>
                                        <IconPower className="w-4 h-4 mr-1" />
                                        활성화
                                    </>
                                )}
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleDeleteSelected}
                                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                                <IconTrash className="w-4 h-4 mr-1" />
                                삭제
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedHostIds(new Set())}
                            >
                                <IconX className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    function renderHostItem(host: ProxyHost) {
        const protocol = host.ssl_forced ? 'https' : 'http';
        const primaryDomain = host.domain_names[0] || '';
        const isSelected = selectedHostIds.has(host.id);

        return (
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleToggleSelect(host.id, e)}
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {host.enabled && primaryDomain ? (
                            <a
                                href={`${protocol}://${primaryDomain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {host.domain_names.join(', ')}
                            </a>
                        ) : (
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                {host.domain_names.join(', ')}
                            </h3>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            {host.forward_host}:{host.forward_port}
                        </p>
                        {host.ssl_forced ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded flex items-center gap-1">
                                <IconLock className="w-3 h-3" />
                                SSL
                            </span>
                        ) : (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded flex items-center gap-1">
                                <IconLockOff className="w-3 h-3" />
                                HTTP
                            </span>
                        )}
                        {!host.enabled && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded">
                                비활성
                            </span>
                        )}
                        {host.statusChecking ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded flex items-center gap-1">
                                <IconRefresh className="w-3 h-3 animate-spin" />
                                확인 중...
                            </span>
                        ) : host.statusCode !== undefined && host.statusCode !== null ? (
                            <span
                                className={`px-2 py-0.5 text-xs font-medium rounded ${host.statusCode >= 200 && host.statusCode < 300
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : host.statusCode >= 300 && host.statusCode < 400
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}
                            >
                                {host.statusCode}
                            </span>
                        ) : host.statusError ? (
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded">
                                {host.statusError}
                            </span>
                        ) : null}
                        {host.folders.length > 0 && (
                            <>
                                {host.folders.map((folder) => (
                                    <Link
                                        key={folder.folder_id}
                                        href="/dashboard/folders"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            router.push('/dashboard/folders');
                                        }}
                                        className="px-2 py-0.5 text-xs font-medium rounded hover:opacity-80 transition-opacity"
                                        style={{
                                            backgroundColor: `${folder.color}20`,
                                            color: folder.color,
                                        }}
                                    >
                                        {folder.name}
                                    </Link>
                                ))}
                            </>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(host)}
                    >
                        편집
                    </Button>
                </div>
            </div>
        );
    }

}