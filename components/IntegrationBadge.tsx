import React from 'react';
import { LucideIcon } from 'lucide-react';

interface IntegrationBadgeProps {
  name: string;
  description: string;
  icon: LucideIcon;
  isActive: boolean;
  colorClass: string;
}

export const IntegrationBadge: React.FC<IntegrationBadgeProps> = ({ 
  name, 
  description, 
  icon: Icon, 
  isActive, 
  colorClass 
}) => {
  return (
    <div className={`
      relative overflow-hidden p-4 rounded-xl border transition-all duration-300
      ${isActive 
        ? `bg-slate-800 border-${colorClass}-500 shadow-[0_0_15px_rgba(var(--${colorClass}-rgb),0.3)]` 
        : 'bg-slate-900 border-slate-700 opacity-70'}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${isActive ? `bg-${colorClass}-500/20 text-${colorClass}-400` : 'bg-slate-800 text-slate-500'}`}>
            <Icon size={24} />
          </div>
          <div>
            <h3 className={`font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>{name}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[150px]">{description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className={`
            px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
            ${isActive 
              ? `bg-${colorClass}-500/20 text-${colorClass}-300 border border-${colorClass}-500/30` 
              : 'bg-slate-800 text-slate-500 border border-slate-700'}
          `}>
            {isActive ? 'Active' : 'Standby'}
          </span>
        </div>
      </div>
      {/* Animated Connector Line */}
      {isActive && (
        <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-${colorClass}-500 to-transparent opacity-50 animate-pulse`} />
      )}
    </div>
  );
};