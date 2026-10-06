import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/app/components/ui/utils';
import { RKCProgressiveImage } from '@/app/components/RKCProgressiveImage';

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
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  sizes?: string;
  preloadMargin?: string;
}

export function RKCCardImage({
  src,
  alt,
  aspectRatio = 'video',
  loading = 'lazy',
  fetchPriority = 'low',
  sizes = '(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw',
  preloadMargin = '1200px 0px',
  className,
  ...props
}: RKCCardImageProps) {
  const aspectStyles = {
    video: 'aspect-video',
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
  };

  return (
    <div className={cn('relative overflow-hidden', aspectStyles[aspectRatio], className)} {...props}>
      <RKCProgressiveImage
        src={src}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        sizes={sizes}
        preloadMargin={preloadMargin}
        wrapperClassName="absolute inset-0 min-h-0"
        imageClassName="w-full h-full object-cover"
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
