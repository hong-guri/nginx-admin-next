'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
    IconActivity,
    IconUsers,
    IconWorld,
    IconServer,
    IconTrendingUp,
    IconTrendingDown,
    IconDownload,
    IconUpload,
    IconAlertCircle,
    IconCircleCheck,
    IconClock,
    IconRefresh,
    IconChartBar,
    IconGauge,
    IconShield,
    IconBolt,
    IconArrowUp,
    IconArrowDown,
    IconMinus,
    IconFilter,
    IconSearch,
} from '@tabler/icons-react';

interface SummaryData {
    summary: {
        total_requests: number;
        unique_ips: number;
        unique_urls: number;
        active_proxy_hosts: number;
        total_bytes_sent: number;
        avg_bytes_sent: number;
        avg_response_time: number;
        status_2xx: number;
        status_4xx: number;
        status_5xx: number;
        peak_rps: number;
        peak_hour: string;
    };
    hourly: Array<{
        hour: string;
        requests: number;
        unique_ips: number;
        bytes_sent: number;
        rps: number;
        avg_response_time: number;
    }>;
    daily: Array<{
        date: string;
        requests: number;
        unique_ips: number;
        bytes_sent: number;
    }>;
    previousPeriod?: {
        total_requests: number;
        unique_ips: number;
        total_bytes_sent: number;
        avg_response_time: number;
    };
}

interface IPRanking {
    ip_address: string;
    access_count: number;
    unique_urls: number;
    active_days: number;
    total_bytes_sent: number;
    avg_response_time: number;
    success_count: number;
    client_error_count: number;
    server_error_count: number;
    last_access: string;
}

interface DomainRanking {
    proxy_host_id?: number;
    primary_domain: string;
    domain_names: string[];
    total_requests: number;
    unique_ips: number;
    unique_urls: number;
    total_bytes_sent: number;
    avg_response_time: number;
    success_count: number;
    client_error_count: number;
    server_error_count: number;
}

interface RealtimeData {
    time_bucket: string;
    total_requests: number;
    avg_response_time: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];

