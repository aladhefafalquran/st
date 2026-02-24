interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} border-2 border-white/20 border-t-[var(--st-accent)] rounded-full animate-spin ${className}`}
    />
  );
}
