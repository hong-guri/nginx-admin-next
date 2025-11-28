'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    IconBan,
    IconCircleCheck,
    IconShield,
    IconClipboard,
    IconAlertTriangle,
    IconTrendingUp,
    IconRefresh,
    IconActivity,
    IconWorld,
    IconClock,
    IconExclamationMark,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Modal, ConfirmModal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

const EVENT_TYPE_LABELS: Record<string, string> = {
    BLOCKED_IP: 'IP 차단',
    BLOCKED_PATH: '경로 차단',
    SUSPICIOUS_UA: '의심스러운 UA',
    RATE_LIMIT: 'Rate Limit',
    VULNERABILITY_DETECTED: '취약점 탐지',
    SQL_INJECTION: 'SQL Injection',
    XSS: 'XSS 공격',
    PATH_TRAVERSAL: 'Path Traversal',
    COMMAND_INJECTION: 'Command Injection',
    ANOMALY_DETECTED: '이상 탐지',
};

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH: '#f59e0b',
    MEDIUM: '#3b82f6',
    LOW: '#10b981',
    UNKNOWN: '#6b7280',
};

export default function SecurityPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'blacklist' | 'whitelist' | 'paths' | 'events'>('overview');
    const [ipBlacklist, setIpBlacklist] = useState<any[]>([]);
    const [ipWhitelist, setIpWhitelist] = useState<any[]>([]);
    const [pathBlacklist, setPathBlacklist] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [securityStats, setSecurityStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
    const [autoRefresh, setAutoRefresh] = useState(false);

    // 모달 상태
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'blacklist' | 'whitelist' | 'path'; id: number } | null>(null);
    const [formData, setFormData] = useState({
        ip_address: '',
        reason: '',
        description: '',
        path_pattern: '',
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;

            if (activeTab === 'overview') {
                const [statsRes, eventsRes] = await Promise.all([
                    fetch(`/api/security/stats?hours=${hours}`).then((r) => r.json()),
                    fetch(`/api/security/events?limit=20`).then((r) => r.json()),
                ]);
                setSecurityStats(statsRes);
                setEvents(Array.isArray(eventsRes) ? eventsRes : []);
            } else {
                switch (activeTab) {
                    case 'blacklist':
                        const blacklistRes = await fetch('/api/security/blacklist/ip').then((r) => r.json());
                        setIpBlacklist(Array.isArray(blacklistRes) ? blacklistRes : []);
                        break;
                    case 'whitelist':
                        const whitelistRes = await fetch('/api/security/whitelist/ip').then((r) => r.json());
                        setIpWhitelist(Array.isArray(whitelistRes) ? whitelistRes : []);
                        break;
                    case 'paths':
                        const pathsRes = await fetch('/api/security/blacklist/path/global').then((r) => r.json());
                        setPathBlacklist(Array.isArray(pathsRes) ? pathsRes : []);
                        break;
                    case 'events':
                        const eventsRes = await fetch(`/api/security/events?limit=100`).then((r) => r.json());
                        setEvents(Array.isArray(eventsRes) ? eventsRes : []);
                        break;
                }
            }
        } catch (error) {
            console.error('보안 데이터 조회 오류:', error);
        } finally {
            setLoading(false);
        }
    }, [activeTab, timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 자동 새로고침
    useEffect(() => {
        if (autoRefresh && activeTab === 'overview') {
            const interval = setInterval(() => {
                fetchData();
            }, 30000); // 30초마다
            return () => clearInterval(interval);
        }
    }, [autoRefresh, activeTab, fetchData]);

    const handleAdd = async () => {
        try {
            let endpoint = '';
            let body: any = {};

            switch (activeTab) {
                case 'blacklist':
                    endpoint = '/api/security/blacklist/ip';
                    body = { ip_address: formData.ip_address, reason: formData.reason };
                    break;
                case 'whitelist':
                    endpoint = '/api/security/whitelist/ip';
                    body = { ip_address: formData.ip_address, description: formData.description };
                    break;
                case 'paths':
                    endpoint = '/api/security/blacklist/path/global';
                    body = { path_pattern: formData.path_pattern, description: formData.description };
                    break;
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (response.ok) {
                setShowAddModal(false);
                setFormData({ ip_address: '', reason: '', description: '', path_pattern: '' });
                fetchData();
            }
        } catch (error) {
            console.error('추가 오류:', error);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;

        try {
            let endpoint = '';
            switch (deleteTarget.type) {
                case 'blacklist':
                    endpoint = `/api/security/blacklist/ip/${deleteTarget.id}`;
                    break;
                case 'whitelist':
                    endpoint = `/api/security/whitelist/ip/${deleteTarget.id}`;
                    break;
                case 'path':
                    endpoint = `/api/security/blacklist/path/global/${deleteTarget.id}`;
                    break;
            }

            const response = await fetch(endpoint, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchData();
                setDeleteTarget(null);
            }
        } catch (error) {
            console.error('삭제 오류:', error);
        }
    };

    const tabs = [
        { id: 'overview', label: '보안 대시보드', icon: IconShield },
        { id: 'blacklist', label: 'IP 블랙리스트', icon: IconBan },
        { id: 'whitelist', label: 'IP 화이트리스트', icon: IconCircleCheck },
        { id: 'paths', label: '경로 블랙리스트', icon: IconShield },
        { id: 'events', label: '보안 이벤트', icon: IconClipboard },
    ];

    const getSeverityColor = (severity: string) => {
        return SEVERITY_COLORS[severity] || SEVERITY_COLORS.UNKNOWN;
    };

    const parseDetails = (details: string | null) => {
        if (!details) return null;
        try {
            return JSON.parse(details);
        } catch {
            return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        보안 관리
                    </h1>
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                        실시간 보안 모니터링 및 위협 탐지
                    </p>
                </div>
                {activeTab === 'overview' && (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                            {(['1h', '24h', '7d'] as const).map((range) => (
                                <Button
                                    key={range}
                                    variant={timeRange === range ? 'default' : 'secondary'}
                                    size="sm"
                                    onClick={() => setTimeRange(range)}
                                >
                                    {range === '1h' ? '1시간' : range === '24h' ? '24시간' : '7일'}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant={autoRefresh ? 'default' : 'secondary'}
                            size="sm"
                            onClick={() => setAutoRefresh(!autoRefresh)}
                        >
                            {autoRefresh ? '자동 새로고침 ON' : '자동 새로고침 OFF'}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={fetchData}
                            disabled={loading}
                        >
                            <IconRefresh className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                            새로고침
                        </Button>
                    </div>
                )}
            </div>

            <Card>
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex -mb-px">
                        {tabs.map((tab) => {
                            const IconComponent = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center px-3 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                        }`}
                                >
                                    <IconComponent className="mr-1.5 w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-4">
                    {loading ? (
                        <div className="text-center py-8 text-xs text-gray-600 dark:text-gray-400">
                            로딩 중...
                        </div>
                    ) : (
                        <>
                            {activeTab === 'overview' && securityStats && (
                                <div className="space-y-6">
                                    {/* 통계 카드 */}
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                            총 보안 이벤트
                                                        </p>
                                                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                                                            {securityStats.totalEvents?.toLocaleString() || 0}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                                                        <IconAlertTriangle className="h-5 w-5 text-red-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                            CRITICAL 위협
                                                        </p>
                                                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                                                            {securityStats.severityStats?.find((s: any) => s.severity === 'CRITICAL')?.count || 0}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                                                        <IconExclamationMark className="h-5 w-5 text-red-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                            차단된 IP
                                                        </p>
                                                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                                                            {ipBlacklist.length}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                                                        <IconBan className="h-5 w-5 text-orange-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                            위협 IP 수
                                                        </p>
                                                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                                                            {securityStats.topThreatIPs?.length || 0}
                                                        </p>
                                                    </div>
                                                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                                        <IconWorld className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* 차트 */}
                                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                        {/* 이벤트 타입별 통계 */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">이벤트 타입별 통계</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <BarChart data={securityStats.eventTypeStats || []}>
                                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                        <XAxis
                                                            dataKey="event_type"
                                                            angle={-45}
                                                            textAnchor="end"
                                                            height={80}
                                                            tickFormatter={(value) => EVENT_TYPE_LABELS[value] || value}
                                                        />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>

                                        {/* 심각도별 분포 */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">심각도별 분포</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <PieChart>
                                                        <Pie
                                                            data={securityStats.severityStats || []}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={false}
                                                            label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                                                            outerRadius={80}
                                                            fill="#8884d8"
                                                            dataKey="count"
                                                        >
                                                            {(securityStats.severityStats || []).map((entry: any, index: number) => (
                                                                <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severity)} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>

                                        {/* 시간대별 이벤트 */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">시간대별 이벤트</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <LineChart data={securityStats.hourlyEvents || []}>
                                                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                                        <XAxis dataKey="hour" />
                                                        <YAxis />
                                                        <Tooltip />
                                                        <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </CardContent>
                                        </Card>

                                        {/* 상위 위협 IP */}
                                        <Card>
                                            <CardHeader>
                                                <CardTitle className="text-sm">상위 위협 IP</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="space-y-2">
                                                    {(securityStats.topThreatIPs || []).slice(0, 10).map((ip: any, index: number) => (
                                                        <div key={ip.ip_address} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                                                    index === 1 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                                        'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                                    }`}>
                                                                    {index + 1}
                                                                </span>
                                                                <span className="text-xs font-mono text-gray-900 dark:text-white">{ip.ip_address}</span>
                                                            </div>
                                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                                                {ip.count}건
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* 최근 보안 이벤트 */}
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm">최근 보안 이벤트</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                                시간
                                                            </th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                                이벤트
                                                            </th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                                IP
                                                            </th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                                경로
                                                            </th>
                                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                                심각도
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                        {events.slice(0, 20).map((event) => {
                                                            const details = parseDetails(event.details);
                                                            const severity = details?.severity || 'UNKNOWN';
                                                            return (
                                                                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                                    <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">
                                                                        {new Date(event.created_at).toLocaleString('ko-KR', {
                                                                            month: '2-digit',
                                                                            day: '2-digit',
                                                                            hour: '2-digit',
                                                                            minute: '2-digit',
                                                                        })}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                                                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-xs font-mono text-gray-900 dark:text-white">
                                                                        {event.ip_address || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                                                        {event.path || '-'}
                                                                    </td>
                                                                    <td className="px-3 py-2">
                                                                        <span
                                                                            className="px-2 py-0.5 text-xs font-medium rounded"
                                                                            style={{
                                                                                backgroundColor: `${getSeverityColor(severity)}20`,
                                                                                color: getSeverityColor(severity),
                                                                            }}
                                                                        >
                                                                            {severity}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* 기존 탭들 */}
                            {activeTab === 'blacklist' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center gap-3">
                                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            IP 블랙리스트
                                        </h2>
                                        <Button
                                            size="sm"
                                            className="whitespace-nowrap"
                                            onClick={() => setShowAddModal(true)}
                                        >
                                            + 추가
                                        </Button>
                                    </div>
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {ipBlacklist.map((item) => (
                                            <div
                                                key={item.id}
                                                className="py-2 flex items-center justify-between gap-3"
                                            >
                                                <div>
                                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                        {item.ip_address}
                                                    </p>
                                                    {item.reason && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {item.reason}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={() => setDeleteTarget({ type: 'blacklist', id: item.id })}
                                                >
                                                    삭제
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'whitelist' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center gap-3">
                                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            IP 화이트리스트
                                        </h2>
                                        <Button
                                            size="sm"
                                            className="whitespace-nowrap"
                                            onClick={() => setShowAddModal(true)}
                                        >
                                            + 추가
                                        </Button>
                                    </div>
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {ipWhitelist.map((item) => (
                                            <div
                                                key={item.id}
                                                className="py-2 flex items-center justify-between gap-3"
                                            >
                                                <div>
                                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                        {item.ip_address}
                                                    </p>
                                                    {item.description && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={() => setDeleteTarget({ type: 'whitelist', id: item.id })}
                                                >
                                                    삭제
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'paths' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center gap-3">
                                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            전역 경로 블랙리스트
                                        </h2>
                                        <Button
                                            size="sm"
                                            className="whitespace-nowrap"
                                            onClick={() => setShowAddModal(true)}
                                        >
                                            + 추가
                                        </Button>
                                    </div>
                                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                        {pathBlacklist.map((item) => (
                                            <div
                                                key={item.id}
                                                className="py-2 flex items-center justify-between gap-3"
                                            >
                                                <div>
                                                    <p className="text-xs font-medium text-gray-900 dark:text-white">
                                                        {item.path_pattern}
                                                    </p>
                                                    {item.description && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                            {item.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-600 hover:text-red-800 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={() => setDeleteTarget({ type: 'path', id: item.id })}
                                                >
                                                    삭제
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'events' && (
                                <div className="space-y-3">
                                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        보안 이벤트 로그
                                    </h2>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                                            <thead className="bg-gray-50 dark:bg-gray-800">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                        시간
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                        이벤트
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                        IP
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                        경로
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                                                        심각도
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                                {events.map((event) => {
                                                    const details = parseDetails(event.details);
                                                    const severity = details?.severity || 'UNKNOWN';
                                                    return (
                                                        <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                            <td className="px-3 py-2 text-xs text-gray-900 dark:text-white">
                                                                {new Date(event.created_at).toLocaleString('ko-KR')}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                                                                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs font-mono text-gray-900 dark:text-white">
                                                                {event.ip_address || '-'}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                                                {event.path || '-'}
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <span
                                                                    className="px-2 py-0.5 text-xs font-medium rounded"
                                                                    style={{
                                                                        backgroundColor: `${getSeverityColor(severity)}20`,
                                                                        color: getSeverityColor(severity),
                                                                    }}
                                                                >
                                                                    {severity}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>

            {/* 추가 모달 */}
            <Modal
                open={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setFormData({ ip_address: '', reason: '', description: '', path_pattern: '' });
                }}
                title={
                    activeTab === 'blacklist' ? 'IP 블랙리스트 추가' :
                        activeTab === 'whitelist' ? 'IP 화이트리스트 추가' :
                            '전역 경로 블랙리스트 추가'
                }
                size="sm"
                footer={
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setShowAddModal(false);
                                setFormData({ ip_address: '', reason: '', description: '', path_pattern: '' });
                            }}
                        >
                            취소
                        </Button>
                        <Button onClick={handleAdd}>
                            추가
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    {activeTab === 'blacklist' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    IP 주소
                                </label>
                                <Input
                                    type="text"
                                    value={formData.ip_address}
                                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                    placeholder="192.168.1.1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    사유 (선택)
                                </label>
                                <Input
                                    type="text"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="차단 사유"
                                />
                            </div>
                        </>
                    )}
                    {activeTab === 'whitelist' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    IP 주소
                                </label>
                                <Input
                                    type="text"
                                    value={formData.ip_address}
                                    onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
                                    placeholder="192.168.1.1"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    설명 (선택)
                                </label>
                                <Input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="설명"
                                />
                            </div>
                        </>
                    )}
                    {activeTab === 'paths' && (
                        <>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    경로 패턴
                                </label>
                                <Input
                                    type="text"
                                    value={formData.path_pattern}
                                    onChange={(e) => setFormData({ ...formData, path_pattern: e.target.value })}
                                    placeholder="/wp-admin"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    설명 (선택)
                                </label>
                                <Input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="설명"
                                />
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* 삭제 확인 모달 */}
            <ConfirmModal
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title="삭제 확인"
                message="이 항목을 삭제하시겠습니까?"
                confirmText="삭제"
                cancelText="취소"
                variant="danger"
            />
        </div>
    );
}
