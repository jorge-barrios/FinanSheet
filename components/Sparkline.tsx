import React from 'react';

interface SparklineProps {
    data: number[];
    width?: number;
    height?: number;
    color?: string;
    fillColor?: string;
    showTrend?: boolean;
    className?: string;
}

const Sparkline: React.FC<SparklineProps> = ({
    data,
    width = 120,
    height = 32,
    color = '#10b981', // emerald-500
    fillColor = '#10b98120', // emerald-500 with opacity
    showTrend = true,
    className = ''
}) => {
    if (!data || data.length === 0) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
                <span className="text-xs text-slate-400 dark:text-slate-500">Sin datos</span>
            </div>
        );
    }

    // Filtrar valores válidos (no cero, no null, no undefined)
    const validData = data.filter(value => value != null && value !== 0);
    
    if (validData.length === 0) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
                <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
            </div>
        );
    }

    const minValue = Math.min(...validData);
    const maxValue = Math.max(...validData);
    const range = maxValue - minValue;

    // Si todos los valores son iguales, mostrar línea plana
    if (range === 0) {
        return (
            <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
                <svg width={width} height={height} className="overflow-visible">
                    <line
                        x1={0}
                        y1={height / 2}
                        x2={width}
                        y2={height / 2}
                        stroke={color}
                        strokeWidth="2"
                        opacity="0.7"
                    />
                    <circle
                        cx={width - 4}
                        cy={height / 2}
                        r="2"
                        fill={color}
                    />
                </svg>
            </div>
        );
    }

    // Calcular puntos para el sparkline
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * (width - 8) + 4; // Padding de 4px en cada lado
        const y = value === 0 || value == null 
            ? height / 2 // Línea media para valores cero
            : height - 4 - ((value - minValue) / range) * (height - 8); // Padding de 4px arriba y abajo
        return { x, y, value };
    });

    // Crear path para la línea
    const pathData = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    // Crear path para el área de relleno
    const areaData = `${pathData} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

    // Calcular tendencia
    const firstValue = validData[0];
    const lastValue = validData[validData.length - 1];
    const trendDirection = lastValue > firstValue ? 'up' : lastValue < firstValue ? 'down' : 'flat';
    const trendPercentage = firstValue !== 0 ? ((lastValue - firstValue) / Math.abs(firstValue)) * 100 : 0;

    // Colores basados en tendencia
    const getTrendColor = () => {
        if (trendDirection === 'up') return '#10b981'; // emerald-500
        if (trendDirection === 'down') return '#ef4444'; // red-500
        return '#6b7280'; // gray-500
    };

    const trendColor = getTrendColor();
    const trendFillColor = `${trendColor}20`;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <svg width={width} height={height} className="overflow-visible">
                {/* Área de relleno */}
                <path
                    d={areaData}
                    fill={showTrend ? trendFillColor : fillColor}
                    opacity="0.3"
                />
                
                {/* Línea principal */}
                <path
                    d={pathData}
                    fill="none"
                    stroke={showTrend ? trendColor : color}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                
                {/* Punto final destacado */}
                <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r="3"
                    fill={showTrend ? trendColor : color}
                    className="drop-shadow-sm"
                />
                
                {/* Punto inicial (más sutil) */}
                <circle
                    cx={points[0].x}
                    cy={points[0].y}
                    r="2"
                    fill={showTrend ? trendColor : color}
                    opacity="0.6"
                />
            </svg>
            
            {/* Indicador de tendencia */}
            {showTrend && Math.abs(trendPercentage) > 1 && (
                <div className="flex flex-col items-center justify-center min-w-[40px]">
                    <div className={`text-xs font-semibold ${
                        trendDirection === 'up' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : trendDirection === 'down'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                    }`}>
                        {trendDirection === 'up' && '↗'}
                        {trendDirection === 'down' && '↘'}
                        {trendDirection === 'flat' && '→'}
                    </div>
                    <div className={`text-[10px] font-medium ${
                        trendDirection === 'up' 
                            ? 'text-emerald-600 dark:text-emerald-400' 
                            : trendDirection === 'down'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-gray-500 dark:text-gray-400'
                    }`}>
                        {Math.abs(trendPercentage).toFixed(0)}%
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sparkline;
