import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getTeamRoomInfo,
  fetchTeamMessages,
  fetchTeamOwnerMessages,
  getMemberList,
  getStarArchives,
  getGiftList,
  type MemberListItem,
} from '../services/pocket48Api';
import type { AccountInfo, RoomOwnerMessage, GiftInfo } from '../types';
import { messageDB, type StoredRoomMessages } from '../services/indexedDB';
import { AIFeatures } from './AIFeatures';
import { MessageStatistics } from './MessageStatistics';
import './PocketRoom.css';

// 关注的房间项
interface FollowedRoom {
  roomId: string;
  roomName: string;
  ownerId: string;
  avatar?: string;
  starTeamName?: string;
}

// Team 消息上下文
interface TeamContext {
  channelId: string;
  serverId: string;
  ownerId?: string;
  nextTime: string;
  channelInfo?: {
    channelName?: string;
    ownerName?: string;
    ownerId?: number;
    [key: string]: unknown;
  };
}

// 小偶像房间信息
interface IdolRoomInfo {
  channelId: string;
  channelName?: string;
  ownerName?: string;
  ownerId?: number;
  serverId: string;
}

// 消息筛选条件
interface MessageFilter {
  startTime: string;
  endTime: string;
  speaker: string;
  keyword: string;
}

interface PocketRoomProps {
  currentAccount: AccountInfo | null;
}

// 从 IndexedDB 加载存储的消息
const loadStoredMessages = async (channelId: string): Promise<StoredRoomMessages | null> => {
  try {
    return await messageDB.loadMessages(channelId);
  } catch (e) {
    console.error('Failed to load stored messages', e);
    return null;
  }
};

// 保存消息到 IndexedDB
const saveMessagesToStorage = async (channelId: string, messages: RoomOwnerMessage[], channelName?: string, ownerName?: string, ownerId?: number): Promise<{ saved: number; skipped: number } | null> => {
  try {
    const result = await messageDB.saveMessages(channelId, messages, channelName, ownerName, ownerId);
    return result;
  } catch (e) {
    console.error('Failed to save messages', e);
    return null;
  }
};

/**
 * 智能合并消息列表，严格去重
 * @param existing 现有消息列表
 * @param newMessages 新消息列表
 * @returns 去重后的合并消息列表
 */
const mergeMessagesDedup = (existing: RoomOwnerMessage[], newMessages: RoomOwnerMessage[]): RoomOwnerMessage[] => {
  // 使用 Map 基于 msgIdServer 去重，新消息优先
  const messageMap = new Map<string, RoomOwnerMessage>();

  // 先添加现有消息
  existing.forEach(msg => {
    messageMap.set(msg.msgIdServer, msg);
  });

  // 新消息覆盖旧消息（同一 msgIdServer）
  newMessages.forEach(msg => {
    messageMap.set(msg.msgIdServer, msg);
  });

  // 转换回数组并按时间倒序排列
  return Array.from(messageMap.values()).sort((a, b) => b.msgTime - a.msgTime);
};

