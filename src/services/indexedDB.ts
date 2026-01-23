// IndexedDB 封装服务，用于存储大量房间消息
import type { RoomOwnerMessage, GiftInfo } from '../types';

// 数据库配置
const DB_NAME = 'Pocket48Messages';
const DB_VERSION = 4; // 升级版本号

// 对象存储名称
const STORE_MESSAGES = 'messages'; // 统一的消息存储
const STORE_METADATA = 'metadata';
const STORE_GIFTS = 'gifts'; // 礼物列表存储

// 消息记录接口
export interface StoredMessage {
  id: string; // 唯一标识: msgIdServer 或组合键
  channelId: string;
  channelName?: string;
  ownerName?: string;
  message: RoomOwnerMessage;
  createdAt: number;
}

// 房间元数据接口
export interface RoomMetadata {
  channelId: string;
  serverId?: string;
  channelName?: string;
  ownerName?: string;
  ownerId?: number;
  messageCount: number;
  oldestMsgTime?: number;
  newestMsgTime?: number;
  lastUpdated: number;
}

// 完整的存储房间数据接口
export interface StoredRoomMessages {
  channelId: string;
  channelName?: string;
  ownerName?: string;
  ownerId?: number;
  messages: RoomOwnerMessage[];
  lastUpdated: number;
}

// 存储的礼物列表接口
export interface StoredGiftList {
  gifts: GiftInfo[];
  lastUpdated: number;
}

class MessageDB {
  private db: IDBDatabase | null = null;

  // 初始化数据库
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB 打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB 初始化成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        // 版本升级时删除旧的存储
        if (oldVersion < 3) {
          if (db.objectStoreNames.contains('messages_all')) {
            db.deleteObjectStore('messages_all');
            console.log('删除旧版 messages_all 存储');
          }
          if (db.objectStoreNames.contains('messages_owner_replies')) {
            db.deleteObjectStore('messages_owner_replies');
            console.log('删除旧版 messages_owner_replies 存储');
          }
          if (db.objectStoreNames.contains('messages')) {
            db.deleteObjectStore('messages');
            console.log('删除旧版 messages 存储');
          }
        }

