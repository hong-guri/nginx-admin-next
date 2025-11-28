'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
    description?: string;
    id?: string;
}

export function Toggle({
    checked,
    onChange,
    disabled = false,
    label,
    description,
    id,
}: ToggleProps) {
    return (
        <div className="flex items-start gap-3">
            <label
                htmlFor={id}
                className={cn(
                    'relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5',
                    disabled && 'opacity-50 cursor-not-allowed'
                )}
            >
                <input
                    type="checkbox"
                    id={id}
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="sr-only peer"
                />
                <div
                    className={cn(
                        "relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--color-primary)] rounded-full peer dark:bg-gray-700 transition-colors",
                        "peer-checked:bg-[var(--color-primary)]"
                    )}
                >
                    <div
                        className={cn(
                            "absolute top-[2px] left-[2px] bg-white border-gray-300 border rounded-full h-5 w-5 transition-all duration-200",
                            checked ? "translate-x-full" : "translate-x-0"
                        )}
                    />
                </div>
            </label>
            <div className="flex-1 min-w-0">
                {label && (
                    <div className="text-xs font-medium text-gray-900 dark:text-white">
                        {label}
                    </div>
                )}
                {description && (
                    <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {description}
                    </div>
                )}
            </div>
        </div>
    );
}

