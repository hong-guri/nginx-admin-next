'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { IconCheck } from '@tabler/icons-react';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
    label?: string;
    description?: string;
}

export function Checkbox({
    className,
    label,
    description,
    checked,
    disabled,
    onChange,
    ...props
}: CheckboxProps) {
    return (
        <label className={cn('flex items-start gap-2 cursor-pointer', disabled && 'cursor-not-allowed opacity-50', className)}>
            <div className="relative flex-shrink-0">
                <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={onChange}
                    className="sr-only"
                    {...props}
                />
                <div
                    className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-all',
                        'border-gray-300 dark:border-gray-600',
                        'bg-white dark:bg-gray-700',
                        checked && 'bg-[var(--color-primary)] border-[var(--color-primary)]',
                        !disabled && 'hover:border-[var(--color-primary)]/50',
                        disabled && 'opacity-50 cursor-not-allowed'
                    )}
                >
                    {checked && (
                        <IconCheck className="w-3 h-3 text-white" strokeWidth={3} />
                    )}
                </div>
            </div>
            {(label || description) && (
                <div className="flex-1 min-w-0">
                    {label && (
                        <span className="text-sm text-gray-900 dark:text-white font-medium">
                            {label}
                        </span>
                    )}
                    {description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {description}
                        </p>
                    )}
                </div>
            )}
        </label>
    );
}