// Toast 通知类型
type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export const PocketRoom: React.FC<PocketRoomProps> = ({ currentAccount }) => {
  const [, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeApi, setActiveApi] = useState<string>('');
  const [isAutoFetching, setIsAutoFetching] = useState(false);
  const stopAutoFetchRef = useRef(false);

  // Toast 通知状态
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 显示 Toast 通知
  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Date.now().toString() + Math.random();
    const newToast: Toast = { id, type, message, duration };

    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  // 移除 Toast
  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // 消息加载状态管理
  const [messageList, setMessageList] = useState<RoomOwnerMessage[]>([]);
  const [filterLivePush, setFilterLivePush] = useState(false);
  const [teamContext, setTeamContext] = useState<TeamContext | null>(null);
  const [currentApiMode, setCurrentApiMode] = useState<'all' | 'owner'>('all');
  const loadingChannelIdRef = useRef<string | null>(null); // 防止重复加载同一房间

  // 保存的 Team 信息
  const [savedTeams, setSavedTeams] = useState<TeamContext[]>([]);

  // 小偶像房间状态
  const [idolRoomInfo, setIdolRoomInfo] = useState<IdolRoomInfo | null>(null);
  const [inputChannelId, setInputChannelId] = useState('');

  // 成员搜索状态
  const [memberList, setMemberList] = useState<MemberListItem[]>([]);
  const [memberSearchKeyword, setMemberSearchKeyword] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<MemberListItem[]>([]);
  const [isMemberListLoading, setIsMemberListLoading] = useState(false);

  // 存储的房间消息
  const [storedMessages, setStoredMessages] = useState<StoredRoomMessages | null>(null);

  // 关注的房间列表
  const [followedRooms, setFollowedRooms] = useState<FollowedRoom[]>([]);
  const [loadingFollowedRooms, setLoadingFollowedRooms] = useState(false);
  const [selectedFollowedRoom, setSelectedFollowedRoom] = useState<FollowedRoom | null>(null);

  // 筛选条件
  const [filter, setFilter] = useState<MessageFilter>({
    startTime: '',
    endTime: '',
    speaker: '',
    keyword: '',
  });
  // 临时筛选条件（未确认前不生效）
  const [tempFilter, setTempFilter] = useState<MessageFilter>({
    startTime: '',
    endTime: '',
    speaker: '',
    keyword: '',
  });

  // 消息类型筛选
  const [msgTypeFilter, setMsgTypeFilter] = useState<string>('all');

  // 发言人搜索下拉状态
  const [showSpeakerDropdown, setShowSpeakerDropdown] = useState(false);

  // 房间主页筛选状态（筛选房主和回复消息）
  const [showOwnerRepliesOnly, setShowOwnerRepliesOnly] = useState(false);

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageJumpInput, setPageJumpInput] = useState('');
  const MESSAGES_PER_PAGE = 100;

  // 存储管理状态
  const [storageInfo, setStorageInfo] = useState<{ channelCount: number; totalMessages: number; estimatedSize: string } | null>(null);
  const [allMetadata, setAllMetadata] = useState<Array<{ channelId: string; channelName?: string; ownerName?: string; messageCount: number; lastUpdated: number }>>([]);
  const [isStorageLoading, setIsStorageLoading] = useState(false);
  const [viewingStorageList, setViewingStorageList] = useState(false);

  // 礼物列表状态
  const [giftList, setGiftList] = useState<GiftInfo[]>([]);
  const [isLoadingGifts, setIsLoadingGifts] = useState(false);

  // 视图状态: 'messages' | 'stored-data' | 'ai-analysis'
  const [currentView, setCurrentView] = useState<'messages' | 'stored-data' | 'ai-analysis' | 'data-statistics'>('messages');

  // 初始化 IndexedDB
  useEffect(() => {
    messageDB.init().catch(err => {
      console.error('IndexedDB 初始化失败:', err);
    });
  }, []);

  // 重置分页当筛选条件改变时
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, filterLivePush]);

  // 加载存储信息
  const loadStorageInfo = useCallback(async () => {
    try {
      const [info, metadata] = await Promise.all([
        messageDB.getStorageInfo(),
        messageDB.getAllMetadata(),
      ]);
      setStorageInfo(info);
      setAllMetadata(metadata);
    } catch (err) {
      console.error('加载存储信息失败:', err);
    }
  }, []);

  // 加载礼物列表（默认使用用户ID 63559）
  const loadGiftList = useCallback(async () => {
    if (!currentAccount) return;

    setIsLoadingGifts(true);
    try {
      const defaultUserId = 63559; // 使用数字格式
      console.log('[PocketRoom] 开始加载礼物列表, userId:', defaultUserId);
      const result = await getGiftList(currentAccount.token, defaultUserId) as {
        status: number;
        success?: boolean;
        content?: Array<{
          typeId: number;
          typeName: string;
          specialInstru: string;
          giftList: GiftInfo[];
        }>;
        message?: string;
      };

      console.log('[PocketRoom] 礼物列表API响应:', result);

      if (result.status === 200 && result.success && result.content) {
        // API 返回的是分类数组，每个分类里有 giftList
        // 需要把所有分类的礼物合并到一个数组
        const allGifts: GiftInfo[] = [];
        result.content.forEach(category => {
          if (category.giftList && Array.isArray(category.giftList)) {
            allGifts.push(...category.giftList);
          }
        });

        // Filter out gifts with missing required properties
        const validGifts = allGifts.filter(gift =>
          gift != null &&
          gift.giftId != null &&
          gift.giftName != null
        );
        setGiftList(validGifts);
        console.log('礼物列表加载成功:', validGifts.length, '个礼物');
        if (validGifts.length < allGifts.length) {
          console.warn('过滤掉了', allGifts.length - validGifts.length, '个无效礼物');
        }

        // 保存到本地 IndexedDB
        try {
          await messageDB.saveGiftList(validGifts);
          console.log('礼物列表已保存到本地存储');
        } catch (err) {
          console.error('保存礼物列表到本地存储失败:', err);
        }
      } else {
        console.error('获取礼物列表失败:', result);
      }
    } catch (err) {
      console.error('加载礼物列表失败:', err);
    } finally {
      setIsLoadingGifts(false);
    }
  }, [currentAccount]);

  // 从本地存储加载礼物列表
  const loadGiftListFromDB = useCallback(async () => {
    try {
      const storedGifts = await messageDB.getGiftList();
      if (storedGifts && storedGifts.length > 0) {
        setGiftList(storedGifts);
        console.log('从本地存储加载了', storedGifts.length, '个礼物');
      }
    } catch (err) {
      console.error('从本地存储加载礼物列表失败:', err);
    }
  }, []);

  // 组件挂载时尝试从本地存储加载礼物列表
  useEffect(() => {
    loadGiftListFromDB();
  }, [loadGiftListFromDB]);

  // 加载关注的房间列表
  const loadFollowedRooms = useCallback(async () => {
    if (!currentAccount) return;
    setLoadingFollowedRooms(true);
    setResult('');

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
      console.log('conversation/page 返回的原始数据:', result);

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
              avatar: avatar || 'https://source.48.cn/images/default_avatar.png',
              starTeamName,
            };
          })
        );

        setFollowedRooms(roomsWithInfo);
        if (roomsWithInfo.length === 0) {
          setResult('没有找到已关注的房间');
        }
      } else {
        setResult(`获取房间列表失败: ${result.message || '未知错误'}`);
      }
    } catch (err) {
      setResult(`加载房间列表失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingFollowedRooms(false);
    }
  }, [currentAccount]);

  // 选择关注的房间并加载消息
  const handleSelectFollowedRoom = async (room: FollowedRoom) => {
    if (!currentAccount) return;

    // 防止重复加载同一房间
    if (loadingChannelIdRef.current === room.roomId) {
      console.log('[关注房间] 正在加载中，跳过重复请求');
      return;
    }

    setSelectedFollowedRoom(room);
    setLoading(true);
    setMessageList([]);
    setActiveApi('');
    setCurrentApiMode('all');
    setViewingStorageList(false); // 清除存储列表查看状态
    loadingChannelIdRef.current = room.roomId;

    // 清空搜索栏
    setMemberSearchKeyword('');
    setMemberSearchResults([]);

    try {
      console.log('conversation/page 返回:', { targetId: room.roomId, ownerId: room.ownerId });

      // 确保成员列表已加载，并获取加载后的列表
      const loadedList = memberList.length > 0 ? memberList : await loadMemberList();

      console.log('当前成员列表长度:', loadedList.length);
      if (loadedList.length > 0) {
        console.log('第一个成员:', { id: loadedList[0].id, roomId: loadedList[0].roomId, ownerName: loadedList[0].ownerName });
      }

      // 用 targetId (roomId) 在 member.json 中查找对应的成员
      const matchedMember = loadedList.find((m: MemberListItem) => String(m.roomId) === room.roomId);

      console.log('查找 targetId:', room.roomId, '匹配结果:', matchedMember ? '找到' : '未找到');

      if (!matchedMember) {
        setResult('未找到匹配的成员信息');
        return;
      }

      console.log('找到匹配的成员:', { ownerName: matchedMember.ownerName, channelId: matchedMember.channelId });

      // 使用 member.json 中的 channelId 获取房间信息
      const data = await getTeamRoomInfo(currentAccount.token, matchedMember.channelId);
      if (data && data.serverId) {
        const realChannelId = data.channelInfo?.channelId as string || matchedMember.channelId;
        const roomInfo: IdolRoomInfo = {
          channelId: realChannelId,
          serverId: data.serverId,
          channelName: data.channelInfo?.channelName as string | undefined,
          ownerName: data.channelInfo?.ownerName as string | undefined,
          ownerId: data.channelInfo?.ownerId as number | undefined,
        };
        setIdolRoomInfo(roomInfo);
        setInputChannelId(realChannelId); // 设置 inputChannelId 以便按钮使用

        const team: TeamContext = {
          channelId: realChannelId,
          serverId: data.serverId,
          nextTime: '0',
          channelInfo: data.channelInfo,
        };
        setTeamContext(team);

        // 修复：先获取最新消息，再与存储消息智能合并
        // 这样确保显示的是最新数据，同时避免重复
        const messagesData = await fetchTeamMessages(currentAccount.token, realChannelId, data.serverId, '0');
        const responseData = messagesData as { content?: { message?: RoomOwnerMessage[]; nextTime?: string | number } };

        let finalMessages: RoomOwnerMessage[] = [];

        if (responseData.content?.message) {
          const newMessages = responseData.content.message;
          console.log(`[关注房间] 获取到 ${newMessages.length} 条最新消息`);

          // 尝试加载已存储的消息用于合并
          const stored = await loadStoredMessages(realChannelId);
          if (stored && stored.messages.length > 0) {
            console.log(`[关注房间] 本地存储有 ${stored.messages.length} 条消息`);
            setStoredMessages(stored);

            // 使用智能合并函数去重
            finalMessages = mergeMessagesDedup(stored.messages, newMessages);
            console.log(`[关注房间] 合并后共 ${finalMessages.length} 条消息（去重 ${stored.messages.length + newMessages.length - finalMessages.length} 条）`);
          } else {
            // 没有存储消息，直接使用新消息
            finalMessages = newMessages;
            console.log(`[关注房间] 无本地存储，使用最新 ${finalMessages.length} 条消息`);
          }

          setMessageList(finalMessages);
          setActiveApi('fetchTeamMessages');

          // 保存新消息到存储（IndexedDB 内部会去重）
          const saveResult = await saveMessagesToStorage(
            realChannelId,
            newMessages,
            roomInfo.channelName,
            roomInfo.ownerName,
            roomInfo.ownerId
          );
          if (saveResult) {
            console.log(`[关注房间] 保存了 ${saveResult.saved} 条消息，跳过 ${saveResult.skipped} 条重复`);
          }

          showToast('success', `已加载 ${finalMessages.length} 条消息`);
          setResult(`已加载留言板消息 (${finalMessages.length} 条)`);
        } else {
          // API 没有返回消息，尝试加载存储的消息
          const stored = await loadStoredMessages(realChannelId);
          if (stored && stored.messages.length > 0) {
            setStoredMessages(stored);
            setMessageList(stored.messages);
            setActiveApi('stored');
            setResult(`已加载本地存储的消息 (${stored.messages.length} 条)`);
          } else {
            setResult('暂无消息');
          }
        }
      } else {
        setResult('获取房间信息失败');
      }
    } catch (error) {
      setResult(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
      loadingChannelIdRef.current = null;
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem('pocket48_teams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedTeams(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load teams from localStorage', e);
    }
  }, []);

  // 进入页面时自动加载关注的房间
  useEffect(() => {
    if (currentAccount) {
      loadFollowedRooms();
    }
  }, [currentAccount, loadFollowedRooms]);

  // 进入页面时自动加载礼物列表
  useEffect(() => {
    if (currentAccount) {
      loadGiftList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAccount]);

  // 加载成员列表
  const loadMemberList = useCallback(async (): Promise<MemberListItem[]> => {
    if (memberList.length > 0) return memberList;
    setIsMemberListLoading(true);
    try {
      const list = await getMemberList();
      console.log('getMemberList 返回成员数:', list.length);
      setMemberList(list);
      return list;
    } catch (error) {
      console.error('加载成员列表失败:', error);
      return [];
    } finally {
      setIsMemberListLoading(false);
    }
  }, [memberList.length]);

  // 搜索成员
  const handleMemberSearch = (keyword: string) => {
    setMemberSearchKeyword(keyword);
    if (!keyword.trim()) {
      setMemberSearchResults([]);
      return;
    }
    // 如果还没加载成员列表，先加载
    if (memberList.length === 0) {
      loadMemberList();
      return;
    }
    const matches = memberList.filter((m: MemberListItem) =>
      m.ownerName && m.ownerName.toLowerCase().includes(keyword.toLowerCase())
    );
    setMemberSearchResults(matches.slice(0, 20)); // 限制显示20条
  };

  // 选择成员
  const handleSelectMember = async (member: MemberListItem) => {
    if (!currentAccount) return;

    // 防止重复加载同一房间
    if (loadingChannelIdRef.current === member.channelId) {
      console.log('[搜索成员] 正在加载中，跳过重复请求');
      return;
    }

    setInputChannelId(member.channelId);
    setMemberSearchKeyword(member.ownerName);
    setMemberSearchResults([]);
    setSelectedFollowedRoom(null); // 清除选中的关注房间
    setLoading(true);
    setMessageList([]);
    setActiveApi('');
    setCurrentApiMode('all');
    setShowOwnerRepliesOnly(false);
    setViewingStorageList(false); // 清除存储列表查看状态
    loadingChannelIdRef.current = member.channelId;

    try {
      setResult(`正在加载 ${member.ownerName} 的房间...`);

      // 获取房间信息
      const data = await getTeamRoomInfo(currentAccount.token, member.channelId);
      if (data && data.serverId) {
        const realChannelId = data.channelInfo?.channelId as string || member.channelId;
        const roomInfo: IdolRoomInfo = {
          channelId: realChannelId,
          serverId: data.serverId,
          channelName: data.channelInfo?.channelName as string | undefined,
          ownerName: data.channelInfo?.ownerName as string | undefined,
          ownerId: data.channelInfo?.ownerId as number | undefined,
        };
        setIdolRoomInfo(roomInfo);
        setInputChannelId(realChannelId);

        const team: TeamContext = {
          channelId: realChannelId,
          serverId: data.serverId,
          nextTime: '0',
          channelInfo: data.channelInfo,
        };
        setTeamContext(team);
        saveTeam(team);

        // 先获取最新消息，再与存储消息智能合并
        const messagesData = await fetchTeamMessages(currentAccount.token, realChannelId, data.serverId, '0');
        const responseData = messagesData as { content?: { message?: RoomOwnerMessage[]; nextTime?: string | number } };

        let finalMessages: RoomOwnerMessage[] = [];

        if (responseData.content?.message) {
          const newMessages = responseData.content.message;
          console.log(`[搜索成员] 获取到 ${newMessages.length} 条最新消息`);

          // 尝试加载已存储的消息用于合并
          const stored = await loadStoredMessages(realChannelId);
          if (stored && stored.messages.length > 0) {
            console.log(`[搜索成员] 本地存储有 ${stored.messages.length} 条消息`);
            setStoredMessages(stored);

            // 使用智能合并函数去重
            finalMessages = mergeMessagesDedup(stored.messages, newMessages);
            console.log(`[搜索成员] 合并后共 ${finalMessages.length} 条消息（去重 ${stored.messages.length + newMessages.length - finalMessages.length} 条）`);
          } else {
            // 没有存储消息，直接使用新消息
            finalMessages = newMessages;
            console.log(`[搜索成员] 无本地存储，使用最新 ${finalMessages.length} 条消息`);
          }

          setMessageList(finalMessages);
          setActiveApi('fetchTeamMessages');

          // 保存新消息到存储
          const saveResult = await saveMessagesToStorage(
            realChannelId,
            newMessages,
            roomInfo.channelName,
            roomInfo.ownerName,
            roomInfo.ownerId
          );
          if (saveResult) {
            console.log(`[搜索成员] 保存了 ${saveResult.saved} 条消息，跳过 ${saveResult.skipped} 条重复`);
          }

          showToast('success', `已加载 ${finalMessages.length} 条消息`);
          setResult(`已加载 ${member.ownerName} 的留言板消息 (${finalMessages.length} 条)`);
        } else {
          // API 没有返回消息，尝试加载存储的消息
          const stored = await loadStoredMessages(realChannelId);
          if (stored && stored.messages.length > 0) {
            setStoredMessages(stored);
            setMessageList(stored.messages);
            setActiveApi('stored');
            setResult(`已加载本地存储的消息 (${stored.messages.length} 条)`);
          } else {
            setResult('暂无消息');
          }
        }
      } else {
        setResult('获取房间信息失败');
      }
    } catch (error) {
      setResult(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
      loadingChannelIdRef.current = null;
    }
  };

  // 选择已存储的频道
  const handleSelectStoredChannel = async (channelId: string, channelName?: string, ownerName?: string, storeType: 'all' | 'owner_replies' = 'all') => {
    if (!currentAccount) return;

    setInputChannelId(channelId);
    setSelectedFollowedRoom(null); // 清除选中的关注房间
    setMemberSearchKeyword(''); // 清空搜索栏
    setMemberSearchResults([]);
    setViewingStorageList(true); // 设置为查看存储列表模式
    setLoading(false);
    setActiveApi('stored');
    setResult(`已选择存储频道: ${channelName || channelId}`);
  };

  // 从消息列表中提取房主的 nickName
  const ownerNickName = useMemo(() => {
    if (!idolRoomInfo?.ownerId || messageList.length === 0) {
      return null;
    }
    for (const msg of messageList) {
      try {
        const ext = JSON.parse(msg.extInfo);
        const msgUserId = ext.user?.userId;
        const msgNickName = ext.user?.nickName;
        if (msgUserId != null && String(msgUserId) === String(idolRoomInfo.ownerId) && msgNickName) {
          return msgNickName;
        }
      } catch {
        // 忽略解析错误
      }
    }
    return null;
  }, [idolRoomInfo?.ownerId, messageList]);

  // 筛选后的消息列表
  const filteredMessages = useMemo(() => {
    let filtered = messageList;

    // 消息类型筛选
    if (msgTypeFilter !== 'all') {
      filtered = filtered.filter(m => {
        if (msgTypeFilter === 'TEXT') {
          return m.msgType === 'TEXT' || (!m.msgType && m.bodys && !m.url);
        } else if (msgTypeFilter === 'VOICE') {
          return m.msgType === 'VOICE' || m.msgType === 'AUDIO';
        } else if (msgTypeFilter === 'VIDEO') {
          return m.msgType === 'VIDEO' || (m.url && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(m.ext || ''));
        } else if (msgTypeFilter === 'REPLY') {
          return m.msgType === 'REPLY';
        } else if (msgTypeFilter === 'GIFTREPLY') {
          return m.msgType === 'GIFTREPLY';
        } else if (msgTypeFilter === 'LIVEPUSH') {
          return m.msgType === 'LIVEPUSH';
        } else if (msgTypeFilter === 'EXPRESSIMAGE') {
          return m.msgType === 'EXPRESSIMAGE';
        } else if (msgTypeFilter === 'GIFT_TEXT') {
          return m.msgType === 'GIFT_TEXT';
        } else if (msgTypeFilter === 'IMAGE') {
          return m.msgType === 'IMAGE' || (m.url && ['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(m.ext || ''));
        }
        return true;
      });
    }

    // 房间主页筛选：只显示房主的所有消息类型
    if (showOwnerRepliesOnly && idolRoomInfo) {
      const ownerId = idolRoomInfo.ownerId;

      console.log('[筛选] 小偶像模式，目标 ownerId:', ownerId, '当前消息数:', filtered.length);

      filtered = filtered.filter(msg => {
        let msgUserId: string | null = null;

        // 使用 ext.user.userId (发送者的用户ID)
        try {
          const ext = JSON.parse(msg.extInfo);
          if (ext.user?.userId != null) {
            msgUserId = String(ext.user.userId);
          }
        } catch {
          // 忽略解析错误
        }

        if (msgUserId && ownerId != null) {
          const targetOwnerId = String(ownerId);
          const isOwner = msgUserId === targetOwnerId;
          if (isOwner && filtered.length <= 5) {
            // 只打印前几条用于调试
            console.log('[筛选] 匹配房主消息:', msgUserId, '===', targetOwnerId);
          }
          return isOwner;
        }

        return false;
      });

      console.log('[筛选] 筛选后消息数:', filtered.length);
    }

    // 隐藏直播推送
    if (filterLivePush) {
      filtered = filtered.filter(m => {
        // 检查 msgType 字段（这是 API 返回的正确字段）
        if (m.msgType === 'LIVEPUSH') return false;
        // 检查 bodys 是否包含直播推送数据
        try {
          const bodysData = JSON.parse(m.bodys);
          if (bodysData.livePushInfo) return false;
        } catch {
          // 忽略解析错误
        }
        return true;
      });
    }

    // 按时间筛选
    if (filter.startTime) {
      const startTimestamp = new Date(filter.startTime).getTime();
      filtered = filtered.filter(m => m.msgTime >= startTimestamp);
    }
    if (filter.endTime) {
      const endTimestamp = new Date(filter.endTime).getTime() + 86400000; // 包含当天
      filtered = filtered.filter(m => m.msgTime < endTimestamp);
    }

    // 按发言人筛选
    if (filter.speaker) {
      filtered = filtered.filter(m => {
        try {
          const ext = JSON.parse(m.extInfo);
          return ext.user?.nickName === filter.speaker;
        } catch {
          return true;
        }
      });
    }

    // 按关键字搜索
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      filtered = filtered.filter(m => {
        // 搜索消息内容
        if (m.bodys && m.bodys.toLowerCase().includes(keyword)) {
          return true;
        }
        // 搜索 bodys 中的特殊消息数据
        try {
          const bodysData = JSON.parse(m.bodys);
          // 搜索直播标题
          if (bodysData.livePushInfo?.liveTitle && bodysData.livePushInfo.liveTitle.toLowerCase().includes(keyword)) {
            return true;
          }
          // 搜索礼物回复文本
          if (bodysData.giftReplyInfo?.replyText && bodysData.giftReplyInfo.replyText.toLowerCase().includes(keyword)) {
            return true;
          }
          if (bodysData.giftReplyInfo?.text && bodysData.giftReplyInfo.text.toLowerCase().includes(keyword)) {
            return true;
          }
        } catch {
          // bodys 不是 JSON，忽略
        }
        return false;
      });
    }

    // 按时间倒序排列
    return filtered.sort((a, b) => b.msgTime - a.msgTime);
  }, [messageList, showOwnerRepliesOnly, idolRoomInfo, filterLivePush, filter.startTime, filter.endTime, filter.speaker, filter.keyword, msgTypeFilter]);

  const handleFetchAll = async () => {
    if (!teamContext || !currentAccount) return;

    setIsAutoFetching(true);
    stopAutoFetchRef.current = false;
    setLoading(true);

    // 根据 currentApiMode 选择 API，不依赖 activeApi
    // activeApi 可能为 'stored'，此时应使用 currentApiMode
    const apiMode = currentApiMode; // 'all' 或 'owner'
    const fetchFunc = apiMode === 'owner'
      ? fetchTeamOwnerMessages
      : fetchTeamMessages;

    // 如果已有消息，从最早消息的时间开始往前获取
    let currentNextTime: string;
    if (messageList.length > 0) {
      // 找到最早消息的 msgTime，减1毫秒作为起始点往前获取
      const earliestMsgTime = Math.min(...messageList.map(m => Number(m.msgTime)));
      currentNextTime = String(earliestMsgTime - 1);
      console.log(`[全部获取] 从已有消息的最早时间开始: ${new Date(earliestMsgTime).toLocaleString()}`);
    } else {
      currentNextTime = teamContext.nextTime;
    }

    let fetchCount = 0;
    let totalNewMessages = 0;
    const API_LIMIT = 50; // API 每次返回 50 条消息

    // 使用本地变量跟踪所有获取的消息，避免 setMessageList 异步更新问题
    let allFetchedMessages: RoomOwnerMessage[] = [...messageList];

    try {
      // 改进：使用 nextTime 和返回消息数量双重判断
      while (!stopAutoFetchRef.current) {
        // 如果 nextTime 为 '0' 或空，但消息数量等于 API_LIMIT，说明可能还有更多数据
        const hasValidNextTime = currentNextTime && currentNextTime !== '0';
        if (!hasValidNextTime && fetchCount > 0) {
          console.log('[全部获取] nextTime 为空，停止获取');
          break;
        }

        fetchCount++;
        setResult(`正在自动获取第 ${fetchCount} 页 (nextTime: ${currentNextTime})...`);

        const data = await fetchFunc(currentAccount.token, teamContext.channelId, teamContext.serverId, currentNextTime);
        const responseData = data as { status?: number; content?: { message?: RoomOwnerMessage[]; nextTime?: string | number } };

        if (responseData.status === 200 && responseData.content?.message) {
          const newMessages = responseData.content.message;
          totalNewMessages += newMessages.length;

          // 去重并添加到本地消息列表
          allFetchedMessages = mergeMessagesDedup(allFetchedMessages, newMessages);
          setMessageList(allFetchedMessages);
          console.log(`[全部获取] 第 ${fetchCount} 页: ${newMessages.length} 条新消息，合并后 ${allFetchedMessages.length} 条`);

          // 检查是否还有更多数据
          const hasMoreData = newMessages.length === API_LIMIT;
          const newNextTime = responseData.content.nextTime;

          if (!hasMoreData) {
            console.log('[全部获取] 返回消息少于 API_LIMIT，已到最后一页');
            break;
          }

          if (newNextTime && String(newNextTime) !== currentNextTime) {
            currentNextTime = String(newNextTime);
          } else {
            console.log('[全部获取] nextTime 未变化，停止获取');
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 300));
        } else {
          console.log('[全部获取] API 返回无效数据，停止获取');
          break;
        }
    }

      setResult(`自动获取完成，共获取 ${fetchCount} 页，${totalNewMessages} 条消息。`);

      // 更新存储的消息 - 使用本地变量而不是 state
      if (idolRoomInfo) {
        const saveResult = await saveMessagesToStorage(idolRoomInfo.channelId, allFetchedMessages, idolRoomInfo.channelName, idolRoomInfo.ownerName, idolRoomInfo.ownerId);
        if (saveResult) {
          console.log(`[全部获取] 保存了 ${saveResult.saved} 条消息，跳过 ${saveResult.skipped} 条重复`);
        }
      }
    } catch (e) {
      setResult(`自动获取中断: ${e}`);
    } finally {
      setIsAutoFetching(false);
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!teamContext || !currentAccount) return;

    const apiMode = currentApiMode; // 'all' 或 'owner'
    const fetchFunc = apiMode === 'owner'
      ? fetchTeamOwnerMessages
      : fetchTeamMessages;

    // 从最早消息的时间开始往前获取
    let currentNextTime: string;
    if (messageList.length > 0) {
      // 找到最早消息的 msgTime，减1毫秒作为起始点往前获取
      const earliestMsgTime = Math.min(...messageList.map(m => Number(m.msgTime)));
      currentNextTime = String(earliestMsgTime - 1);
      console.log(`[加载更多] 从已有消息的最早时间开始: ${new Date(earliestMsgTime).toLocaleString()}`);
    } else {
      currentNextTime = teamContext.nextTime;
    }

    setLoading(true);
    setActiveApi('fetchTeamMessages');
    setResult('正在加载更多消息...');

    try {
      const data = await fetchFunc(currentAccount.token, teamContext.channelId, teamContext.serverId, currentNextTime);
      const responseData = data as { status?: number; content?: { message?: RoomOwnerMessage[]; nextTime?: string | number } };

      if (responseData.status === 200 && responseData.content?.message) {
        const newMessages = responseData.content.message;

        // 去重并添加到现有列表
        const finalMessages = mergeMessagesDedup(messageList, newMessages);
        setMessageList(finalMessages);

        // 更新 teamContext 的 nextTime 以便下次加载
        if (responseData.content.nextTime) {
          setTeamContext(prev => prev ? { ...prev, nextTime: String(responseData.content!.nextTime) } : null);
        }

        // 保存到本地存储
        if (idolRoomInfo) {
          await saveMessagesToStorage(
            idolRoomInfo.channelId,
            newMessages,
            idolRoomInfo.channelName,
            idolRoomInfo.ownerName,
            idolRoomInfo.ownerId
          );
        }

        showToast('success', `已加载 ${newMessages.length} 条消息，共 ${finalMessages.length} 条`);
        setResult(`已加载 ${newMessages.length} 条新消息（总计 ${finalMessages.length} 条）`);
      } else {
        setResult('没有更多消息了');
        showToast('info', '没有更多消息了');
      }
    } catch (error) {
      setResult(`加载失败: ${error instanceof Error ? error.message : String(error)}`);
      showToast('error', `加载失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const saveTeam = (team: TeamContext) => {
    const exists = savedTeams.find((t: TeamContext) => t.channelId === team.channelId);
    if (!exists) {
      const newTeams = [...savedTeams, team];
      setSavedTeams(newTeams);
      localStorage.setItem('pocket48_teams', JSON.stringify(newTeams));
    }
  };

  // 查看小偶像房间 - 获取房间信息
  const handleFetchIdolRoom = async () => {
    if (!currentAccount) {
      setResult('请先登录账号');
      return;
    }

    const channelId = String(inputChannelId).trim();
    if (!channelId) {
      setResult('请输入频道ID或搜索成员');
      return;
    }

    setLoading(true);
    setResult('正在获取房间信息...');

    try {
      const data = await getTeamRoomInfo(currentAccount.token, channelId);
      if (data && data.serverId) {
        const roomInfo: IdolRoomInfo = {
          channelId,
          serverId: data.serverId,
          channelName: data.channelInfo?.channelName as string | undefined,
          ownerName: data.channelInfo?.ownerName as string | undefined,
          ownerId: data.channelInfo?.ownerId as number | undefined,
        };
        setIdolRoomInfo(roomInfo);

        const team: TeamContext = {
          channelId,
          serverId: data.serverId,
          nextTime: '0',
          channelInfo: data.channelInfo,
        };
        setTeamContext(team);
        saveTeam(team);

        // 尝试加载已存储的消息
        const stored = await loadStoredMessages(channelId);
        if (stored && stored.messages.length > 0) {
          setStoredMessages(stored);
          setMessageList(stored.messages);
          setActiveApi('stored');
          setResult(`已加载本地存储的消息 (${stored.messages.length} 条)\n\n${JSON.stringify(roomInfo, null, 2)}`);
        } else {
          setResult(JSON.stringify(roomInfo, null, 2));
        }
      } else {
        setResult('获取房间信息失败');
      }
    } catch (error) {
      setResult(`请求失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 留言板 - 获取所有消息（修复多次点击空白问题）
  const handleFetchIdolMessages = async () => {
    if (!idolRoomInfo || !currentAccount) {
      setResult('请先获取房间信息');
      return;
    }

    // 防止重复点击
    if (loading) {
      console.log('[留言板] 正在加载中，跳过重复请求');
      return;
    }

    // 设置当前 API 模式为全部消息
    setCurrentApiMode('all');
    setShowOwnerRepliesOnly(false);
    setActiveApi('fetchTeamMessages');
    setViewingStorageList(false); // 清除存储列表查看状态
    setLoading(true);

    try {
      console.log(`[留言板] 开始获取消息，当前 messageList 数量: ${messageList.length}`);

      // 先获取最新消息
      const messagesData = await fetchTeamMessages(currentAccount.token, idolRoomInfo.channelId, idolRoomInfo.serverId, '0');
      const responseData = messagesData as { content?: { message?: RoomOwnerMessage[]; nextTime?: string | number } };

      let finalMessages: RoomOwnerMessage[] = [];

      if (responseData.content?.message) {
        const newMessages = responseData.content.message;
        console.log(`[留言板] 获取到 ${newMessages.length} 条最新消息`);

        // 使用智能合并与现有消息合并
        finalMessages = mergeMessagesDedup(messageList, newMessages);
        console.log(`[留言板] 合并后共 ${finalMessages.length} 条消息（去重 ${messageList.length + newMessages.length - finalMessages.length} 条）`);

        setMessageList(finalMessages);

        // 保存新消息到存储
        const saveResult = await saveMessagesToStorage(
          idolRoomInfo.channelId,
          newMessages,
          idolRoomInfo.channelName,
          idolRoomInfo.ownerName,
          idolRoomInfo.ownerId
        );
        if (saveResult) {
          console.log(`[留言板] 保存了 ${saveResult.saved} 条消息，跳过 ${saveResult.skipped} 条重复`);
        }

        // 更新 teamContext 的 nextTime 以便加载更多按钮工作
        if (responseData.content.nextTime) {
          setTeamContext(prev => prev ? { ...prev, nextTime: String(responseData.content!.nextTime) } : null);
          console.log(`[留言板] 更新 nextTime: ${responseData.content.nextTime}`);
        }

        showToast('success', `已加载留言板消息 (${finalMessages.length} 条)`);
        setResult(`已加载留言板消息 (${finalMessages.length} 条)`);
      } else {
        showToast('info', 'API 未返回消息数据');
        setResult('API 未返回消息数据');
      }
    } catch (error) {
      console.error('[留言板] 获取消息失败:', error);
      showToast('error', `获取消息失败: ${error instanceof Error ? error.message : String(error)}`);
      setResult(`获取消息失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // 房间主页 - 切换筛选器，只显示房主的所有消息
  const handleFetchIdolOwnerMessages = async () => {
    if (!idolRoomInfo) {
      setResult('请先获取房间信息');
      return;
    }

    console.log('[小偶像按钮] ownerId:', idolRoomInfo.ownerId, 'ownerName:', idolRoomInfo.ownerName, 'channelId:', idolRoomInfo.channelId);

    // 切换筛选状态
    const newState = !showOwnerRepliesOnly;
    setShowOwnerRepliesOnly(newState);
    setViewingStorageList(false); // 清除存储列表查看状态

    // 如果开启筛选且当前没有消息，尝试加载存储的消息
    if (newState && messageList.length === 0) {
      const stored = await loadStoredMessages(idolRoomInfo.channelId);
      if (stored && stored.messages.length > 0) {
        setStoredMessages(stored);
        setMessageList(stored.messages);
        setActiveApi('stored');
        console.log(`[房间主页] 加载了 ${stored.messages.length} 条存储消息, ownerId: ${stored.ownerId}`);
      }
    }

    if (newState) {
      console.log('[房间主页] 开启筛选，仅显示房主消息，ownerId:', idolRoomInfo.ownerId);
      showToast('info', `已开启房间主页筛选（仅显示${idolRoomInfo.ownerName || '房主'}消息）`);
      setResult(`已开启房间主页筛选（仅显示房主的所有消息，ownerId: ${idolRoomInfo.ownerId}）`);
    } else {
      console.log('[房间主页] 关闭筛选，显示所有消息');
      showToast('info', '已关闭房间主页筛选（显示所有消息）');
      setResult('已关闭房间主页筛选（显示所有消息）');
    }
  };

  // 清除筛选条件
  const clearFilters = () => {
    setFilter({
      startTime: '',
      endTime: '',
      speaker: '',
      keyword: '',
    });
    setTempFilter({
      startTime: '',
      endTime: '',
      speaker: '',
      keyword: '',
    });
    setFilterLivePush(false);
  };

  const confirmFilters = () => {
    setFilter(tempFilter);
  };

  // 快捷日期筛选函数
  const setQuickDateFilter = (days: number) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - days);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    setTempFilter(prev => ({
      ...prev,
      startTime: formatDate(startDate),
      endTime: formatDate(today),
    }));
  };

  const setTodayFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
    setTempFilter(prev => ({ ...prev, startTime: today, endTime: today }));
  };

  const setThisWeekFilter = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    setTempFilter(prev => ({
      ...prev,
      startTime: formatDate(startOfWeek),
      endTime: formatDate(today),
    }));
  };

  const setThisMonthFilter = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    setTempFilter(prev => ({
      ...prev,
      startTime: formatDate(startOfMonth),
      endTime: formatDate(today),
    }));
  };

  // 导出功能
  const handleExport = async (format: 'json' | 'csv', channelId?: string) => {
    setIsStorageLoading(true);
    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'json') {
        if (channelId) {
          content = await messageDB.exportChannelToJson(channelId);
          filename = `pocket48_messages_${channelId}_${Date.now()}.json`;
        } else {
          content = await messageDB.exportAllToJson();
          filename = `pocket48_all_messages_${Date.now()}.json`;
        }
        mimeType = 'application/json';
      } else {
        if (!channelId) {
          setResult('CSV 导出仅支持单个频道');
          return;
        }
        content = await messageDB.exportChannelToCsv(channelId);
        filename = `pocket48_messages_${channelId}_${Date.now()}.csv`;
        mimeType = 'text/csv';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult(`导出成功: ${filename}`);
    } catch (error) {
      setResult(`导出失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStorageLoading(false);
    }
  };

  // 导出房主消息
  const exportOwnerMessages = async (channelId: string) => {
    try {
      const stored = await messageDB.loadMessages(channelId);
      if (!stored || stored.messages.length === 0) {
        showToast('info', '该频道暂无消息');
        return;
      }

      // 使用 ownerNickName（从消息中提取的房主 nickName）
      // 如果没有，则尝试从 ownerName 匹配消息中的 nickName
      let targetNickName = ownerNickName;
      const ownerName = idolRoomInfo?.ownerName || stored.ownerName;

      console.log('[导出房主] ownerNickName:', ownerNickName, 'ownerName:', ownerName);

      // 如果 ownerNickName 不可用，尝试从存储的消息中提取房主的 nickName
      // 使用 ownerId 来匹配，因为 ownerId 是唯一的，而 ownerName 和消息中的 nickName 可能不同
      if (targetNickName == null) {
        const ownerId = idolRoomInfo?.ownerId ?? stored.ownerId;
        if (ownerId != null) {
          console.log('[导出房主] ownerNickName 不可用，尝试通过 ownerId 从消息中提取房主 nickName...', 'ownerId:', ownerId);
          // 查找与 ownerId 匹配的消息，提取其 nickName
          for (const msg of stored.messages) {
            try {
              const ext = JSON.parse(msg.extInfo);
              const msgUserId = ext.user?.userId;
              const msgNickName = ext.user?.nickName;
              if (msgUserId != null && String(msgUserId) === String(ownerId) && msgNickName) {
                targetNickName = msgNickName;
                console.log('[导出房主] 从消息中提取到 nickName:', targetNickName, '通过匹配 ownerId:', ownerId);
                break;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }

      if (targetNickName == null) {
        showToast('error', '无法获取房主昵称，请先刷新房间信息');
        return;
      }

      // 先打印前10条消息的用户ID用于调试
      console.log('[导出房主] 消息样本（前10条）:');
      stored.messages.slice(0, 10).forEach((msg, idx) => {
        try {
          const ext = JSON.parse(msg.extInfo);
          console.log(`  [${idx}] userId=${ext.user?.userId}, nickName=${ext.user?.nickName}, msgType=${msg.msgType}`);
        } catch {
          console.log(`  [${idx}] 解析失败`);
        }
      });

      // 筛选房主消息 - 使用 nickName 匹配
      const ownerMessages = stored.messages.filter(msg => {
        try {
          const ext = JSON.parse(msg.extInfo);
          const msgNickName = ext.user?.nickName;
          if (msgNickName != null) {
            const isOwner = msgNickName === targetNickName;
            if (isOwner && ownerMessages.length <= 5) {
              console.log('[导出房主] 匹配房主消息: msgNickName =', msgNickName, 'targetNickName =', targetNickName);
            }
            return isOwner;
          }
          return false;
        } catch {
          return false;
        }
      });

      console.log('[导出房主] 筛选结果:', ownerMessages.length, '条消息');

      if (ownerMessages.length === 0) {
        showToast('info', '该频道暂无房主消息');
        return;
      }

      const exportData = {
        channelId: stored.channelId,
        channelName: stored.channelName,
        ownerName: targetNickName,
        ownerId: idolRoomInfo?.ownerId ?? stored.ownerId,
        messages: ownerMessages,
        exportType: 'owner',
        exportTime: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stored.channelName || channelId}_owner_${ownerMessages.length}条_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', `已导出 ${ownerMessages.length} 条房主消息`);
    } catch (error) {
      showToast('error', `导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 导出本人消息
  const exportMyMessages = async (channelId: string) => {
    try {
      if (!currentAccount) {
        showToast('error', '请先登录');
        return;
      }

      const stored = await messageDB.loadMessages(channelId);
      if (!stored || stored.messages.length === 0) {
        showToast('info', '该频道暂无消息');
        return;
      }

      console.log('[导出本人] 当前登录用户 userId:', currentAccount.userId, 'nickname:', currentAccount.nickname || currentAccount.username);

      // 筛选本人消息 - 使用当前登录用户的 userId
      const myMessages = stored.messages.filter(msg => {
        try {
          const ext = JSON.parse(msg.extInfo);
          const msgUserId = ext.user?.userId;
          // 匹配当前登录用户的 userId
          return msgUserId != null && String(msgUserId) === String(currentAccount.userId);
        } catch {
          return false;
        }
      });

      console.log('[导出本人] 筛选结果:', myMessages.length, '条消息');

      if (myMessages.length === 0) {
        showToast('info', '该频道暂无您的消息');
        return;
      }

      const exportData = {
        channelId: stored.channelId,
        channelName: stored.channelName,
        ownerName: stored.ownerName,
        myUserId: currentAccount.userId,
        myNickname: currentAccount.nickname || currentAccount.username,
        messages: myMessages,
        exportType: 'my',
        exportTime: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stored.channelName || channelId}_${currentAccount.nickname || currentAccount.username}_${myMessages.length}条_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('success', `已导出 ${myMessages.length} 条用户消息`);
    } catch (error) {
      showToast('error', `导出失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // 导入功能
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setIsStorageLoading(true);
      try {
        const content = await file.text();
        await messageDB.importFromJson(content);
        setResult(`导入成功: ${file.name}`);
        // 刷新存储信息
        await loadStorageInfo();
      } catch (error) {
        setResult(`导入失败: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsStorageLoading(false);
      }
    };
    input.click();
  };

  // 删除频道数据
  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm(`确定要删除频道 ${channelId} 的所有消息吗？`)) return;
    setIsStorageLoading(true);
    try {
      await messageDB.deleteChannel(channelId);
      setResult(`已删除频道 ${channelId} 的消息`);
      await loadStorageInfo();
    } catch (error) {
      setResult(`删除失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStorageLoading(false);
    }
  };

  // 清空所有数据
  const handleClearAll = async () => {
    if (!confirm('确定要清空所有存储的消息吗？此操作不可恢复！')) return;
    setIsStorageLoading(true);
    try {
      await messageDB.clearAll();
      setResult('已清空所有数据');
      await loadStorageInfo();
    } catch (error) {
      setResult(`清空失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStorageLoading(false);
    }
  };

  // 新增状态：侧边栏折叠
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!currentAccount) {
    return (
      <div className="pocket-room">
        <div className="login-prompt">
          <span className="login-prompt-icon">🔐</span>
          <h2>请先登录</h2>
          <p>在账号管理页登录后即可使用口袋房间功能</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pocket-room">
      <div className="pocket-room-layout">
        {/* 顶部筛选栏 */}
        <div className="pocket-room-filter-top">
          <div className="filter-bar-merged">
            {/* 第一行：日期筛选 + 快捷按钮 */}
            <div className="filter-row-1">
              <div className="filter-group-inline">
                <label className="filter-label">📅 开始</label>
                <input
                  type="date"
                  value={tempFilter.startTime}
                  onChange={e => setTempFilter(prev => ({ ...prev, startTime: e.target.value }))}
                  className="filter-input"
                />
              </div>
              <div className="filter-group-inline">
                <label className="filter-label">📅 结束</label>
                <input
                  type="date"
                  value={tempFilter.endTime}
                  onChange={e => setTempFilter(prev => ({ ...prev, endTime: e.target.value }))}
                  className="filter-input"
                />
              </div>
              <button onClick={() => { setTodayFilter(); confirmFilters(); }} className="calendar-quick-btn-inline">今天</button>
              <button onClick={() => { setQuickDateFilter(1); confirmFilters(); }} className="calendar-quick-btn-inline">昨天</button>
              <button onClick={() => { setThisWeekFilter(); confirmFilters(); }} className="calendar-quick-btn-inline">本周</button>
              <button onClick={() => { setThisMonthFilter(); confirmFilters(); }} className="calendar-quick-btn-inline">本月</button>
            </div>

            {/* 第二行：消息类型筛选 */}
            <div className="filter-row-2">
              <button
                className={`msg-type-btn ${msgTypeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('all')}
              >
                全部
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'TEXT' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('TEXT')}
              >
                文本
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'VOICE' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('VOICE')}
              >
                语音
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'VIDEO' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('VIDEO')}
              >
                视频
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'IMAGE' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('IMAGE')}
              >
                图片
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'REPLY' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('REPLY')}
              >
                回复
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'GIFTREPLY' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('GIFTREPLY')}
              >
                礼物回复
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'LIVEPUSH' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('LIVEPUSH')}
              >
                直播
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'EXPRESSIMAGE' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('EXPRESSIMAGE')}
              >
                表情
              </button>
              <button
                className={`msg-type-btn ${msgTypeFilter === 'GIFT_TEXT' ? 'active' : ''}`}
                onClick={() => setMsgTypeFilter('GIFT_TEXT')}
              >
                礼物消息
              </button>
            </div>

            {/* 第三行：发言人、关键字、确认、清除 */}
            <div className="filter-row-3">
              <div className="filter-group-inline speaker-group">
                <label className="filter-label">👤 发言人</label>
                <input
                  type="text"
                  placeholder="搜索发言人..."
                  value={tempFilter.speaker}
                  onChange={e => setTempFilter(prev => ({ ...prev, speaker: e.target.value }))}
                  onFocus={() => setShowSpeakerDropdown(true)}
                  onBlur={() => setTimeout(() => setShowSpeakerDropdown(false), 200)}
                  className="filter-input"
                />
                {showSpeakerDropdown && (
                  <div className="speaker-dropdown">
                    {idolRoomInfo && (
                      <div
                        className="speaker-option"
                        onMouseDown={() => {
                          const displayName = ownerNickName || idolRoomInfo.ownerName || '未知';
                          console.log('[筛选] 选择房主发言人:', displayName, 'ownerId:', idolRoomInfo.ownerId);
                          setTempFilter(prev => ({ ...prev, speaker: displayName }));
                          setShowSpeakerDropdown(false);
                        }}
                      >
                        👑 成员：{ownerNickName || idolRoomInfo.ownerName || '未知'}
                      </div>
                    )}
                    {currentAccount && (
                      <div
                        className="speaker-option"
                        onMouseDown={() => {
                          const displayName = currentAccount.nickname || currentAccount.username;
                          console.log('[筛选] 选择当前登录用户:', displayName, 'userId:', currentAccount.userId);
                          setTempFilter(prev => ({ ...prev, speaker: displayName }));
                          setShowSpeakerDropdown(false);
                        }}
                      >
                        🧑 本人: {currentAccount.nickname || currentAccount.username || '未知'}
                      </div>
                    )}
                    {/* 从消息列表中提取所有唯一发言人 */}
                    {(() => {
                      const speakers = new Map<string, { count: number; avatar?: string }>();
                      messageList.forEach(msg => {
                        try {
                          const ext = JSON.parse(msg.extInfo);
                          const nickName = ext.user?.nickName;
                          const userId = ext.user?.userId;
                          const avatar = ext.user?.avatar;
                          // 排除房主（通过 userId 匹配）
                          if (userId != null && idolRoomInfo?.ownerId != null && String(userId) === String(idolRoomInfo.ownerId)) {
                            return; // 跳过房主的消息
                          }
                          if (nickName) {
                            speakers.set(nickName, {
                              count: (speakers.get(nickName)?.count || 0) + 1,
                              avatar,
                            });
                          }
                        } catch {
                          // 忽略解析错误
                        }
                      });
                      // 排除已经在选项中的发言人
                      const existingNames = new Set([
                        ownerNickName || idolRoomInfo?.ownerName,
                        currentAccount?.nickname || currentAccount?.username,
                      ].filter(Boolean));

                      return Array.from(speakers.entries())
                        .filter(([name]) => !existingNames.has(name))
                        .sort((a, b) => b[1].count - a[1].count)
                        .slice(0, 20) // 限制显示20个
                        .map(([name, info]) => (
                          <div
                            key={name}
                            className="speaker-option"
                            onMouseDown={() => {
                              console.log('[筛选] 选择发言人:', name, '消息数:', info.count);
                              setTempFilter(prev => ({ ...prev, speaker: name }));
                              setShowSpeakerDropdown(false);
                            }}
                          >
                            💬 {name} ({info.count})
                          </div>
                        ));
                    })()}
                  </div>
                )}
              </div>
              <div className="filter-group-inline">
                <label className="filter-label">🔍 关键字</label>
                <input
                  type="text"
                  placeholder="搜索消息..."
                  value={tempFilter.keyword}
                  onChange={e => setTempFilter(prev => ({ ...prev, keyword: e.target.value }))}
                  className="filter-input"
                />
              </div>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={filterLivePush}
                  onChange={e => setFilterLivePush(e.target.checked)}
                />
                隐藏直播推送
              </label>
              <button className="filter-action-btn confirm-filter-btn" onClick={confirmFilters}>
                ✓ 确认筛选
              </button>
              <button className="filter-action-btn clear-filter-btn" onClick={clearFilters}>
                ✕ 清除筛选
              </button>
            </div>
          </div>
        </div>

        {/* 左侧面板 - 房间选择区 + 存储管理 */}
        <aside className={`pocket-room-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          
          {/* 关注的房间 */}
          <div className="crystal-panel">
            <div className="panel-title">
              关注的房间
            </div>
            {followedRooms.length === 0 && !loadingFollowedRooms ? (
              <div className="empty-state">
                <span className="empty-state-icon">💭</span>
                <p>没有已关注的房间</p>
                <p className="hint">请先在口袋48关注一些成员</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* 存储管理卡片 */}
          <div className="crystal-panel storage-section">
            <div className="panel-title" onClick={() => {
              setCurrentView('stored-data');
              loadStorageInfo();
            }} style={{ cursor: 'pointer', userSelect: 'none' }}>
              数据管理
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                {currentView === 'stored-data' ? '✓' : ''}
              </span>
            </div>
          </div>

          {/* 数据统计卡片 */}
          <div className="crystal-panel statistics-section">
            <div className="panel-title" onClick={() => setCurrentView('data-statistics')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              数据统计
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                {currentView === 'data-statistics' ? '✓' : ''}
              </span>
            </div>
          </div>

          {/* AI智能分析按钮 */}
          <div className="crystal-panel ai-section">
            <div className="panel-title" onClick={() => setCurrentView('ai-analysis')} style={{ cursor: 'pointer', userSelect: 'none' }}>
              AI报告
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                {currentView === 'ai-analysis' ? '✓' : ''}
              </span>
            </div>
          </div>

          {/* JSON转换器按钮 */}
          <div className="crystal-panel json-converter-section">
            <a
              href="#json-converter"
              className="panel-title"
              style={{ cursor: 'pointer', userSelect: 'none', textDecoration: 'none', color: 'inherit' }}
              onClick={(e) => {
                e.preventDefault();
                // 切换到App的json tab
                const event = new CustomEvent('switch-to-json-tab');
                window.dispatchEvent(event);
              }}
            >
              JSON转换器
              <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>
                →
              </span>
            </a>
          </div>
        </aside>

        {/* 中央主区域 */}
        <main className="pocket-room-main">
          {currentView === 'stored-data' ? (
            /* 存储数据列表视图 */
            <div className="room-info-card">
              <div className="messages-header">
                <div className="messages-title">存储数据列表</div>
                <button
                  onClick={() => setCurrentView('messages')}
                  className="action-btn secondary"
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                >
                  返回消息视图
                </button>
              </div>
              {storageInfo && (
                <div className="storage-stats-sidebar" style={{ marginBottom: '16px' }}>
                  <div className="stat-item">
                    <span className="stat-label">📊 频道</span>
                    <span className="stat-value">{storageInfo.channelCount}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">💬 消息</span>
                    <span className="stat-value">{storageInfo.totalMessages}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">💾 大小</span>
                    <span className="stat-value">{storageInfo.estimatedSize}</span>
                  </div>
                </div>
              )}
              <div className="storage-actions-sidebar" style={{ marginBottom: '16px' }}>
                <button onClick={handleImport} className="storage-action-btn" disabled={isStorageLoading} title="导入数据">
                  📥 导入
                </button>
                <button onClick={() => handleExport('json')} className="storage-action-btn" disabled={isStorageLoading} title="导出全部数据">
                  📤 导出全部
                </button>
                <button onClick={handleClearAll} className="storage-action-btn danger" disabled={isStorageLoading} title="清空所有数据">
                  🗑️ 清空
                </button>
              </div>
              {allMetadata.length > 0 ? (
                <div className="storage-channels-list-compact">
                  {allMetadata.map((meta) => (
                    <div key={meta.channelId} className="storage-channel-item-compact">
                      <div className="storage-channel-info-compact" onClick={() => {
                        handleSelectStoredChannel(meta.channelId, meta.channelName, meta.ownerName, 'all');
                        setCurrentView('messages');
                      }}>
                        <div className="storage-channel-name-compact">{meta.channelName || meta.channelId}</div>
                        <div className="storage-channel-meta-compact">
                          <span>👤 {meta.ownerName || '未知'}</span>
                          <span>💬 {meta.messageCount}条</span>
                        </div>
                      </div>
                      <div className="storage-channel-buttons-compact">
                        <button
                          className="storage-channel-btn-sm"
                          onClick={() => handleExport('json', meta.channelId)}
                          title="导出所有消息"
                        >
                          导出所有
                        </button>
                        <button
                          className="storage-channel-btn-sm"
                          onClick={() => exportOwnerMessages(meta.channelId)}
                          title="仅导出房主消息"
                        >
                          导出成员
                        </button>
                        <button
                          className="storage-channel-btn-sm"
                          onClick={() => exportMyMessages(meta.channelId)}
                          title="仅导出本人消息"
                        >
                          导出本人
                        </button>
                        <button
                          className="storage-channel-btn-sm danger"
                          onClick={() => handleDeleteChannel(meta.channelId)}
                          title="删除此频道数据"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-state-icon">💾</span>
                  <p>暂无存储数据</p>
                </div>
              )}
            </div>
          ) : currentView === 'ai-analysis' ? (
            /* AI智能分析视图 */
            <>
              <div className="room-info-card" style={{ marginBottom: '16px' }}>
                <div className="messages-header">
                  <div className="messages-title">AI智能分析</div>
                  <button
                    onClick={() => setCurrentView('messages')}
                    className="action-btn secondary"
                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  >
                    返回消息视图
                  </button>
                </div>
              </div>
              {/* AI 智能分析功能 */}
              <AIFeatures
                messages={messageList}
                filteredMessages={filteredMessages}
                filterInfo={{
                  startTime: filter.startTime,
                  endTime: filter.endTime,
                  speaker: filter.speaker,
                  keyword: filter.keyword,
                  msgType: msgTypeFilter,
                  filterLivePush: filterLivePush,
                  showOwnerRepliesOnly: showOwnerRepliesOnly,
                  totalCount: messageList.length,
                  filteredCount: filteredMessages.length,
                }}
                channelId={idolRoomInfo?.channelId}
                channelName={idolRoomInfo?.channelName}
                ownerName={idolRoomInfo?.ownerName}
                ownerId={idolRoomInfo?.ownerId}
              />
            </>
          ) : currentView === 'data-statistics' ? (
            /* 数据统计视图 */
            <>
              <div className="room-info-card" style={{ marginBottom: '16px' }}>
                <div className="messages-header">
                  <div className="messages-title">数据统计</div>
                  <button
                    onClick={() => setCurrentView('messages')}
                    className="action-btn secondary"
                    style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                  >
                    返回消息视图
                  </button>
                </div>
              </div>
              {/* 消息统计面板 */}
              <MessageStatistics messages={filteredMessages} giftList={giftList} />
            </>
          ) : (
            /* 默认消息视图 */
            <>
          {/* 房间信息卡片 */}
          {idolRoomInfo ? (
            <div className="room-info-card">
              {/*<div className="room-info-header">
                <div className="room-info-avatar-large">
                  {idolRoomInfo.ownerName ? idolRoomInfo.ownerName.charAt(0).toUpperCase() : '?'}
                </div>
                <div className="room-info-details">
                  <h3>{idolRoomInfo.channelName || '未知房间'}</h3>
                  <p>{idolRoomInfo.ownerName || '未知成员'}</p>
                </div>
              </div>*/}
              <div className="room-info-meta">
                <div className="meta-item">
                  <span>频道ID: {idolRoomInfo.channelId}</span>
                </div>
                <div className="meta-item">
                  <span>服务器: {idolRoomInfo.serverId}</span>
                </div>
                {storedMessages && (
                  <div className="meta-item">
                    <span>{storedMessages.messages.length} 条消息</span>
                  </div>
                )}
              </div>
              <div className="room-actions">
                {/* 成员搜索 */}
                <div className="action-search-wrapper">
                  <input
                    type="text"
                    placeholder="搜索成员..."
                    value={memberSearchKeyword}
                    onChange={e => handleMemberSearch(e.target.value)}
                    onFocus={() => {
                      if (memberList.length === 0) loadMemberList();
                    }}
                    className="action-search-input"
                  />
                  {memberSearchResults.length > 0 && (
                    <div className="action-search-results">
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
                  {isMemberListLoading && (
                    <div className="action-search-loading">
                      <span className="loading-spinner"></span>
                    </div>
                  )}
                </div>

                {/* 频道ID输入 */}
                <input
                  type="text"
                  placeholder="频道ID"
                  value={inputChannelId}
                  onChange={e => setInputChannelId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleFetchIdolRoom()}
                  className="action-channel-input"
                />

                {/* 获取按钮 */}
                <button
                  onClick={handleFetchIdolMessages}
                  disabled={loading}
                  className="action-btn primary"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                  </svg>
                  留言板
                </button>
                <button
                  onClick={handleFetchIdolOwnerMessages}
                  disabled={loading}
                  className="action-btn secondary"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                  小偶像
                </button>
              </div>
            </div>
          ) : (
            <div className="room-info-card">
              <div className="empty-state">
                <span className="empty-state-icon">🏠</span>
                <p>请选择一个房间</p>
                <p className="hint">在左侧选择关注的房间或输入频道ID</p>
              </div>
            </div>
          )}

          {/* 消息列表 */}
          {!viewingStorageList && messageList.length > 0 && (activeApi === 'fetchTeamOwnerMessages' || activeApi === 'fetchTeamMessages' || activeApi === 'stored') && (
            <>
              <div className="messages-section">
                <div className="messages-header">
                  <div className="messages-title">
                    {activeApi === 'fetchTeamOwnerMessages' ? '房主消息' : activeApi === 'stored' ? '已存储消息' : '所有消息'}
                  </div>
                  <div className="messages-count">({filteredMessages.length} / {messageList.length} 条)</div>
                </div>

              <div className="messages-list">
                {filteredMessages.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state-icon">🔍</span>
                    <p>没有符合条件的消息</p>
                    <p className="hint">尝试调整筛选条件</p>
                  </div>
                ) : (
                  filteredMessages
                    .slice((currentPage - 1) * MESSAGES_PER_PAGE, currentPage * MESSAGES_PER_PAGE)
                    .map((msg, index) => {
                    // 解析消息类型
                    let messageType: string = 'text';
                    let speakerName = '未知';
                    let speakerAvatar = '';
                    let messageExt: {
                      messageType?: string;
                      user?: { nickName?: string; avatar?: string };
                      liveTitle?: string;
                      liveStatus?: string;
                      imageUrl?: string;
                      videoUrl?: string;
                      voiceDuration?: string;
                      livePushInfo?: {
                        liveCover?: string;
                        liveTitle?: string;
                        liveId?: string;
                      };
                      giftReplyInfo?: {
                        replyText?: string;
                        replyName?: string;
                        text?: string;
                      };
                      expressImgInfo?: {
                        emotionRemote?: string;
                        width?: number;
                        height?: number;
                      };
                      replyInfo?: {
                        replyText?: string;
                        replyName?: string;
                        replyMessageId?: string;
                        text?: string;
                      };
                    } = {};

                    // 解析 extInfo 获取用户信息
                    let speakerAvatarUrl = '';
                    try {
                      messageExt = JSON.parse(msg.extInfo);
                      speakerName = messageExt.user?.nickName || '未知';
                      // 获取头像URL，如果有相对路径则转换为完整URL
                      if (messageExt.user?.avatar) {
                        speakerAvatarUrl = messageExt.user.avatar.startsWith('http')
                          ? messageExt.user.avatar
                          : `https://source.48.cn${messageExt.user.avatar}`;
                      }
                    } catch {
                      speakerName = '未知';
                    }

                    // 🔑 关键：优先从 msgType 判断消息类型（这是API返回的字段）
                    if (msg.msgType === 'LIVEPUSH') {
                      messageType = 'LIVEPUSH';
                    } else if (msg.msgType === 'GIFTREPLY') {
                      messageType = 'GIFTREPLY';
                    } else if (msg.msgType === 'IMAGE' || msg.msgType === 'PICTURE') {
                      messageType = 'IMAGE';
                    } else if (msg.msgType === 'VIDEO') {
                      messageType = 'VIDEO';
                    } else if (msg.msgType === 'VOICE' || msg.msgType === 'AUDIO') {
                      messageType = 'VOICE';
                    } else if (msg.msgType === 'TEXT') {
                      messageType = 'TEXT';
                    } else if (msg.msgType === 'EXPRESSIMAGE') {
                      messageType = 'EXPRESSIMAGE';
                    } else if (msg.msgType === 'REPLY') {
                      messageType = 'REPLY';
                    } else if (msg.msgType === 'GIFT_TEXT') {
                      messageType = 'GIFT_TEXT';
                    }

                    // 🔑 关键：从 bodys 字段解析特殊消息数据
                    let livePushData: { liveCover?: string; liveTitle?: string; liveId?: string } | null = null;
                    let giftReplyData: { replyText?: string; replyName?: string; text?: string } | null = null;
                    let giftTextData: { giftInfo?: { giftId?: string; giftName?: string; giftNum?: number; picPath?: string; userName?: string; isScore?: number; hasSkill?: number } } | null = null;
                    let imageData: { url?: string; ext?: string; w?: number; h?: number } | null = null;
                    let videoData: { url?: string; ext?: string; dur?: number; w?: number; h?: number } | null = null;
                    let voiceData: { url?: string; ext?: string; dur?: number; size?: number; md5?: string } | null = null;
                    let expressImgData: { emotionRemote?: string; width?: number; height?: number } | null = null;
                    let replyData: { replyText?: string; replyName?: string; replyMessageId?: string; text?: string } | null = null;

                    // 如果是特殊类型消息，bodys 包含 JSON 数据
                    if (messageType === 'LIVEPUSH' || messageType === 'GIFTREPLY' || messageType === 'IMAGE' || messageType === 'VIDEO' || messageType === 'VOICE' || messageType === 'AUDIO' || messageType === 'EXPRESSIMAGE' || messageType === 'REPLY' || messageType === 'GIFT_TEXT') {
                      try {
                        const bodysData = JSON.parse(msg.bodys);
                        if (bodysData.livePushInfo) {
                          livePushData = bodysData.livePushInfo;
                        }
                        if (bodysData.giftReplyInfo) {
                          giftReplyData = bodysData.giftReplyInfo;
                        }
                        if (bodysData.giftInfo) {
                          giftTextData = bodysData;
                        }
                        if (bodysData.expressImgInfo) {
                          expressImgData = bodysData.expressImgInfo;
                        }
                        if (bodysData.replyInfo) {
                          replyData = bodysData.replyInfo;
                        }
                        // 图片和视频数据直接在 bodys 的根级别
                        if (bodysData.url && (bodysData.ext === 'jpg' || bodysData.ext === 'png' || bodysData.ext === 'gif' || bodysData.ext === 'jpeg' || bodysData.ext === 'webp')) {
                          imageData = bodysData;
                        }
                        if (bodysData.url && (bodysData.ext === 'mp4' || bodysData.ext === 'mov' || bodysData.ext === 'avi' || bodysData.ext === 'mkv' || bodysData.ext === 'webm')) {
                          videoData = bodysData;
                        }
                        // 语音数据: {"size":25337,"ext":"aac","dur":7012,"url":"...","md5":"..."}
                        if (bodysData.url && ['aac', 'mp3', 'wav', 'amr', 'm4a', 'silk'].includes(bodysData.ext)) {
                          voiceData = bodysData;
                        }
                      } catch (e) {
                        console.log('解析 bodys 失败:', e);
                      }
                    }

                    // 判断特殊类型消息
                    const isLivePush = messageType === 'LIVEPUSH';
                    const isGiftReply = messageType === 'GIFTREPLY';
                    const isGiftText = messageType === 'GIFT_TEXT';
                    const isExpressImage = messageType === 'EXPRESSIMAGE';
                    const isReply = messageType === 'REPLY';
                    const isVoice = voiceData !== null || (msg.url && ['aac', 'mp3', 'wav', 'amr', 'm4a', 'silk'].includes(msg.ext || ''));
                    const isImage = imageData !== null || (msg.url && ['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(msg.ext || ''));
                    const isVideo = videoData !== null || (msg.url && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(msg.ext || ''));
                    const isTextMsg = !isLivePush && !isGiftReply && !isGiftText && !isExpressImage && !isReply && !isImage && !isVideo && !isVoice;

                    // 获取发言人首字母作为头像
                    speakerAvatar = speakerName.charAt(0).toUpperCase();

                    return (
                      <div
                        key={index}
                        className={`message-item message-type-${isLivePush ? 'live' : isImage ? 'image' : isVideo ? 'video' : isVoice ? 'voice' : isGiftReply ? 'gift' : isGiftText ? 'gift' : isReply ? 'reply' : 'text'}`}
                      >
                        {/* 发言人头像 */}
                        <div className="message-speaker-avatar">
                          {speakerAvatarUrl ? (
                            <img src={speakerAvatarUrl} alt={speakerName} />
                          ) : (
                            speakerAvatar
                          )}
                        </div>

                        {/* 消息主体 */}
                        <div className="message-body">
                          {/* 消息类型徽章 */}
                          {!isTextMsg && (
                            <div className={`message-type-badge ${isLivePush ? 'live' : isExpressImage ? 'express' : isReply ? 'reply' : isImage ? 'image' : isVideo ? 'video' : isVoice ? 'voice' : isGiftReply ? 'gift' : isGiftText ? 'gift' : 'voice'}`}>
                              {isLivePush && (
                                <>
                                  <span>🔴</span>
                                  <span>直播推送</span>
                                </>
                              )}
                              {isGiftReply && (
                                <>
                                  <span>🎁</span>
                                  <span>礼物回复</span>
                                </>
                              )}
                              {isGiftText && (
                                <>
                                  <span>🎁</span>
                                  <span>礼物消息</span>
                                </>
                              )}
                              {isExpressImage && (
                                <>
                                  <span>😊</span>
                                  <span>表情</span>
                                </>
                              )}
                              {isReply && (
                                <>
                                  <span>💬</span>
                                  <span>回复</span>
                                </>
                              )}
                              {isImage && (
                                <>
                                  <span>🖼️</span>
                                  <span>图片</span>
                                </>
                              )}
                              {isVideo && (
                                <>
                                  <span>🎬</span>
                                  <span>视频</span>
                                </>
                              )}
                              {isVoice && (
                                <>
                                  <span>🎤</span>
                                  <span>语音</span>
                                </>
                              )}
                            </div>
                          )}

                          {/* 消息头部 */}
                          <div className="message-header">
                            <span className="message-speaker">{speakerName}</span>
                            <span className="message-time">
                              {new Date(msg.msgTime).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {/* 直播推送特殊显示 */}
                          {isLivePush && livePushData && (
                            <div className="live-push-card">
                              {livePushData.liveCover && (
                                <div className="live-push-cover">
                                  <img src={livePushData.liveCover} alt="直播封面" />
                                </div>
                              )}
                              <div className="live-push-info">
                                <div className="live-push-title">{livePushData.liveTitle || '直播中'}</div>
                                <div className="live-push-status">
                                  🔴 直播中
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 礼物回复特殊显示 */}
                          {isGiftReply && giftReplyData && (
                            <div className="gift-reply-card">
                              <div className="gift-reply-info">
                                {giftReplyData.replyName && (
                                  <div className="gift-reply-from">来自: {giftReplyData.replyName}</div>
                                )}
                                <div className="gift-reply-text">{giftReplyData.replyText}</div>
                                {giftReplyData.text && (
                                  <div className="gift-reply-emoji">{giftReplyData.text}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 礼物消息 (GIFT_TEXT) */}
                          {isGiftText && giftTextData?.giftInfo && (
                            <div className="message-content">
                              {giftTextData.giftInfo.picPath && (
                                <img
                                  src={giftTextData.giftInfo.picPath.startsWith('http')
                                    ? giftTextData.giftInfo.picPath
                                    : `https://source.48.cn${giftTextData.giftInfo.picPath}`}
                                  alt={giftTextData.giftInfo.giftName || '礼物'}
                                  style={{ width: '57.5px', height: '57.5px', verticalAlign: 'middle', marginRight: '8px', borderRadius: '8px' }}
                                />
                              )}
                              <span>{giftTextData.giftInfo.giftName || '未知礼物'} × {giftTextData.giftInfo.giftNum || 0}</span>
                            </div>
                          )}

                          {/* 图片消息 */}
                          {isImage && (imageData?.url || msg.url) && (
                            <img
                              src={imageData?.url || msg.url}
                              alt="图片消息"
                              className="message-image"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(imageData?.url || msg.url, '_blank');
                              }}
                              style={{ maxWidth: '100%', maxHeight: '300px', cursor: 'pointer' }}
                            />
                          )}

                          {/* 视频消息 */}
                          {isVideo && (videoData?.url || msg.url) && (
                            <video
                              src={videoData?.url || msg.url}
                              controls
                              className="message-video"
                              preload="none"
                              style={{ maxWidth: '100%', maxHeight: '300px' }}
                            />
                          )}

                          {/* 语音消息 */}
                          {isVoice && (voiceData?.url || msg.url) && (
                            <div className="message-voice-wrapper">
                              <audio
                                src={voiceData?.url || msg.url}
                                controls
                                className="message-audio"
                                preload="none"
                              />
                              {(voiceData?.dur || msg.dur) && (
                                <span className="voice-duration">
                                  {Math.round((voiceData?.dur || msg.dur || 0) / 1000)}秒
                                </span>
                              )}
                            </div>
                          )}

                          {/* 表情图片消息 (EXPRESSIMAGE) */}
                          {messageType === 'EXPRESSIMAGE' && expressImgData?.emotionRemote && (
                            <img
                              src={expressImgData.emotionRemote}
                              alt="表情"
                              className="message-express-image"
                              style={{ maxWidth: '200px', maxHeight: '200px', objectFit: 'contain' }}
                            />
                          )}

                          {/* 回复消息 (REPLY) */}
                          {messageType === 'REPLY' && replyData && (
                            <div className="message-reply-card">
                              {replyData.replyName && (
                                <div className="reply-from">回复: {replyData.replyName}</div>
                              )}
                              <div className="reply-content">
                                <div className="reply-text">{replyData.replyText}</div>
                                {replyData.text && (
                                  <div className="reply-emoji">{replyData.text}</div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 文本消息 */}
                          {isTextMsg && msg.bodys && (
                            <div className="message-content">{msg.bodys}</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 分页控件 */}
              {filteredMessages.length > MESSAGES_PER_PAGE && (
                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    « 首页
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                  >
                    ‹ 上一页
                  </button>
                  <span className="pagination-info">
                    第 {currentPage} / {Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)} 页
                  </span>
                  <div className="pagination-jump">
                    <input
                      type="number"
                      min="1"
                      max={Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)}
                      value={pageJumpInput}
                      onChange={e => setPageJumpInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const page = parseInt(pageJumpInput);
                          const totalPages = Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE);
                          if (page >= 1 && page <= totalPages) {
                            setCurrentPage(page);
                            setPageJumpInput('');
                          }
                        }
                      }}
                      className="pagination-jump-input"
                      placeholder="页码"
                    />
                    <button
                      className="pagination-btn"
                      onClick={() => {
                        const page = parseInt(pageJumpInput);
                        const totalPages = Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE);
                        if (page >= 1 && page <= totalPages) {
                          setCurrentPage(page);
                          setPageJumpInput('');
                        }
                      }}
                      disabled={!pageJumpInput || parseInt(pageJumpInput) < 1 || parseInt(pageJumpInput) > Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)}
                    >
                      跳转
                    </button>
                  </div>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage >= Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)}
                  >
                    下一页 ›
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE))}
                    disabled={currentPage >= Math.ceil(filteredMessages.length / MESSAGES_PER_PAGE)}
                  >
                    末页 »
                  </button>
                </div>
              )}

              <div className="load-more-section">
                <button
                  className="load-btn primary"
                  onClick={handleLoadMore}
                  disabled={loading || isAutoFetching}
                >
                  {loading ? '加载中...' : '加载更多'}
                </button>
                {!isAutoFetching ? (
                  <>
                    <button
                      className="load-btn secondary"
                      onClick={handleFetchAll}
                      disabled={loading}
                    >
                      全部获取
                    </button>
                    <button
                      className="refresh-circular-btn"
                      onClick={async () => {
                        if (idolRoomInfo) {
                          const stored = await loadStoredMessages(idolRoomInfo.channelId);
                          if (stored && stored.messages.length > 0) {
                            setStoredMessages(stored);
                            setMessageList(stored.messages);
                            setActiveApi('stored');
                            showToast('success', `已刷新存储数据 (${stored.messages.length} 条)`);
                          } else {
                            showToast('info', '该房间暂无存储数据');
                          }
                        }
                      }}
                      disabled={loading}
                      title="刷新存储数据"
                    >
                      🔄
                    </button>
                  </>
                ) : (
                  <button
                    className="load-btn secondary"
                    onClick={() => { stopAutoFetchRef.current = true; }}
                  >
                    停止获取
                  </button>
                )}
              </div>
            </div>
          </>
          )}

          {/* 存储数据列表 */}
          {viewingStorageList && allMetadata.length > 0 && (
            <div className="storage-list-view">
              <div className="messages-section">
                <div className="messages-header">
                  <div className="messages-title">📦 已存储的数据</div>
                  <div className="messages-count">({allMetadata.length} 个频道)</div>
                </div>

                <div className="storage-channels-grid">
                  {allMetadata.map((meta) => (
                    <div
                      key={meta.channelId}
                      className="storage-channel-card"
                      onClick={() => {
                        setViewingStorageList(false);
                        // 加载该频道的消息
                        loadStoredMessages(meta.channelId).then(stored => {
                          if (stored && stored.messages.length > 0) {
                            setStoredMessages(stored);
                            setMessageList(stored.messages);
                            setIdolRoomInfo({
                              channelId: meta.channelId,
                              serverId: '',
                              channelName: meta.channelName,
                              ownerName: meta.ownerName,
                              ownerId: stored.ownerId,
                            });
                          }
                        });
                      }}
                    >
                      <div className="storage-channel-header">
                        <div className="storage-channel-icon">💬</div>
                        <div className="storage-channel-info">
                          <div className="storage-channel-name">{meta.channelName || meta.channelId}</div>
                          <div className="storage-channel-owner">{meta.ownerName || '未知成员'}</div>
                        </div>
                      </div>
                      <div className="storage-channel-stats">
                        <div className="storage-channel-stat">
                          <span className="stat-label">消息数</span>
                          <span className="stat-value">{meta.messageCount}</span>
                        </div>
                        <div className="storage-channel-stat">
                          <span className="stat-label">更新时间</span>
                          <span className="stat-value">{new Date(meta.lastUpdated).toLocaleDateString('zh-CN')}</span>
                        </div>
                      </div>
                      <div className="storage-channel-actions">
                        <button
                          className="storage-action-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport('json', meta.channelId);
                          }}
                          title="导出 JSON"
                        >
                          📄 JSON
                        </button>
                        <button
                          className="storage-action-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExport('csv', meta.channelId);
                          }}
                          title="导出 CSV"
                        >
                          📊 CSV
                        </button>
                        <button
                          className="storage-action-btn-sm danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChannel(meta.channelId);
                          }}
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </main>

        {/* 侧边栏切换按钮（平板端显示） */}
        <button
          className="sidebar-toggle"
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

      {/* Toast 通知容器 */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            onClick={() => removeToast(toast.id)}
          >
            <span className="toast-icon">
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
              {toast.type === 'loading' && '⏳'}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
