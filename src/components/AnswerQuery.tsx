// 翻牌查询组件 - 改进的翻转卡片设计
import { useState, useMemo } from 'react';
import type { IdolAnswer, AnswerFilter } from '../types';
import { formatTimestamp, getStatusName } from '../services/statisticsService';
import { StatisticsPanel } from './StatisticsPanel';
import type { AccountInfo } from '../types';
import { AIFeatures } from './AIFeatures';
import './AnswerQuery.css';

interface AnswerQueryProps {
  answers: IdolAnswer[];
  currentAccount?: AccountInfo | null;
  onLoadData?: () => void;
  onFileImport?: (data: IdolAnswer[]) => void;
  loading?: boolean;
  message?: string;
  setMessage?: (msg: string) => void;
}

export const AnswerQuery: React.FC<AnswerQueryProps> = ({
  answers,
  currentAccount,
  onLoadData,
  onFileImport,
  loading = false,
  message = '',
  setMessage
}) => {
  const [filter, setFilter] = useState<AnswerFilter>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'list' | 'stats' | 'card' | 'ai'>('list');
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());

  // 筛选后的数据
  const filteredAnswers = useMemo(() => {
    const result = answers.filter(answer => {
      if (filter.idolId && answer.idolId !== filter.idolId) return false;
      if (filter.idolName && !answer.idolName.includes(filter.idolName)) return false;
      if (filter.keyword && !answer.content.includes(filter.keyword)) return false;
      if (filter.status !== undefined && answer.status !== filter.status) return false;
      if (filter.startTime && answer.qtime * 1000 < filter.startTime) return false;
      if (filter.endTime && answer.qtime * 1000 > filter.endTime) return false;
      return true;
    });
    // 按时间倒序排序
    return result.sort((a, b) => b.qtime - a.qtime);
  }, [answers, filter]);

  // 计算筛选结果的统计信息
  const summaryStats = useMemo(() => {
    return filteredAnswers.reduce((acc, curr) => ({
      count: acc.count + 1,
      cost: acc.cost + (curr.price || 0)
    }), { count: 0, cost: 0 });
  }, [filteredAnswers]);

  // 分页数据
  const paginatedAnswers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAnswers.slice(start, start + pageSize);
  }, [filteredAnswers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAnswers.length / pageSize);

  // 获取筛选选项
  const idols = useMemo(() => {
    const idolMap = new Map<string, string>();
    answers.forEach(a => idolMap.set(a.idolId, a.idolName));
    return Array.from(idolMap.entries()).map(([idolId, idolName]) => ({ idolId, idolName }));
  }, [answers]);

  const handleFilterChange = (key: keyof AnswerFilter, value: string) => {
    let finalValue: string | number | undefined = value;
    if (key === 'status') {
      finalValue = value === '' ? undefined : Number(value);
    } else if (key === 'startTime') {
      // Treat input date as local time start of day
      finalValue = value ? new Date(value + 'T00:00:00').getTime() : undefined;
    } else if (key === 'endTime') {
      // Treat input date as local time end of day
      finalValue = value ? new Date(value + 'T23:59:59.999').getTime() : undefined;
    } else {
      finalValue = value || undefined;
    }
    setFilter(prev => ({ ...prev, [key]: finalValue }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilter({});
    setCurrentPage(1);
  };

  const toggleCardFlip = (answerId: string, answer: IdolAnswer) => {
    // Only allow flipping for answered cards (status === 2)
    // Disable flipping for unanswered (status === 1) or refunded (status === 3)
    if (answer.status !== 2) {
      return; // Don't flip unanswered or refunded cards
    }

    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(answerId)) {
        newSet.delete(answerId);
      } else {
        newSet.add(answerId);
      }
      return newSet;
    });
  };

  const resetAllFlips = () => {
    setFlippedCards(new Set());
  };

  const renderAnswerContent = (answer: IdolAnswer) => {
    if (!answer.answerContent) return null;

    const answerContentBody = () => {
      // 语音(2)或视频(3)翻牌
      if (answer.type === 2 || answer.type === 3) {
        try {
          const media = JSON.parse(answer.answerContent!);
          // Fix URL issue: Check if URL already has protocol/domain
          let url = media.url;
          if (url && !url.startsWith('http')) {
             url = `https://mp4.48.cn${url}`;
          }
          
          // const typeName = answer.type === 2 ? '语音' : '视频';
          return (
            <div className="content media-content">
              {/* <span className="media-tag">[{typeName}]</span> */}
              <div className="media-player-container">
                {answer.type === 2 ? (
                    <audio controls src={url} style={{maxWidth: '100%', marginTop: '5px'}} />
                ) : (
                    <video controls src={url} style={{maxWidth: '100%', marginTop: '5px'}} />
                )}
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="download-btn"
                    style={{
                        display: 'inline-block',
                        marginLeft: '10px',
                        padding: '4px 8px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        verticalAlign: 'top',
                        marginTop: '8px'
                    }}
                >
                    下载
                </a>
              </div>
              {/* {media.duration && <span className="duration"> ({media.duration}秒)</span>} */}
            </div>
          );
        } catch {
          return <span className="content">{answer.answerContent}</span>;
        }
      }
      return <span className="content">{answer.answerContent}</span>;
    };

    return (
      <div className="answer">
        <div className="answer-divider" style={{borderTop: '1px dashed #eee', margin: '10px 0'}}></div>
        <div className="answer-user-info flip-hidden" style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
           {answer.idolAvatar && (
             <img
                src={answer.idolAvatar}
                alt={answer.idolName}
                className="user-avatar"
                style={{width: '12px', height: '12px', borderRadius: '50%', marginRight: '8px'}}
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
             />
           )}
           <span className="label" style={{fontWeight: 'bold', color: '#666'}}>{answer.idolName} 答：</span>
           <span className="time-hint" style={{fontSize: '12px', color: '#999', marginLeft: '8px'}}>
             {formatTimestamp(answer.answerTime)}
           </span>
        </div>
        {answerContentBody()}
      </div>
    );
  };

  const toDateInputString = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="answer-query crystal-theme">
      {/* 数据操作 */}
      <div className="data-actions">
        <h4>数据操作</h4>
        <div className="action-buttons">
          <button onClick={onLoadData} disabled={loading || !currentAccount}>
            {loading ? '加载中...' : '获取翻牌数据'}
          </button>
          <label className="import-btn">
            导入数据
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    try {
                      const result = event.target?.result;
                      if (typeof result === 'string') {
                        const data = JSON.parse(result);
                        if (Array.isArray(data) && onFileImport) {
                          onFileImport(data);
                        }
                      }
                    } catch (error) {
                      console.error('File parse error:', error);
                      setMessage?.('文件解析失败');
                    }
                  };
                  reader.readAsText(file);
                }
              }}
              hidden
            />
          </label>
          {answers && answers.length > 0 && (
            <button onClick={() => {
              const blob = new Blob([JSON.stringify(answers, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'pocket48_answers.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>
              导出数据
            </button>
          )}
        </div>
        {answers && answers.length > 0 && (
          <p className="data-info">已加载 {answers.length} 条翻牌数据</p>
        )}
        {message && <p className="data-message">{message}</p>}
      </div>

      <div className="answer-query-header">
        <div className="header-title">
          <h2>翻牌查询</h2>
          <div className="header-stats">
            <span className="stat-badge">
              <span className="stat-icon">💬</span>
              <span className="stat-value">{summaryStats.count}</span>
            </span>
            <span className="stat-badge">
              <span className="stat-icon">🍗</span>
              <span className="stat-value">{summaryStats.cost.toFixed(1)}</span>
            </span>
          </div>
        </div>

        {/* 创意视图切换按钮 */}
        <div className="view-toggle-group">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
            </svg>
            <span>列表</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title="卡片视图"
          >
            <svg viewBox="0 0 24 24">
              <path d="M4 6h6v6H4zm0 8h6v6H4zm8-8h6v6h-6zm0 8h6v6h-6z"/>
            </svg>
            <span>翻转卡片</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'stats' ? 'active' : ''}`}
            onClick={() => setViewMode('stats')}
            title="统计视图"
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
            </svg>
            <span>统计</span>
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'ai' ? 'active' : ''}`}
            onClick={() => setViewMode('ai')}
            title="AI报告"
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>AI报告</span>
          </button>
        </div>
      </div>

      <div className="filter-section crystal-filter">
        <div className="filter-row">
          <select
            value={filter.idolId || ''}
            onChange={(e) => handleFilterChange('idolId', e.target.value)}
            className="crystal-select"
          >
            <option value="">全部成员</option>
            {idols.map(idol => (
              <option key={idol.idolId} value={idol.idolId}>{idol.idolName}</option>
            ))}
          </select>
          <select
            value={filter.status !== undefined ? filter.status : ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="crystal-select"
          >
            <option value="">全部状态</option>
            <option value="1">未回复</option>
            <option value="2">已回复</option>
            <option value="3">已退款</option>
            <option value="4">翻牌中</option>
          </select>
          <input
            type="date"
            placeholder="开始日期"
            value={toDateInputString(filter.startTime)}
            onChange={(e) => handleFilterChange('startTime', e.target.value)}
            className="crystal-input"
          />
          <input
            type="date"
            placeholder="结束日期"
            value={toDateInputString(filter.endTime)}
            onChange={(e) => handleFilterChange('endTime', e.target.value)}
            className="crystal-input"
          />
          <input
            type="text"
            placeholder="关键词搜索"
            value={filter.keyword || ''}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
            className="crystal-input"
          />
          <button onClick={clearFilters} className="crystal-btn secondary">清除筛选</button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <div className="answer-list">
            {paginatedAnswers.map((answer, index) => (
              <div key={answer.answerId || `fallback-${index}`} className={`answer-item crystal-card status-${answer.status}`}>
                <div className="answer-header">
                  <span className="idol-name">{answer.idolName}</span>
                  <span className={`status-badge status-${getStatusName(answer.status).toLowerCase()}`}>
                    {getStatusName(answer.status)}
                  </span>
                  <span className="price">🍗{answer.price}</span>
                </div>
                <div className="question">
                  <div className="question-user-info">
                    {answer.userAvatar && (
                      <img src={answer.userAvatar} alt={answer.userName} className="user-avatar" />
                    )}
                    <span className="label">{answer.userName} 问：</span>
                    <span className="time-hint">
                      {formatTimestamp(answer.qtime)}
                    </span>
                  </div>
                  <span className="content">{answer.content}</span>
                </div>
                {renderAnswerContent(answer)}
                <div className="answer-meta">
                  <span className="room">{answer.roomName}</span>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination crystal-pagination">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="crystal-select"
              >
                <option value={20}>每页20条</option>
                <option value={50}>每页50条</option>
                <option value={100}>每页100条</option>
              </select>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="crystal-btn secondary"
              >
                上一页
              </button>
              <span className="page-info">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="crystal-btn secondary"
              >
                下一页
              </button>
            </div>
          )}
        </>
      ) : viewMode === 'card' ? (
        <>
          <div className="flip-cards-container">
            {paginatedAnswers.map((answer, index) => {
              const isFlipped = flippedCards.has(answer.answerId || `fallback-${index}`);
              return (
                <div
                  key={answer.answerId || `fallback-${index}`}
                  className={`flip-card ${isFlipped ? 'flipped' : ''}`}
                  onClick={() => toggleCardFlip(answer.answerId || `fallback-${index}`, answer)}
                >
                  <div className="flip-card-inner">
                    {/* 正面 - 问题 */}
                    <div className="flip-card-front">
                      <div className="card-header">
                        <span className="idol-name">{answer.idolName}</span>
                        <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                          <span className="price" style={{fontSize: '0.9rem', fontWeight: '600'}}>🍗{answer.price}</span>
                          <span className={`status-badge status-${getStatusName(answer.status).toLowerCase()}`}>
                            {getStatusName(answer.status)}
                          </span>
                        </div>
                      </div>
                      <div className="card-content question-side">
                        <div className="question-user-info">
                          {answer.userAvatar && (
                            <img src={answer.userAvatar} alt={answer.userName} className="user-avatar" style={{ maxWidth: '25px', maxHeight: '25px' }} />
                          )}
                          <span className="label">{answer.userName} 问：</span>
                        </div>
                        <p className="content">{answer.content}</p>
                        <span className="time-hint">{formatTimestamp(answer.qtime)}</span>
                      </div>
                      <div className="card-footer">
                        <span className="flip-hint">点击查看回复 →</span>
                      </div>
                    </div>

                    {/* 背面 - 回复 */}
                    <div className="flip-card-back">
                      <div className="card-header">
                        <span className="answer-label">{answer.idolName} 答：</span>
                        <span className="time-hint">{formatTimestamp(answer.answerTime)}</span>
                      </div>
                      <div className="card-content answer-side">
                        {renderAnswerContent(answer)}
                      </div>
                      <div className="card-footer">
                        <span className="room">{answer.roomName}</span>
                        <span className="flip-hint">← 返回问题</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination crystal-pagination">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="crystal-select"
              >
                <option value={20}>每页20条</option>
                <option value={50}>每页50条</option>
                <option value={100}>每页100条</option>
              </select>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="crystal-btn secondary"
              >
                上一页
              </button>
              <span className="page-info">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="crystal-btn secondary"
              >
                下一页
              </button>
            </div>
          )}

          {flippedCards.size > 0 && (
            <button onClick={resetAllFlips} className="reset-flips-btn crystal-btn primary">
              重置所有卡片
            </button>
          )}
        </>
      ) : viewMode === 'stats' ? (
        <div className="filtered-stats">
          <StatisticsPanel answers={filteredAnswers} />
        </div>
      ) : viewMode === 'ai' ? (
        <div className="ai-analysis-view">
          <AIFeatures answers={filteredAnswers} answersType="query" />
        </div>
      ) : null}
    </div>
  );
};
