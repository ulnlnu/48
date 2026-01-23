import { useState, useEffect, useCallback } from 'react';
import { getOpenLiveMessages, getMemberList, getOpenLiveOne, getOpenLiveList, getStarArchives, type MemberListItem } from '../services/pocket48Api';
import type { OpenLiveMessage, OpenLiveInfo } from '../types';
import type { AccountInfo } from '../types';
import './PerformanceList.css';

interface PerformanceListProps {
  currentAccount: AccountInfo | null;
}

type TabType = 'push' | 'record';

// 关注的房间项
interface FollowedRoom {
  roomId: string;
  roomName: string;
  ownerId: string;
  avatar?: string;
  starTeamName?: string;
}

// 团队选项
const TEAM_RECORD_OPTIONS = [
  { label: 'SNH48', value: 'snh48', groupId: 10 },
  { label: 'BEJ48', value: 'bej48', groupId: 11 },
  { label: 'GNZ48', value: 'gnz48', groupId: 12 },
  { label: 'CKG48', value: 'ckg48', groupId: 14 },
  { label: 'CGT48', value: 'cgt48', groupId: 21 },
];

// 默认头像常量
const DEFAULT_AVATAR = 'https://source.48.cn/images/default_avatar.png';

// 头像加载失败缓存
const failedAvatars = new Set<string>();

// 处理头像加载失败
const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, avatarUrl?: string) => {
  if (avatarUrl && !failedAvatars.has(avatarUrl)) {
    failedAvatars.add(avatarUrl);
  }
  e.currentTarget.src = DEFAULT_AVATAR;
};

// 获取头像URL
const getAvatarUrl = (avatarUrl?: string) => {
  if (!avatarUrl || failedAvatars.has(avatarUrl)) {
    return DEFAULT_AVATAR;
  }
  return avatarUrl;
};

