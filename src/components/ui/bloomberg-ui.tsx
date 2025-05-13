import React from "react";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";

// Tableau style Bloomberg
export const BloombergTable = ({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLTableElement>) => {
  const { isBloomberg } = useTheme();
  
  return (
    <table 
      className={cn(
        "w-full border border-border",
        isBloomberg && "bloomberg-table",
        className
      )} 
      {...props}
    >
      {children}
    </table>
  );
};

// En-tête de tableau Bloomberg
export const BloombergHeader = ({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLElement>) => {
  const { isBloomberg } = useTheme();
  
  return (
    <th 
      className={cn(
        "p-2 text-left font-medium border-b border-border",
        isBloomberg && "bloomberg-header",
        className
      )} 
      {...props}
    >
      {children}
    </th>
  );
};

// Cellule de tableau Bloomberg
export const BloombergCell = ({ 
  children, 
  className,
  positive,
  negative,
  ...props 
}: React.HTMLAttributes<HTMLElement> & { 
  positive?: boolean; 
  negative?: boolean; 
}) => {
  const { isBloomberg } = useTheme();
  
  return (
    <td 
      className={cn(
        "p-2 border-b border-border",
        isBloomberg && "bloomberg-cell",
        isBloomberg && positive && "bloomberg-up",
        isBloomberg && negative && "bloomberg-down",
        className
      )} 
      {...props}
    >
      {children}
    </td>
  );
};

// Ligne de tableau Bloomberg
export const BloombergRow = ({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLTableRowElement>) => {
  const { isBloomberg } = useTheme();
  
  return (
    <tr 
      className={cn(
        "border-b border-border",
        isBloomberg && "bloomberg-row",
        className
      )} 
      {...props}
    >
      {children}
    </tr>
  );
};

// Carte style Bloomberg
export const BloombergCard = ({ 
  children, 
  className,
  title,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { title?: string }) => {
  const { isBloomberg } = useTheme();
  
  return (
    <div 
      className={cn(
        "bg-card border border-border rounded-lg overflow-hidden",
        isBloomberg && "rounded-none border-[#444444]",
        className
      )} 
      {...props}
    >
      {title && (
        <div className={cn(
          "px-4 py-3 border-b border-border font-medium",
          isBloomberg && "bg-[#222222] text-[#ff9e00] border-[#444444]"
        )}>
          {title}
        </div>
      )}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

// Formatage style Bloomberg pour les valeurs numériques
export const BloombergValue = ({ 
  value, 
  positive,
  negative,
  currency,
  percentage,
  fixed = 4,
  className
}: { 
  value: number; 
  positive?: boolean; 
  negative?: boolean; 
  currency?: boolean;
  percentage?: boolean;
  fixed?: number;
  className?: string;
}) => {
  const { isBloomberg } = useTheme();
  
  // Déterminer si la valeur est positive ou négative
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  // Formatter la valeur
  let formattedValue = value.toFixed(fixed);
  
  if (currency) {
    formattedValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }
  
  if (percentage) {
    formattedValue = `${(value * 100).toFixed(2)}%`;
  }
  
  return (
    <span 
      className={cn(
        isBloomberg && isPositive && (positive !== false) && "bloomberg-up",
        isBloomberg && isNegative && (negative !== false) && "bloomberg-down",
        className
      )}
    >
      {formattedValue}
    </span>
  );
};

// Label avec valeur style Bloomberg
export const BloombergLabelValue = ({ 
  label, 
  value,
  className,
  ...props 
}: { 
  label: string; 
  value: React.ReactNode;
  className?: string;
}) => {
  const { isBloomberg } = useTheme();
  
  return (
    <div 
      className={cn(
        "flex justify-between items-center p-2 border-b border-border",
        isBloomberg && "border-[#444444] text-[#ff9e00]",
        className
      )} 
      {...props}
    >
      <div className={cn(
        "font-medium",
        isBloomberg && "text-[#cccccc]"
      )}>
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
};

// Interface complète style terminal Bloomberg
export const BloombergTerminal = ({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) => {
  const { isBloomberg } = useTheme();
  
  if (!isBloomberg) {
    return <div className={className} {...props}>{children}</div>;
  }
  
  return (
    <div 
      className={cn(
        "bg-black text-[#ff9e00] font-mono border border-[#444444]",
        className
      )} 
      {...props}
    >
      <div className="bg-[#222222] p-2 border-b border-[#444444]">
        <div className="flex justify-between items-center">
          <span className="text-[#ff9e00] font-bold">FOREX HEDGE</span>
          <span className="text-[#cccccc]">
            {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}; 