import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/components/ui/utils';

interface RKCCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'featured' | 'minimal';
  children: ReactNode;
}

export function RKCCard({ className, variant = 'default', children, ...props }: RKCCardProps) {
  const baseStyles = 'bg-white rounded-xl overflow-hidden transition-all hover:shadow-lg';
  
  const variantStyles = {
    default: 'border border-gray-200 shadow-sm',
    featured: 'shadow-md border-l-4 border-l-[#0F7A3E]',
    minimal: 'border-none',
  };
  
  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface RKCCardImageProps extends HTMLAttributes<HTMLDivElement> {
  src: string;
  alt: string;
  aspectRatio?: 'video' | 'square' | 'portrait';
}

export function RKCCardImage({ src, alt, aspectRatio = 'video', className, ...props }: RKCCardImageProps) {
  const aspectStyles = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  };
  
  return (
    <div className={cn('relative overflow-hidden', aspectStyles[aspectRatio], className)} {...props}>
      <img 
        src={src} 
        alt={alt} 
        className="w-full h-full object-cover"
      />
    </div>
  );
}

interface RKCCardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function RKCCardContent({ className, children, ...props }: RKCCardContentProps) {
  return (
    <div className={cn('p-5', className)} {...props}>
      {children}
    </div>
  );
}
