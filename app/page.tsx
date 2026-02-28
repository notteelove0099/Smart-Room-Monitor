"use client";
import { useEffect, useState, useCallback } from "react";
import { ref, onValue, set } from "firebase/database";
import { db } from "../firebase";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend, Area, AreaChart 
} from "recharts";
import { 
  Thermometer, Droplets, Wind, AlertCircle, CheckCircle2, 
  Lightbulb, Volume2, VolumeX, Sliders, RefreshCw, Sparkles,
  TrendingUp, Activity, Gauge
} from "lucide-react";

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="backdrop-blur-md bg-white/90 dark:bg-slate-800/90 p-4 rounded-2xl shadow-xl border border-slate-200/50">
        <p className="text-xs font-semibold text-slate-500 mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm font-medium text-slate-700">
                {entry.name}:
              </span>
              <span className="text-sm font-bold text-slate-900">
                {entry.value}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  {entry.name.includes('อุณหภูมิ') ? '°C' : 
                   entry.name.includes('ความชื้น') ? '%' : 'µg/m³'}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Status Badge Component
const StatusBadge = ({ status, simulation }: { status: boolean; simulation: boolean }) => {
  const badges = [
    {
      condition: simulation,
      bg: "bg-gradient-to-r from-purple-500/10 to-pink-500/10",
      border: "border-purple-200",
      text: "text-purple-700",
      icon: <Sparkles className="w-4 h-4 animate-pulse" />,
      label: "Simulation Mode"
    },
    {
      condition: !simulation && status,
      bg: "bg-gradient-to-r from-red-500/10 to-orange-500/10",
      border: "border-red-200",
      text: "text-red-700",
      icon: <AlertCircle className="w-4 h-4 animate-bounce" />,
      label: "ค่าเกินมาตรฐาน"
    },
    {
      condition: !simulation && !status,
      bg: "bg-gradient-to-r from-emerald-500/10 to-teal-500/10",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: <CheckCircle2 className="w-4 h-4" />,
      label: "สภาวะปกติ"
    }
  ];

  const active = badges.find(b => b.condition) || badges[2];

  return (
    <div className={`
      flex items-center gap-2 px-4 py-2.5 rounded-full 
      border ${active.bg} ${active.border} ${active.text}
      font-medium text-sm backdrop-blur-sm
      transition-all duration-300 hover:scale-105
    `}>
      {active.icon}
      <span className="hidden sm:inline">{active.label}</span>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ 
  icon: Icon, 
  title, 
  value, 
  unit, 
  colorScheme,
  trend 
}: { 
  icon: any; 
  title: string; 
  value: string; 
  unit: string; 
  colorScheme: string;
  trend?: 'up' | 'down' | 'stable';
}) => {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    orange: { bg: "bg-gradient-to-br from-orange-400/20 to-amber-400/20", text: "text-orange-600", icon: "text-orange-500" },
    blue: { bg: "bg-gradient-to-br from-blue-400/20 to-cyan-400/20", text: "text-blue-600", icon: "text-blue-500" },
    emerald: { bg: "bg-gradient-to-br from-emerald-400/20 to-teal-400/20", text: "text-emerald-600", icon: "text-emerald-500" },
    yellow: { bg: "bg-gradient-to-br from-yellow-400/20 to-amber-400/20", text: "text-yellow-600", icon: "text-yellow-500" },
    red: { bg: "bg-gradient-to-br from-red-400/20 to-rose-400/20", text: "text-red-600", icon: "text-red-500" },
  };

  const colors = colorMap[colorScheme] || colorMap.orange;

  return (
    <div className="
      group relative bg-white dark:bg-slate-800 
      p-6 rounded-3xl shadow-sm hover:shadow-xl 
      border border-slate-100 dark:border-slate-700
      transition-all duration-500 hover:-translate-y-1
      overflow-hidden
    ">
      <div className={`
        absolute -top-10 -right-10 w-24 h-24 rounded-full 
        ${colors.bg} blur-2xl opacity-60 
        group-hover:opacity-80 transition-opacity duration-500
      `} />
      
      <div className="relative flex items-center gap-4">
        <div className={`
          p-4 rounded-2xl ${colors.bg} ${colors.icon}
          transition-transform duration-300 group-hover:scale-110
          shadow-inner
        `}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
              {value}
            </span>
            <span className="text-slate-400 font-medium text-lg">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Toggle Switch Component
const AnimatedToggle = ({ 
  enabled, 
  onToggle, 
  color = "indigo",
}: { 
  enabled: boolean; 
  onToggle: () => void; 
  color?: string;
}) => {
  const colorMap: Record<string, { on: string; off: string; ring: string }> = {
    amber: { on: "bg-amber-500", off: "bg-slate-300", ring: "ring-amber-400" },
    indigo: { on: "bg-indigo-500", off: "bg-slate-300", ring: "ring-indigo-400" },
    purple: { on: "bg-purple-500", off: "bg-slate-300", ring: "ring-purple-400" },
  };
  
  const colors = colorMap[color] || colorMap.indigo;

  return (
    <button
      onClick={onToggle}
      className={`
        relative inline-flex h-9 w-16 items-center rounded-full
        transition-all duration-300 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.ring}
        ${enabled ? colors.on : colors.off}
        hover:scale-105 active:scale-95
      `}
    >
      <span
        className={`
          inline-block h-7 w-7 transform rounded-full bg-white 
          shadow-lg transition-all duration-300 ease-in-out
          ${enabled ? 'translate-x-8' : 'translate-x-1'}
        `}
      />
    </button>
  );
};

// Control Card Component
const ControlCard = ({ 
  title, 
  description, 
  enabled, 
  onToggle, 
  icon: Icon,
  colorScheme,
  bgTint 
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  icon: any;
  colorScheme: string;
  bgTint: string;
}) => {
  return (
    <div className={`
      flex flex-col justify-between p-6 
      border border-slate-100 dark:border-slate-700 
      rounded-2xl transition-all duration-300
      hover:shadow-lg hover:-translate-y-0.5
      ${bgTint} backdrop-blur-sm
    `}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`
            p-4 rounded-2xl transition-all duration-300
            ${enabled 
              ? `bg-gradient-to-br ${colorScheme} shadow-lg scale-105` 
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
            }
          `}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white">
              {title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {description}
            </p>
          </div>
        </div>
        
        <div className={`
          w-2.5 h-2.5 rounded-full transition-all duration-300
          ${enabled ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-slate-300'}
        `} />
      </div>
      
      <div className="mt-6 flex justify-end">
        <AnimatedToggle 
          enabled={enabled} 
          onToggle={onToggle} 
          color={colorScheme.includes('amber') ? 'amber' : colorScheme.includes('purple') ? 'purple' : 'indigo'}
        />
      </div>
    </div>
  );
};

export default function Dashboard() {
  const [currentData, setCurrentData] = useState({
    temperature: 0,
    humidity: 0,
    dust: 0,
    led_status: false,
    manual_led: false,    
    manual_buzzer: false, 
    use_simulation: false
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const getDustStatus = useCallback((dustValue: number) => {
    const levels = [
      { max: 37.5, color: "emerald", label: "ดีมาก" },
      { max: 50, color: "yellow", label: "ปานกลาง" },
      { max: 90, color: "orange", label: "เริ่มมีผล" },
      { max: Infinity, color: "red", label: "อันตราย" },
    ];
    return levels.find(l => dustValue <= l.max) || levels[3];
  }, []);

  const dustStatus = getDustStatus(currentData.dust);

  useEffect(() => {
    try {
      const roomRef = ref(db, "room1");
      
      const unsubscribe = onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setIsLoading(false);
          setCurrentData(prev => ({ ...prev, ...data }));
          setLastUpdate(new Date());
          
          setChartData(prevData => {
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const newDataPoint = {
              time: timeString,
              Temperature: Number(data.temperature).toFixed(1),
              Humidity: Number(data.humidity).toFixed(1),
              Dust: Math.round(data.dust),
            };

            const newHistory = [...prevData, newDataPoint];
            return newHistory.slice(-20); 
          });
        }
      });

      const timer = setTimeout(() => setIsLoading(false), 2000);
      return () => {
        unsubscribe();
        clearTimeout(timer);
      };
    } catch (error) {
      console.error("Firebase error:", error);
      setIsLoading(false);
    }
  }, []);

  const toggleLed = () => set(ref(db, 'room1/manual_led'), !currentData.manual_led);
  const toggleBuzzer = () => set(ref(db, 'room1/manual_buzzer'), !currentData.manual_buzzer);
  const toggleSimulation = () => set(ref(db, 'room1/use_simulation'), !currentData.use_simulation);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6 md:p-12">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="h-24 bg-slate-200 rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200 rounded-3xl" />)}
          </div>
          <div className="h-64 bg-slate-200 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="
      min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 
      p-4 md:p-8 font-sans text-slate-800
    ">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* Header */}
        <header className="
          flex flex-col md:flex-row justify-between items-start md:items-center 
          bg-white/80 backdrop-blur-xl 
          p-6 md:p-8 rounded-3xl shadow-sm 
          border border-slate-200/50
        ">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Room Environment
              </h1>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live Monitoring Dashboard
              </p>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
            <StatusBadge status={currentData.led_status} simulation={currentData.use_simulation} />
            
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-full text-xs text-slate-500">
              <RefreshCw className="w-3 h-3" />
              <span>อัปเดต: {lastUpdate.toLocaleTimeString('th-TH')}</span>
            </div>
          </div>
        </header>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <MetricCard
            icon={Thermometer}
            title="อุณหภูมิ"
            value={Number(currentData.temperature).toFixed(1)}
            unit="°C"
            colorScheme="orange"
          />
          <MetricCard
            icon={Droplets}
            title="ความชื้นสัมพัทธ์"
            value={Number(currentData.humidity).toFixed(1)}
            unit="%"
            colorScheme="blue"
          />
          <MetricCard
            icon={Wind}
            title="ปริมาณฝุ่น PM2.5"
            value={Math.round(currentData.dust).toString()}
            unit="µg/m³"
            colorScheme={dustStatus.color}
          />
        </div>

        {/* Dust Quality Banner */}
        <div className={`
          p-4 md:p-6 rounded-2xl border backdrop-blur-sm
          ${dustStatus.color === 'emerald' ? 'bg-emerald-50/80 border-emerald-200' :
            dustStatus.color === 'yellow' ? 'bg-yellow-50/80 border-yellow-200' :
            dustStatus.color === 'orange' ? 'bg-orange-50/80 border-orange-200' :
            'bg-red-50/80 border-red-200'}
        `}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className={`
                w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
                ${dustStatus.color === 'emerald' ? 'bg-emerald-100' :
                  dustStatus.color === 'yellow' ? 'bg-yellow-100' :
                  dustStatus.color === 'orange' ? 'bg-orange-100' :
                  'bg-red-100'}
              `}>
                {dustStatus.color === 'emerald' && '🌿'}
                {dustStatus.color === 'yellow' && '⚠️'}
                {dustStatus.color === 'orange' && '🟠'}
                {dustStatus.color === 'red' && '🔴'}
              </div>
              <div>
                <p className="font-semibold text-slate-800">
                  คุณภาพอากาศ: <span className={`text-${dustStatus.color}-600`}>{dustStatus.label}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Control Panel */}
        <section className="
          bg-white/80 backdrop-blur-xl 
          p-6 md:p-8 rounded-3xl shadow-sm 
          border border-slate-200/50
        ">
          <div className="flex items-center gap-3 mb-6">
            <Sliders className="w-5 h-5 text-indigo-500" />
            <h2 className="text-lg font-bold text-slate-800">
              แผงควบคุมอุปกรณ์
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <ControlCard
              title="ไฟเตือน LED"
              description="ทดสอบระบบแจ้งเตือนด้วยแสง"
              enabled={currentData.manual_led}
              onToggle={toggleLed}
              icon={Lightbulb}
              colorScheme="from-amber-400/30 to-orange-400/30"
              bgTint="bg-amber-50/50"
            />
            <ControlCard
              title="เสียงเตือน Buzzer"
              description="ทดสอบระบบแจ้งเตือนด้วยเสียง"
              enabled={currentData.manual_buzzer}
              onToggle={toggleBuzzer}
              icon={Volume2}
              colorScheme="from-indigo-400/30 to-purple-400/30"
              bgTint="bg-indigo-50/50"
            />
            <ControlCard
              title="โหมดจำลองข้อมูล"
              description="ใช้ Potentiometer จำลองค่าฝุ่น"
              enabled={currentData.use_simulation}
              onToggle={toggleSimulation}
              icon={Sliders}
              colorScheme="from-purple-400/30 to-pink-400/30"
              bgTint="bg-purple-50/50"
            />
          </div>
        </section>

        {/* Chart Section */}
        <section className="
          bg-white/80 backdrop-blur-xl 
          p-6 md:p-8 rounded-3xl shadow-sm 
          border border-slate-200/50
        ">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-800">
              แนวโน้มข้อมูลแบบ Real-time
            </h2>
          </div>
          
          <div className="h-72 md:h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="humidGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="dustGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  tick={{fill: '#94a3b8', fontSize: 11}} 
                  tickMargin={8}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{fill: '#94a3b8', fontSize: 11}} 
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  iconType="circle" 
                  wrapperStyle={{ paddingTop: '15px', fontSize: '12px' }}
                  iconSize={8}
                />
                <Area 
                  type="monotone" 
                  dataKey="Temperature" 
                  name="อุณหภูมิ (°C)" 
                  stroke="#f97316" 
                  strokeWidth={2.5} 
                  fill="url(#tempGradient)"
                  dot={{r: 3, strokeWidth: 2, fill: '#fff', stroke: '#f97316'}} 
                  activeDot={{ r: 6 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Humidity" 
                  name="ความชื้น (%)" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5} 
                  fill="url(#humidGradient)"
                  dot={{r: 3, strokeWidth: 2, fill: '#fff', stroke: '#3b82f6'}}
                  activeDot={{ r: 6 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Dust" 
                  name="ฝุ่น (µg/m³)" 
                  stroke="#64748b" 
                  strokeWidth={2.5} 
                  fill="url(#dustGradient)"
                  dot={{r: 3, strokeWidth: 2, fill: '#fff', stroke: '#64748b'}}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

      </div>
    </div>
  );
}
