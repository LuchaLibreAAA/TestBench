import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

    const sizeStyles = {
      sm: 'min-h-[36px] min-w-[36px] px-3 py-1.5 text-xs gap-1.5',
      md: 'min-h-[44px] min-w-[44px] px-4 py-2 text-sm gap-2',
      lg: 'min-h-[50px] min-w-[50px] px-6 py-3 text-base gap-2.5',
    }[size];

    const variantStyles = {
      primary: 'bg-[#1f5fa6] text-white hover:bg-[#1a4f8b] focus:ring-[#1f5fa6]',
      secondary: 'bg-gray-100 text-gray-800 hover:bg-gray-200 focus:ring-gray-300',
      outline: 'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-300',
      danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
      ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200',
      success: 'bg-[#2e9e5b] text-white hover:bg-[#26844c] focus:ring-[#2e9e5b]',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          icon && <span className="inline-flex shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

