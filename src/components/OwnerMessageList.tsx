import React, { useMemo, useState } from 'react';
import type { RoomOwnerMessage } from '../types';

interface OwnerMessageListProps {
  messages: RoomOwnerMessage[];
}

// 消息类型判断
const isImageMsg = (msgType: string) => ['IMAGE', 'PICTURE', 'PIC'].includes(msgType.toUpperCase());
const isVideoMsg = (msgType: string) => ['VIDEO', 'VIDEO_MSG'].includes(msgType.toUpperCase());

// 获取完整URL
const getFullUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `https://source.48.cn${url}`;
};

// 格式化视频时长 (dur 字段是毫秒)
const formatVideoDuration = (milliseconds: number) => {
  if (!milliseconds) return '';
  const seconds = Math.round(milliseconds / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 获取用户信息
const getUserInfo = (extInfo: string) => {
  try {
    const parsed = JSON.parse(extInfo);
    return parsed.user || null;
  } catch {
    return null;
  }
};

// 解析 bodys 字段（图片/视频消息的URL在bodys中）
const parseBodyContent = (bodys: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(bodys);
  } catch {
    return null;
  }
};

export const OwnerMessageList: React.FC<OwnerMessageListProps> = ({ messages }) => {
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  interface ParsedMessage {
    msgIdServer: string;
    msgIdClient: string;
    msgTime: number;
    msgType: string;
    bodys: string;
    extInfo: string;
    privacy: boolean;
    userInfo: {
      nickName: string;
      avatar: string;
    } | null;
    parsedBody: Record<string, unknown> | null;
  }

  const parsedMessages = useMemo((): ParsedMessage[] => {
    return messages.map(msg => ({
      msgIdServer: msg.msgIdServer,
      msgIdClient: msg.msgIdClient,
      msgTime: msg.msgTime,
      msgType: msg.msgType,
      bodys: msg.bodys,
      extInfo: msg.extInfo,
      privacy: msg.privacy,
      userInfo: getUserInfo(msg.extInfo),
      parsedBody: parseBodyContent(msg.bodys),
    })).sort((a, b) => b.msgTime - a.msgTime);
  }, [messages]);

  if (parsedMessages.length === 0) {
    return <div className="empty-message">暂无消息</div>;
  }

  return (
    <div className="owner-message-list">
      {parsedMessages.map((msg, index) => {
        // 生成唯一key，处理可能存在的undefined值
        const msgId = `${msg.msgIdServer || 's'}-${msg.msgIdClient || 'c'}-${msg.msgTime || index}`;
        const parsedBody = msg.parsedBody;

        // 图片消息：从bodys中获取url
        const imageUrl = parsedBody && isImageMsg(msg.msgType)
          ? getFullUrl(parsedBody.url as string || '')
          : '';
        const imageWidth = parsedBody?.w as number | undefined;
        const imageHeight = parsedBody?.h as number | undefined;

        // 视频消息：从bodys中获取url和时长
        const videoUrl = parsedBody && isVideoMsg(msg.msgType)
          ? getFullUrl(parsedBody.url as string || '')
          : '';
        const videoDuration = parsedBody?.dur as number | undefined;

        return (
          <div key={msgId} className="message-card">
            <div className="message-header">
              <div className="user-info">
                <img
                  src={msg.userInfo?.avatar ? getFullUrl(msg.userInfo.avatar) : ''}
                  alt="avatar"
                  className="avatar"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://source.48.cn/mediasource/teamLogo2/all/snh48_n2.png';
                  }}
                />
                <div className="name-time">
                  <span className="nickname">{msg.userInfo?.nickName || '未知用户'}</span>
                  <span className="time">{new Date(msg.msgTime).toLocaleString()}</span>
                </div>
              </div>
              <div className="message-tags">
                {isImageMsg(msg.msgType) && <span className="tag image">图片</span>}
                {isVideoMsg(msg.msgType) && <span className="tag video">视频</span>}
              </div>
            </div>

            <div className="message-content">
              {/* 文本消息 */}
              {msg.msgType.toUpperCase() === 'TEXT' && msg.bodys && (
                <p className="text">{msg.bodys}</p>
              )}

              {/* 图片消息 */}
              {isImageMsg(msg.msgType) && imageUrl && (
                <div className="media-container image-container">
                  <img
                    src={imageUrl}
                    alt="消息图片"
                    className="message-image"
                    onClick={() => setLightboxImage(imageUrl)}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {imageWidth && imageHeight && (
                    <span className="media-dimensions">{imageWidth}x{imageHeight}</span>
                  )}
                  <span className="media-badge">图片</span>
                </div>
              )}

              {/* 视频消息 */}
              {isVideoMsg(msg.msgType) && videoUrl && (
                <div className="media-container video-container">
                  <div
                    className="video-thumbnail"
                    onClick={() => window.open(videoUrl, '_blank')}
                  >
                    <div className="video-placeholder">
                      <span className="video-icon">▶</span>
                    </div>
                    <div className="video-play-overlay">
                      <span className="play-icon">▶</span>
                    </div>
                  </div>
                  <div className="video-info">
                    <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="video-link">
                      点击查看视频
                    </a>
                    {videoDuration && (
                      <span className="video-duration">{formatVideoDuration(videoDuration)}</span>
                    )}
                  </div>
                  <span className="media-badge">视频</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* 图片预览弹窗 */}
      {lightboxImage && (
        <div className="lightbox" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="预览" />
            <a href={lightboxImage} target="_blank" rel="noopener noreferrer" className="lightbox-download">
              下载图片
            </a>
            <button className="lightbox-close" onClick={() => setLightboxImage(null)}>×</button>
          </div>
        </div>
      )}
    </div>
  );
};
