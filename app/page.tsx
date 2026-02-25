"use client";
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "../firebase"; // เช็ค path ให้ตรงกับไฟล์ firebase.js ของคุณ
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { Thermometer, Droplets, Wind, AlertCircle, CheckCircle2 } from "lucide-react";

export default function Dashboard() {
  const [currentData, setCurrentData] = useState({
    temperature: 0,
    humidity: 0,
    dust: 0,
    led_status: false,
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const roomRef = ref(db, "room1");
    
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCurrentData(data);
        
        setChartData(prevData => {
          const now = new Date();
          const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
          
          const newDataPoint = {
            time: timeString,
            Temperature: Number(data.temperature).toFixed(1),
            Humidity: Number(data.humidity).toFixed(1),
            Dust: Math.round(data.dust)
          };

          const newHistory = [...prevData, newDataPoint];
          return newHistory.slice(-15); 
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // --- ฟังก์ชันกำหนดสีตามระดับค่าฝุ่น ---
  const getDustColor = (dustValue: number) => {
    if (dustValue <= 37.5) {
      return { text: "text-emerald-500", bg: "bg-emerald-50", icon: "text-emerald-500" }; // สีเขียว/ฟ้า
    } else if (dustValue <= 50) {
      return { text: "text-yellow-500", bg: "bg-yellow-50", icon: "text-yellow-500" };   // สีเหลือง
    } else if (dustValue <= 90) {
      return { text: "text-orange-500", bg: "bg-orange-50", icon: "text-orange-500" };   // สีส้ม
    } else {
      return { text: "text-red-500", bg: "bg-red-50", icon: "text-red-500" };            // สีแดง (มากกว่า 90)
    }
  };

  const dustStyle = getDustColor(currentData.dust);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12 font-sans text-slate-800">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Room Environment</h1>
            <p className="text-slate-500 text-sm mt-1">Live Monitoring Dashboard</p>
          </div>
          
          {/* Status Badge */}
          <div className="mt-4 md:mt-0">
            {currentData.led_status ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full border border-red-100 font-medium animate-pulse">
                <AlertCircle size={20} />
                <span>ค่าเกินมาตรฐาน</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 font-medium">
                <CheckCircle2 size={20} />
                <span>สภาวะปกติ</span>
              </div>
            )}
          </div>
        </div>

        {/* Info Cards Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* อุณหภูมิ */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-orange-50 text-orange-500 rounded-2xl">
              <Thermometer size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">อุณหภูมิ</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">{Number(currentData.temperature).toFixed(1)}</span>
                <span className="text-slate-400 font-medium">°C</span>
              </div>
            </div>
          </div>

          {/* ความชื้น */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-500 rounded-2xl">
              <Droplets size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">ความชื้น</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-800">{Number(currentData.humidity).toFixed(1)}</span>
                <span className="text-slate-400 font-medium">%</span>
              </div>
            </div>
          </div>

          {/* ปริมาณฝุ่น (ปรับเปลี่ยนสีอัตโนมัติ) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 transition-colors duration-300">
            <div className={`p-4 rounded-2xl transition-colors duration-300 ${dustStyle.bg} ${dustStyle.icon}`}>
              <Wind size={32} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">ปริมาณฝุ่น (PM)</p>
              <div className="flex items-baseline gap-1">
                {/* เปลี่ยนสีตัวเลขตามเกณฑ์ */}
                <span className={`text-3xl font-bold transition-colors duration-300 ${dustStyle.text}`}>
                  {Math.round(currentData.dust)}
                </span>
                <span className="text-slate-400 font-medium">µg/m³</span>
              </div>
            </div>
          </div>
        </div>

        {/* Graph Section */}
        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold mb-6 text-slate-800">แนวโน้มสภาพอากาศ (Real-time)</h2>
          <div className="h-80 w-full text-sm">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" stroke="#94a3b8" tick={{fill: '#94a3b8'}} tickMargin={10} />
                <YAxis stroke="#94a3b8" tick={{fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }}/>
                <Line type="monotone" dataKey="Temperature" name="อุณหภูมิ (°C)" stroke="#f97316" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Humidity" name="ความชื้น (%)" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
                <Line type="monotone" dataKey="Dust" name="ฝุ่น (µg/m³)" stroke="#64748b" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}