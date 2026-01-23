// 翻牌统计分析组件 - 优化图表配置和月度分析
import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { IdolAnswer } from '../types';
import { calculateStatistics, sortStatistics, getMonthlyDistribution, getHourlyDistribution } from '../services/statisticsService';
import './StatisticsPanel.css';

interface StatisticsPanelProps {
  answers: IdolAnswer[];
}

export const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ answers }) => {
  const [viewType, setViewType] = useState<'count' | 'cost'>('count');
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');

  const stats = useMemo(() => calculateStatistics(answers), [answers]);

  const sortedData = useMemo(() => {
    return sortStatistics(stats.byIdol, viewType === 'count' ? 'count' : 'cost');
  }, [stats, viewType]);

  const monthlyData = useMemo(() => getMonthlyDistribution(answers), [answers]);

  const hourlyData = useMemo(() => getHourlyDistribution(answers), [answers]);

  // 优化的柱状图配置 - 水晶主题
  const barChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(199, 132, 252, 0.3)',
      borderWidth: 2,
      textStyle: { color: '#5b21b6' },
      extraCssText: 'box-shadow: 0 8px 24px rgba(168, 85, 247, 0.2); border-radius: 12px;',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(199, 132, 252, 0.15)'
        }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: sortedData.slice(0, 15).map(item => item.name),
      axisLabel: {
        rotate: 45,
        interval: 0,
        color: '#7c3aed',
        fontSize: 11
      },
      axisLine: { lineStyle: { color: 'rgba(199, 132, 252, 0.3)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#a78bfa' },
      splitLine: {
        lineStyle: {
          color: 'rgba(199, 132, 252, 0.15)',
          type: 'dashed'
        }
      }
    },
    series: [{
      data: sortedData.slice(0, 15).map(item => viewType === 'count' ? item.count : item.cost),
      type: 'bar',
      barMaxWidth: 40,
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#c084fc' },
            { offset: 1, color: '#7c3aed' }
          ]
        },
        borderRadius: [8, 8, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#f0abfc' },
              { offset: 1, color: '#c084fc' }
            ]
          },
          shadowBlur: 20,
          shadowColor: 'rgba(168, 85, 247, 0.4)'
        }
      },
      animationDelay: (idx: number) => idx * 50
    }],
    animationEasing: 'elasticOut',
    animationDelayUpdate: (idx: number) => idx * 5
  };

  // 优化的饼图配置
  const pieChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(199, 132, 252, 0.3)',
      borderWidth: 2,
      textStyle: { color: '#5b21b6' },
      extraCssText: 'box-shadow: 0 8px 24px rgba(168, 85, 247, 0.2); border-radius: 12px;',
      formatter: '{a} <br/>{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      textStyle: { color: '#7c3aed' },
      icon: 'circle'
    },
    series: [{
      name: viewType === 'count' ? '翻牌数量' : '消费金额',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: {
        borderRadius: 12,
        borderColor: '#fff',
        borderWidth: 3,
        shadowBlur: 10,
        shadowColor: 'rgba(168, 85, 247, 0.3)'
      },
      label: {
        show: true,
        color: '#5b21b6',
        formatter: '{b}\n{d}%'
      },
      emphasis: {
        label: {
          show: true,
          fontSize: 16,
          fontWeight: 'bold',
          color: '#7c3aed'
        },
        itemStyle: {
          shadowBlur: 20,
          shadowColor: 'rgba(168, 85, 247, 0.5)'
        }
      },
      data: sortedData.slice(0, 8).map((item, index) => ({
        name: item.name,
        value: viewType === 'count' ? item.count : item.cost,
        itemStyle: {
          color: [
            '#7c3aed', '#c084fc', '#f0abfc', '#a78bfa',
            '#8b5cf6', '#d8b4fe', '#e9d5ff', '#ddd6fe'
          ][index % 8]
        }
      })),
      animationType: 'scale',
      animationEasing: 'elasticOut',
      animationDelay: (idx: number) => Math.random() * 200
    }]
  };

  // 优化的月度趋势图 - 修复双Y轴问题
  const monthlyChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(199, 132, 252, 0.3)',
      borderWidth: 2,
      textStyle: { color: '#5b21b6' },
      extraCssText: 'box-shadow: 0 8px 24px rgba(168, 85, 247, 0.2); border-radius: 12px;',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: 'rgba(199, 132, 252, 0.5)'
        }
      }
    },
    legend: {
      data: ['翻牌数量', '消费金额'],
      textStyle: { color: '#7c3aed' },
      top: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: monthlyData.labels,
      boundaryGap: false,
      axisLabel: {
        color: '#7c3aed',
        rotate: monthlyData.labels.length > 6 ? 45 : 0
      },
      axisLine: { lineStyle: { color: 'rgba(199, 132, 252, 0.3)' } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '翻牌数量',
        position: 'left',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#7c3aed' },
        splitLine: {
          lineStyle: {
            color: 'rgba(199, 132, 252, 0.15)',
            type: 'dashed'
          }
        }
      },
      {
        type: 'value',
        name: '消费金额(鸡腿)',
        position: 'right',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#a78bfa' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '翻牌数量',
        type: 'line',
        data: monthlyData.counts,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        yAxisIndex: 0,
        itemStyle: {
          color: '#7c3aed',
          borderColor: '#fff',
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#7c3aed' },
              { offset: 1, color: '#c084fc' }
            ]
          },
          shadowColor: 'rgba(168, 85, 247, 0.3)',
          shadowBlur: 10,
          shadowOffsetY: 5
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(124, 58, 237, 0.3)' },
              { offset: 1, color: 'rgba(124, 58, 237, 0.05)' }
            ]
          }
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#f0abfc',
            shadowBlur: 20,
            shadowColor: 'rgba(168, 85, 247, 0.5)'
          }
        }
      },
      {
        name: '消费金额',
        type: 'line',
        data: monthlyData.costs,
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        yAxisIndex: 1,
        itemStyle: {
          color: '#f59e0b',
          borderColor: '#fff',
          borderWidth: 2
        },
        lineStyle: {
          width: 3,
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#fbbf24' },
              { offset: 1, color: '#f59e0b' }
            ]
          },
          shadowColor: 'rgba(251, 191, 36, 0.3)',
          shadowBlur: 10,
          shadowOffsetY: 5
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(251, 191, 36, 0.3)' },
              { offset: 1, color: 'rgba(251, 191, 36, 0.05)' }
            ]
          }
        },
        emphasis: {
          focus: 'series',
          itemStyle: {
            color: '#fcd34d',
            shadowBlur: 20,
            shadowColor: 'rgba(251, 191, 36, 0.5)'
          }
        }
      }
    ],
    animationEasing: 'cubicOut',
    animationDelay: (idx: number) => idx * 100
  };

  // 优化的时段分布图
  const hourlyChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: 'rgba(199, 132, 252, 0.3)',
      borderWidth: 2,
      textStyle: { color: '#5b21b6' },
      extraCssText: 'box-shadow: 0 8px 24px rgba(168, 85, 247, 0.2); border-radius: 12px;',
      axisPointer: {
        type: 'shadow',
        shadowStyle: {
          color: 'rgba(199, 132, 252, 0.15)'
        }
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: hourlyData.labels,
      axisLabel: {
        color: '#7c3aed',
        interval: 2
      },
      axisLine: { lineStyle: { color: 'rgba(199, 132, 252, 0.3)' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#a78bfa' },
      splitLine: {
        lineStyle: {
          color: 'rgba(199, 132, 252, 0.15)',
          type: 'dashed'
        }
      }
    },
    series: [{
      type: 'bar',
      data: hourlyData.counts,
      barMaxWidth: 30,
      itemStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#c084fc' },
            { offset: 1, color: '#7c3aed' }
          ]
        },
        borderRadius: [6, 6, 0, 0]
      },
      emphasis: {
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#f0abfc' },
              { offset: 1, color: '#c084fc' }
            ]
          },
          shadowBlur: 15,
          shadowColor: 'rgba(168, 85, 247, 0.4)'
        }
      },
      animationDelay: (idx: number) => idx * 30
    }],
    animationEasing: 'elasticOut'
  };

  return (
    <div className="statistics-panel crystal-theme">
      {/* 统计概览卡片 */}
      <div className="stats-summary">
        <div className="summary-card crystal-card">
          <div className="card-icon">💬</div>
          <div className="card-content">
            <span className="label">总翻牌数</span>
            <span className="value">{stats.totalCount}</span>
          </div>
        </div>
        <div className="summary-card crystal-card">
          <div className="card-icon">🍗</div>
          <div className="card-content">
            <span className="label">总消费</span>
            <span className="value">{Math.round(stats.totalCost)}</span>
          </div>
        </div>
        <div className="summary-card crystal-card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <span className="label">成员数</span>
            <span className="value">{Object.keys(stats.byIdol).length}</span>
          </div>
        </div>
      </div>

      {/* 视图控制 */}
      <div className="view-controls crystal-controls">
        <div className="control-group">
          <span className="control-label">数据类型：</span>
          <div className="toggle-group crystal-toggle">
            <button
              className={`crystal-btn ${viewType === 'count' ? 'active' : ''}`}
              onClick={() => setViewType('count')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
              按数量
            </button>
            <button
              className={`crystal-btn ${viewType === 'cost' ? 'active' : ''}`}
              onClick={() => setViewType('cost')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
              按消费
            </button>
          </div>
        </div>
        <div className="control-group">
          <span className="control-label">图表类型：</span>
          <div className="toggle-group crystal-toggle">
            <button
              className={`crystal-btn ${chartType === 'bar' ? 'active' : ''}`}
              onClick={() => setChartType('bar')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
              </svg>
              柱状图
            </button>
            <button
              className={`crystal-btn ${chartType === 'pie' ? 'active' : ''}`}
              onClick={() => setChartType('pie')}
            >
              <svg viewBox="0 0 24 24">
                <path d="M11 2v20c-5.04-.22-9-4.35-9-9.65 0-5.3 3.96-9.43 9-9.35zm2 0v11.35c4.15.49 7.5 3.76 7.92 7.9l-7.92.45v-19.7z"/>
              </svg>
              饼图
            </button>
          </div>
        </div>
      </div>

      {/* 成员排行图表 */}
      <div className="chart-section crystal-card">
        <h4 className="chart-title">成员排行 TOP15</h4>
        <ReactECharts
          option={chartType === 'bar' ? barChartOption : pieChartOption}
          style={{ height: chartType === 'pie' ? '450px' : '400px' }}
        />
      </div>

      {/* 月度趋势图表 */}
      <div className="chart-section crystal-card">
        <h4 className="chart-title">月度趋势分析</h4>
        <ReactECharts
          option={monthlyChartOption}
          style={{ height: '350px' }}
        />
      </div>

      {/* 时段分布图表 */}
      <div className="chart-section crystal-card">
        <h4 className="chart-title">翻牌时段分布</h4>
        <ReactECharts
          option={hourlyChartOption}
          style={{ height: '300px' }}
        />
      </div>

      {/* 完整排行表格 */}
      <div className="ranking-table crystal-card">
        <h4 className="chart-title">完整排行榜</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>成员</th>
                <th>翻牌数</th>
                <th>消费金额</th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, index) => (
                <tr key={item.key} className={index < 3 ? `top-${index + 1}` : ''}>
                  <td>
                    {index < 3 ? (
                      <span className="rank-badge rank-{index + 1}">
                        {index + 1}
                      </span>
                    ) : (
                      index + 1
                    )}
                  </td>
                  <td>{item.name}</td>
                  <td>{item.count}</td>
                  <td>🍗{Math.round(item.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
