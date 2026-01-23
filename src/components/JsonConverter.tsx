// JSON转换器组件 - 支持导入JSON解析出图片、语音、视频供用户下载保存
import { useState } from 'react';
import './JsonConverter.css';

// 媒体资源接口
interface MediaResource {
  type: 'image' | 'video' | 'voice';
  url: string;
  filename: string;
  ext?: string;
  size?: number;
  duration?: number;
  index: number;
}

export const JsonConverter: React.FC = () => {
  const [jsonContent, setJsonContent] = useState('');
  const [mediaResources, setMediaResources] = useState<MediaResource[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');

  // 解析JSON内容
  const parseJsonContent = () => {
    try {
      setIsLoading(true);
      const data = JSON.parse(jsonContent);
      const resources: MediaResource[] = [];

      // 处理导出的消息格式
      if (data.messages && Array.isArray(data.messages)) {
        data.messages.forEach((msg: any, index: number) => {
          // 检查 bodys 字段
          if (msg.bodys) {
            try {
              const bodysData = typeof msg.bodys === 'string' ? JSON.parse(msg.bodys) : msg.bodys;

              // 图片消息
              if ((bodysData.url && ['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(bodysData.ext)) ||
                  (msg.msgType === 'IMAGE' && msg.url)) {
                resources.push({
                  type: 'image',
                  url: bodysData.url || msg.url,
                  filename: `image_${index}.${bodysData.ext || msg.ext || 'jpg'}`,
                  ext: bodysData.ext || msg.ext,
                  size: bodysData.size || msg.size,
                  index,
                });
              }

              // 视频消息
              if ((bodysData.url && ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(bodysData.ext)) ||
                  (msg.msgType === 'VIDEO' && msg.url)) {
                resources.push({
                  type: 'video',
                  url: bodysData.url || msg.url,
                  filename: `video_${index}.${bodysData.ext || msg.ext || 'mp4'}`,
                  ext: bodysData.ext || msg.ext,
                  size: bodysData.size || msg.size,
                  duration: bodysData.dur || msg.dur,
                  index,
                });
              }

              // 语音消息 - 检查bodys中的语音格式
              // 语音格式: {"size":25337,"ext":"aac","dur":7012,"url":"...","md5":"..."}
              if (bodysData.url && ['aac', 'mp3', 'wav', 'amr', 'm4a'].includes(bodysData.ext)) {
                resources.push({
                  type: 'voice',
                  url: bodysData.url,
                  filename: `voice_${index}.${bodysData.ext || 'aac'}`,
                  ext: bodysData.ext,
                  size: bodysData.size,
                  duration: bodysData.dur,
                  index,
                });
              }
            } catch {
              // 忽略bodys解析错误
            }
          }

          // 检查直接在消息对象上的url字段（视频/图片）
          if (msg.url && msg.ext) {
            if (['jpg', 'png', 'gif', 'jpeg', 'webp'].includes(msg.ext)) {
              resources.push({
                type: 'image',
                url: msg.url,
                filename: `image_${index}.${msg.ext}`,
                ext: msg.ext,
                size: msg.size,
                index,
              });
            }
            if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(msg.ext)) {
              resources.push({
                type: 'video',
                url: msg.url,
                filename: `video_${index}.${msg.ext}`,
                ext: msg.ext,
                size: msg.size,
                duration: msg.dur,
                index,
              });
            }
            if (['aac', 'mp3', 'wav', 'amr', 'm4a'].includes(msg.ext)) {
              resources.push({
                type: 'voice',
                url: msg.url,
                filename: `voice_${index}.${msg.ext}`,
                ext: msg.ext,
                size: msg.size,
                duration: msg.dur,
                index,
              });
            }
          }
        });
      }

      setMediaResources(resources);
      if (resources.length === 0) {
        alert('未在JSON中找到图片、语音或视频资源');
      }
    } catch (error) {
      alert('JSON解析失败: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedItems.size === mediaResources.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(mediaResources.map(r => r.index)));
    }
  };

  // 切换单个选择
  const toggleSelectItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  // 下载选中的资源
  const downloadSelected = async () => {
    if (selectedItems.size === 0) {
      alert('请先选择要下载的资源');
      return;
    }

    const selectedResources = mediaResources.filter(r => selectedItems.has(r.index));

    for (const resource of selectedResources) {
      try {
        const response = await fetch(resource.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resource.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 添加延迟避免浏览器阻止多个下载
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`下载失败: ${resource.filename}`, error);
      }
    }
  };

  // 按类型下载
  const downloadByType = async (type: 'image' | 'video' | 'voice') => {
    const resources = mediaResources.filter(r => r.type === type);
    if (resources.length === 0) {
      alert(`没有找到${type === 'image' ? '图片' : type === 'video' ? '视频' : '语音'}资源`);
      return;
    }

    for (const resource of resources) {
      try {
        const response = await fetch(resource.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = resource.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`下载失败: ${resource.filename}`, error);
      }
    }
  };

  // 清空内容
  const clearContent = () => {
    setJsonContent('');
    setMediaResources([]);
    setSelectedItems(new Set());
    setFileName('');
  };

  const imageCount = mediaResources.filter(r => r.type === 'image').length;
  const videoCount = mediaResources.filter(r => r.type === 'video').length;
  const voiceCount = mediaResources.filter(r => r.type === 'voice').length;

  return (
    <div className="json-converter">
      <div className="converter-header">
        <h2>JSON 资源转换器</h2>
        <p className="converter-desc">导入口袋房间消息JSON文件，自动提取并下载图片、语音、视频资源</p>
      </div>

      <div className="converter-content">
        {/* JSON输入区域 */}
        <div className="input-section">
          <h3>1️⃣ 导入JSON文件</h3>
          <div className="file-input-area">
            <input
              type="file"
              accept=".json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const content = await file.text();
                  setJsonContent(content);
                  setFileName(file.name);
                }
              }}
              className="file-input"
              id="json-file-input"
            />
            <label htmlFor="json-file-input" className="file-input-label">
              📁 选择JSON文件
            </label>
            {fileName && <span className="file-name">{fileName}</span>}
          </div>

          <div className="textarea-area">
            <textarea
              value={jsonContent}
              onChange={(e) => setJsonContent(e.target.value)}
              placeholder="或直接粘贴JSON内容..."
              className="json-textarea"
              rows={10}
            />
          </div>

          <div className="action-buttons">
            <button
              onClick={parseJsonContent}
              disabled={!jsonContent.trim() || isLoading}
              className="btn-parse"
            >
              {isLoading ? '解析中...' : '🔍 解析资源'}
            </button>
            {jsonContent && (
              <button onClick={clearContent} className="btn-clear">
                🗑️ 清空
              </button>
            )}
          </div>
        </div>

        {/* 资源列表区域 */}
        {mediaResources.length > 0 && (
          <div className="resources-section">
            <div className="resources-header">
              <h3>2️⃣ 解析结果 ({mediaResources.length} 个资源)</h3>
              <div className="resource-stats">
                <span className="stat-item stat-image">🖼️ 图片: {imageCount}</span>
                <span className="stat-item stat-video">🎬 视频: {videoCount}</span>
                <span className="stat-item stat-voice">🎤 语音: {voiceCount}</span>
              </div>
            </div>

            <div className="resources-toolbar">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={selectedItems.size === mediaResources.length}
                  onChange={toggleSelectAll}
                />
                全选 ({selectedItems.size}/{mediaResources.length})
              </label>

              <div className="download-buttons">
                <button
                  onClick={downloadSelected}
                  disabled={selectedItems.size === 0}
                  className="btn-download btn-download-selected"
                >
                  📥 下载选中 ({selectedItems.size})
                </button>
                <button
                  onClick={() => downloadByType('image')}
                  disabled={imageCount === 0}
                  className="btn-download btn-download-image"
                >
                  🖼️ 下载图片 ({imageCount})
                </button>
                <button
                  onClick={() => downloadByType('video')}
                  disabled={videoCount === 0}
                  className="btn-download btn-download-video"
                >
                  🎬 下载视频 ({videoCount})
                </button>
                <button
                  onClick={() => downloadByType('voice')}
                  disabled={voiceCount === 0}
                  className="btn-download btn-download-voice"
                >
                  🎤 下载语音 ({voiceCount})
                </button>
              </div>
            </div>

            <div className="resources-list">
              {mediaResources.map((resource) => (
                <div
                  key={resource.index}
                  className={`resource-item resource-${resource.type} ${selectedItems.has(resource.index) ? 'selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(resource.index)}
                    onChange={() => toggleSelectItem(resource.index)}
                    className="resource-checkbox"
                  />
                  <div className="resource-icon">
                    {resource.type === 'image' && '🖼️'}
                    {resource.type === 'video' && '🎬'}
                    {resource.type === 'voice' && '🎤'}
                  </div>
                  <div className="resource-info">
                    <div className="resource-name">{resource.filename}</div>
                    <div className="resource-meta">
                      {resource.size && <span>大小: {(resource.size / 1024).toFixed(1)} KB</span>}
                      {resource.duration && <span>时长: {(resource.duration / 1000).toFixed(1)} 秒</span>}
                    </div>
                  </div>
                  <div className="resource-preview">
                    {resource.type === 'image' && (
                      <img src={resource.url} alt="" loading="lazy" />
                    )}
                    {resource.type === 'video' && (
                      <video src={resource.url} preload="metadata" />
                    )}
                    {resource.type === 'voice' && (
                      <audio src={resource.url} controls />
                    )}
                  </div>
                  <button
                    onClick={() => window.open(resource.url, '_blank')}
                    className="btn-open"
                    title="新窗口打开"
                  >
                    🔗
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
