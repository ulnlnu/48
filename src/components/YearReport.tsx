// 年报统计组件
import { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { YearReportData, IdolAnswer, UserInfo } from '../types';
import { getAllIdolAnswers, generateYearReportFromData, getUserInfo } from '../services/pocket48Api';
import './YearReport.css';

interface YearReportProps {
  token: string;
  answers?: IdolAnswer[] | null;
  onAnswersLoaded?: (answers: IdolAnswer[]) => void;
}

export const YearReport: React.FC<YearReportProps> = ({ token, answers, onAnswersLoaded }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<YearReportData | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('overview');

  // 获取用户信息
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      // 1. 如果 props.token 存在，尝试获取 userInfo
      // 需要 userId，我们先尝试从 answers 里找一个 userId（如果 answers 属于该用户）
      // 或者尝试解析 token
      
      if (!token) return;

      try {
        let uid = '';
        // 尝试从 answers 获取 userId
        if (answers && answers.length > 0) {
           uid = answers[0].userId;
        } 
        
        // 如果没找到，尝试解析 token
        if (!uid) {
           try {
             const payload = JSON.parse(atob(token.split('.')[1]));
             uid = payload.userId || payload.sub || ''; 
           } catch (e) {
             console.warn('Token解析失败', e);
           }
        }

        if (uid) {
          const info = await getUserInfo(token, uid);
          if (isMounted && info) {
            setUserInfo(info);
          }
        }
      } catch (e) {
        console.error('获取用户信息失败', e);
      }
    };
    
    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [token, answers]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      // 优先使用传入的已获取数据
      if (answers && answers.length > 0) {
        try {
          const data = generateYearReportFromData(answers, year);
          if (isMounted) {
            setReportData(data);
          }
        } catch (err) {
          console.error("生成年报出错", err);
        }
        return;
      }

      if (!token) return;
      
      setLoading(true);
      try {
        // 并行获取：1. 用户信息 2. 翻牌数据
        // const userId = JSON.parse(atob(token.split('.')[1] || '')).userId || ''; // 尝试简单解析或留空，实际应从父组件传
        // 注意：由于 YearReportProps 没传 userId，我们暂时尝试用 token 获取 userInfo
        // 但最好的方式是从 props 传入 userId，或者 getUserInfo 内部逻辑处理（当前 getUserInfo 需要 userId 参数）
        
        // 修正策略：我们需要从 answers 或外部获取 userId。
        // 如果没有 answers，我们无法得知 userId，除非 token 解析。
        // 临时方案：仅当 answers 存在时获取用户信息，或者忽略 userInfo 获取错误
        
        // 由于我们刚刚在 AccountManager 修复了 userId，最好的办法是将 userId 也通过 props 传入。
        // 但为了不破坏接口，我们先只获取数据。
        
        const allAnswers = await getAllIdolAnswers(token);
        
        // 如果父组件提供了回调，将数据回传
        if (onAnswersLoaded) {
          onAnswersLoaded(allAnswers);
        }

        const data = generateYearReportFromData(allAnswers, year);
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
  }, [token, year, answers, onAnswersLoaded]);

  // Chart Options Helpers
  const getBarOption = (data: number[], colorStart: string, colorEnd: string, name: string) => ({
    backgroundColor: 'transparent',
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.length === 12 
        ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        : Array.from({ length: 24 }, (_, i) => `${i}时`),
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#666', fontSize: 12 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: name,
      splitLine: { lineStyle: { color: '#f5f5f5' } },
      axisLabel: { color: '#999' },
      nameTextStyle: { color: '#999', padding: [0, 0, 0, 10] }
    },
    series: [{
      type: 'bar',
      data: data,
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: colorStart }, { offset: 1, color: colorEnd }]
        },
        borderRadius: [4, 4, 0, 0]
      },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(0,0,0,0.1)'
        }
      }
    }]
  });

  const getLineOption = (data: number[], color: string, name: string) => ({
    backgroundColor: 'transparent',
    tooltip: { 
      trigger: 'axis', 
      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
      borderColor: '#eee',
      borderWidth: 1,
      textStyle: { color: '#333' },
      extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;'
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}时`),
      axisLine: { lineStyle: { color: '#e0e0e0' } },
      axisLabel: { color: '#666', fontSize: 12 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: name,
      splitLine: { lineStyle: { color: '#f5f5f5' } },
      axisLabel: { color: '#999' },
      nameTextStyle: { color: '#999', padding: [0, 0, 0, 10] }
    },
    series: [{
      type: 'line',
      data: data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: color, borderColor: '#fff', borderWidth: 2 },
      lineStyle: { width: 3, color: color, shadowColor: 'rgba(0,0,0,0.1)', shadowBlur: 10, shadowOffsetY: 5 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: color }, { offset: 1, color: 'rgba(255,255,255,0)' }]
        },
        opacity: 0.2
      }
    }]
  });

  if (loading) {
    return <div className="year-report loading">
      <div className="loading-spinner"></div>
      <p>正在生成 {year} 年报数据...</p>
    </div>;
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

  // Generate Options
  const answerMonthlyOption = reportData.answer.monthlyStats ? getBarOption(reportData.answer.monthlyStats, '#fccb90', '#d57eeb', '翻牌数') : null;
  const answerHourlyOption = reportData.answer.hourlyStats ? getLineOption(reportData.answer.hourlyStats, '#d57eeb', '翻牌数') : null;

  return (
    <div className="year-report">
      <div className="report-header">
        <div className="header-content">
           {userInfo && (
             <div className="user-profile">
               <img src={userInfo.avatar} alt={userInfo.nickname} className="user-avatar" />
               <div className="user-details">
                 <h3>{userInfo.nickname}</h3>
                 <span className="user-level">Lv.{userInfo.level}</span>
                 {userInfo.vip && <span className="user-vip">VIP</span>}
               </div>
             </div>
           )}
           <div className="title-area">
              <h2>{year}个人口袋年报</h2>
           </div>
        </div>
        <div className="year-selector">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
        </div>
      </div>

      <div className="section-nav">
        {['overview', 'answer', 'live', 'room', 'gift'].map(section => (
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
              <span className="label">翻牌总数</span>
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
          
          <div className="chart-box">
             <h4>翻牌月度趋势</h4>
             {answerMonthlyOption && <ReactECharts option={answerMonthlyOption} style={{ height: '300px' }} />}
          </div>
        </div>
      )}

      {/* 翻牌 */}
      {activeSection === 'answer' && (
        <div className="section-content answer">
          <div className="stats-grid">
            <div className="stat-item">
              <span className="value">{reportData.answer.askCount}</span>
              <span className="label">提问次数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.answer.askedIdols}</span>
              <span className="label">提问成员数</span>
            </div>
            <div className="stat-item">
              <span className="value">{reportData.answer.answeredCount}</span>
              <span className="label">被回复次数</span>
            </div>
            <div className="stat-item">
              <span className="value">🍗 {reportData.answer.cost.toFixed(0)}</span>
              <span className="label">消费鸡腿</span>
            </div>
          </div>

          <div className="chart-box">
            <h4>翻牌月度分布</h4>
            {answerMonthlyOption && <ReactECharts option={answerMonthlyOption} style={{ height: '300px' }} />}
          </div>

          <div className="chart-box">
            <h4>翻牌时段分布</h4>
            {answerHourlyOption && <ReactECharts option={answerHourlyOption} style={{ height: '300px' }} />}
          </div>

          {reportData.answer.topIdols.length > 0 && (
            <div className="top-list">
              <h4>提问最多的成员</h4>
              <ul>
                {reportData.answer.topIdols.map((idol, i) => (
                  <li key={i}>
                    <span>{i + 1}. {idol.name}</span>
                    <span className="amount">{idol.count}次</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {reportData.answer.topAnsweredIdols.length > 0 && (
            <div className="top-list" style={{marginTop: '20px'}}>
              <h4>回复最多的成员</h4>
              <ul>
                {reportData.answer.topAnsweredIdols.map((idol, i) => (
                  <li key={i}>
                    <span>{i + 1}. {idol.name}</span>
                    <span className="amount">{idol.count}次</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 直播 (Placeholder) */}
      {activeSection === 'live' && (
        <div className="section-content live empty-placeholder">
          <div className="card">
            <p>由于API限制，暂无法获取历史直播观看数据。</p>
            <p>请关注后续版本更新。</p>
          </div>
        </div>
      )}

      {/* 房间 (Placeholder) */}
      {activeSection === 'room' && (
        <div className="section-content room empty-placeholder">
           <div className="card">
            <p>由于API限制，暂无法获取历史房间留言数据。</p>
            <p>请关注后续版本更新。</p>
          </div>
        </div>
      )}

      {/* 礼物 (Placeholder) */}
      {activeSection === 'gift' && (
        <div className="section-content gift empty-placeholder">
           <div className="card">
            <p>由于API限制，暂无法获取历史礼物数据。</p>
            <p>请关注后续版本更新。</p>
          </div>
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
