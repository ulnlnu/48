import { useState, useEffect, useCallback } from 'react';
import { getLiveList, getLiveOne, getMemberList, getStarArchives, type MemberListItem } from '../services/pocket48Api';
import type { AccountInfo } from '../types';
import './LiveList.css';

interface LiveListProps {
  currentAccount: AccountInfo | null;
}

type ModeType = 'live' | 'record';

// 成员直播信息
interface MemberLive {
  liveId: string;
  title: string;
  coverPath: string;
  ctime: string;
  roomId: string;
  liveType: number;
  userInfo?: {
    userId: string;
    nickName: string;
    avatar: string;
  };
}

// 关注的房间项
interface FollowedRoom {
  roomId: string;
  roomName: string;
  ownerId: string;
  avatar?: string;
  starTeamName?: string;
}

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

export function LiveList({ currentAccount }: LiveListProps) {
  const [mode, setMode] = useState<ModeType>('live');
  const [lives, setLives] = useState<MemberLive[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(0);

  // 关注的房间列表
  const [followedRooms, setFollowedRooms] = useState<FollowedRoom[]>([]);
  const [loadingFollowedRooms, setLoadingFollowedRooms] = useState(false);
  const [selectedFollowedRoom, setSelectedFollowedRoom] = useState<FollowedRoom | null>(null);

  // 成员搜索状态
  const [memberList, setMemberList] = useState<MemberListItem[]>([]);
  const [memberSearchKeyword, setMemberSearchKeyword] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<MemberListItem[]>([]);
  const [isMemberListLoading, setIsMemberListLoading] = useState(false);

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
    setError('');

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

        // 获取每个房间的成员信息
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
    // 可以在这里触发加载该成员的直播
    setMode('live');
    setNextPage(0);
    setLives([]);
    loadLives(false, room.ownerId);
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
    setMemberSearchKeyword('');
    setMemberSearchResults([]);
    setMode('live');
    setNextPage(0);
    setLives([]);
    loadLives(false, String(member.id));
  };

  const loadLives = useCallback(async (append: boolean = false, userId?: string) => {
    if (!currentAccount) {
      setError('请先登录账号');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = append ? nextPage : 0;
      const result = await getLiveList(currentAccount.token, {
        next,
        record: mode === 'record',
        groupId: 0,
        userId: userId ? Number(userId) : undefined,
      });

      if (result.status === 200 && result.content?.liveList) {
        const newList = result.content.liveList;
        setLives(prev => append ? [...prev, ...newList] : newList);
        setNextPage(Number(result.content.next) || 0);
        setHasMore(newList.length >= 20);
      } else {
        setError(mode === 'live' ? '获取直播列表失败' : '获取录播列表失败');
      }
    } catch (err) {
      setError(mode === 'live' ? '获取直播列表失败' : '获取录播列表失败');
      console.error(err);
    }
    setLoading(false);
  }, [currentAccount, nextPage, mode]);

  useEffect(() => {
    setNextPage(0);
    setHasMore(true);
    setLives([]);
    loadLives(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount, mode]);

  // 进入页面时自动加载关注房间
  useEffect(() => {
    if (currentAccount) {
      loadFollowedRooms();
    }
  }, [currentAccount, loadFollowedRooms]);

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadLives(true);
    }
  };

  const handleRefresh = () => {
    setNextPage(0);
    setHasMore(true);
    setLives([]);
    loadLives(false);
  };

  const handleModeChange = (newMode: ModeType) => {
    setMode(newMode);
  };

  const handleShowAll = () => {
    setSelectedFollowedRoom(null);
    setNextPage(0);
    setLives([]);
    loadLives(false);
  };

  return (
    <div className="live-list-container crystal-layout">
      {/* 左侧栏 - 关注的成员 */}
      <aside className="live-list-sidebar">
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
      </aside>

      {/* 中央区域 - 直播列表 */}
      <main className="live-list-main">
        <div className="live-list-header">
          <h2>
            {selectedFollowedRoom ? (
              <>
                <span className="selected-member-name">{selectedFollowedRoom.roomName}</span>
                <span className="selected-member-badge">的{mode === 'live' ? '直播' : '录播'}</span>
              </>
            ) : (
              `全部成员${mode === 'live' ? '直播' : '录播'}`
            )}
          </h2>
          <div className="mode-switch">
            <button
              className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
              onClick={() => handleModeChange('live')}
            >
              📺 正在直播
            </button>
            <button
              className={`mode-btn ${mode === 'record' ? 'active' : ''}`}
              onClick={() => handleModeChange('record')}
            >
              💿 历史录播
            </button>
          </div>
          <button className="refresh-btn" onClick={handleRefresh} disabled={loading}>
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="live-list">
          {lives.length === 0 && !loading && !error && (
            <div className="empty-state">
              <span className="empty-state-icon">📺</span>
              <p>{mode === 'live' ? '暂无正在直播的成员' : '暂无历史录播'}</p>
              {selectedFollowedRoom && (
                <p className="hint">该成员暂时没有{mode === 'live' ? '直播' : '录播'}</p>
              )}
            </div>
          )}
          {lives.map(live => (
            <LiveCard key={live.liveId} live={live} currentAccount={currentAccount} mode={mode} />
          ))}
        </div>

        {lives.length > 0 && hasMore && !loading && (
          <button className="load-more-btn" onClick={handleLoadMore}>
            加载更多
          </button>
        )}
      </main>
    </div>
  );
}

