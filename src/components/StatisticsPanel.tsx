// 翻牌统计分析组件
import { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { IdolAnswer } from '../types';
import { calculateStatistics, sortStatistics, getMonthlyDistribution, getHourlyDistribution } from '../services/statisticsService';

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

  // 柱状图配置
  const barChartOption = {
    tooltip: { trigger: 'axis' },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%', // 增加底部空间给斜置的标签
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: sortedData.slice(0, 15).map(item => item.name),
      axisLabel: { 
        rotate: 45,
        interval: 0 // 强制显示所有标签
      },
    },
    yAxis: { type: 'value' },
    series: [{
      data: sortedData.slice(0, 15).map(item => viewType === 'count' ? item.count : item.cost),
      type: 'bar',
      color: '#ff6b6b',
      barMaxWidth: 50, // 限制柱子最大宽度
    }],
  };

  // 饼图配置
  const pieChartOption = {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: '60%',
      data: sortedData.slice(0, 10).map(item => ({
        name: item.name,
        value: viewType === 'count' ? item.count : item.cost,
      })),
    }],
  };

  // 月度趋势图
  const monthlyChartOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: monthlyData.labels },
    yAxis: { type: 'value' },
    series: [
      {
        name: '翻牌数量',
        type: 'line',
        data: monthlyData.counts,
        smooth: true,
        areaStyle: { opacity: 0.3 },
        color: '#ff6b6b',
      },
      {
        name: '消费金额',
        type: 'line',
        data: monthlyData.costs,
        smooth: true,
        yAxisIndex: 1,
        color: '#4ecdc4',
      },
    ],
  };

  // 时段分布图
  const hourlyChartOption = {
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: hourlyData.labels },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: hourlyData.counts,
      color: '#45b7d1',
    }],
  };

  return (
    <div className="statistics-panel">
      <div className="stats-summary">
        <div className="summary-item">
          <span className="label">总翻牌数</span>
          <span className="value">{stats.totalCount}</span>
        </div>
        <div className="summary-item">
          <span className="label">总消费</span>
          <span className="value">￥{stats.totalCost.toFixed(1)}</span>
        </div>
        <div className="summary-item">
          <span className="label">成员数</span>
          <span className="value">{Object.keys(stats.byIdol).length}</span>
        </div>
      </div>

      <div className="view-controls">
        <div className="toggle-group">
          <button
            className={viewType === 'count' ? 'active' : ''}
            onClick={() => setViewType('count')}
          >
            按数量
          </button>
          <button
            className={viewType === 'cost' ? 'active' : ''}
            onClick={() => setViewType('cost')}
          >
            按消费
          </button>
        </div>
        <div className="toggle-group">
          <button
            className={chartType === 'bar' ? 'active' : ''}
            onClick={() => setChartType('bar')}
          >
            柱状图
          </button>
          <button
            className={chartType === 'pie' ? 'active' : ''}
            onClick={() => setChartType('pie')}
          >
            饼图
          </button>
        </div>
      </div>

      <div className="chart-section">
        <h4>成员排行 TOP15</h4>
        <ReactECharts
          option={chartType === 'bar' ? barChartOption : pieChartOption}
          style={{ height: '400px' }}
        />
      </div>

      <div className="chart-section">
        <h4>月度趋势</h4>
        <ReactECharts
          option={monthlyChartOption}
          style={{ height: '300px' }}
        />
      </div>

      <div className="chart-section">
        <h4>翻牌时段分布</h4>
        <ReactECharts
          option={hourlyChartOption}
          style={{ height: '300px' }}
        />
      </div>

      <div className="ranking-table">
        <h4>完整排行</h4>
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
              <tr key={item.key}>
                <td>{index + 1}</td>
                <td>{item.name}</td>
                <td>{item.count}</td>
                <td>🍗{item.cost.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