        // 创建统一的消息存储
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const messageStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          messageStore.createIndex('channelId', 'channelId', { unique: false });
          messageStore.createIndex('msgTime', 'message.msgTime', { unique: false });
          messageStore.createIndex('channelId-msgTime', ['channelId', 'message.msgTime'], { unique: false });
          console.log('创建 messages 存储');
        }

        // 创建元数据存储
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          const metadataStore = db.createObjectStore(STORE_METADATA, { keyPath: 'channelId' });
          metadataStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        }

        // 创建礼物列表存储
        if (!db.objectStoreNames.contains(STORE_GIFTS)) {
          const giftStore = db.createObjectStore(STORE_GIFTS, { keyPath: 'id' });
          giftStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
          console.log('创建 gifts 存储');
        }

        console.log('IndexedDB 对象存储创建完成');
      };
    });
  }

  // 确保数据库已初始化
  private async ensureInit(): Promise<void> {
    if (!this.db) {
      await this.init();
    }
  }

  // 保存消息列表（批量保存，自动去重）
  async saveMessages(
    channelId: string,
    messages: RoomOwnerMessage[],
    channelName?: string,
    ownerName?: string,
    ownerId?: number
  ): Promise<{ saved: number; skipped: number }> {
    await this.ensureInit();

    if (!this.db || messages.length === 0) return { saved: 0, skipped: 0 };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [STORE_MESSAGES, STORE_METADATA],
        'readwrite'
      );
      const messageStore = transaction.objectStore(STORE_MESSAGES);
      const metadataStore = transaction.objectStore(STORE_METADATA);

      // 计算时间范围
      const msgTimes = messages.map(m => m.msgTime);
      const oldestTime = Math.min(...msgTimes);
      const newestTime = Math.max(...msgTimes);

      // 获取已存在的消息 ID
      const index = messageStore.index('channelId');
      const req = index.getAllKeys(channelId);
      req.onsuccess = () => {
        const existingKeys = new Set(req.result as string[]);
        const newMessages: RoomOwnerMessage[] = [];

        messages.forEach((message) => {
          const msgId = `${channelId}_${message.msgIdServer}`;
          const isNew = !existingKeys.has(msgId);

          if (isNew) {
            newMessages.push(message);
            const storedMessage: StoredMessage = {
              id: msgId,
              channelId,
              channelName,
              ownerName,
              message,
              createdAt: Date.now(),
            };
            messageStore.put(storedMessage);
          }
        });

        // 更新元数据
        const metadataRequest = metadataStore.get(channelId);
        metadataRequest.onsuccess = () => {
          const existing = metadataRequest.result as RoomMetadata | undefined;

          const metadata: RoomMetadata = {
            channelId,
            channelName,
            ownerName,
            ownerId,
            messageCount: (existing?.messageCount || 0) + newMessages.length,
            oldestMsgTime: existing?.oldestMsgTime
              ? Math.min(existing.oldestMsgTime, oldestTime)
              : oldestTime,
            newestMsgTime: existing?.newestMsgTime
              ? Math.max(existing.newestMsgTime, newestTime)
              : newestTime,
            lastUpdated: Date.now(),
          };

          metadataStore.put(metadata);
        };

        transaction.oncomplete = () => {
          const skipped = messages.length - newMessages.length;
          console.log(`保存了 ${newMessages.length} 条新消息，跳过 ${skipped} 条重复消息`);
          resolve({ saved: newMessages.length, skipped });
        };

        transaction.onerror = () => {
          console.error('保存消息失败:', transaction.error);
          reject(transaction.error);
        };
      };

      req.onerror = () => {
        console.error('获取已存在消息失败:', req.error);
        reject(req.error);
      };
    });
  }

  // 加载指定频道的所有消息
  async loadMessages(channelId: string): Promise<StoredRoomMessages | null> {
    await this.ensureInit();

    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_MESSAGES, STORE_METADATA], 'readonly');
      const messageStore = transaction.objectStore(STORE_MESSAGES);
      const metadataStore = transaction.objectStore(STORE_METADATA);

      const index = messageStore.index('channelId');
      const request = index.getAll(channelId);
      const metadataRequest = metadataStore.get(channelId);

      let metadata: RoomMetadata | undefined;

      metadataRequest.onsuccess = () => {
        metadata = metadataRequest.result as RoomMetadata | undefined;
      };

      request.onsuccess = () => {
        const storedMessages = request.result as StoredMessage[];

        if (storedMessages.length === 0) {
          resolve(null);
          return;
        }

        const messages = storedMessages
          .map(sm => sm.message)
          .sort((a, b) => b.msgTime - a.msgTime); // 按时间倒序

        resolve({
          channelId,
          channelName: metadata?.channelName,
          ownerName: metadata?.ownerName,
          ownerId: metadata?.ownerId,
          messages,
          lastUpdated: metadata?.lastUpdated || Date.now(),
        });
      };

      request.onerror = () => {
        console.error('加载消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 按时间范围加载消息
  async loadMessagesByTimeRange(
    channelId: string,
    startTime?: number,
    endTime?: number
  ): Promise<RoomOwnerMessage[]> {
    await this.ensureInit();

    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_MESSAGES], 'readonly');
      const messageStore = transaction.objectStore(STORE_MESSAGES);
      const index = messageStore.index('channelId-msgTime');

      const range = IDBKeyRange.bound(
        [channelId, startTime || 0],
        [channelId, endTime || Date.now()],
        false,
        false
      );

      const request = index.getAll(range);

      request.onsuccess = () => {
        const storedMessages = request.result as StoredMessage[];
        const messages = storedMessages.map(sm => sm.message);
        resolve(messages);
      };

      request.onerror = () => {
        console.error('按时间范围加载消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取所有房间元数据
  async getAllMetadata(): Promise<RoomMetadata[]> {
    await this.ensureInit();

    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_METADATA], 'readonly');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result as RoomMetadata[]);
      };

      request.onerror = () => {
        console.error('获取元数据失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 删除指定频道的所有消息
  async deleteChannel(channelId: string): Promise<void> {
    await this.ensureInit();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_MESSAGES, STORE_METADATA], 'readwrite');
      const messageStore = transaction.objectStore(STORE_MESSAGES);
      const metadataStore = transaction.objectStore(STORE_METADATA);

      // 删除所有该频道的消息
      const index = messageStore.index('channelId');
      const request = index.openCursor(IDBKeyRange.only(channelId));

      request.onsuccess = () => {
        // 删除元数据
        metadataStore.delete(channelId);
        console.log(`已删除频道 ${channelId} 的所有消息`);
        resolve();
      };

      request.onerror = () => {
        console.error('删除频道失败:', request.error);
        reject(transaction.error);
      };
    });
  }

  // 清空所有数据
  async clearAll(): Promise<void> {
    await this.ensureInit();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_MESSAGES, STORE_METADATA], 'readwrite');
      transaction.objectStore(STORE_MESSAGES).clear();
      transaction.objectStore(STORE_METADATA).clear();

      transaction.oncomplete = () => {
        console.log('已清空所有数据');
        resolve();
      };

      transaction.onerror = () => {
        console.error('清空数据失败:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  // 导出指定频道数据为 JSON
  async exportChannelToJson(channelId: string): Promise<string> {
    const data = await this.loadMessages(channelId);
    if (!data) {
      throw new Error('没有找到该频道的消息');
    }
    return JSON.stringify(data, null, 2);
  }

  // 导出所有数据为 JSON
  async exportAllToJson(): Promise<string> {
    const metadataList = await this.getAllMetadata();
    const exportData: Record<string, StoredRoomMessages> = {};

    for (const metadata of metadataList) {
      const data = await this.loadMessages(metadata.channelId);
      if (data) {
        exportData[metadata.channelId] = data;
      }
    }

    return JSON.stringify(exportData, null, 2);
  }

  // 导入 JSON 数据
  async importFromJson(jsonString: string): Promise<void> {
    await this.ensureInit();

    try {
      const data = JSON.parse(jsonString);

      // 支持两种格式：单个频道数据或多个频道数据
      if (data.channelId && Array.isArray(data.messages)) {
        // 单个频道格式
        await this.saveMessages(
          data.channelId,
          data.messages,
          data.channelName,
          data.ownerName,
          data.ownerId  // 保存 ownerId
        );
      } else if (typeof data === 'object') {
        // 多个频道格式
        for (const channelId in data) {
          const channelData = data[channelId] as StoredRoomMessages;
          if (channelData.channelId && Array.isArray(channelData.messages)) {
            await this.saveMessages(
              channelData.channelId,
              channelData.messages,
              channelData.channelName,
              channelData.ownerName,
              channelData.ownerId  // 保存 ownerId
            );
          }
        }
      }
    } catch (error) {
      console.error('导入数据失败:', error);
      throw error;
    }
  }

  // 导出为 CSV 格式
  async exportChannelToCsv(channelId: string): Promise<string> {
    const data = await this.loadMessages(channelId);
    if (!data || data.messages.length === 0) {
      throw new Error('没有找到该频道的消息');
    }

    const headers = ['msgTime', 'msgType', 'bodys', 'privacy'];
    const rows = data.messages.map(msg => [
      new Date(msg.msgTime).toLocaleString('zh-CN'),
      msg.msgType,
      `"${(msg.bodys || '').replace(/"/g, '""')}"`,
      msg.privacy ? '是' : '否',
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // 获取数据库使用情况
  async getStorageInfo(): Promise<{ channelCount: number; totalMessages: number; estimatedSize: string }> {
    await this.ensureInit();
    const metadataList = await this.getAllMetadata();
    const totalMessages = metadataList.reduce((sum, m) => sum + m.messageCount, 0);

    // 估算大小（每条消息约 500 字节）
    const estimatedBytes = totalMessages * 500;
    const estimatedSize = estimatedBytes > 1024 * 1024
      ? `${(estimatedBytes / (1024 * 1024)).toFixed(2)} MB`
      : `${(estimatedBytes / 1024).toFixed(2)} KB`;

    return {
      channelCount: metadataList.length,
      totalMessages,
      estimatedSize,
    };
  }

  // 保存礼物列表
  async saveGiftList(gifts: GiftInfo[]): Promise<void> {
    await this.ensureInit();

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_GIFTS], 'readwrite');
      const giftStore = transaction.objectStore(STORE_GIFTS);

      const storedGiftList: StoredGiftList = {
        gifts,
        lastUpdated: Date.now(),
      };

      const request = giftStore.put({ id: 'default', ...storedGiftList });

      request.onsuccess = () => {
        console.log(`保存了 ${gifts.length} 个礼物到本地存储`);
        resolve();
      };

      request.onerror = () => {
        console.error('保存礼物列表失败:', request.error);
        reject(request.error);
      };
    });
  }

  // 获取礼物列表
  async getGiftList(): Promise<GiftInfo[] | null> {
    await this.ensureInit();

    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_GIFTS], 'readonly');
      const giftStore = transaction.objectStore(STORE_GIFTS);

      const request = giftStore.get('default');

      request.onsuccess = () => {
        const result = request.result as StoredGiftList | undefined;
        if (result && result.gifts && Array.isArray(result.gifts)) {
          console.log(`从本地存储加载了 ${result.gifts.length} 个礼物`);
          resolve(result.gifts);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('加载礼物列表失败:', request.error);
        reject(request.error);
      };
    });
  }
}

// 导出单例实例
export const messageDB = new MessageDB();
