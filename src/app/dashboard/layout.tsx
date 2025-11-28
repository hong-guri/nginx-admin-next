'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    IconDashboard,
    IconServer,
    IconFolder,
    IconChartLine,
    IconLock,
    IconX,
    IconMenu,
} from '@tabler/icons-react';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);

    useEffect(() => {
        setMounted(true);

        // 자동 로그인 체크
        const checkAuth = async () => {
            try {
                const response = await fetch('/api/auth/check');
                if (!response.ok) {
                    router.push('/login');
                    return;
                }
                setCheckingAuth(false);
            } catch (error) {
                router.push('/login');
            }
        };

        checkAuth();
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
        router.refresh();
    };

    const navItems = [
        { href: '/dashboard', label: '대시보드', icon: IconDashboard },
        { href: '/dashboard/proxy-hosts', label: '프록시 호스트', icon: IconServer },
        { href: '/dashboard/folders', label: '폴더', icon: IconFolder },
        { href: '/dashboard/analytics', label: '트래픽 분석', icon: IconChartLine },
        { href: '/dashboard/security', label: '보안', icon: IconLock },
    ];

    if (!mounted || checkingAuth) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-600 dark:text-gray-400">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* 사이드바 - 데스크톱 */}
            <aside className="hidden md:flex md:flex-shrink-0">
                <div className="flex flex-col w-48 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-center h-14 px-4 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                            Nginx Admin
                        </h1>
                    </div>
                    <nav className="flex-1 px-2 py-4 space-y-1">
                        {navItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center px-2 py-2 text-xs font-medium rounded transition-all duration-200 ${pathname === item.href
                                        ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                                        }`}
                                >
                                    <IconComponent className="mr-2 w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleLogout}
                            className="w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </aside>

            {/* 모바일 사이드바 오버레이 */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* 모바일 사이드바 */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 transform transition-transform duration-300 ease-in-out md:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between h-12 px-3 border-b border-gray-200 dark:border-gray-700">
                        <h1 className="text-sm font-bold text-gray-900 dark:text-white">
                            Nginx Admin
                        </h1>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="text-gray-500 dark:text-gray-400"
                        >
                            <IconX className="w-4 h-4" />
                        </button>
                    </div>
                    <nav className="flex-1 px-2 py-3 space-y-1">
                        {navItems.map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`flex items-center px-2 py-2 text-xs font-medium rounded transition-colors ${pathname === item.href
                                        ? 'bg-primary text-white'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`}
                                >
                                    <IconComponent className="mr-2 w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={handleLogout}
                            className="w-full px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            로그아웃
                        </button>
                    </div>
                </div>
            </aside>

            {/* 메인 컨텐츠 */}
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* 모바일 헤더 */}
                <header className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-gray-500 dark:text-gray-400"
                    >
                        <IconMenu className="w-5 h-5" />
                    </button>
                </header>

                {/* 컨텐츠 영역 */}
                <main className="flex-1 overflow-y-auto p-4">
                    <div className="max-w-full mx-auto w-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

