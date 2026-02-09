import { HTMLAttributes } from 'react';
import { cn } from '@/app/components/ui/utils';

interface RKCTagProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'green' | 'yellow' | 'orange' | 'brown';
}

export function RKCTag({ className, variant = 'green', children, ...props }: RKCTagProps) {
  const variantStyles = {
    green: 'bg-[#0F7A3E]/10 text-[#0F7A3E]',
    yellow: 'bg-[#F2B705]/10 text-[#C85A1E]',
    orange: 'bg-[#C85A1E]/10 text-[#C85A1E]',
    brown: 'bg-[#7A3E1D]/10 text-[#7A3E1D]',
  };
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
