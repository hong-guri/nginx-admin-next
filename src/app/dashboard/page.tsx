'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
    IconServer,
    IconFolder,
    IconLock,
    IconShield,
    IconArrowRight,
} from '@tabler/icons-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalHosts: 0,
        totalFolders: 0,
        securityEvents: 0,
        activeSecurityRules: 0,
    });

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const [hostsRes, foldersRes, eventsRes, blacklistRes] = await Promise.all([
                    fetch('/api/proxy-hosts').then((r) => r.json()),
                    fetch('/api/folders').then((r) => r.json()),
                    fetch('/api/security/events?limit=1').then((r) => r.json()),
                    fetch('/api/security/blacklist/ip').then((r) => r.json()),
                ]);

                const hosts = Array.isArray(hostsRes) ? hostsRes : [];
                const folders = Array.isArray(foldersRes) ? foldersRes : [];
                const events = Array.isArray(eventsRes) ? eventsRes : [];
                const blacklist = Array.isArray(blacklistRes) ? blacklistRes : [];

                setStats({
                    totalHosts: hosts.length || 0,
                    totalFolders: folders.length || 0,
                    securityEvents: events.length || 0,
                    activeSecurityRules: blacklist.filter((b: any) => b.is_active).length || 0,
                });
            } catch (error) {
                console.error('통계 조회 오류:', error);
            }
        };

        fetchStats();
    }, []);

    const statCards = [
        {
            title: '프록시 호스트',
            value: stats.totalHosts,
            href: '/dashboard/proxy-hosts',
            icon: IconServer,
            color: 'bg-blue-500',
        },
        {
            title: '폴더',
            value: stats.totalFolders,
            href: '/dashboard/folders',
            icon: IconFolder,
            color: 'bg-purple-500',
        },
        {
            title: '보안 이벤트',
            value: stats.securityEvents,
            href: '/dashboard/security',
            icon: IconLock,
            color: 'bg-red-500',
        },
        {
            title: '활성 보안 규칙',
            value: stats.activeSecurityRules,
            href: '/dashboard/security',
            icon: IconShield,
            color: 'bg-green-500',
        },
    ];

    return (
        <div className="space-y-4">
            <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    대시보드
                </h1>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    Nginx Proxy Manager 관리 대시보드
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {statCards.map((card) => {
                    const IconComponent = card.icon;
                    return (
                        <Link key={card.title} href={card.href}>
                            <Card className="hover:shadow-md transition-all duration-200">
                                <CardContent className="p-3">
                                    <div className="flex items-center">
                                        <div className={`${card.color} rounded-lg p-2 text-white shadow-sm`}>
                                            <IconComponent className="w-4 h-4" />
                                        </div>
                                        <div className="ml-3">
                                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                                                {card.title}
                                            </p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                {card.value}
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                    <CardContent className="p-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            빠른 링크
                        </h2>
                        <div className="space-y-2">
                            <Link
                                href="/dashboard/proxy-hosts"
                                className="flex items-center px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <IconArrowRight className="mr-2 w-4 h-4" />
                                프록시 호스트 관리
                            </Link>
                            <Link
                                href="/dashboard/security"
                                className="flex items-center px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <IconArrowRight className="mr-2 w-4 h-4" />
                                보안 설정
                            </Link>
                            <Link
                                href="/dashboard/analytics"
                                className="flex items-center px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                            >
                                <IconArrowRight className="mr-2 w-4 h-4" />
                                트래픽 분석
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                            최근 보안 이벤트
                        </h2>
                        <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                            보안 이벤트 로그를 확인하려면{' '}
                            <Link
                                href="/dashboard/security"
                                className="text-[var(--color-primary)] hover:underline font-medium"
                            >
                                보안 페이지
                            </Link>
                            를 방문하세요.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

