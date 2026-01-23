// 消息统计组件 - 房间消息数据统计
import React, { useState, useMemo } from 'react';
import type { RoomOwnerMessage, GiftInfo } from '../types';
import './MessageStatistics.css';

interface MessageStatisticsProps {
  messages: RoomOwnerMessage[];  // 已筛选的消息列表
  giftList?: GiftInfo[];         // 礼物列表（用于获取价格）
}

type StatsView = 'speech' | 'gift';

export const MessageStatistics: React.FC<MessageStatisticsProps> = ({ messages, giftList }) => {
  // 统计视图切换
  const [statsView, setStatsView] = useState<StatsView>('speech'); // 默认显示发言统计

  // 排行搜索关键词
  const [rankingSearchKeyword, setRankingSearchKeyword] = useState<string>('');

  // 选中的日期
  const [selectedDate, setSelectedDate] = useState<string>('');

  // 日历选中的年月 - 初始化为当前日期
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);

  // 统计发送人
  const senderStats = useMemo(() => {
    const stats: Record<string, number> = {};
    messages.forEach(msg => {
      try {
        const ext = JSON.parse(msg.extInfo);
        const sender = ext.user?.nickName || '未知用户';
        stats[sender] = (stats[sender] || 0) + 1;
      } catch {
        stats['解析失败'] = (stats['解析失败'] || 0) + 1;
      }
    });
    return Object.entries(stats)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [messages]);

  // 时间分布 - 按天统计
  const dailyStats = useMemo(() => {
    const stats: Record<string, number> = {};
    messages.forEach(msg => {
      const date = new Date(Number(msg.msgTime));
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      stats[dateKey] = (stats[dateKey] || 0) + 1;
    });
    return Object.entries(stats)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [messages]);

  // 获取日历数据 - 只显示选中的月份
  const calendarData = useMemo(() => {
    if (dailyStats.length === 0) return null;

    // 获取今天的日期
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const year = selectedYear;
    const month = selectedMonth;
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const startDayOfWeek = firstDay.getDay(); // 0 = 周日
    const totalDays = lastDay.getDate();

    // 获取该月有数据的天
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const monthDaysData = new Map<string, number>();
    dailyStats.forEach(([date, count]) => {
      if (date.startsWith(monthKey)) {
        monthDaysData.set(date, count);
      }
    });

    // 生成完整的周
    const weeks: Array<Array<{ date: string; count: number; isCurrentMonth: boolean }>> = [];
    let currentWeek: Array<{ date: string; count: number; isCurrentMonth: boolean }> = [];

    // 填充第一天之前的空白
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ date: '', count: 0, isCurrentMonth: false });
    }

    // 填充日期
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = monthDaysData.get(dateStr) || 0;
      currentWeek.push({
        date: dateStr,
        count: count,
        isCurrentMonth: true
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 填充最后一周之后的空白
    while (currentWeek.length > 0) {
      currentWeek.push({ date: '', count: 0, isCurrentMonth: false });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return {
      monthLabel: `${year}年${month}月`,
      weeks,
      todayStr
    };
  }, [dailyStats, selectedYear, selectedMonth, selectedDate]);

  // 礼物统计 - 解析 GIFT_TEXT 消息并统计送礼数据
  const giftStats = useMemo(() => {
    // 创建礼物ID到价格的映射
    const giftPriceMap = new Map<number, number>();
    giftList?.forEach(gift => {
      giftPriceMap.set(gift.giftId, gift.money);
    });

    // 按用户统计礼物
    const userGiftStats: Record<string, {
      giftCount: number;      // 送礼次数
      giftTypes: Set<string>; // 礼物种类
      totalAmount: number;    // 总金额（鸡腿）
    }> = {};

    // 总体统计
    let totalGiftCount = 0;
    let totalGiftTypes = new Set<string>();
    let totalGiftAmount = 0;

    messages.forEach(msg => {
      // 只处理礼物类型消息
      if (msg.msgType === 'GIFT_TEXT') {
        try {
          const bodysData = JSON.parse(msg.bodys);
          const giftInfo = bodysData.giftInfo;
          if (giftInfo) {
            const sender = giftInfo.userName || '未知用户';
            const giftId = typeof giftInfo.giftId === 'number' ? giftInfo.giftId : parseInt(String(giftInfo.giftId), 10);
            const giftName = giftInfo.giftName || '未知礼物';
            const giftNum = giftInfo.giftNum || 1;
            const price = giftPriceMap.get(giftId) || 0;

            if (!userGiftStats[sender]) {
              userGiftStats[sender] = {
                giftCount: 0,
                giftTypes: new Set<string>(),
                totalAmount: 0
              };
            }

            userGiftStats[sender].giftCount += giftNum;
            userGiftStats[sender].giftTypes.add(giftName);
            userGiftStats[sender].totalAmount += price * giftNum;

            totalGiftCount += giftNum;
            totalGiftTypes.add(giftName);
            totalGiftAmount += price * giftNum;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    });

    // 转换为数组并排序
    const sortedUsers = Object.entries(userGiftStats)
      .map(([name, stats]) => ({
        name,
        giftCount: stats.giftCount,
        giftTypes: stats.giftTypes.size,
        totalAmount: stats.totalAmount
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalGiftCount,
      totalGiftTypes: totalGiftTypes.size,
      totalGiftAmount,
      userRankings: sortedUsers
    };
  }, [messages, giftList]);

  // 处理日期点击
  const handleDateClick = (date: string) => {
    console.log('[日历点击] 选中日期:', date);
    setSelectedDate(date === selectedDate ? '' : date);
    // TODO: 触发筛选事件，显示该日期的消息
  };

  // 生成星期标题
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="message-statistics crystal-theme">
      {/* 视图切换按钮 */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '20px',
        gap: '12px',
      }}>
        <button
          onClick={() => setStatsView('speech')}
          style={{
            padding: '10px 24px',
            border: '2px solid',
            borderColor: statsView === 'speech' ? '#7c3aed' : 'rgba(199, 132, 252, 0.2)',
            borderRadius: '50px',
            background: statsView === 'speech'
              ? 'linear-gradient(135deg, #7c3aed, #c084fc)'
              : 'rgba(255, 255, 255, 0.8)',
            color: statsView === 'speech' ? 'white' : '#5b21b6',
            fontWeight: statsView === 'speech' ? '600' : '400',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (statsView !== 'speech') {
              e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (statsView !== 'speech') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
            }
          }}
        >
          💬 发言统计
        </button>
        {giftStats.totalGiftCount > 0 && (
          <button
            onClick={() => setStatsView('gift')}
            style={{
              padding: '10px 24px',
              border: '2px solid',
              borderColor: statsView === 'gift' ? '#7c3aed' : 'rgba(199, 132, 252, 0.2)',
              borderRadius: '50px',
              background: statsView === 'gift'
                ? 'linear-gradient(135deg, #7c3aed, #c084fc)'
                : 'rgba(255, 255, 255, 0.8)',
              color: statsView === 'gift' ? 'white' : '#5b21b6',
              fontWeight: statsView === 'gift' ? '600' : '400',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (statsView !== 'gift') {
                e.currentTarget.style.background = 'rgba(124, 58, 237, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (statsView !== 'gift') {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
              }
            }}
          >
            🎁 礼物统计
          </button>
        )}
      </div>

      {/* 发言统计视图 */}
      {statsView === 'speech' && (
        <>
          {/* 统计概览卡片 */}
          <div className="stats-summary">
            <div className="summary-card crystal-card">
              <div className="card-icon">💬</div>
              <div className="card-content">
                <span className="label">总消息数</span>
                <span className="value">{messages.length}</span>
              </div>
            </div>
            <div className="summary-card crystal-card">
              <div className="card-icon">👥</div>
              <div className="card-content">
                <span className="label">发送人数</span>
                <span className="value">{senderStats.length}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 礼物统计视图 */}
      {statsView === 'gift' && giftStats.totalGiftCount > 0 && (
        <>
          {/* 统计概览卡片 */}
          <div className="stats-summary">
            <div className="summary-card crystal-card">
              <div className="card-icon">🎁</div>
              <div className="card-content">
                <span className="label">送礼次数</span>
                <span className="value">{giftStats.totalGiftCount}</span>
              </div>
            </div>
            <div className="summary-card crystal-card">
              <div className="card-icon">🍗</div>
              <div className="card-content">
                <span className="label">总鸡腿数</span>
                <span className="value">{giftStats.totalGiftAmount.toLocaleString()}</span>
              </div>
            </div>
            <div className="summary-card crystal-card">
              <div className="card-icon">✨</div>
              <div className="card-content">
                <span className="label">礼物种类</span>
                <span className="value">{giftStats.totalGiftTypes}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 礼物排行榜 */}
      {statsView === 'gift' && giftStats.totalGiftCount > 0 && (
        <div className="ranking-table crystal-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h4 className="chart-title" style={{ margin: 0 }}>🏆 送礼排行榜 TOP24</h4>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px' }}>排名</th>
                  <th style={{ padding: '8px 12px' }}>用户</th>
                  <th style={{ padding: '8px 12px' }}>送礼次数</th>
                  <th style={{ padding: '8px 12px' }}>礼物种类</th>
                  <th style={{ padding: '8px 12px' }}>鸡腿数</th>
                </tr>
              </thead>
              <tbody>
                {giftStats.userRankings.slice(0, 24).map((user, index) => (
                  <tr
                    key={index}
                    className={index < 3 ? `top-${index + 1}` : ''}
                    style={{ height: '36px' }}
                  >
                    <td style={{ padding: '6px 12px' }}>
                      {index < 3 ? (
                        <span className={`rank-badge rank-${index + 1}`}>
                          {index + 1}
                        </span>
                      ) : (
                        index + 1
                      )}
                    </td>
                    <td style={{ padding: '6px 12px' }}>{user.name}</td>
                    <td style={{ padding: '6px 12px' }}>{user.giftCount}</td>
                    <td style={{ padding: '6px 12px' }}>{user.giftTypes}</td>
                    <td style={{ padding: '6px 12px', fontWeight: '600', color: '#d97706' }}>
                      {user.totalAmount.toLocaleString()} 🍗
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 日历组件 */}
      <div className="chart-section crystal-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h4 className="chart-title" style={{ margin: 0 }}>📅 消息日历</h4>
          {/* 年份月份选择器 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                border: '2px solid rgba(199, 132, 252, 0.2)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#5b21b6',
                cursor: 'pointer',
              }}
            >
              {Array.from({ length: 10 }, (_, i) => {
                const year = new Date().getFullYear() - 5 + i;
                return <option key={year} value={year}>{year}年</option>;
              })}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                padding: '4px 8px',
                border: '2px solid rgba(199, 132, 252, 0.2)',
                borderRadius: '8px',
                fontSize: '0.8rem',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#5b21b6',
                cursor: 'pointer',
              }}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}月</option>
              ))}
            </select>
          </div>
        </div>
        {!calendarData ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#a78bfa' }}>
            暂无消息数据
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#7c3aed',
              marginBottom: '12px',
              textAlign: 'center'
            }}>
              {calendarData.monthLabel}
            </div>
            {/* 星期标题 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
              {weekDays.map(day => (
                <div key={day} style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: '#a78bfa',
                  fontWeight: '500'
                }}>
                  {day}
                </div>
              ))}
            </div>
            {/* 日期网格 - 缩小到60% */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {calendarData.weeks.map((week, weekIndex) => (
                <React.Fragment key={weekIndex}>
                  {week.map((dayData, index) => {
                    const isSelected = dayData.date === selectedDate;
                    const isToday = dayData.date === calendarData.todayStr;
                    return (
                      <div
                        key={`${weekIndex}-${index}`}
                        onClick={() => dayData.date && handleDateClick(dayData.date)}
                        style={{
                          aspectRatio: '1',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          cursor: dayData.date ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          background: !dayData.date
                            ? 'transparent'
                            : isSelected
                            ? 'linear-gradient(135deg, #7c3aed, #c084fc)'
                            : isToday
                            ? 'rgba(124, 58, 237, 0.1)'
                            : dayData.count > 0
                            ? `rgba(124, 58, 237, ${Math.min(0.05 + dayData.count * 0.01, 0.3)})`
                            : 'rgba(199, 132, 252, 0.05)',
                          border: isToday ? '2px solid #7c3aed' : '1px solid rgba(199, 132, 252, 0.1)',
                          color: isSelected
                            ? 'white'
                            : dayData.count > 0
                            ? '#5b21b6'
                            : '#c4b5fd',
                          fontWeight: isToday || isSelected ? '600' : '400',
                          // 缩小到60%
                          transform: 'scale(0.6)',
                          transformOrigin: 'center',
                        }}
                        onMouseEnter={(e) => {
                          if (dayData.date) {
                            e.currentTarget.style.transform = 'scale(0.7)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.3)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(0.6)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <span style={{ fontSize: '0.85rem' }}>
                          {dayData.date ? new Date(dayData.date).getDate() : ''}
                        </span>
                        {dayData.count > 0 && (
                          <span style={{
                            fontSize: '0.65rem',
                            opacity: isSelected ? 1 : 0.7,
                            marginTop: '2px'
                          }}>
                            {dayData.count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 发言排行榜 - 双栏显示，左栏1-24，右栏25-48 */}
      {statsView === 'speech' && (
      <div className="ranking-table crystal-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h4 className="chart-title" style={{ margin: 0 }}>🏆 发言排行榜 TOP48</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="text"
              value={rankingSearchKeyword}
              onChange={(e) => setRankingSearchKeyword(e.target.value)}
              placeholder="输入昵称查询排名..."
              style={{
                padding: '6px 12px',
                border: '2px solid rgba(199, 132, 252, 0.2)',
                borderRadius: '50px',
                fontSize: '0.8rem',
                background: 'rgba(255, 255, 255, 0.8)',
                color: '#5b21b6',
                minWidth: '160px',
              }}
            />
            {rankingSearchKeyword && (
              <button
                onClick={() => setRankingSearchKeyword('')}
                style={{
                  padding: '6px 12px',
                  border: '2px solid rgba(199, 132, 252, 0.2)',
                  borderRadius: '50px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#7c3aed',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                清除
              </button>
            )}
          </div>
        </div>

        {/* 双栏布局 */}
        {rankingSearchKeyword ? (
          // 搜索模式：显示单个结果
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px' }}>排名</th>
                  <th style={{ padding: '8px 12px' }}>发送人</th>
                  <th style={{ padding: '8px 12px' }}>消息数</th>
                  <th style={{ padding: '8px 12px' }}>占比</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const searchLower = rankingSearchKeyword.toLowerCase();
                  const foundIndex = senderStats.findIndex(item =>
                    item.name.toLowerCase().includes(searchLower)
                  );
                  if (foundIndex === -1) {
                    return (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#a78bfa' }}>
                          未找到匹配的发送人
                        </td>
                      </tr>
                    );
                  }
                  const item = senderStats[foundIndex];
                  return (
                    <tr
                      key={foundIndex}
                      className={foundIndex < 3 ? `top-${foundIndex + 1}` : ''}
                      style={{ height: '36px' }}
                    >
                      <td style={{ padding: '6px 12px' }}>
                        {foundIndex < 3 ? (
                          <span className={`rank-badge rank-${foundIndex + 1}`}>
                            {foundIndex + 1}
                          </span>
                        ) : (
                          foundIndex + 1
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>{item.name}</td>
                      <td style={{ padding: '6px 12px' }}>{item.count}</td>
                      <td style={{ padding: '6px 12px' }}>{messages.length > 0 ? ((item.count / messages.length) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          // 默认模式：双栏显示
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* 左栏：排名1-24 */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>排名</th>
                    <th style={{ padding: '8px 12px' }}>发送人</th>
                    <th style={{ padding: '8px 12px' }}>消息数</th>
                    <th style={{ padding: '8px 12px' }}>占比</th>
                  </tr>
                </thead>
                <tbody>
                  {senderStats.slice(0, 24).map((item, index) => (
                    <tr
                      key={index}
                      className={index < 3 ? `top-${index + 1}` : ''}
                      style={{ height: '36px' }}
                    >
                      <td style={{ padding: '6px 12px' }}>
                        {index < 3 ? (
                          <span className={`rank-badge rank-${index + 1}`}>
                            {index + 1}
                          </span>
                        ) : (
                          index + 1
                        )}
                      </td>
                      <td style={{ padding: '6px 12px' }}>{item.name}</td>
                      <td style={{ padding: '6px 12px' }}>{item.count}</td>
                      <td style={{ padding: '6px 12px' }}>{messages.length > 0 ? ((item.count / messages.length) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                  {senderStats.length < 24 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#a78bfa' }}>
                        暂无更多数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 右栏：排名25-48 */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>排名</th>
                    <th style={{ padding: '8px 12px' }}>发送人</th>
                    <th style={{ padding: '8px 12px' }}>消息数</th>
                    <th style={{ padding: '8px 12px' }}>占比</th>
                  </tr>
                </thead>
                <tbody>
                  {senderStats.slice(24, 48).map((item, index) => {
                    const actualRank = 24 + index + 1;
                    return (
                      <tr
                        key={actualRank}
                        style={{ height: '36px' }}
                      >
                        <td style={{ padding: '6px 12px' }}>{actualRank}</td>
                        <td style={{ padding: '6px 12px' }}>{item.name}</td>
                        <td style={{ padding: '6px 12px' }}>{item.count}</td>
                        <td style={{ padding: '6px 12px' }}>{messages.length > 0 ? ((item.count / messages.length) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    );
                  })}
                  {senderStats.length <= 24 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#a78bfa' }}>
                        暂无更多数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {!rankingSearchKeyword && senderStats.length > 48 && (
          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.75rem', color: '#a78bfa' }}>
            显示前 48 名，共 {senderStats.length} 位发送人
          </div>
        )}
      </div>
      )}
    </div>
  );
};
