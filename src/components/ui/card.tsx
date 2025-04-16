import React, { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'glass';
  isHoverable?: boolean;
  isClickable?: boolean;
  noPadding?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ 
    children, 
    className = '', 
    variant = 'default', 
    isHoverable = false,
    isClickable = false,
    noPadding = false,
    ...props 
  }, ref) => {
    // Base styles
    const baseStyles = 'rounded-lg shadow-sm overflow-hidden transition-all duration-200';
    
    // Variant styles
    const variantStyles = {
      default: 'bg-white dark:bg-gray-800',
      outline: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
      glass: 'bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50',
    };
    
    // Hover effect
    const hoverStyles = isHoverable 
      ? 'hover:shadow-md hover:translate-y-[-2px]' 
      : '';
    
    // Click effect
    const clickStyles = isClickable 
      ? 'cursor-pointer active:scale-[0.98]' 
      : '';
    
    // Padding
    const paddingStyles = noPadding ? '' : 'p-4';
    
    // Combine all styles
    const cardStyles = `${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${clickStyles} ${paddingStyles} ${className}`;
    
    return (
      <div ref={ref} className={cardStyles} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = ({ 
  children, 
  className = '',
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-4 border-b border-gray-200 dark:border-gray-700 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle = ({ 
  children, 
  className = '',
  ...props 
}: React.HTMLAttributes<HTMLHeadingElement>) => {
  return (
    <h3 className={`text-lg font-semibold ${className}`} {...props}>
      {children}
    </h3>
  );
};

export const CardDescription = ({ 
  children, 
  className = '',
  ...props 
}: React.HTMLAttributes<HTMLParagraphElement>) => {
  return (
    <p className={`mt-1 text-sm text-gray-500 dark:text-gray-400 ${className}`} {...props}>
      {children}
    </p>
  );
};

export const CardContent = ({ 
  children, 
  className = '',
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardFooter = ({ 
  children, 
  className = '',
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={`p-4 border-t border-gray-200 dark:border-gray-700 ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card; 