interface LiveCardProps {
  live: MemberLive;
  currentAccount: AccountInfo | null;
  mode: ModeType;
}

function LiveCard({ live, currentAccount, mode }: LiveCardProps) {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(Number(timestamp));
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    return `${Math.floor(diff / 86400)}天前`;
  };

  const coverUrl = live.coverPath ? `https://source.48.cn${live.coverPath}` : '';

  // 获取流地址
  const fetchStreamUrl = async () => {
    if (!currentAccount) {
      alert('请先登录');
      return;
    }
    setLoadingStream(true);
    try {
      const { getLiveOne } = await import('../services/pocket48Api');
      const info = await getLiveOne(live.liveId);
      if (info?.content?.playStreamPath) {
        setStreamUrl(`https://source.48.cn${info.content.playStreamPath}`);
        setShowVideo(true);
      } else {
        alert('无法获取流地址');
      }
    } catch (err) {
      console.error('获取流地址失败:', err);
      alert('获取流地址失败');
    } finally {
      setLoadingStream(false);
    }
  };

  const handleCloseVideo = () => {
    setShowVideo(false);
    setStreamUrl(null);
  };

  return (
    <div className="live-card">
      <div className="live-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={live.title} onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }} />
        ) : (
          <div className="live-cover-placeholder">无封面</div>
        )}
        <div className="live-badge">{mode === 'live' ? '直播中' : '录播'}</div>
        <button
          className="play-overlay-btn"
          onClick={fetchStreamUrl}
          disabled={loadingStream}
        >
          {loadingStream ? (
            <div className="loading-spinner"></div>
          ) : (
            <svg viewBox="0 0 24 24" width="48" height="48" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
      </div>
      <div className="live-info">
        <h3 className="live-title">{live.title || '未命名直播'}</h3>
        {live.ctime && (
          <div className="live-time">开播于 {formatTime(live.ctime)}</div>
        )}
        {live.userInfo && (
          <div className="live-user">
            <img
              src={`https://source.48.cn${live.userInfo.avatar}`}
              alt={live.userInfo.nickName}
              className="user-avatar"
              onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_AVATAR;
              }}
            />
            <span>{live.userInfo.nickName}</span>
          </div>
        )}
        <div className="live-room-id">房间ID: {live.roomId}</div>
      </div>

      {/* 视频播放器弹窗 */}
      {showVideo && streamUrl && (
        <div className="video-modal" onClick={handleCloseVideo}>
          <div className="video-modal-content" onClick={e => e.stopPropagation()}>
            <button className="video-modal-close" onClick={handleCloseVideo}>×</button>
            <div className="video-player-wrapper">
              <video
                className="video-player"
                controls
                autoPlay
                src={streamUrl}
              />
            </div>
            <div className="video-info">
              <h4>{live.title}</h4>
              <p>直播ID: {live.liveId}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
