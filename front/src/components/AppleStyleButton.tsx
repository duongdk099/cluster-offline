import React from 'react';

interface AppleStyleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary';
}

export const AppleStyleButton: React.FC<AppleStyleButtonProps> = ({
    children,
    variant = 'primary',
    className = '',
    ...props
}) => {
    const baseStyles = 'px-6 py-2 rounded-lg font-medium transition-all duration-200 active:scale-95 focus:outline-none disabled:opacity-50 disabled:grayscale';
    const variants = {
        primary: 'bg-accent text-white hover:opacity-90 shadow-[0_1px_2px_rgba(0,0,0,0.1)]',
        secondary: 'bg-white dark:bg-white/5 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-white/10 border border-apple-border/50 shadow-sm'
    };

    return (
        <button
            className={`${baseStyles} ${variants[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
};
