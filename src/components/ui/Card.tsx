'use client';

import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  hoverable?: boolean;
}

export function Card({ active, hoverable, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-geo-surface border rounded-xl p-4
        ${active ? 'border-geo-accent' : 'border-geo-border'}
        ${hoverable ? 'hover:border-geo-border-hover cursor-pointer transition-colors' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
