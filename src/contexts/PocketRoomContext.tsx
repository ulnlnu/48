// PocketRoom 状态管理 Context
import React, { createContext, useContext, useState } from 'react';
import type { RoomOwnerMessage, AccountInfo } from '../types';
import type { ReactNode } from 'react';

// 关注的房间项
export interface FollowedRoom {
  roomId: string;
  roomName: string;
  ownerId: string;
  avatar?: string;
  starTeamName?: string;
}

// Team 消息上下文
export interface TeamContext {
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
export interface IdolRoomInfo {
  channelId: string;
  channelName?: string;
  ownerName?: string;
  ownerId?: number;
  serverId: string;
}

// 消息筛选条件
export interface MessageFilter {
  startTime: string;
  endTime: string;
  speaker: string;
  keyword: string;
}

// 导航选项卡类型
export type TabType = 'follow' | 'search' | 'messages' | 'storage';

// 面包屑路径项
interface BreadcrumbItem {
  label: string;
  tab?: TabType;
  action?: () => void;
}

// PocketRoom 状态接口
interface PocketRoomContextType {
  // 导航状态
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  breadcrumbs: BreadcrumbItem[];
  setBreadcrumbs: (items: BreadcrumbItem[]) => void;

  // 房间状态
  followedRooms: FollowedRoom[];
  setFollowedRooms: React.Dispatch<React.SetStateAction<FollowedRoom[]>>;
  selectedFollowedRoom: FollowedRoom | null;
  setSelectedFollowedRoom: React.Dispatch<React.SetStateAction<FollowedRoom | null>>;

  // 搜索状态
  memberList: any[];
  setMemberList: React.Dispatch<React.SetStateAction<any[]>>;
  memberSearchResults: any[];
  setMemberSearchResults: React.Dispatch<React.SetStateAction<any[]>>;
  memberSearchKeyword: string;
  setMemberSearchKeyword: React.Dispatch<React.SetStateAction<string>>;

  // 房间信息状态
  idolRoomInfo: IdolRoomInfo | null;
  setIdolRoomInfo: React.Dispatch<React.SetStateAction<IdolRoomInfo | null>>;
  inputChannelId: string;
  setInputChannelId: React.Dispatch<React.SetStateAction<string>>;

  // 消息状态
  messageList: RoomOwnerMessage[];
  setMessageList: React.Dispatch<React.SetStateAction<RoomOwnerMessage[]>>;
  filterLivePush: boolean;
  setFilterLivePush: React.Dispatch<React.SetStateAction<boolean>>;
  filter: MessageFilter;
  setFilter: React.Dispatch<React.SetStateAction<MessageFilter>>;

  // Team 状态
  teamContext: TeamContext | null;
  setTeamContext: React.Dispatch<React.SetStateAction<TeamContext | null>>;
  savedTeams: TeamContext[];
  setSavedTeams: React.Dispatch<React.SetStateAction<TeamContext[]>>;

  // 存储状态
  storedMessages: any;
  setStoredMessages: React.Dispatch<React.SetStateAction<any>>;

  // 加载状态
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  loadingFollowedRooms: boolean;
  setLoadingFollowedRooms: React.Dispatch<React.SetStateAction<boolean>>;

  // 结果显示
  result: string;
  setResult: React.Dispatch<React.SetStateAction<string>>;
}

// 创建 Context
const PocketRoomContext = createContext<PocketRoomContextType | undefined>(undefined);

// Provider 组件
export const PocketRoomProvider: React.FC<{
  children: ReactNode;
  currentAccount: AccountInfo | null;
}> = ({ children }) => {
  // 导航状态
  const [activeTab, setActiveTab] = useState<TabType>('follow');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: '关注房间', tab: 'follow' }
  ]);

  // 房间状态
  const [followedRooms, setFollowedRooms] = useState<FollowedRoom[]>([]);
  const [selectedFollowedRoom, setSelectedFollowedRoom] = useState<FollowedRoom | null>(null);

  // 搜索状态
  const [memberList, setMemberList] = useState<any[]>([]);
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);
  const [memberSearchKeyword, setMemberSearchKeyword] = useState('');

  // 房间信息状态
  const [idolRoomInfo, setIdolRoomInfo] = useState<IdolRoomInfo | null>(null);
  const [inputChannelId, setInputChannelId] = useState('');

  // 消息状态
  const [messageList, setMessageList] = useState<RoomOwnerMessage[]>([]);
  const [filterLivePush, setFilterLivePush] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>({
    startTime: '',
    endTime: '',
    speaker: '',
    keyword: '',
  });

  // Team 状态
  const [teamContext, setTeamContext] = useState<TeamContext | null>(null);
  const [savedTeams, setSavedTeams] = useState<TeamContext[]>([]);

  // 存储状态
  const [storedMessages, setStoredMessages] = useState<any>(null);

  // 加载状态
  const [loading, setLoading] = useState(false);
  const [loadingFollowedRooms, setLoadingFollowedRooms] = useState(false);

  // 结果显示
  const [result, setResult] = useState<string>('');

  const value: PocketRoomContextType = {
    // 导航状态
    activeTab,
    setActiveTab,
    breadcrumbs,
    setBreadcrumbs,

    // 房间状态
    followedRooms,
    setFollowedRooms,
    selectedFollowedRoom,
    setSelectedFollowedRoom,

    // 搜索状态
    memberList,
    setMemberList,
    memberSearchResults,
    setMemberSearchResults,
    memberSearchKeyword,
    setMemberSearchKeyword,

    // 房间信息状态
    idolRoomInfo,
    setIdolRoomInfo,
    inputChannelId,
    setInputChannelId,

    // 消息状态
    messageList,
    setMessageList,
    filterLivePush,
    setFilterLivePush,
    filter,
    setFilter,

    // Team 状态
    teamContext,
    setTeamContext,
    savedTeams,
    setSavedTeams,

    // 存储状态
    storedMessages,
    setStoredMessages,

    // 加载状态
    loading,
    setLoading,
    loadingFollowedRooms,
    setLoadingFollowedRooms,

    // 结果显示
    result,
    setResult,
  };

  return (
    <PocketRoomContext.Provider value={value}>
      {children}
    </PocketRoomContext.Provider>
  );
};

// Hook 使用 Context
export const usePocketRoom = () => {
  const context = useContext(PocketRoomContext);
  if (context === undefined) {
    throw new Error('usePocketRoom must be used within PocketRoomProvider');
  }
  return context;
};
