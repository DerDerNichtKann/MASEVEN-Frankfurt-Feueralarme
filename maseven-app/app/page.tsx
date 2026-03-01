"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, addDoc, updateDoc, doc, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { Flame, Clock, Activity, CalendarDays, BarChart3, PlusCircle, Filter, Calculator } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Home() {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [mounted, setMounted] = useState(false);
  const [timeframe, setTimeframe] = useState("period1");

  useEffect(() => {
    setMounted(true);
    const q = query(collection(db, "alarms"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const alarmData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      }));
      setAlarms(alarmData);
    });
    return () => unsubscribe();
  }, []);

  const addOrUpdateAlarm = async (alarmTime: Date) => {
    setIsSubmitting(true);
    try {
      const oneHour = 60 * 60 * 1000;
      const timeMinusOne = new Date(alarmTime.getTime() - oneHour);
      const timePlusOne = new Date(alarmTime.getTime() + oneHour);

      const q = query(
        collection(db, "alarms"),
        where("timestamp", ">=", timeMinusOne),
        where("timestamp", "<=", timePlusOne)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        const currentConfirmations = existingDoc.data().confirmations || 1;
        await updateDoc(doc(db, "alarms", existingDoc.id), {
          confirmations: currentConfirmations + 1
        });
        alert("🚨 Alarm existiert bereits! Er wurde als Bestätigung gewertet.");
      } else {
        await addDoc(collection(db, "alarms"), {
          timestamp: alarmTime,
          confirmations: 1
        });
        alert("🔥 Neuer Feueralarm eingetragen!");
      }
    } catch (error) {
      console.error("Fehler:", error);
      alert("Fehler beim Speichern. Firestore-Regeln im Testmodus?");
    }
    setIsSubmitting(false);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDate || !manualTime) return;
    const alarmDate = new Date(`${manualDate}T${manualTime}`);
    await addOrUpdateAlarm(alarmDate);
    setManualDate("");
    setManualTime("");
  };

  const getFilteredAlarms = () => {
    const now = new Date();
    return alarms.filter(a => {
      const d = a.timestamp;
      if (timeframe === "day") return d.toDateString() === now.toDateString();
      if (timeframe === "week") return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) && d <= now;
      if (timeframe === "month") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (timeframe === "period1") {
        const start = new Date("2026-02-22T00:00:00");
        const end = new Date("2026-03-27T23:59:59");
        return d >= start && d <= end;
      }
      return true;
    });
  };

  const filteredAlarms = getFilteredAlarms();

  const getMostFrequentHour = () => {
    if (filteredAlarms.length === 0) return "-";
    const hoursCount: Record<number, number> = {};
    filteredAlarms.forEach(a => {
      const hour = a.timestamp.getHours();
      hoursCount[hour] = (hoursCount[hour] || 0) + 1;
    });
    const maxHour = Object.keys(hoursCount).reduce((a, b) => hoursCount[a as any] > hoursCount[b as any] ? a : b);
    return `${maxHour}:00 Uhr`;
  };

  const getAverageStats = () => {
    if (filteredAlarms.length === 0) return { avg: "0.0", projection: 0 };
    
    const now = new Date();
    
    const getDaysBetween = (d1: Date, d2: Date) => {
      const date1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
      const date2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
      return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };

    let passedDays = 1;
    let totalDays = 1;

    if (timeframe === "day") {
      passedDays = 1; totalDays = 1;
    } else if (timeframe === "week") {
      passedDays = 7; totalDays = 7;
    } else if (timeframe === "month") {
      passedDays = now.getDate();
      totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    } else if (timeframe === "period1") {
      const start = new Date(2026, 1, 22);
      const end = new Date(2026, 2, 27);
      const effectiveEnd = now < end ? now : end;
      
      passedDays = getDaysBetween(start, effectiveEnd);
      totalDays = getDaysBetween(start, end);
    } else if (timeframe === "all") {
      const earliest = alarms.reduce((min, a) => a.timestamp < min ? a.timestamp : min, alarms[0].timestamp);
      passedDays = getDaysBetween(earliest, now);
      totalDays = passedDays;
    }

    const avg = filteredAlarms.length / passedDays;
    const projection = Math.round(avg * totalDays);

    return { 
      avg: avg.toFixed(1),
      projection: timeframe === "all" ? "-" : projection 
    };
  };

  const stats = getAverageStats();

  const getChartData = () => {
    const map: Record<string, { date: string; timestampForSort: number; count: number; times: string[] }> = {};
    const sorted = [...filteredAlarms].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    sorted.forEach(alarm => {
      const dateStr = alarm.timestamp.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const exactTime = alarm.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      
      if (!map[dateStr]) {
        map[dateStr] = { date: dateStr, timestampForSort: alarm.timestamp.getTime(), count: 0, times: [] };
      }
      map[dateStr].count += 1;
      map[dateStr].times.push(`${exactTime} Uhr`);
    });

    return Object.values(map).sort((a, b) => a.timestampForSort - b.timestampForSort);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-neutral-900 border border-neutral-700 p-4 rounded-xl shadow-xl z-50">
          <p className="text-neutral-400 text-sm mb-2 font-medium">{label}</p>
          <p className="text-red-500 font-bold text-xl mb-2">
            {data.count} {data.count === 1 ? 'Alarm' : 'Alarme'}
          </p>
          <div className="text-sm text-neutral-300">
            <span className="text-neutral-500 block mb-1">Exakte Zeiten:</span>
            <ul className="list-disc pl-4 space-y-1">
              {data.times.map((time: string, i: number) => (
                <li key={i} className="font-mono">{time}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    return null;
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-neutral-200 p-4 md:p-8 font-sans selection:bg-red-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <header className="flex flex-col items-center justify-center space-y-3 pt-4 pb-2">
          <div className="bg-red-500/10 p-4 rounded-full border border-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
            <Flame className="text-red-500 w-12 h-12" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            MASEVEN <span className="text-red-500">Tracker</span>
          </h1>
        </header>

        <section className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-red-400"></div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-white relative z-10">
            <PlusCircle className="w-7 h-7 text-red-500" />
            Neuen Alarm erfassen
          </h2>
          <form onSubmit={handleManualSubmit} className="flex flex-col md:flex-row gap-5 items-end relative z-10">
            <div className="flex-1 w-full relative z-20">
              <label className="block text-sm font-medium text-neutral-400 mb-2">Datum auswählen</label>
              <input 
                type="date" 
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-2xl p-4 text-white text-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all cursor-pointer"
                required 
              />
            </div>
            <div className="flex-1 w-full relative z-20">
              <label className="block text-sm font-medium text-neutral-400 mb-2">Genaue Uhrzeit</label>
              <input 
                type="time" 
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-2xl p-4 text-white text-lg focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all cursor-pointer"
                required 
              />
            </div>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white font-bold text-lg py-4 px-8 rounded-2xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] disabled:opacity-50 relative z-20"
            >
              {isSubmitting ? "Lädt..." : "Eintragen"}
            </button>
          </form>
        </section>

        <section className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl p-4 flex flex-col md:flex-row items-center gap-4">
          <div className="flex items-center gap-2 text-neutral-400 px-4">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Zeitraum:</span>
          </div>
          <div className="flex flex-wrap gap-2 w-full">
            <button onClick={() => setTimeframe("period1")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${timeframe === "period1" ? "bg-red-600 text-white shadow-lg" : "bg-neutral-950 text-neutral-400 hover:bg-neutral-800"}`}>
              22.02 - 27.03.26
            </button>
            <button onClick={() => setTimeframe("day")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${timeframe === "day" ? "bg-red-600 text-white shadow-lg" : "bg-neutral-950 text-neutral-400 hover:bg-neutral-800"}`}>
              Heute
            </button>
            <button onClick={() => setTimeframe("week")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${timeframe === "week" ? "bg-red-600 text-white shadow-lg" : "bg-neutral-950 text-neutral-400 hover:bg-neutral-800"}`}>
              Letzte 7 Tage
            </button>
            <button onClick={() => setTimeframe("month")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${timeframe === "month" ? "bg-red-600 text-white shadow-lg" : "bg-neutral-950 text-neutral-400 hover:bg-neutral-800"}`}>
              Dieser Monat
            </button>
            <button onClick={() => setTimeframe("all")} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${timeframe === "all" ? "bg-red-600 text-white shadow-lg" : "bg-neutral-950 text-neutral-400 hover:bg-neutral-800"}`}>
              Alle Zeiten
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-3xl flex flex-col justify-center items-center relative overflow-hidden">
            <BarChart3 className="absolute top-4 right-4 text-neutral-800/50 w-16 h-16 rotate-12" />
            <div className="text-neutral-400 text-sm font-medium mb-2 z-10">Bisherige Alarme</div>
            <div className="text-6xl font-black text-white z-10">{filteredAlarms.length}</div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-3xl flex flex-col justify-center items-center relative overflow-hidden">
            <Calculator className="absolute top-4 right-4 text-neutral-800/50 w-16 h-16 -rotate-12" />
            <div className="text-neutral-400 text-sm font-medium mb-2 z-10 text-center">Ø pro Tag</div>
            <div className="text-6xl font-black text-red-500 z-10">{stats.avg}</div>
            {timeframe !== "all" && timeframe !== "day" && (
              <div className="mt-3 text-xs text-neutral-500 font-medium bg-neutral-950/50 px-3 py-1.5 rounded-full z-10 border border-neutral-800">
                Hochrechnung: <span className="text-white">{stats.projection} gesamt</span>
              </div>
            )}
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-3xl flex flex-col justify-center items-center relative overflow-hidden">
            <Clock className="absolute top-4 right-4 text-neutral-800/50 w-16 h-16 rotate-12" />
            <div className="text-neutral-400 text-sm font-medium mb-2 z-10">Häufigste Uhrzeit</div>
            <div className="text-5xl font-black text-white z-10 mt-2">{getMostFrequentHour()}</div>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-3xl">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-red-500" />
              Alarm-Verlauf
            </h2>
            <div className="h-64 w-full">
              {getChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis dataKey="date" stroke="#525252" fontSize={12} tickMargin={10} />
                    <YAxis stroke="#525252" fontSize={12} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: '#171717'}} />
                    <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-500 border-2 border-dashed border-neutral-800 rounded-2xl">
                  Keine Alarme im gewählten Zeitraum.
                </div>
              )}
            </div>
          </div>

          <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 rounded-3xl p-6">
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
              <Clock className="w-5 h-5 text-red-500" />
              Exakte Zeiten der letzten Alarme
            </h2>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredAlarms.slice(0, 15).map(alarm => (
                <div key={alarm.id} className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-neutral-950/50 hover:bg-neutral-800/50 rounded-2xl border border-neutral-800/50 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                      <CalendarDays className="w-4 h-4 text-red-500" />
                    </div>
                    <div>
                      <div className="text-white font-semibold text-sm">
                        {alarm.timestamp.toLocaleDateString('de-DE')}
                      </div>
                      <div className="text-neutral-400 text-xs flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {alarm.timestamp.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'})} Uhr
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
                    <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold">Meldungen:</span>
                    <span className="text-red-400 font-bold text-sm">{alarm.confirmations}x</span>
                  </div>
                </div>
              ))}
              {filteredAlarms.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-neutral-500 text-sm">Nichts zu sehen.</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}