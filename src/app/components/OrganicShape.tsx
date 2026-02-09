import { HTMLAttributes } from 'react';
import { cn } from '@/app/components/ui/utils';

interface OrganicShapeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'wave' | 'curve-top' | 'curve-bottom';
  color?: 'green' | 'yellow' | 'orange';
}

export function OrganicShape({ className, variant = 'wave', color = 'green', ...props }: OrganicShapeProps) {
  const colorStyles = {
    green: 'bg-[#0F7A3E]',
    yellow: 'bg-[#F2B705]',
    orange: 'bg-[#C85A1E]',
  };
  
  const shapes = {
    wave: (
      <div className={cn('absolute inset-0', colorStyles[color])} style={{ clipPath: 'ellipse(150% 100% at 50% 0%)' }} />
    ),
    'curve-top': (
      <div className={cn('absolute inset-0', colorStyles[color])} style={{ clipPath: 'ellipse(100% 55% at 48% 0%)' }} />
    ),
    'curve-bottom': (
      <div className={cn('absolute inset-0', colorStyles[color])} style={{ clipPath: 'ellipse(100% 55% at 48% 100%)' }} />
    ),
  };
  
  return (
    <div className={cn('relative w-full h-full', className)} {...props}>
      {shapes[variant]}
    </div>
  );
}