function formatBytes(bytes: number | null | undefined): string {
    const num = Number(bytes) || 0;
    if (num === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(k));
    return Math.round((num / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function formatNumber(num: number | null | undefined): string {
    const n = Number(num) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function calculateTrend(current: number, previous: number): { value: number; isPositive: boolean } {
    if (previous === 0) return { value: 0, isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
}

export default function AnalyticsPage() {
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [ipRanking, setIpRanking] = useState<IPRanking[]>([]);
    const [domainRanking, setDomainRanking] = useState<DomainRanking[]>([]);
    const [realtimeData, setRealtimeData] = useState<RealtimeData[]>([]);
    const [proxyHosts, setProxyHosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
    const [selectedDomain, setSelectedDomain] = useState<number | 'all'>('all');
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    // 프록시 호스트 목록 가져오기
    useEffect(() => {
        const fetchProxyHosts = async () => {
            try {
                const hostsRes = await fetch('/api/proxy-hosts').then((r) => r.json());
                setProxyHosts(Array.isArray(hostsRes) ? hostsRes : []);
            } catch (error) {
                console.error('프록시 호스트 조회 오류:', error);
            }
        };
        fetchProxyHosts();
    }, []);

    // 데이터 가져오기 함수
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
            const proxyHostParam = selectedDomain !== 'all' ? `&proxy_host_id=${selectedDomain}` : '';

            const [summaryRes, ipsRes, domainsRes, realtimeRes] = await Promise.all([
                fetch(`/api/traffic/summary?hours=${hours}${proxyHostParam}`).then((r) => r.json()),
                fetch(`/api/traffic/ips?limit=20&hours=${hours}${proxyHostParam}`).then((r) => r.json()),
                fetch(`/api/traffic/domains?limit=20&hours=${hours}`).then((r) => r.json()),
                fetch(`/api/analytics/realtime?minutes=${timeRange === '1h' ? 60 : timeRange === '24h' ? 1440 : timeRange === '7d' ? 10080 : 43200}${proxyHostParam}`).then((r) => r.json()),
            ]);

            // 데이터 타입 변환
            if (summaryRes?.hourly) {
                summaryRes.hourly = summaryRes.hourly.map((item: any) => ({
                    ...item,
                    requests: Number(item.requests) || 0,
                    unique_ips: Number(item.unique_ips) || 0,
                    bytes_sent: Number(item.bytes_sent) || 0,
                    rps: Number(item.rps) || 0,
                    avg_response_time: Number(item.avg_response_time) || 0,
                }));
            }
            if (summaryRes?.daily) {
                summaryRes.daily = summaryRes.daily.map((item: any) => ({
                    ...item,
                    requests: Number(item.requests) || 0,
                    unique_ips: Number(item.unique_ips) || 0,
                    bytes_sent: Number(item.bytes_sent) || 0,
                }));
            }

            // 이전 기간 데이터 가져오기 (비교용)
            if (timeRange !== '1h') {
                const prevHours = hours;
                const prevSummaryRes = await fetch(`/api/traffic/summary?hours=${prevHours * 2}&offset=${prevHours}${proxyHostParam}`).then((r) => r.json()).catch(() => null);
                if (prevSummaryRes?.summary) {
                    summaryRes.previousPeriod = {
                        total_requests: Number(prevSummaryRes.summary.total_requests) || 0,
                        unique_ips: Number(prevSummaryRes.summary.unique_ips) || 0,
                        total_bytes_sent: Number(prevSummaryRes.summary.total_bytes_sent) || 0,
                        avg_response_time: Number(prevSummaryRes.summary.avg_response_time) || 0,
                    };
                }
            }

            setSummaryData(summaryRes);
            setIpRanking(Array.isArray(ipsRes) ? ipsRes : []);
            setDomainRanking(Array.isArray(domainsRes) ? domainsRes : []);
            setRealtimeData(Array.isArray(realtimeRes) ? realtimeRes.slice(0, 60).reverse() : []);
            setLoading(false);
        } catch (error) {
            console.error('통계 조회 오류:', error);
            setLoading(false);
        }
    }, [timeRange, selectedDomain]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // 자동 새로고침
    useEffect(() => {
        if (autoRefresh) {
            const interval = setInterval(() => {
                fetchData();
            }, 30000); // 30초마다
            setRefreshInterval(interval);
            return () => {
                if (interval) clearInterval(interval);
            };
        } else {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshInterval(null);
            }
        }
    }, [autoRefresh, fetchData]);

    // proxy_host_id를 실제 도메인 이름으로 변환
    const getDomainName = (proxyHostId: number): string => {
        const host = proxyHosts.find((h) => h.id === proxyHostId);
        if (host && host.domain_names && Array.isArray(host.domain_names) && host.domain_names.length > 0) {
            return host.domain_names[0];
        }
        return `proxy-host-${proxyHostId}`;
    };

    const summary = summaryData?.summary || {
        total_requests: 0,
        unique_ips: 0,
        unique_urls: 0,
        active_proxy_hosts: 0,
        total_bytes_sent: 0,
        avg_bytes_sent: 0,
        avg_response_time: 0,
        status_2xx: 0,
        status_4xx: 0,
        status_5xx: 0,
        peak_rps: 0,
        peak_hour: '',
    };

    const previousPeriod = summaryData?.previousPeriod;

    // 숫자로 변환 및 기본값 설정
    const avgResponseTime = Number(summary.avg_response_time) || 0;
    const totalRequests = Number(summary.total_requests) || 0;
    const status2xx = Number(summary.status_2xx) || 0;
    const status4xx = Number(summary.status_4xx) || 0;
    const status5xx = Number(summary.status_5xx) || 0;
    const totalErrors = status4xx + status5xx;
    const errorRate = totalRequests > 0 ? ((totalErrors / totalRequests) * 100) : 0;
    const successRate = totalRequests > 0 ? ((status2xx / totalRequests) * 100) : 0;
    const avgRPS = timeRange === '1h' ? totalRequests / 60 : timeRange === '24h' ? totalRequests / 1440 : timeRange === '7d' ? totalRequests / 10080 : totalRequests / 43200;

    // 트렌드 계산
    const requestsTrend = previousPeriod ? calculateTrend(totalRequests, previousPeriod.total_requests) : null;
    const ipsTrend = previousPeriod ? calculateTrend(Number(summary.unique_ips) || 0, previousPeriod.unique_ips) : null;
    const bytesTrend = previousPeriod ? calculateTrend(Number(summary.total_bytes_sent) || 0, previousPeriod.total_bytes_sent) : null;
    const responseTimeTrend = previousPeriod ? calculateTrend(avgResponseTime, previousPeriod.avg_response_time) : null;

    const statsCards = [
        {
            title: '총 요청 수',
            value: formatNumber(totalRequests),
            subtitle: `평균 ${avgRPS.toFixed(1)} req/s`,
            icon: IconActivity,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            trend: requestsTrend,
        },
        {
            title: '고유 IP',
            value: formatNumber(Number(summary.unique_ips) || 0),
            subtitle: `${Number(summary.active_proxy_hosts) || 0}개 도메인`,
            icon: IconUsers,
            color: 'text-green-600',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
            trend: ipsTrend,
        },
        {
            title: '전송량',
            value: formatBytes(Number(summary.total_bytes_sent) || 0),
            subtitle: `평균 ${formatBytes(Number(summary.avg_bytes_sent) || 0)}/요청`,
            icon: IconDownload,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
            trend: bytesTrend,
        },
        {
            title: '평균 응답 시간',
            value: `${avgResponseTime.toFixed(0)}ms`,
            subtitle: avgResponseTime < 200 ? '우수' : avgResponseTime < 500 ? '양호' : '개선 필요',
            icon: IconClock,
            color: 'text-orange-600',
            bgColor: 'bg-orange-50 dark:bg-orange-900/20',
            trend: responseTimeTrend,
        },
        {
            title: '성공률',
            value: `${successRate.toFixed(1)}%`,
            subtitle: `${status2xx.toLocaleString()}건 성공`,
            icon: IconCircleCheck,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
        },
        {
            title: '에러율',
            value: `${errorRate.toFixed(2)}%`,
            subtitle: `${totalErrors.toLocaleString()}건 에러`,
            icon: IconAlertCircle,
            color: errorRate > 5 ? 'text-red-600' : 'text-yellow-600',
            bgColor: errorRate > 5 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20',
        },
        {
            title: '피크 RPS',
            value: `${Number(summary.peak_rps) || 0}`,
            subtitle: summary.peak_hour || 'N/A',
            icon: IconBolt,
            color: 'text-cyan-600',
            bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
        },
        {
            title: '고유 URL',
            value: formatNumber(Number(summary.unique_urls) || 0),
            subtitle: `${formatNumber(totalRequests)}건 요청`,
            icon: IconWorld,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
        },
    ];

    // 실시간 데이터 차트용
    const realtimeChartData = useMemo(() => {
        return realtimeData.map((item) => ({
            time: new Date(item.time_bucket).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
            requests: Number(item.total_requests) || 0,
            responseTime: Number(item.avg_response_time) || 0,
        }));
    }, [realtimeData]);

    if (loading && !summaryData) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-sm text-gray-600 dark:text-gray-400">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 p-6">
            {/* 헤더 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        트래픽 분석
                    </h1>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        실시간 트래픽 모니터링 및 상세 통계 분석
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-[200px]">
                        <Select
                            value={selectedDomain}
                            onChange={(value) => setSelectedDomain(value === 'all' ? 'all' : Number(value))}
                            options={[
                                { value: 'all', label: '전체 도메인' },
                                ...proxyHosts.map((host) => ({
                                    value: host.id,
                                    label: host.domain_names?.[0] || `Host #${host.id}`,
                                })),
                            ]}
                            placeholder="도메인 선택"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        {(['1h', '24h', '7d', '30d'] as const).map((range) => (
                            <Button
                                key={range}
                                variant={timeRange === range ? 'default' : 'secondary'}
                                size="sm"
                                onClick={() => setTimeRange(range)}
                            >
                                {range === '1h' ? '1시간' : range === '24h' ? '24시간' : range === '7d' ? '7일' : '30일'}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <IconRefresh className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                        새로고침
                    </Button>
                    <Button
                        variant={autoRefresh ? 'default' : 'secondary'}
                        size="sm"
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? '자동 새로고침 ON' : '자동 새로고침 OFF'}
                    </Button>
                </div>
            </div>

            {/* 통계 카드 그리드 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                {statsCards.map((card, index) => {
                    const Icon = card.icon;
                    const TrendIcon = card.trend?.isPositive ? IconTrendingUp : IconTrendingDown;
                    return (
                        <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                                            {card.title}
                                        </p>
                                        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                                            {card.value}
                                        </p>
                                        {card.subtitle && (
                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                {card.subtitle}
                                            </p>
                                        )}
                                        {card.trend && (
                                            <div className={`mt-2 flex items-center gap-1 text-xs ${card.trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                                <TrendIcon className="w-3 h-3" />
                                                <span>{card.trend.value.toFixed(1)}%</span>
                                                <span className="text-gray-500">vs 이전 기간</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className={`p-2.5 rounded-lg ${card.bgColor} flex-shrink-0 ml-2`}>
                                        <Icon className={`h-5 w-5 ${card.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* 실시간 모니터링 */}
            {timeRange === '1h' && realtimeChartData.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>실시간 트래픽 모니터링</CardTitle>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span>요청 수</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                                    <span>응답 시간</span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={350}>
                            <ComposedChart data={realtimeChartData}>
                                <defs>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis
                                    dataKey="time"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    interval="preserveStartEnd"
                                />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip
                                    formatter={(value: any, name: string) => {
                                        if (name === 'requests') return [formatNumber(Number(value)), '요청 수'];
                                        if (name === 'responseTime') return [`${Number(value).toFixed(0)}ms`, '응답 시간'];
                                        return value;
                                    }}
                                />
                                <Legend />
                                <Area
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRequests)"
                                    name="요청 수"
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="responseTime"
                                    stroke="#f59e0b"
                                    strokeWidth={2}
                                    dot={false}
                                    name="응답 시간 (ms)"
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* 차트 섹션 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 시간대별 요청 수 및 RPS */}
                <Card>
                    <CardHeader>
                        <CardTitle>시간대별 요청 수</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={summaryData?.hourly || []}>
                                <defs>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis
                                    dataKey="hour"
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: any, name: string) => {
                                        if (name === 'requests') return [formatNumber(Number(value)), '요청 수'];
                                        if (name === 'rps') return [`${Number(value).toFixed(1)}`, 'RPS'];
                                        return value;
                                    }}
                                />
                                <Legend />
                                <Area
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRequests)"
                                    name="요청 수"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rps"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={false}
                                    name="RPS"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 시간대별 전송량 */}
                <Card>
                    <CardHeader>
                        <CardTitle>시간대별 전송량</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={summaryData?.hourly || []}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis
                                    dataKey="hour"
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: any) => [formatBytes(Number(value)), '전송량']}
                                />
                                <Bar
                                    dataKey="bytes_sent"
                                    fill="#10b981"
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 일별 트래픽 추이 */}
                <Card>
                    <CardHeader>
                        <CardTitle>일별 트래픽 추이</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={summaryData?.daily || []}>
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis
                                    dataKey="date"
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                />
                                <YAxis />
                                <Tooltip
                                    formatter={(value: any) => formatNumber(Number(value))}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="requests"
                                    stroke="#3b82f6"
                                    name="요청 수"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="unique_ips"
                                    stroke="#10b981"
                                    name="고유 IP"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="bytes_sent"
                                    stroke="#8b5cf6"
                                    name="전송량"
                                    strokeWidth={2}
                                    dot={{ r: 4 }}
                                    activeDot={{ r: 6 }}
                                    yAxisId="right"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* 상태 코드 분포 */}
                <Card>
                    <CardHeader>
                        <CardTitle>상태 코드 분포</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: '2xx 성공', value: status2xx, color: '#10b981' },
                                            { name: '4xx 클라이언트 오류', value: status4xx, color: '#f59e0b' },
                                            { name: '5xx 서버 오류', value: status5xx, color: '#ef4444' },
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {[
                                            { name: '2xx', value: status2xx, color: '#10b981' },
                                            { name: '4xx', value: status4xx, color: '#f59e0b' },
                                            { name: '5xx', value: status5xx, color: '#ef4444' },
                                        ].map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col justify-center gap-3">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-green-500"></div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">2xx 성공</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{status2xx.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-yellow-500"></div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">4xx 오류</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{status4xx.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-red-500"></div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">5xx 오류</span>
                                    </div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">{status5xx.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 순위 테이블 */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* IP 순위 */}
                <Card>
                    <CardHeader>
                        <CardTitle>접속 IP 순위 (상위 20개)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            순위
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            IP 주소
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            접속 수
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            전송량
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            응답 시간
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                    {ipRanking.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        ipRanking.map((ip, index) => (
                                            <tr key={ip.ip_address} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                        index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                                            index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                                'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-mono">
                                                    {ip.ip_address}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                    {formatNumber(ip.access_count)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                    {formatBytes(ip.total_bytes_sent)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                    {Number(ip.avg_response_time).toFixed(0)}ms
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* 도메인 순위 */}
                <Card>
                    <CardHeader>
                        <CardTitle>접속 도메인 순위 (상위 20개)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-800">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            순위
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            도메인
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            요청 수
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            고유 IP
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            응답 시간
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                    {domainRanking.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        domainRanking.map((domain, index) => {
                                            const proxyHostId = domain.proxy_host_id || parseInt(domain.primary_domain.replace('proxy-host-', '')) || 0;
                                            const domainName = getDomainName(proxyHostId);
                                            return (
                                                <tr key={domain.primary_domain} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                            index === 1 ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                                                index === 2 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                                                    'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                                        {domainName}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                        {formatNumber(domain.total_requests)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                        {formatNumber(domain.unique_ips)}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                                        {Number(domain.avg_response_time).toFixed(0)}ms
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
