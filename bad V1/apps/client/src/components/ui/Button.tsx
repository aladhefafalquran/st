import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

const variants = {
  primary: 'bg-[var(--st-accent)] hover:bg-[var(--st-accent-hover)] text-white',
  secondary: 'bg-white/10 hover:bg-white/20 text-white',
  ghost: 'bg-transparent hover:bg-white/10 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
