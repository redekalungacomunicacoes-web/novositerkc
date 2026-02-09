import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/app/components/ui/utils';

interface RKCButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'accent';
  size?: 'sm' | 'md' | 'lg';
}

export const RKCButton = forwardRef<HTMLButtonElement, RKCButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';
    
    const variantStyles = {
      primary: 'bg-[#0F7A3E] text-white hover:bg-[#0d6633]',
      secondary: 'bg-[#2FA866] text-white hover:bg-[#28915a]',
      outline: 'border-2 border-[#0F7A3E] text-[#0F7A3E] hover:bg-[#0F7A3E] hover:text-white',
      accent: 'bg-[#F2B705] text-[#2E2E2E] hover:bg-[#d9a504]',
    };
    
    const sizeStyles = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3',
      lg: 'px-8 py-4 text-lg',
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

RKCButton.displayName = 'RKCButton';
