import { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  icon?: string;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'btn';
  const variantClass =
    variant === 'primary' ? 'btn-primary' :
    variant === 'secondary' ? 'btn-secondary' :
    variant === 'danger' ? 'btn-danger' :
    'btn-ghost';
  const sizeClass = size === 'sm' ? 'btn-sm' : '';

  return (
    <button className={`${base} ${variantClass} ${sizeClass} ${className}`} {...props}>
      {icon && (
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          <i className={`${icon} text-sm`}></i>
        </div>
      )}
      {children}
    </button>
  );
}
