import React from 'react';
import { LucideIcon } from 'lucide-react';

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-surface-raised border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm ${className}`}>
    {children}
  </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent',
  size?: 'sm' | 'md' | 'lg'
}> = 
  ({ children, className = '', variant = 'primary', size = 'md', ...props }) => {
  const base = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };

  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700",
    ghost: "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400",
    accent: "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
  };
  
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">{label}</label>}
    <input 
      className={`flex h-10 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all ${className}`}
      {...props}
    />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, options: {value: string, label: string}[] }> = ({ label, options, className = '', ...props }) => (
  <div className="flex flex-col gap-1.5 w-full">
    {label && <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider ml-1">{label}</label>}
    <div className="relative">
      <select 
        className={`flex h-10 w-full appearance-none rounded-md border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 ${className}`}
        {...props}
      >
        {options.map(opt => <option key={opt.value} value={opt.value} className="bg-white dark:bg-zinc-900">{opt.label}</option>)}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
      </div>
    </div>
  </div>
);

export const StatCard: React.FC<{ title: string, value: string, subValue?: string, icon: LucideIcon, color?: string }> = ({ title, value, subValue, icon: Icon, color = "text-zinc-900 dark:text-white" }) => (
  <Card className="flex flex-col gap-4 relative overflow-hidden group hover:border-accent/30 transition-colors">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest">{title}</p>
        <h3 className={`text-2xl font-light mt-2 ${color}`}>{value}</h3>
        {subValue && <p className="text-xs text-zinc-400 mt-1">{subValue}</p>}
      </div>
      <div className="p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-full group-hover:scale-110 transition-transform">
        <Icon size={20} className="text-zinc-400 group-hover:text-accent transition-colors" />
      </div>
    </div>
  </Card>
);

export const Badge: React.FC<{ children: React.ReactNode, variant?: 'success' | 'warning' | 'info' | 'default' }> = ({ children, variant = 'default' }) => {
    const styles = {
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800",
        default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[variant]}`}>
            {children}
        </span>
    )
}