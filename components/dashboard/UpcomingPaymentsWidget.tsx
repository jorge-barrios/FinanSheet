import React, { useMemo } from 'react';

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  category: string;
  urgency: 'overdue' | 'today' | 'thisWeek' | 'thisMonth';
  installment?: { current: number; total: number };
}

interface UpcomingPaymentsWidgetProps {
  payments: UpcomingPayment[];
  formatCurrency: (value: number) => string;
  onPaymentClick?: (payment: UpcomingPayment) => void;
}

export const UpcomingPaymentsWidget: React.FC<UpcomingPaymentsWidgetProps> = ({
  payments,
  formatCurrency,
  onPaymentClick
}) => {
  const groupedPayments = useMemo(() => {
    const groups = {
      overdue: [] as UpcomingPayment[],
      today: [] as UpcomingPayment[],
      thisWeek: [] as UpcomingPayment[],
      thisMonth: [] as UpcomingPayment[],
    };

    payments.forEach(p => {
      groups[p.urgency].push(p);
    });

    return groups;
  }, [payments]);

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);

  const urgencyConfig = {
    overdue: {
      label: 'Vencidos',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      color: 'text-red-500 dark:text-red-400',
      dotColor: 'bg-red-500',
      borderColor: 'border-l-red-500',
      bgHover: 'hover:bg-red-50 dark:hover:bg-red-500/10',
    },
    today: {
      label: 'Hoy',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-amber-500 dark:text-amber-400',
      dotColor: 'bg-amber-500',
      borderColor: 'border-l-amber-500',
      bgHover: 'hover:bg-amber-50 dark:hover:bg-amber-500/10',
    },
    thisWeek: {
      label: 'Esta semana',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-blue-500 dark:text-blue-400',
      dotColor: 'bg-blue-500',
      borderColor: 'border-l-blue-500',
      bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-500/10',
    },
    thisMonth: {
      label: 'Este mes',
      icon: (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      color: 'text-slate-500 dark:text-slate-400',
      dotColor: 'bg-slate-400',
      borderColor: 'border-l-slate-400',
      bgHover: 'hover:bg-slate-50 dark:hover:bg-slate-800',
    },
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="bg-white dark:bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-200 dark:border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                Pagos por Vencer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {payments.length} pendientes
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatCurrency(totalAmount)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment Groups */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-80 overflow-y-auto">
        {(Object.keys(groupedPayments) as Array<keyof typeof groupedPayments>).map(urgency => {
          const group = groupedPayments[urgency];
          if (group.length === 0) return null;

          const config = urgencyConfig[urgency as keyof typeof urgencyConfig];

          return (
            <div key={urgency} className="py-2">
              {/* Group Header */}
              <div className={`flex items-center gap-2 px-4 py-1.5 ${config.color}`}>
                {config.icon}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {config.label}
                </span>
                <span className="text-xs opacity-60">({group.length})</span>
              </div>

              {/* Group Items */}
              {group.map((payment, idx) => (
                <div
                  key={payment.id}
                  onClick={() => onPaymentClick?.(payment)}
                  className={`
                    relative flex items-center justify-between
                    px-4 py-3 ml-3 border-l-2
                    cursor-pointer transition-all duration-200
                    ${config.borderColor} ${config.bgHover}
                  `}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Timeline dot */}
                  <div className={`
                    absolute left-[-5px] top-1/2 -translate-y-1/2
                    w-2 h-2 rounded-full ${config.dotColor}
                    ${urgency === 'overdue' ? 'animate-pulse' : ''}
                  `} />

                  <div className="flex-1 min-w-0 pl-3">
                    <p className="font-medium text-sm text-slate-900 dark:text-white truncate">
                      {payment.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(payment.dueDate)}
                      </span>
                      {payment.installment && (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          Cuota {payment.installment.current}/{payment.installment.total}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="font-semibold text-sm text-slate-900 dark:text-white tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}

        {payments.length === 0 && (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ¡Todo al día!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
