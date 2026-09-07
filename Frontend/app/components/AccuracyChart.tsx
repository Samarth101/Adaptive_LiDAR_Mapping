'use client';

import { useMemo, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { DemoData } from '../types/dataset';
import { OBJ_TYPE_COLORS, NEAR_RADIUS, MID_RADIUS, getObjectClass } from '../lib/foveatedGrid';

interface Props { data: DemoData }
interface BinEntry { count: number; totalConf: number }

export default function AccuracyChart({ data }: Props) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    update();
    return () => observer.disconnect();
  }, []);

  const options = useMemo(() => {
    const zones = ['near', 'mid', 'far'] as const;
    const bins: Record<string, Record<string, BinEntry>> = { near: {}, mid: {}, far: {} };

    for (const frame of data.frames) {
      const egoX = frame.vehicle.position[0];
      const egoY = frame.vehicle.position[1];
      for (const obj of frame.detected_objects) {
        const dx = obj.position[0] - egoX;
        const dy = obj.position[1] - egoY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const zone = dist <= NEAR_RADIUS ? 'near' : dist <= MID_RADIUS ? 'mid' : 'far';
        
        if (!bins[zone][obj.type]) {
          bins[zone][obj.type] = { count: 0, totalConf: 0 };
        }
        bins[zone][obj.type].count++;
        bins[zone][obj.type].totalConf += obj.confidence;
      }
    }

    const rawTypes = Array.from(new Set(data.frames.flatMap((f) => f.detected_objects.map((o) => o.type))));
    
    // Sort types so static and dynamic are grouped together nicely in the legend
    const allTypes = rawTypes.sort((a, b) => {
      const clsA = getObjectClass(a);
      const clsB = getObjectClass(b);
      if (clsA !== clsB) return clsA.localeCompare(clsB);
      return a.localeCompare(b);
    });

    const textColorStrong = isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)';
    const textColorMuted = isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    const textColorFaint = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)';
    const lineColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
    const splitLineColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const tooltipBg = isDark ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.9)';

    const series = allTypes.map(type => {
      const objClass = getObjectClass(type);
      const labelPrefix = objClass === 'static' ? '[S]' : objClass === 'dynamic' ? '[D]' : '';
      const formattedLabel = `${labelPrefix} ${type}`.trim();
      const color = OBJ_TYPE_COLORS[type] ?? '#888888';

      const dataPoints = zones.map(zone => {
        const entry = bins[zone][type];
        const avgConf = entry ? (entry.totalConf / entry.count) * 100 : 0;
        return parseFloat(avgConf.toFixed(1));
      });

      return {
        name: formattedLabel,
        type: 'bar',
        barGap: '15%',
        itemStyle: {
          color: color,
          borderRadius: [4, 4, 0, 0] // Rounded on top
        },
        label: {
          show: true,
          position: 'top',
          formatter: (params: any) => params.value > 5 ? `${Math.round(params.value)}%` : '',
          color: textColorStrong,
          fontSize: 9,
          fontFamily: 'system-ui, sans-serif'
        },
        data: dataPoints
      };
    });

    return {
      backgroundColor: 'transparent',
      textStyle: {
        fontFamily: 'system-ui, sans-serif'
      },
      title: {
        text: 'Object Classification Accuracy by Distance',
        left: 'center',
        top: 0,
        textStyle: {
          color: textColorStrong,
          fontSize: 13,
          fontWeight: 500
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: tooltipBg,
        borderColor: lineColor,
        textStyle: { color: textColorStrong, fontSize: 12 },
        valueFormatter: (value: number) => `${value}%`
      },
      legend: {
        bottom: -5,
        type: 'plain', // Wraps to next line instead of scrolling
        itemGap: 16,
        itemWidth: 12,
        itemHeight: 12,
        icon: 'circle',
        textStyle: {
          color: textColorMuted,
          fontSize: 13
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: ['Near (0-10m)', 'Mid (10-40m)', 'Far (40-100m)'],
        axisLabel: {
          color: textColorFaint,
          fontSize: 11,
          margin: 12
        },
        axisLine: {
          lineStyle: {
            color: lineColor
          }
        },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: {
          color: textColorFaint,
          fontSize: 11,
          formatter: '{value}%'
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor,
            type: 'dashed'
          }
        }
      },
      series: series
    };
  }, [data, isDark]);

  return (
    <div className="w-full h-full p-2 relative">
      <ReactECharts 
        option={options} 
        style={{ height: '100%', width: '100%' }} 
        opts={{ renderer: 'svg' }}
      />
    </div>
  );
}
