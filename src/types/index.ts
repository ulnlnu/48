// 口袋48 API 类型定义

export interface AccountInfo {
  accountId: string;
  userId: string;
  token: string;
  username: string;
  avatar?: string;
  nickname?: string;
  level?: number;
  vip?: boolean;
  lastLogin?: number;
}

export interface IdolAnswer {
  answerId: string;
  questionId: string;
  content: string;
  qtime: number;
  answerTime: number;
  roomId: string;
  roomName: string;
  userId: string;
  userName: string;
  userAvatar: string;
  idolId: string;
  idolName: string;
  idolAvatar: string;
  price: number;
  status: number;
  type: number;
  expand?: string;
  answerContent?: string;
}

export interface AnswerFilter {
  idolId?: string;
  idolName?: string;
  roomId?: string;
  startTime?: number;
  endTime?: number;
  keyword?: string;
  status?: number;
  type?: number;
}

export interface StatisticsResult {
  totalCount: number;
  totalCost: number;
  byIdol: { [key: string]: { count: number; cost: number; name: string } };
  byMonth: { [key: string]: { count: number; cost: number } };
  byType: { [key: number]: { count: number; cost: number; name: string } };
}

// 原始翻牌数据接口 (用于 API 响应)
export interface IdolAnswerRaw {
  answerId?: string;
  questionId?: string;
  content?: string;
  qtime?: number;
  answerTime?: number;
  roomId?: string;
  roomName?: string;
  userId?: string;
  baseUserInfo?: {
    nickname?: string;
    avatar?: string;
  };
  idolId?: string;
  price?: number;
  cost?: number;
  status?: number;
  type?: number;
  expand?: string;
  answerContent?: string;
  [key: string]: unknown;
}

// 用户信息接口
export interface UserInfo {
  userId: string;
  nickname: string;
  avatar: string;
  level?: number;
  vip?: boolean;
  [key: string]: unknown;
}

// 房间接口
export interface Room {
  roomId: string;
  roomName: string;
  roomTopic?: string;
  channelId?: string;
  ownerId?: string;
  [key: string]: unknown;
}

// 直播接口
export interface Live {
  liveId: string;
  title: string;
  coverPath: string;
  startTime?: number;
  memberId?: string;
  [key: string]: unknown;
}

// 公演直播推送消息
export interface OpenLiveMessage {
  msgIdClient: string;
  msgIdServer: string;
  msgTime: number;
  msgType: string;
  bodys: string;
  extInfo: string;
  privacy: boolean;
  parsedExtInfo?: {
    id: string;
    coverUrl: string;
    coverUrlList: string[];
    title: string;
    content: string;
    url: string;
    jumpType: string;
    jumpPath: string;
    thirdAppName: string;
    thirdAPPImgUrl: string;
    startTime: number;
    messageType: string;
    user: {
      userId: number;
      nickname: string;
      avatar: string;
    };
    sessionRole: string;
    [key: string]: any;
  };
}

export interface RoomMessageResponse {
  message: RoomOwnerMessage[];
  nextTime: number | string;
  [key: string]: unknown;
}

// 直播推送信息
export interface LivePushInfo {
  liveCover: string;
  liveTitle: string;
  liveId: string;
  shortPath: string;
}

// 礼物回复信息
export interface GiftReplyInfo {
  replyText: string;
  replyName: string;
  replyMessageId: string;
  text: string;
}

// 图片消息信息
export interface ImageMessageInfo {
  url: string;
  md5: string;
  ext: string;
  w: number;
  h: number;
  size: number;
}

// 视频消息信息
export interface VideoMessageInfo {
  url: string;
  md5: string;
  ext: string;
  w: number;
  h: number;
  dur: number;
  size: number;
}

