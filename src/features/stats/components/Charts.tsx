import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { CHART_COLORS } from '../constants';

export function MuscleGroupChart({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) return null;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={68}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: 'var(--bg-surface-3)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                fontSize: 12,
              }}
              formatter={(value) => {
                const numVal = typeof value === 'number' ? value : Number(value);
                return [
                  !isNaN(numVal) && numVal > 0
                    ? `${(numVal / 1000).toFixed(1)}t (${Math.round((numVal / total) * 100)}%)`
                    : `${value}`,
                  'Volumen',
                ];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 max-h-[120px] overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 pr-2">
          {data.map((item, index) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-xs truncate flex-1 text-fg-muted">{item.name}</span>
              <span className="text-xs text-fg-subtle">{(item.value / 1000).toFixed(1)}t</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export type ChartView = 'bar' | 'area';

export function VolumeChart({
  data,
  view,
  onViewChange,
}: {
  data: { week: string; vol: number }[];
  view: ChartView;
  onViewChange: (v: ChartView) => void;
}) {
  const maxVol = Math.max(...data.map((d) => d.vol), 1);

  return (
    <div>
      <div className="flex items-center justify-end mb-3 gap-1">
        {(['bar', 'area'] as ChartView[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className="text-[0.5625rem] px-2 py-1 rounded-pill transition-colors font-medium uppercase tracking-wide"
            style={
              view === v
                ? {
                    backgroundColor: 'var(--interactive-primary)',
                    color: 'var(--interactive-primary-fg)',
                  }
                : { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-tertiary)' }
            }
          >
            {v === 'bar' ? 'Barras' : 'Área'}
          </button>
        ))}
      </div>
      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          {view === 'bar' ? (
            <BarChart data={data} barCategoryGap="35%">
              <defs>
                <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, maxVol * 1.15]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  return [
                    !isNaN(numVal) && numVal > 0 ? `${(numVal / 1000).toFixed(1)}t` : `${value}`,
                    'Volumen',
                  ];
                }}
              />
              <Bar dataKey="vol" fill="url(#volumeGradient)" radius={[5, 5, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--interactive-primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--interactive-primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="week"
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={[0, maxVol * 1.15]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface-3)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => {
                  const numVal = typeof value === 'number' ? value : Number(value);
                  return [
                    !isNaN(numVal) && numVal > 0 ? `${(numVal / 1000).toFixed(1)}t` : `${value}`,
                    'Volumen',
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="vol"
                stroke="var(--interactive-primary)"
                strokeWidth={2.5}
                fill="url(#areaGradient)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExerciseComparisonChart({
  data,
  nameA,
  nameB,
}: {
  data: { date: string; a: number | null; b: number | null }[];
  nameA: string;
  nameB: string;
}) {
  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-sm text-fg-subtle">
        <p>Necesitas al menos 2 sesiones en común para comparar.</p>
      </div>
    );
  }
  const colorA = CHART_COLORS[0];
  const colorB = CHART_COLORS[2];
  return (
    <div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="date"
              tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
            />
            <YAxis hide domain={['dataMin - 5', 'dataMax + 10']} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-surface-3)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                fontSize: 12,
              }}
              labelStyle={{ color: 'var(--text-secondary)' }}
              labelFormatter={(v) => format(parseISO(v as string), 'dd MMM', { locale: es })}
              formatter={(value, key) => {
                const numVal = typeof value === 'number' ? value : Number(value);
                return [
                  `${!isNaN(numVal) ? numVal.toFixed(1) : value} kg`,
                  key === 'a' ? nameA : nameB,
                ];
              }}
            />
            <Line
              type="monotone"
              dataKey="a"
              stroke={colorA}
              strokeWidth={2.5}
              dot={{ r: 3, fill: colorA }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="b"
              stroke={colorB}
              strokeWidth={2.5}
              dot={{ r: 3, fill: colorB }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorA }} />
          <span className="text-xs truncate text-fg-muted">{nameA}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colorB }} />
          <span className="text-xs truncate text-fg-muted">{nameB}</span>
        </div>
      </div>
    </div>
  );
}

export function ProgressionChart({
  data,
  metric,
  exerciseName,
}: {
  data: { date: string; value: number; isPR: boolean }[];
  metric: '1rm' | 'maxWeight' | 'volume';
  exerciseName: string;
}) {
  if (data.length < 2) {
    return (
      <div className="text-center py-8 text-sm text-fg-subtle">
        <svg
          viewBox="0 0 24 24"
          className="w-8 h-8 mx-auto mb-2 opacity-40"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4v6a6 6 0 0 0 12 0V4" />
          <line x1="4" y1="20" x2="20" y2="20" />
        </svg>
        <p>Necesitas al menos 2 sesiones de {exerciseName}</p>
      </div>
    );
  }

  const metricLabel = metric === '1rm' ? '1RM' : metric === 'maxWeight' ? 'Peso máx' : 'Volumen';

  return (
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => format(parseISO(v), 'dd/MM')}
          />
          <YAxis hide domain={['dataMin - 5', 'dataMax + 10']} />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-surface-3)',
              border: '1px solid var(--border-default)',
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--text-secondary)' }}
            labelFormatter={(v) => format(parseISO(v as string), 'dd MMM', { locale: es })}
            formatter={(value) => {
              const numVal = typeof value === 'number' ? value : Number(value);
              return [`${!isNaN(numVal) ? numVal.toFixed(1) : value} kg`, metricLabel];
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--interactive-primary)"
            strokeWidth={2.5}
            dot={(props: {
              cx?: number;
              cy?: number;
              payload?: { isPR: boolean; value: number };
            }) => {
              if (!props.cx || !props.cy || !props.payload) return null;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={props.payload.isPR ? 5 : 3}
                  fill={props.payload.isPR ? 'var(--warning)' : 'var(--interactive-primary)'}
                  stroke="var(--bg-surface)"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6, fill: 'var(--interactive-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
