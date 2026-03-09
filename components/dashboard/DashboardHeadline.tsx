import React from 'react';

interface DashboardHeadlineProps {
  primary: string;
  accent?: string;
  secondary?: string;
}

export const DashboardHeadline: React.FC<DashboardHeadlineProps> = ({
  primary,
  accent,
  secondary
}) => {
  return (
    <div className="mb-6">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
        <span className="font-sans">{primary}</span>
        {accent && (
          <span className="
            font-serif italic
            bg-gradient-to-r from-teal-600 via-cyan-500 to-emerald-500
            dark:from-teal-400 dark:via-cyan-400 dark:to-emerald-400
            bg-clip-text text-transparent
          ">
            {' '}{accent}
          </span>
        )}
      </h1>
      {secondary && (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          {secondary}
        </p>
      )}
    </div>
  );
};