// 房间主人消息
export interface RoomOwnerMessage {
  msgIdServer: string;
  msgIdClient: string;
  msgTime: number;
  msgType: string;
  bodys: string;
  extInfo: string;
  privacy: boolean;
  // 特殊类型消息字段（直接在消息对象上）
  messageType?: 'LIVEPUSH' | 'GIFTREPLY' | 'IMAGE' | 'VIDEO' | 'VOICE' | 'AUDIO' | 'TEXT';
  livePushInfo?: LivePushInfo;
  giftReplyInfo?: GiftReplyInfo;
  // 图片/视频消息字段（直接在消息对象上）
  url?: string;
  ext?: string;
  w?: number;
  h?: number;
  size?: number;
  dur?: number;
  md5?: string;
  parsedExtInfo?: {
    liveCover?: string;
    liveTitle?: string;
    liveId?: string;
    roomId?: string;
    messageType?: string;
    // 用户信息
    user?: {
      userId: number;
      nickName: string;
      avatar: string;
      teamLogo?: string;
      level?: number;
      pfUrl?: string;
    };
    [key: string]: any;
  };
}

// 消息类型常量
export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  PICTURE: 'PICTURE',
  VOICE: 'VOICE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  FILE: 'FILE',
} as const;

// 年报相关类型
export interface YearReportData {
  userId: string;
  year: number;
  overview: YearOverview;
  live: LiveStats;
  room: RoomStats;
  answer: AnswerStats;
  gift: GiftStats;
}

export interface YearOverview {
  totalDays: number;
  totalMessages: number;
  totalChars: number;
  idolsReplied: number;
  idolsMessaged: number;
}

export interface LiveStats {
  watchCount: number;      // 观看场次
  watchDays: number;       // 观看天数
  danmakuCount: number;    // 弹幕次数
  danmakuDays: number;     // 发弹幕天数
  danmakuKeywords: string[]; // 弹幕关键词
  giftCount: number;       // 礼物数量
  giftDays: number;        // 送礼天数
  giftAmount: number;      // 礼物金额
  scoreCount: number;      // 计分场次
  topLiveIdols: { idolId: string; name: string; count: number }[];
  topGiftLive: { date: string; amount: number; idolName: string }[];
  danmakuMonthly: number[];
  danmakuHourly: number[];
}

export interface RoomStats {
  messageCount: number;    // 留言次数
  messageDays: number;     // 留言天数
  replyCount: number;      // 被回复次数
  replyDays: number;       // 被回复天数
  topIdols: { idolId: string; name: string; count: number }[];
  messageMonthly: number[];
  messageHourly: number[];
}

export interface AnswerStats {
  askCount: number;        // 提问次数
  askedIdols: number;      // 提问成员数
  answeredCount: number;   // 被回复次数
  answeredIdols: number;   // 回复成员数
  cost: number;            // 消费金额
  topIdols: { idolId: string; name: string; count: number }[];
  topAnsweredIdols: { idolId: string; name: string; count: number }[];
  monthlyStats: number[];  // 月度分布
  hourlyStats: number[];   // 时段分布
}

export interface GiftStats {
  totalCount: number;      // 礼物总数
  totalAmount: number;     // 礼物总金额
  giftTypes: { type: string; count: number }[];
  giftIdols: { idolId: string; name: string; count: number; amount: number }[];
}

// 公演录播信息
export interface OpenLiveInfo {
  liveId: string;
  title: string;
  subTitle: string;
  coverPath: string;
  stime: string;        // 开始时间戳
  status?: number;      // 0=未开始 1=已开始
  liveType?: number;
}

// 礼物信息
export interface GiftInfo {
  giftId: number;       // API returns number, not string
  giftName: string;
  picPath: string;
  money: number;        // 礼物金额（API returns "money", not "price"）
  // Optional fields from API
  melee?: number;
  click?: boolean;
  special?: boolean;
  switchTime?: number;
  typeId?: number;
  adaptUser?: number;
  additionalData?: number;
  isPocketGift?: number;
  hasEndtime?: number;
  giftTotal?: number;
  giftDesc?: string;
  tpNum?: string;
  hasSkill?: number;
}

// 礼物列表响应
export interface GiftListResponse {
  status: number;
  success: boolean;
  content?: GiftInfo[];
  message?: string;
}
