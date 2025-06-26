import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ChartSectionProps {
  id?: string;
  props: {
    kind   : 'line' | 'bar' | 'pie' | 'area' | 'radar';
    data   : Array<Record<string, number | string>>;   // ← string OU number
    xKey   : string;
    yKeys  : string[];
    stacked?: boolean;
    legend ?: boolean;
  };
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export function ChartSection({ id, props }: ChartSectionProps) {
  const { kind, data, xKey, yKeys, stacked = false, legend = true } = props;

  const renderChart = () => {
    switch (kind) {
      case 'line':
        return (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            {legend && <Legend />}
            {yKeys.map((key, index) => (
              <Line 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={COLORS[index % COLORS.length]} 
                strokeWidth={2}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            {legend && <Legend />}
            {yKeys.map((key, index) => (
              <Bar 
                key={key} 
                dataKey={key} 
                fill={COLORS[index % COLORS.length]}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            {legend && <Legend />}
            {yKeys.map((key, index) => (
              <Area 
                key={key} 
                type="monotone" 
                dataKey={key} 
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </AreaChart>
        );

      case 'pie':
        { const pieData = data.map((item, index) => ({
          name: item[xKey],
          value: yKeys.reduce((sum, key) => sum + (typeof item[key] === 'string' ? parseFloat(item[key] as string) || 0 : (item[key] as number || 0)), 0),
          fill: COLORS[index % COLORS.length]
        }));
        
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              outerRadius={120}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip />
            {legend && <Legend />}
          </PieChart>
        ); }

      case 'radar':
        return (
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey={xKey} />
            <PolarRadiusAxis />
            <Tooltip />
            {legend && <Legend />}
            {yKeys.map((key, index) => (
              <Radar 
                key={key} 
                name={key} 
                dataKey={key} 
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </RadarChart>
        );

      default:
        return null;
    }
  };

  return (
    <section id={id} className="py-16 bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-card rounded-lg border p-6">
            <ResponsiveContainer width="100%" height={400}>
              {renderChart()}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}