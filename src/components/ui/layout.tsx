import React from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme-provider";

// Section container for better organization
export const Section = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isBloomberg } = useTheme();
  
  return (
    <div
      className={cn(
        "py-6",
        isBloomberg && "border-b border-[#444444]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Glass container with blur effect
export const GlassContainer = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isBloomberg } = useTheme();
  
  return (
    <div
      className={cn(
        "rounded-lg p-6",
        !isBloomberg && "glass-effect",
        isBloomberg && "bg-black border border-[#444444]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Card with hover effect
export const HoverCard = ({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div 
      className={cn("bg-card rounded-xl p-6 card-hover", className)} 
      {...props}
    >
      {children}
    </div>
  );
};

// Heading with optional badge
interface HeadingProps {
  children: React.ReactNode;
  badge?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
}

export const Heading = ({
  children,
  badge,
  level = 2,
  className,
  ...props
}: HeadingProps) => {
  const { isBloomberg } = useTheme();
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  
  return (
    <div className="flex items-center gap-2 mb-4">
      <Tag 
        className={cn(
          "font-medium tracking-tight",
          level === 1 && "text-3xl md:text-4xl",
          level === 2 && "text-2xl md:text-3xl",
          level === 3 && "text-xl md:text-2xl",
          level === 4 && "text-lg md:text-xl",
          level === 5 && "text-base md:text-lg",
          level === 6 && "text-sm md:text-base",
          isBloomberg && "text-[#ff9e00]",
          className
        )} 
      >
        {children}
      </Tag>
      
      {badge && (
        <span className="px-2 py-0.5 bg-secondary text-secondary-foreground text-xs rounded-full">
          {badge}
        </span>
      )}
    </div>
  );
};

// Simple grid layout
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: number;
  gap?: number;
}

export const Grid = ({
  children,
  cols = 2,
  gap = 4,
  className,
  ...props
}: GridProps) => {
  return (
    <div 
      className={cn(
        "grid",
        `grid-cols-1 md:grid-cols-${cols}`,
        `gap-${gap}`,
        className
      )} 
      {...props}
    >
      {children}
    </div>
  );
};

// Value display component
export const ValueDisplay = ({ 
  value, 
  prefix = "", 
  suffix = "", 
  currency = false, 
  percentage = false, 
  colored = true, 
  positive = true,
  negative = true,
  className,
  fixed = 4,
  label,
  highlight
}: { 
  value: number | string; 
  prefix?: string; 
  suffix?: string; 
  currency?: boolean; 
  percentage?: boolean;
  colored?: boolean;
  positive?: boolean;
  negative?: boolean;
  className?: string;
  fixed?: number;
  label?: string;
  highlight?: boolean;
}) => {
  const { isBloomberg } = useTheme();
  
  // Si value est une chaîne, l'afficher directement
  if (typeof value === 'string') {
    return (
      <div className={className}>
        {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
        <p className={isBloomberg ? "text-[#ff9e00]" : ""}>
          {prefix}{value}{suffix}
        </p>
      </div>
    );
  }
  
  // Sinon, traiter comme avant pour les nombres
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  let formattedValue;
  
  if (currency) {
    formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } else if (percentage) {
    formattedValue = `${(value * 100).toFixed(2)}%`;
  } else if (highlight) {
    formattedValue = value.toFixed(4);
  } else {
    formattedValue = value.toFixed(fixed);
  }
  
  if (!label) {
    return (
      <span 
        className={cn(
          // Couleurs standard
          !isBloomberg && colored && isPositive && positive && "text-green-500",
          !isBloomberg && colored && isNegative && negative && "text-red-500",
          
          // Couleurs Bloomberg
          isBloomberg && colored && isPositive && positive && "bloomberg-up",
          isBloomberg && colored && isNegative && negative && "bloomberg-down",
          isBloomberg && (!isPositive && !isNegative) && "bloomberg-neutral",
          
          className
        )}
      >
        {prefix}{formattedValue}{suffix}
      </span>
    );
  }
  
  return (
    <div 
      className={cn(
        "p-3 rounded-lg",
        highlight ? "bg-primary/10" : "bg-card", 
        !isBloomberg && isPositive && "text-green-500",
        !isBloomberg && isNegative && "text-red-500",
        isBloomberg && isPositive && "bloomberg-up",
        isBloomberg && isNegative && "bloomberg-down",
        isBloomberg && (!isPositive && !isNegative) && "bloomberg-neutral",
        className
      )} 
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn("font-medium", highlight && "text-primary")}>
        {formattedValue}{suffix && <span className="text-sm font-normal ml-1">{suffix}</span>}
      </p>
    </div>
  );
};
