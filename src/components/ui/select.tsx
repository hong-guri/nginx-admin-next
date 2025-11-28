'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { IconChevronDown } from '@tabler/icons-react';

interface SelectOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

interface SelectProps {
    value?: string | number;
    onChange?: (value: string | number) => void;
    options: SelectOption[];
    placeholder?: string;
    error?: string;
    disabled?: boolean;
    className?: string;
}

export function Select({
    value,
    onChange,
    options,
    placeholder,
    error,
    disabled = false,
    className,
}: SelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const selectRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const selectedOption = options.find((opt) => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setFocusedIndex(-1);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && buttonRef.current) {
            buttonRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (option: SelectOption) => {
        if (option.disabled) return;
        onChange?.(option.value);
        setIsOpen(false);
        setFocusedIndex(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (isOpen && focusedIndex >= 0) {
                    const option = options[focusedIndex];
                    if (option && !option.disabled) {
                        handleSelect(option);
                    }
                } else {
                    setIsOpen(!isOpen);
                }
                break;
            case 'Escape':
                setIsOpen(false);
                setFocusedIndex(-1);
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (!isOpen) {
                    setIsOpen(true);
                } else {
                    setFocusedIndex((prev) => {
                        const next = prev < options.length - 1 ? prev + 1 : 0;
                        const nextOption = options[next];
                        if (nextOption?.disabled) {
                            return next < options.length - 1 ? next + 1 : 0;
                        }
                        return next;
                    });
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (isOpen) {
                    setFocusedIndex((prev) => {
                        const next = prev > 0 ? prev - 1 : options.length - 1;
                        const nextOption = options[next];
                        if (nextOption?.disabled) {
                            return next > 0 ? next - 1 : options.length - 1;
                        }
                        return next;
                    });
                }
                break;
        }
    };

    return (
        <div className="w-full relative" ref={selectRef}>
            <button
                ref={buttonRef}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                onKeyDown={handleKeyDown}
                className={cn(
                    'flex h-9 w-full items-center justify-between rounded-md border',
                    'bg-white dark:bg-gray-700',
                    'px-3 py-2 text-sm',
                    'text-gray-900 dark:text-white',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'hover:border-gray-400 dark:hover:border-gray-500 transition-colors',
                    error
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300 dark:border-gray-600',
                    className
                )}
            >
                <span className={cn('truncate', !selectedOption && 'text-gray-500 dark:text-gray-400')}>
                    {selectedOption ? selectedOption.label : placeholder || '선택하세요'}
                </span>
                <IconChevronDown
                    className={cn(
                        'h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform',
                        isOpen && 'transform rotate-180'
                    )}
                />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className={cn(
                            'absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-700',
                            'bg-white dark:bg-gray-800',
                            'shadow-lg',
                            'max-h-60 overflow-auto',
                            'py-1'
                        )}
                        role="listbox"
                    >
                        {options.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                                옵션이 없습니다
                            </div>
                        ) : (
                            options.map((option, index) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    disabled={option.disabled}
                                    onClick={() => handleSelect(option)}
                                    onMouseEnter={() => setFocusedIndex(index)}
                                    className={cn(
                                        'w-full text-left px-3 py-2 text-sm',
                                        'transition-colors',
                                        'focus:outline-none',
                                        option.disabled
                                            ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500'
                                            : 'cursor-pointer',
                                        index === focusedIndex || option.value === value
                                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] dark:bg-[var(--color-primary)]/20 dark:text-[var(--color-primary)]'
                                            : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700',
                                        option.value === value && 'font-medium'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))
                        )}
                    </div>
                </>
            )}

            {error && (
                <p className="mt-1 text-xs text-red-500 dark:text-red-400">{error}</p>
            )}
        </div>
    );
}
