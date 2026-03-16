'use client';

interface BadgeProps {
  variant?: 'info' | 'success' | 'warning' | 'error' | 'neutral';
  children: React.ReactNode;
  title?: string;
}

export function Badge({ variant = 'neutral', children, title }: BadgeProps) {
  const variants = {
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    success: 'bg-green-500/10 text-green-400 border-green-500/20',
    warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    error: 'bg-red-500/10 text-red-400 border-red-500/20',
    neutral: 'bg-geo-border text-geo-text-muted border-geo-border',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${variants[variant]}`} title={title}>
      {children}
    </span>
  );
}
