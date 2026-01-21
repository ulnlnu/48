// 翻牌查询组件
import { useState, useMemo } from 'react';
import type { IdolAnswer, AnswerFilter } from '../types';
import { formatTimestamp, getStatusName } from '../services/statisticsService';
import { StatisticsPanel } from './StatisticsPanel';

interface AnswerQueryProps {
  answers: IdolAnswer[];
}

export const AnswerQuery: React.FC<AnswerQueryProps> = ({ answers }) => {
  const [filter, setFilter] = useState<AnswerFilter>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');

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
        <div className="answer-user-info" style={{display: 'flex', alignItems: 'center', marginBottom: '5px'}}>
           {answer.idolAvatar && (
             <img 
                src={answer.idolAvatar} 
                alt={answer.idolName} 
                className="user-avatar" 
                style={{width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px'}}
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
    <div className="answer-query">
      <div className="filter-section">
        <h4>筛选条件</h4>
        <div className="filter-row">
          <select
            value={filter.idolId || ''}
            onChange={(e) => handleFilterChange('idolId', e.target.value)}
          >
            <option value="">全部成员</option>
            {idols.map(idol => (
              <option key={idol.idolId} value={idol.idolId}>{idol.idolName}</option>
            ))}
          </select>
          <select
            value={filter.status !== undefined ? filter.status : ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
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
            style={{ width: '130px' }}
          />
          <input
            type="date"
            placeholder="结束日期"
            value={toDateInputString(filter.endTime)}
            onChange={(e) => handleFilterChange('endTime', e.target.value)}
            style={{ width: '130px' }}
          />
          <input
            type="text"
            placeholder="关键词搜索"
            value={filter.keyword || ''}
            onChange={(e) => handleFilterChange('keyword', e.target.value)}
          />
          <button onClick={clearFilters}>清除筛选</button>
        </div>
      </div>

      <div className="result-info">
        <span>共 {summaryStats.count} 条翻牌</span>
        <span style={{ marginLeft: '10px' }}>总消费: 🍗{summaryStats.cost.toFixed(1)}</span>
        
        <div className="toggle-group" style={{ float: 'right' }}>
          <button 
            className={viewMode === 'list' ? 'active' : ''} 
            onClick={() => setViewMode('list')}
          >
            列表视图
          </button>
          <button 
            className={viewMode === 'stats' ? 'active' : ''} 
            onClick={() => setViewMode('stats')}
          >
            统计视图
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          <div className="answer-list">
            {paginatedAnswers.map((answer, index) => (
              <div key={answer.answerId || `fallback-${index}`} className={`answer-item status-${answer.status}`}>
                <div className="answer-header">
                  <span className="idol-name">{answer.idolName}</span>
                  <span className={`status-badge ${getStatusName(answer.status).toLowerCase()}`}>
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
                    <span className="time-hint" style={{fontSize: '12px', color: '#999', marginLeft: '8px'}}>
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
            <div className="pagination">
              <select 
                value={pageSize} 
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="page-size-selector"
              >
                <option value={20}>每页20条</option>
                <option value={50}>每页50条</option>
                <option value={100}>每页100条</option>
              </select>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                上一页
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="filtered-stats">
          <StatisticsPanel answers={filteredAnswers} />
        </div>
      )}
    </div>
  );
};
