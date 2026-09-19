'use client';

import React, { useState } from 'react';
import { Database, Binary, Server, ArrowRight, Zap, Eye, MonitorPlay } from 'lucide-react';

export default function ArchitectureDiagram() {
  const [showHex, setShowHex] = useState(false);

  return (
    <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl relative">
      
      {/* Background grid */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      <div className="p-8 relative z-10 flex flex-col h-full">
        
        <div className="mb-8">
          <h3 className="text-xl font-bold text-slate-100">Live System Architecture</h3>
          <p className="text-slate-400 text-sm max-w-2xl mt-2">
            A major bottleneck in robotics is transmitting bulky point cloud JSON objects to visualizers. 
            LumiGRID solves this by packing semantic cells into a strict C-struct binary payload, cutting network latency.
          </p>
        </div>

        {/* Pipeline Diagram */}
        <div className="flex-1 flex items-center justify-center gap-4">
          
          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-slate-900 border-2 border-slate-700 rounded-xl flex items-center justify-center text-slate-400 shadow-lg">
              <Eye className="w-10 h-10" />
            </div>
            <span className="text-xs font-bold text-slate-300 text-center">LiDAR<br/>Sensor</span>
          </div>

          <ArrowRight className="w-6 h-6 text-slate-600" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-slate-900 border-2 border-sky-800 rounded-xl flex flex-col items-center justify-center text-sky-400 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-sky-500/10" />
              <Zap className="w-8 h-8 mb-1 relative z-10" />
              <span className="text-[10px] font-bold relative z-10">PointNet++</span>
            </div>
            <span className="text-xs font-bold text-slate-300 text-center">Semantic<br/>AI</span>
          </div>

          <ArrowRight className="w-6 h-6 text-slate-600" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-slate-900 border-2 border-emerald-800 rounded-xl flex flex-col items-center justify-center text-emerald-400 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-emerald-500/10" />
              <Database className="w-8 h-8 mb-1 relative z-10" />
              <span className="text-[10px] font-bold relative z-10">Adaptive</span>
            </div>
            <span className="text-xs font-bold text-slate-300 text-center">Foveated<br/>Mapper</span>
          </div>

          <ArrowRight className="w-6 h-6 text-slate-600" />

          {/* Interactive Binary Node */}
          <div className="flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setShowHex(true)}>
            <div className="w-32 h-32 bg-slate-900 border-2 border-cyan-500 rounded-xl flex flex-col items-center justify-center text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:bg-cyan-950 transition-colors">
              <Binary className="w-10 h-10 mb-2" />
              <span className="text-xs font-bold">Binary Frame</span>
              <span className="text-[10px] text-cyan-500 mt-1">Click to inspect</span>
            </div>
            <span className="text-xs font-bold text-slate-300 text-center">FastAPI<br/>WebSocket</span>
          </div>

          <ArrowRight className="w-6 h-6 text-slate-600" />

          <div className="flex flex-col items-center gap-2">
            <div className="w-24 h-24 bg-slate-900 border-2 border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-300 shadow-lg">
              <MonitorPlay className="w-10 h-10 mb-1" />
              <span className="text-[10px] font-bold">deck.gl</span>
            </div>
            <span className="text-xs font-bold text-slate-300 text-center">Next.js<br/>Frontend</span>
          </div>

        </div>

      </div>

      {/* Hex Viewer Modal Overlay */}
      {showHex && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-8" onClick={() => setShowHex(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center p-4 border-b border-slate-800">
              <h4 className="text-cyan-400 font-bold flex items-center gap-2"><Binary className="w-5 h-5"/> Frame Binary Structure</h4>
              <button className="text-slate-500 hover:text-slate-300" onClick={() => setShowHex(false)}>✕</button>
            </div>

            <div className="p-6 overflow-y-auto flex gap-6">
              
              <div className="w-1/3 space-y-4">
                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                  <h5 className="text-slate-300 font-bold text-xs mb-2">HEADER (52 Bytes)</h5>
                  <ul className="text-xs font-mono text-slate-500 space-y-1">
                    <li><span className="text-cyan-400">uint32</span> magic (0x10010110)</li>
                    <li><span className="text-cyan-400">uint32</span> version (1)</li>
                    <li><span className="text-cyan-400">uint32</span> frame_id</li>
                    <li><span className="text-cyan-400">float64</span> timestamp</li>
                    <li><span className="text-cyan-400">uint32</span> cell_count</li>
                    <li><span className="text-cyan-400">uint32</span> obj_count</li>
                    <li><span className="text-cyan-400">uint32</span> num_points</li>
                    <li><span className="text-cyan-400">float32</span> inference_fps</li>
                  </ul>
                </div>
                <div className="bg-slate-950 p-4 rounded border border-slate-800">
                  <h5 className="text-slate-300 font-bold text-xs mb-2">PAYLOAD (variable)</h5>
                  <ul className="text-xs font-mono text-slate-500 space-y-1">
                    <li>Array[cell_count]:</li>
                    <li><span className="text-emerald-400">float32</span> x, y, res</li>
                    <li><span className="text-emerald-400">uint16</span>  semantic_id</li>
                    <li><span className="text-emerald-400">float32</span> elevation</li>
                  </ul>
                </div>
              </div>

              <div className="flex-1 bg-slate-950 p-4 rounded border border-slate-800 overflow-hidden font-mono text-xs leading-relaxed">
                 <h5 className="text-slate-400 mb-2">Simulated Byte Stream</h5>
                 <div className="text-slate-600">
                   <span className="text-cyan-400">10 01 01 10 01 00 00 00 17 00 00 00</span> 00 00 00 00 <br/>
                   <span className="text-cyan-400">A8 47 E6 41</span> <span className="text-sky-400">12 AF 00 00</span> 00 00 00 00 00 00 00 00 <br/>
                   <span className="text-emerald-400">CD CC 8C 40 CD CC 0C 40 00 00 80 3E 01 00 00 00</span> <br/>
                   <span className="text-emerald-400">00 00 00 00 CD CC 8C 40 9A 99 19 40 00 00 80 3E</span> <br/>
                   02 00 00 00 00 00 00 00 CD CC 8C 40 66 66 26 40 <br/>
                   00 00 80 3E 01 00 00 00 00 00 00 00 CD CC 8C 40 <br/>
                   ...
                 </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
