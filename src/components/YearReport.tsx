// 年报统计组件
import { useState, useEffect, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { YearReportData } from '../types';
import { getYearReport } from '../services/pocket48Api';

interface YearReportProps {
  token: string;
}

export const YearReport: React.FC<YearReportProps> = ({ token }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<YearReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!token) return;
      
      setLoading(true);
      try {
        const data = await getYearReport(token, year);
        if (isMounted) {
          setReportData(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [token, year]);

  // 直播弹幕时段分布图
  const liveHourlyOption = reportData?.live ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      name: '时段',
    },
    yAxis: { type: 'value', name: '弹幕数' },
    series: [{
      type: 'bar',
      data: reportData.live.danmakuHourly,
      color: '#ff6b6b',
    }],
  } : null;

  // 直播弹幕月度分布图
  const liveMonthlyOption = reportData?.live ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    },
    yAxis: { type: 'value', name: '弹幕数' },
    series: [{
      type: 'bar',
      data: reportData.live.danmakuMonthly,
      color: '#4ecdc4',
    }],
  } : null;

  // 房间留言月度分布图
  const roomMonthlyOption = reportData?.room ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    },
    yAxis: { type: 'value', name: '留言数' },
    series: [{
      type: 'bar',
      data: reportData.room.messageMonthly,
      color: '#45b7d1',
    }],
  } : null;

  // 房间消息时段分布图
  const roomHourlyOption = reportData?.room ? {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      name: '时段',
    },
    yAxis: { type: 'value', name: '消息数' },
    series: [{
      type: 'bar',
      data: reportData.room.messageHourly,
      color: '#f9ca24',
    }],
  } : null;

  // 礼物类型饼图
  const giftTypeOption = reportData?.gift ? {
    tooltip: { trigger: 'item' },
    series: [{
      type: 'pie',
      radius: '50%',
      data: reportData.gift.giftTypes.slice(0, 8).map(g => ({
        name: g.type,
        value: g.count,
      })),
    }],
  } : null;

  if (loading) {
    return <div className="year-report loading">加载中...</div>;
  }

  if (!reportData) {
    return (
      <div className="year-report empty">
        <p>暂无可用数据，请先登录账号</p>
        <div className="year-selector">
          <label>选择年份：</label>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="year-report">
      <div className="report-header">
        <h2>{year}个人口袋年报</h2>
        <div className="year-selector">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-nav">
        {['overview', 'live', 'room', 'answer', 'gift'].map(section => (
          <button
            key={section}
            className={activeSection === section ? 'active' : ''}
            onClick={() => setActiveSection(section)}
          >
            {getSectionName(section)}
          </button>
        ))}
      </div>

      {/* 概览 */}
      {activeSection === 'overview' && (
        <div className="section-content overview">
          <div className="overview-cards">
            <div className="card">
              <span className="value">{reportData.overview.totalDays}</span>
              <span className="label">活跃天数</span>
            </div>
            <div className="card">
              <span className="value">{reportData.overview.totalMessages}</span>
              <span className="label">发送消息</span>
            </div>
            <div className="card">
              <span className="value">{reportData.overview.totalChars}</span>
              <span className="label">累计字数</span>
            </div>
            <div className="card">
              <span className="value">{reportData.overview.idolsReplied}</span>
              <span className="label">回复成员</span>
            </div>
          </div>
        </div>
      )}

      {/* 直播 */}
      {activeSection === 'live' && reportData.live && (
        <div className="section-content live">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="value">{reportData.live.watchCount}</span>
              <span className="label">观看场次</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.live.watchDays}</span>
              <span className="label">观看天数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.live.danmakuCount}</span>
              <span className="label">弹幕次数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.live.giftAmount.toFixed(1)}</span>
              <span className="label">礼物金额</span>
            </div>
          </div>

          {liveHourlyOption && (
            <div className="chart-box">
              <h4>弹幕时段分布</h4>
              <ReactECharts option={liveHourlyOption} style={{ height: '250px' }} />
            </div>
          )}

          {liveMonthlyOption && (
            <div className="chart-box">
              <h4>弹幕月度分布</h4>
              <ReactECharts option={liveMonthlyOption} style={{ height: '250px' }} />
            </div>
          )}

          {reportData.live.topGiftLive.length > 0 && (
            <div className="top-list">
              <h4>直播送礼TOP10场次</h4>
              <ul>
                {reportData.live.topGiftLive.slice(0, 10).map((item, i) => (
                  <li key={i}>
                    <span>{item.date}</span>
                    <span>{item.idolName}</span>
                    <span className="amount">￥{item.amount.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 房间 */}
      {activeSection === 'room' && reportData.room && (
        <div className="section-content room">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="value">{reportData.room.messageCount}</span>
              <span className="label">留言次数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.room.messageDays}</span>
              <span className="label">留言天数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.room.replyCount}</span>
              <span className="label">被回复次数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.room.replyDays}</span>
              <span className="label">被回复天数</span>
            </div>
          </div>

          {roomMonthlyOption && (
            <div className="chart-box">
              <h4>留言月度分布</h4>
              <ReactECharts option={roomMonthlyOption} style={{ height: '250px' }} />
            </div>
          )}

          {roomHourlyOption && (
            <div className="chart-box">
              <h4>消息时段分布</h4>
              <ReactECharts option={roomHourlyOption} style={{ height: '250px' }} />
            </div>
          )}
        </div>
      )}

      {/* 翻牌 */}
      {activeSection === 'answer' && reportData.answer && (
        <div className="section-content answer">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="value">{reportData.answer.askCount}</span>
              <span className="label">提问次数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.answer.askedIdols}</span>
              <span className="label">提问成员</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.answer.answeredCount}</span>
              <span className="label">被回复次数</span>
            </div>
            <div className="stat-item">
              <span className="value">￥{reportData.answer.cost.toFixed(1)}</span>
              <span className="label">翻牌消费</span>
            </div>
          </div>
        </div>
      )}

      {/* 礼物 */}
      {activeSection === 'gift' && reportData.gift && (
        <div className="section-content gift">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="value">{reportData.gift.totalCount}</span>
              <span className="label">礼物总数</span>
            </div>
            <div className="stat-item">
              <span className="value">￥{reportData.gift.totalAmount.toFixed(1)}</span>
              <span className="label">礼物金额</span>
            </div>
          </div>

          {giftTypeOption && (
            <div className="chart-box">
              <h4>礼物类型分布</h4>
              <ReactECharts option={giftTypeOption} style={{ height: '300px' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function getSectionName(section: string): string {
  const names: { [key: string]: string } = {
    overview: '概览',
    live: '直播',
    room: '房间',
    answer: '翻牌',
    gift: '礼物',
  };
  return names[section] || section;
}