export function PerformanceList({ currentAccount }: PerformanceListProps) {
  // Tab 切换
  const [activeTab, setActiveTab] = useState<TabType>('push');

  // 公演推送状态
  const [performances, setPerformances] = useState<OpenLiveMessage[]>([]);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState('');
  const [nextTime, setNextTime] = useState(0);
  const [memberId, setMemberId] = useState('');
  const [selectedMemberName, setSelectedMemberName] = useState('');

  // 公演录播状态
  const [recordList, setRecordList] = useState<OpenLiveInfo[]>([]);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('snh48');
  const [recordNextPage, setRecordNextPage] = useState(0);
  const [hasMoreRecords, setHasMoreRecords] = useState(true);

  // 成员搜索状态
  const [memberList, setMemberList] = useState<MemberListItem[]>([]);
  const [memberSearchKeyword, setMemberSearchKeyword] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<MemberListItem[]>([]);
  const [isMemberListLoading, setIsMemberListLoading] = useState(false);

  // 关注的房间列表
  const [followedRooms, setFollowedRooms] = useState<FollowedRoom[]>([]);
  const [loadingFollowedRooms, setLoadingFollowedRooms] = useState(false);
  const [selectedFollowedRoom, setSelectedFollowedRoom] = useState<FollowedRoom | null>(null);

  // 弹窗状态
  const [showStreamModal, setShowStreamModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OpenLiveInfo | null>(null);
  const [streamInfo, setStreamInfo] = useState<Awaited<ReturnType<typeof getOpenLiveOne>> | null>(null);

  // 加载成员列表
  const loadMemberList = useCallback(async (): Promise<MemberListItem[]> => {
    setIsMemberListLoading(true);
    try {
      const list = await getMemberList();
      setMemberList(list);
      return list;
    } catch (error) {
      console.error('加载成员列表失败:', error);
      return [];
    } finally {
      setIsMemberListLoading(false);
    }
  }, []);

  // 加载关注的房间列表
  const loadFollowedRooms = useCallback(async () => {
    if (!currentAccount) return;
    setLoadingFollowedRooms(true);
    setPushError('');

    const APP_INFO = {
      vendor: 'Huawei',
      deviceId: 'F2BA149C-06DB-9843-31DE-36BF375E36F2',
      appVersion: '7.1.0',
      appBuild: '23051902',
      osVersion: '16.6.0',
      osType: 'ios',
      deviceName: 'Huawei',
      os: 'ios',
    };

    try {
      const response = await fetch('/pocketapi/im/api/v1/conversation/page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'pa': 'MTY5MjY1MzQwODAwMCwyNDExLDIwNzc2MUQxM0E2NjE1MjFCNkE0NkM4QTY4NTVCNjM3LA==',
          'User-Agent': 'PocketFans201807/7.1.0 (iPad; iOS 16.6; Scale/2.00)',
          'Accept-Language': 'zh-Hans-CN;q=1, zh-Hant-TW;q=0.9',
          'Origin': 'https://pocket.48.cn',
          'Referer': 'https://pocket.48.cn/',
          'AppInfo': JSON.stringify(APP_INFO),
          'token': currentAccount.token,
        },
        body: JSON.stringify({ targetType: 0 })
      });
      const result = await response.json();

      if (result.status === 200 && result.success && result.content?.conversations) {
        const conversations = result.content.conversations as Array<{
          targetId: string;
          targetName: string;
          ownerId: string;
          targetAvatar?: string;
        }>;
        const validRooms = conversations.filter((r) => r.ownerId && r.ownerId !== '0');

        const roomsWithInfo: FollowedRoom[] = await Promise.all(
          validRooms.map(async (r) => {
            const ownerId = r.ownerId;
            let avatar = r.targetAvatar || '';
            let starTeamName = '';

            try {
              const archiveResult = await getStarArchives(currentAccount.token, Number(ownerId));
              const data = archiveResult as { status: number; content?: { starInfo?: { starAvatar?: string; starTeamName?: string } } };
              if (data.status === 200 && data.content?.starInfo) {
                avatar = data.content.starInfo.starAvatar || avatar;
                starTeamName = data.content.starInfo.starTeamName || '';
              }
            } catch {
              // 忽略错误
            }

            return {
              roomId: r.targetId,
              roomName: r.targetName || `房间 ${r.targetId}`,
              ownerId,
              avatar: avatar || DEFAULT_AVATAR,
              starTeamName,
            };
          })
        );

        setFollowedRooms(roomsWithInfo);
      }
    } catch (err) {
      console.error('加载关注房间失败:', err);
    } finally {
      setLoadingFollowedRooms(false);
    }
  }, [currentAccount]);

  // 搜索成员
  const handleMemberSearch = (keyword: string) => {
    setMemberSearchKeyword(keyword);
    if (!keyword.trim()) {
      setMemberSearchResults([]);
      return;
    }
    if (memberList.length === 0) {
      loadMemberList();
      return;
    }
    const matches = memberList.filter((m: MemberListItem) =>
      m.ownerName && m.ownerName.toLowerCase().includes(keyword.toLowerCase())
    );
    setMemberSearchResults(matches.slice(0, 20));
  };

  // 选择关注的成员
  const handleSelectFollowedRoom = (room: FollowedRoom) => {
    setSelectedFollowedRoom(room);
    setActiveTab('push');
    setMemberId(room.ownerId);
    setSelectedMemberName(room.roomName);
    setNextTime(0);
    setPerformances([]);
    loadPerformances();
  };

  // 选择搜索的成员
  const handleSelectMember = (member: MemberListItem) => {
    setSelectedFollowedRoom({
      roomId: member.roomId,
      roomName: member.ownerName,
      ownerId: String(member.id),
      avatar: DEFAULT_AVATAR,
      starTeamName: member.team,
    });
    setActiveTab('push');
    setMemberId(String(member.id));
    setSelectedMemberName(member.ownerName);
    setMemberSearchKeyword('');
    setMemberSearchResults([]);
    setNextTime(0);
    setPerformances([]);
  };

  // 查看全部
  const handleShowAll = () => {
    setSelectedFollowedRoom(null);
    setMemberId('');
    setSelectedMemberName('');
    setNextTime(0);
    setPerformances([]);
  };

  // ==================== 公演推送功能 ====================

  // 加载公演推送
  const loadPerformances = useCallback(async () => {
    if (!currentAccount) {
      setPushError('请先登录账号');
      return;
    }
    if (!memberId) {
      setPushError('请选择成员或输入成员ID');
      return;
    }
    setPushLoading(true);
    setPushError('');
    try {
      const result = await getOpenLiveMessages(currentAccount.token, memberId, nextTime);
      if (result.status === 200 && result.content?.message) {
        const parsedMessages = result.content.message.map(msg => {
          let parsedExtInfo;
          try {
            parsedExtInfo = JSON.parse(msg.extInfo);
          } catch {
            parsedExtInfo = {};
          }
          return { ...msg, parsedExtInfo };
        });

        setPerformances(prev => nextTime === 0 ? parsedMessages : [...prev, ...parsedMessages]);
        if (result.content.nextTime) {
          setNextTime(Number(result.content.nextTime));
        }
      } else {
        setPushError('获取公演列表失败');
      }
    } catch (err) {
      setPushError('获取公演列表失败');
      console.error(err);
    }
    setPushLoading(false);
  }, [currentAccount, memberId, nextTime]);

  // ==================== 公演录播功能 ====================

  // 加载录播列表
  const loadRecordList = useCallback(async (append: boolean = false) => {
    if (!currentAccount) {
      setRecordError('请先登录账号');
      return;
    }

    setRecordLoading(true);
    setRecordError('');

    try {
      const teamInfo = TEAM_RECORD_OPTIONS.find(t => t.value === selectedTeam);
      if (!teamInfo) return;

      const next = append ? recordNextPage : 0;
      const result = await getOpenLiveList(teamInfo.groupId, true, next);

      if (result.status === 200 && result.content?.liveList) {
        const newList = result.content.liveList;
        setRecordList(prev => append ? [...prev, ...newList] : newList);
        setRecordNextPage(result.content.next ?? 0);
        setHasMoreRecords((result.content.liveList.length ?? 0) >= 20);
      } else {
        setRecordError('获取录播列表失败');
      }
    } catch (err) {
      setRecordError('获取录播列表失败');
      console.error(err);
    } finally {
      setRecordLoading(false);
    }
  }, [currentAccount, selectedTeam, recordNextPage]);

  // 切换团队时加载录播
  useEffect(() => {
    if (activeTab === 'record') {
      setRecordNextPage(0);
      setHasMoreRecords(true);
      setRecordList([]);
      loadRecordList();
    }
  }, [activeTab, selectedTeam, loadRecordList]);

  // 获取流信息
  const handleShowStreamInfo = async (record: OpenLiveInfo) => {
    if (!currentAccount) {
      alert('请先登录账号');
      return;
    }
    setSelectedRecord(record);
    setShowStreamModal(true);
    setStreamInfo(null);

    try {
      const info = await getOpenLiveOne(currentAccount.token, record.liveId);
      setStreamInfo(info);
    } catch (err) {
      console.error('获取流信息失败:', err);
    }
  };

  // 生成下载命令
  const generateFFmpegCommand = (streamUrl: string, title: string): string => {
    const safeTitle = title.replace(/[\\/:*?"<>|]/g, '_');
    return `ffmpeg -i "${streamUrl}" -c copy -bsf:a aac_adtstoasc "${safeTitle}.mp4"`;
  };

  const handleGetDownloadCommand = async (record: OpenLiveInfo) => {
    if (!currentAccount) {
      alert('请先登录账号');
      return;
    }
    try {
      const info = await getOpenLiveOne(currentAccount.token, record.liveId);
      if (info?.content?.playStreams?.length) {
        const stream = info.content.playStreams.find(s => s.streamName === '高清')
          || info.content.playStreams.find(s => s.streamName === '标清')
          || info.content.playStreams.find(s => s.streamPath)
          || info.content.playStreams[info.content.playStreams.length - 1];

        if (stream?.streamPath) {
          const command = generateFFmpegCommand(stream.streamPath, record.title);
          navigator.clipboard.writeText(command).then(() => {
            alert(`下载命令已复制到剪贴板！\n\n${command}\n\n在命令行中执行此命令即可下载视频。`);
          }).catch(() => {
            prompt('复制以下命令：', command);
          });
        } else {
          alert('无可用的流地址');
        }
      }
    } catch (err) {
      console.error('获取流信息失败:', err);
      alert('获取流信息失败');
    }
  };

  // ==================== 公共功能 ====================

  // 切换标签
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  // 手动输入成员ID搜索推送
  const handleRefresh = () => {
    setNextTime(0);
    setPerformances([]);
    loadPerformances();
  };

  // 加载更多推送
  const handleLoadMore = () => {
    loadPerformances();
  };

  // 加载更多录播
  const handleLoadMoreRecords = () => {
    if (hasMoreRecords && !recordLoading) {
      loadRecordList(true);
    }
  };

  // 刷新录播列表
  const handleRefreshRecords = () => {
    setRecordNextPage(0);
    setHasMoreRecords(true);
    setRecordList([]);
    loadRecordList();
  };

  // 格式化时间
  const formatTime = (timestamp: string | number) => {
    const date = new Date(typeof timestamp === 'string' ? Number(timestamp) : timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 进入页面时自动加载关注房间
  useEffect(() => {
    if (currentAccount) {
      loadFollowedRooms();
    }
  }, [currentAccount, loadFollowedRooms]);

  // 当 memberId 变化时自动加载推送
  useEffect(() => {
    if (activeTab === 'push' && memberId) {
      setNextTime(0);
      setPerformances([]);
      loadPerformances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, memberId]);

  // 存储管理状态
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{ channelCount: number; totalMessages: number; estimatedSize: string } | null>(null);
  const [allMetadata, setAllMetadata] = useState<Array<{ channelId: string; channelName?: string; ownerName?: string; messageCount: number; lastUpdated: number }>>([]);
  const [isStorageLoading, setIsStorageLoading] = useState(false);

  // AI分析状态
  const [showAiPanel, setShowAiPanel] = useState(false);

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 加载存储信息
  const loadStorageInfo = useCallback(async () => {
    // Placeholder for storage info loading
    setStorageInfo({ channelCount: 0, totalMessages: 0, estimatedSize: '0 MB' });
    setAllMetadata([]);
  }, []);

  return (
    <div className="performance-list-container crystal-layout">
      {/* 左侧栏 - 关注的成员 */}
      <aside className={`performance-list-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* 关注的房间 */}
        <div className="crystal-panel">
          <div className="panel-title">
            <svg viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            关注的成员
          </div>

          {followedRooms.length === 0 && !loadingFollowedRooms ? (
            <div className="empty-state">
              <span className="empty-state-icon">💭</span>
              <p>没有已关注的成员</p>
              <p className="hint">请先在口袋48关注一些成员</p>
            </div>
          ) : (
            <>
              {/* 查看全部按钮 */}
              <button
                className={`show-all-btn ${!selectedFollowedRoom ? 'active' : ''}`}
                onClick={handleShowAll}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
                </svg>
                全部成员
              </button>

              <div className="rooms-grid">
                {followedRooms.map((room) => (
                  <div
                    key={room.roomId}
                    className={`room-card ${selectedFollowedRoom?.roomId === room.roomId ? 'selected' : ''}`}
                    onClick={() => handleSelectFollowedRoom(room)}
                  >
                    <div className="room-name">{room.roomName}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 成员搜索 */}
        <div className="crystal-panel">
          <div className="panel-title">
            <svg viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            搜索成员
          </div>
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="输入成员名字..."
              value={memberSearchKeyword}
              onChange={(e) => handleMemberSearch(e.target.value)}
              onFocus={() => {
                if (memberList.length === 0) loadMemberList();
              }}
              className="search-input"
            />
            {memberSearchResults.length > 0 && (
              <div className="search-results">
                {memberSearchResults.map((member: MemberListItem, index: number) => (
                  <div
                    key={`${member.channelId}-${index}`}
                    className="search-result-item"
                    onClick={() => handleSelectMember(member)}
                  >
                    <span className="search-result-name">{member.ownerName}</span>
                    <span className="search-result-team">{member.team || '未知队伍'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 数据统计面板 */}
        <div className="crystal-panel stats-section">
          <div className="panel-title" onClick={() => setShowStorageManager(!showStorageManager)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <svg viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            数据统计
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
              {showStorageManager ? '▼' : '▶'}
            </span>
          </div>
          {showStorageManager && (
            <div className="stats-content">
              <div className="stat-item">
                <span className="stat-label">推送消息</span>
                <span className="stat-value">{performances.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">录播数量</span>
                <span className="stat-value">{recordList.length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">关注成员</span>
                <span className="stat-value">{followedRooms.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* AI分析面板 */}
        <div className="crystal-panel">
          <div className="panel-title" onClick={() => setShowAiPanel(!showAiPanel)} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <svg viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            AI分析
            <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
              {showAiPanel ? '▼' : '▶'}
            </span>
          </div>
          {showAiPanel && (
            <div className="ai-panel-content">
              <p style={{ fontSize: '0.85rem', color: '#a78bfa', padding: '12px' }}>
                配置AI API Key后可对公演数据进行分析
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* 中央区域 - 公演列表 */}
      <main className="performance-list-main">
        {/* Tab 切换 */}
        <div className="tab-switch">
          <button
            className={`tab-btn ${activeTab === 'push' ? 'active' : ''}`}
            onClick={() => handleTabChange('push')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-8H5V5h12v4z"/>
            </svg>
            公演录播
          </button>
        </div>

        {/* ==================== 公演推送 ==================== */}
        {activeTab === 'push' && (
          <>
            {/* 选择成员提示 */}
            {!memberId && (
              <div className="selection-prompt">
                <span className="prompt-icon">👆</span>
                <p>请选择左侧关注的成员或搜索成员</p>
              </div>
            )}

            {/* 控制栏 */}
            {selectedMemberName && (
              <div className="control-bar">
                <span className="selected-member-name">{selectedMemberName} 的公演推送</span>
                {nextTime > 0 && (
                  <button className="load-more-btn-small" onClick={handleLoadMore} disabled={pushLoading}>
                    加载更多
                  </button>
                )}
              </div>
            )}

            {pushError && <div className="error-message">{pushError}</div>}

            <div className="performance-list">
              {performances.length === 0 && !pushLoading && !pushError && memberId && (
                <div className="empty-state">
                  <span className="empty-state-icon">📭</span>
                  <p>暂无公演推送消息</p>
                </div>
              )}
              {performances.map((msg) => (
                <PerformanceCard key={msg.msgIdClient} message={msg} currentAccount={currentAccount} />
              ))}
            </div>
          </>
        )}

        {/* ==================== 公演录播 ==================== */}
        {activeTab === 'record' && (
          <>
            {/* 录播控制栏 */}
            <div className="record-controls">
              <div className="team-select">
                <label htmlFor="record-team-select">团队:</label>
                <select
                  id="record-team-select"
                  value={selectedTeam}
                  onChange={(e) => {
                    setSelectedTeam(e.target.value);
                  }}
                  disabled={recordLoading}
                  className="crystal-select"
                >
                  {TEAM_RECORD_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="button-group">
                <button className="crystal-btn primary" onClick={handleRefreshRecords} disabled={recordLoading}>
                  {recordLoading ? '加载中...' : '刷新列表'}
                </button>
                {recordList.length > 0 && (
                  <button className="crystal-btn secondary" onClick={handleLoadMoreRecords} disabled={recordLoading || !hasMoreRecords}>
                    加载更多
                  </button>
                )}
              </div>
            </div>

            {recordError && <div className="error-message">{recordError}</div>}

            {/* 录播列表 */}
            <div className="record-list">
              {recordList.length === 0 && !recordLoading && !recordError && (
                <div className="empty-state">
                  <span className="empty-state-icon">📼</span>
                  <p>暂无录播数据</p>
                </div>
              )}

              {recordList.map((record) => (
                <div key={record.liveId} className="record-card">
                  <img
                    src={record.coverPath ? `https://source.48.cn${record.coverPath}` : ''}
                    alt={record.title}
                    className="record-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="68"><rect fill="%23f0f0f0" width="120" height="68"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999" font-size="12">无封面</text></svg>';
                    }}
                  />
                  <div className="record-info">
                    <h3 className="record-title" title={record.title}>{record.title}</h3>
                    <p className="record-subtitle">{record.subTitle}</p>
                    <div className="record-meta">
                      <span>📅 {formatTime(record.stime)}</span>
                      <span>🆔 {record.liveId}</span>
                    </div>
                  </div>
                  <div className="record-actions">
                    <button
                      className="crystal-btn primary"
                      onClick={() => handleShowStreamInfo(record)}
                    >
                      查看流信息
                    </button>
                    <button
                      className="crystal-btn secondary"
                      onClick={() => handleGetDownloadCommand(record)}
                    >
                      📥 获取下载命令
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 流信息弹窗 */}
        {showStreamModal && selectedRecord && (
          <div className="modal-overlay" onClick={() => setShowStreamModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{selectedRecord.title}</h3>
                <button className="modal-close" onClick={() => setShowStreamModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <p><strong>副标题:</strong> {selectedRecord.subTitle}</p>
                <p><strong>时间:</strong> {formatTime(selectedRecord.stime)}</p>

                {streamInfo === null ? (
                  <div className="loading-state">加载中...</div>
                ) : streamInfo?.content?.playStreams?.length ? (
                  <div className="stream-info">
                    <label>可用流地址:</label>
                    {streamInfo.content.playStreams.map((stream, idx) => (
                      <div key={idx} className="stream-item">
                        <div className="stream-header">
                          <strong>{stream.streamName}</strong>
                          {stream.vipShow && <span className="status-badge status-pending">VIP</span>}
                        </div>
                        <code className="stream-url">{stream.streamPath || '暂无地址'}</code>
                        {stream.streamPath && (
                          <div className="stream-actions">
                            <button
                              className="crystal-btn small"
                              onClick={() => {
                                const command = generateFFmpegCommand(stream.streamPath!, selectedRecord.title);
                                navigator.clipboard.writeText(command);
                                alert('FFmpeg 命令已复制！\n\n' + command);
                              }}
                            >
                              复制 FFmpeg 命令
                            </button>
                            <button
                              className="crystal-btn small"
                              onClick={() => {
                                navigator.clipboard.writeText(stream.streamPath!);
                                alert('流地址已复制！');
                              }}
                            >
                              复制流地址
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#999' }}>无可用的流地址</p>
                )}
              </div>
              <div className="modal-footer">
                <button className="crystal-btn secondary" onClick={() => setShowStreamModal(false)}>
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 侧边栏切换按钮 */}
      <button
        className="sidebar-toggle performance-toggle"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label="Toggle sidebar"
      >
        {sidebarCollapsed ? (
          <svg viewBox="0 0 24 24">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/>
          </svg>
        )}
      </button>
    </div>
  );
}

interface PerformanceCardProps {
  message: OpenLiveMessage;
  currentAccount: AccountInfo | null;
}

function PerformanceCard({ message, currentAccount }: PerformanceCardProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parsed = (message.parsedExtInfo || {}) as {
    id?: string;
    coverUrl?: string;
    title?: string;
    url?: string;
    jumpPath?: string;
    user?: {
      userId: number;
      nickname: string;
      avatar: string;
    };
    startTime?: number;
  };
  const coverUrl = parsed.coverUrl ? `https://source.48.cn${parsed.coverUrl}` : '';
  const user = parsed.user;

  // 解析 jumpPath 或 url 获取 liveId
  const liveId = parsed.id ||
    (parsed.url && extractLiveIdFromUrl(parsed.url)) ||
    (parsed.jumpPath && extractLiveIdFromJumpPath(parsed.jumpPath));

  function extractLiveIdFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('id') || undefined;
    } catch {
      return undefined;
    }
  }

  function extractLiveIdFromJumpPath(jumpPath: string): string | undefined {
    try {
      const params = new URLSearchParams(jumpPath.replace(/\\u003d/g, '=').replace(/\\u0026/g, '&'));
      return params.get('id') || undefined;
    } catch {
      return undefined;
    }
  }

  // 获取视频地址
  const fetchVideoUrl = async () => {
    if (!currentAccount || !liveId) {
      alert('无法获取视频地址：缺少必要信息');
      return;
    }

    setLoadingVideo(true);
    try {
      const response = await fetch('/pocketapi/live/api/v1/live/getOpenLiveOne', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'Accept': '*/*',
          'Connection': 'keep-alive',
          'pa': 'MTY5MjY1MzQwODAwMCwyNDExLDIwNzc2MUQxM0E2NjE1MjFCNkE0NkM4QTY4NTVCNjM3LA==',
          'User-Agent': 'PocketFans201807/7.1.0 (iPad; iOS 16.6; Scale/2.00)',
          'Accept-Language': 'zh-Hans-CN;q=1, zh-Hant-TW;q=0.9',
          'Origin': 'https://pocket.48.cn',
          'Referer': 'https://pocket.48.cn/',
          'AppInfo': JSON.stringify({
            vendor: 'Huawei',
            deviceId: 'F2BA149C-06DB-9843-31DE-36BF375E36F2',
            appVersion: '7.1.0',
            appBuild: '23051902',
            osVersion: '16.6.0',
            osType: 'ios',
            deviceName: 'Huawei',
            os: 'ios',
          }),
          'token': currentAccount.token,
        },
        body: JSON.stringify({ liveId: String(liveId) })
      });

      const result = await response.json();

      if (result.status === 200 && result.content) {
        const videoPath = result.content.playPath || result.content.hlsPath;
        if (videoPath) {
          setVideoUrl(`https://source.48.cn${videoPath}`);
          setShowVideo(true);
        } else {
          alert('无法获取视频地址：未找到视频路径');
        }
      } else {
        alert(`无法获取视频地址：${result.message || '该直播已被删除'}`);
      }
    } catch (err) {
      console.error('获取视频地址失败:', err);
      alert('获取视频地址失败');
    } finally {
      setLoadingVideo(false);
    }
  };

  const handleCloseVideo = () => {
    setShowVideo(false);
    setVideoUrl('');
  };

  return (
    <div className="performance-card">
      <div className="performance-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={parsed.title || '公演'} />
        ) : (
          <div className="performance-cover-placeholder">无封面</div>
        )}
        <div className="performance-badge">公演直播</div>
        <button
          className={`play-overlay-btn ${loadingVideo ? 'loading' : ''}`}
          onClick={fetchVideoUrl}
          disabled={loadingVideo}
        >
          {loadingVideo ? (
            <div className="loading-spinner"></div>
          ) : (
            <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
      </div>
      <div className="performance-info">
        <h3 className="performance-title">{parsed.title || '未命名公演'}</h3>
        <div className="performance-time">{formatTime(message.msgTime)}</div>
        {user && (
          <div className="performance-user">
            <img
              src={`https://source.48.cn${user.avatar}`}
              alt={user.nickname}
              className="user-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
            />
            <span>{user.nickname}</span>
          </div>
        )}
        {parsed.startTime && (
          <div className="performance-start-time">开播: {formatTime(parsed.startTime)}</div>
        )}
        {parsed.id && (
          <div className="performance-live-id">直播ID: {parsed.id}</div>
        )}
      </div>

      {/* 视频播放器弹窗 */}
      {showVideo && videoUrl && (
        <div className="video-modal" onClick={handleCloseVideo}>
          <div className="video-modal-content" onClick={e => e.stopPropagation()}>
            <button className="video-modal-close" onClick={handleCloseVideo}>×</button>
            <div className="video-player-wrapper">
              <video
                className="video-player"
                controls
                autoPlay
                src={videoUrl}
              />
            </div>
            <div className="video-info">
              <h4>{parsed.title}</h4>
              <p>直播ID: {parsed.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
