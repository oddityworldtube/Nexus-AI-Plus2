
import React, { useMemo } from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    TooltipProps,
    Cell
} from 'recharts';
import { VideoData } from '../../types';
import { BarChart3 } from 'lucide-react';

interface PerformanceChartProps {
    videos: VideoData[];
}

// --- Custom Tooltip Component (Modern & Dark Mode Ready) ---
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-xl rounded-xl p-3 text-right min-w-[150px]">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 font-mono">العنوان</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white mb-2 line-clamp-2 leading-snug">
                    {data.fullTitle}
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 text-base">
                        {new Intl.NumberFormat('en-US').format(payload[0].value as number)}
                    </span>
                    <span className="text-xs text-gray-500">مشاهدة</span>
                </div>
            </div>
        );
    }
    return null;
};

const PerformanceChart: React.FC<PerformanceChartProps> = ({ videos }) => {
    // 1. Data Processing (Memoized for performance)
    const chartData = useMemo(() => {
        // Sort by viewCount (descending) to show top performers, then take top 10
        return [...videos]
            .sort((a, b) => Number(b.viewCount) - Number(a.viewCount))
            .slice(0, 10)
            .map(v => ({
                name: v.title.length > 15 ? v.title.substring(0, 15) + '...' : v.title,
                views: Number(v.viewCount),
                fullTitle: v.title
            }));
    }, [videos]);

    // 2. Empty State Handling
    if (!videos || videos.length === 0) {
        return (
            <div className="h-80 w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <BarChart3 className="text-gray-300 dark:text-slate-600 mb-2" size={32} />
                <p className="text-sm text-gray-400 dark:text-gray-500">لا توجد بيانات كافية للعرض</p>
            </div>
        );
    }

    // 3. Main Chart Render
    return (
        // Fix: Explicit style width/height ensures DOM element has dimension before Recharts measures it.
        <div className="h-80 w-full relative" dir="ltr" style={{ width: '100%', height: 320 }}>
            {/* Fix: minWidth={0} prevents the -1 warning during initial layout calculation */}
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100}>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    {/* Definitions for Gradients */}
                    <defs>
                        <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.9}/>
                            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.6}/>
                        </linearGradient>
                        <linearGradient id="colorViewsHover" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={1}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                        </linearGradient>
                    </defs>

                    <CartesianGrid 
                        strokeDasharray="3 3" 
                        vertical={false} 
                        strokeOpacity={0.1} // Use opacity for Dark Mode compatibility
                        stroke="currentColor" // Inherits text color (works great in dark mode)
                        className="text-gray-600 dark:text-gray-400"
                    />
                    
                    <XAxis 
                        dataKey="name" 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} // slate-400
                        axisLine={false} 
                        tickLine={false}
                        interval={0}
                        tickMargin={10}
                    />
                    
                    <YAxis 
                        tickFormatter={(value) => new Intl.NumberFormat('en-US', { notation: "compact" }).format(value)} 
                        tick={{ fontSize: 10, fill: '#94a3b8' }} // slate-400
                        axisLine={false}
                        tickLine={false}
                    />
                    
                    <Tooltip 
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }} // Subtle highlight on hover
                    />
                    
                    <Bar 
                        dataKey="views" 
                        fill="url(#colorViews)" // Use the Gradient
                        radius={[6, 6, 2, 2]} 
                        barSize={32}
                        animationDuration={1500}
                    >
                         {/* Optional: Different color for top video */}
                         {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? "url(#colorViewsHover)" : "url(#colorViews)"} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PerformanceChart;
