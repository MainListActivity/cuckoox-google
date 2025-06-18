import { useEffect, useRef } from 'react';
import type { CollaborationManagerProps, RemoteCursor, QuillDelta } from './types';
import type { Range as QuillRange } from 'quill/core';
import { LiveHandler, Uuid } from 'surrealdb';

// 定义SurrealDB相关类型
interface DeltaRecord {
  [x: string]: unknown;
  docId: string;
  delta: QuillDelta;
  deltaContent?: QuillDelta;
  userId: string;
  ts: string;
}

interface CursorRecord {
  [x: string]: unknown;
  docId: string;
  userId: string;
  userName?: string;
  range: QuillRange;
  ts: string;
}

interface DocumentRecord {
  content?: QuillDelta;
}

// interface LiveChangeData {
//   action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE';
//   result: DeltaRecord | CursorRecord | 'killed' | 'disconnected';
// }

interface QueryResult {
  result: Uuid;
}

// Helper function to convert hex to rgba
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Predefined colors for user cursors
const USER_COLORS = [
  '#26A69A', // Teal 300
  '#5C6BC0', // Indigo 300
  '#EC407A', // Pink 400
  '#FF7043', // Deep Orange 400
  '#66BB6A', // Green 400
  '#78909C', // Blue Grey 400
];

const CollaborationManager: React.FC<CollaborationManagerProps> = ({
  quillRef,
  config,
  onTextChange,
  onSelectionChange,
  onRemoteCursorsChange,
}) => {
  const { documentId, userId, userName, surreal } = config;

  // 在测试环境中直接返回null，避免执行SurrealDB操作
  if (process.env.NODE_ENV === 'test' || typeof window === 'undefined') {
    return null;
  }

  // 使用 useRef 存储回调函数的最新引用
  const onTextChangeRef = useRef(onTextChange);
  const onSelectionChangeRef = useRef(onSelectionChange);


  // 更新回调函数引用
  useEffect(() => {
    onTextChangeRef.current = onTextChange;
    onSelectionChangeRef.current = onSelectionChange;
  });


  // 调试日志：跟踪组件生命周期
  useEffect(() => {
    console.log('[CollaborationManager] 组件挂载，配置:', {
      hasDocumentId: !!documentId,
      hasUserId: !!userId,
      hasUserName: !!userName,
      hasSurreal: !!surreal,
      surrealStatus: surreal?.status
    });

    return () => {
      console.log('[CollaborationManager] 组件卸载');
    };
  }, [documentId, surreal, userId, userName]);

  // 处理文本变化事件
  useEffect(() => {
    // 等待 surreal 连接稳定后再初始化
    if (!surreal || surreal.status !== 'connected') {
      console.log('[CollaborationManager] 等待 SurrealDB 连接...', surreal?.status);
      return;
    }

    const quill = quillRef.current?.getQuill();
    if (!quill || !documentId || !userId) {
      console.log('[CollaborationManager] 等待必要参数...', {
        hasQuill: !!quill,
        hasDocumentId: !!documentId,
        hasUserId: !!userId
      });
      return;
    }

    console.log('[CollaborationManager] 初始化事件监听器');

    // 使用稳定的事件处理器，避免频繁重新绑定
    const textChangeHandler = (delta: QuillDelta, oldDelta: QuillDelta, source: string) => {

      const currentQuill = quillRef.current?.getQuill();
      if (!currentQuill) return;

      const currentContents = currentQuill.getContents();

      // 调用回调函数（如果存在）
      if (onTextChangeRef.current) {
        onTextChangeRef.current(currentContents, delta, source);
      }

      // 发送delta到SurrealDB
      if (source === 'user' && surreal && documentId && userId) {
        surreal.create(`delta`, {
          docId: documentId,
          delta,
          userId,
          ts: new Date().toISOString(),
        }).catch((error: Error) => console.error('Failed to send delta to SurrealDB:', error));
      }
    };

    const selectionChangeHandler = (range: QuillRange | null, oldRange: QuillRange | null, source: string) => {
      if (onSelectionChange) {
        onSelectionChange(range, oldRange, source);
      }
    };

    // 添加事件监听器
    quill.on('text-change', textChangeHandler);
    quill.on('selection-change', selectionChangeHandler);

    return () => {
      console.log('[CollaborationManager] 清理事件监听器');
      // 清理事件监听器
      if (quill) {
        quill.off('text-change', textChangeHandler);
        quill.off('selection-change', selectionChangeHandler);
      }
    };
  }, [quillRef, surreal?.status, documentId, userId, onSelectionChange, surreal]); // 添加所有依赖

  // 订阅SurrealDB变化
  useEffect(() => {
    if (!quillRef || !surreal || surreal.status !== 'connected' || !documentId || !userId) {
      console.log('[CollaborationManager] 跳过订阅设置，条件不满足');
      return;
    }

    const handleLiveChange = (action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE', result: Record<string, unknown> | 'killed' | 'disconnected') => {
      if (result === 'killed' || result === 'disconnected') return;

      const record = result as Record<string, unknown>;
      if (record && typeof record.docId === 'string' && record.docId === documentId) {
        if (action === 'CREATE') {
          const deltaRecord = record as unknown as DeltaRecord;
          if (deltaRecord.deltaContent && deltaRecord.userId !== userId) {
            const currentQuill = quillRef.current?.getQuill();
            currentQuill?.updateContents(deltaRecord.deltaContent, 'api');
          }
        }
      }
    };

    const liveQuery = `LIVE SELECT * FROM delta WHERE docId = '${documentId}'`;
    let liveQueryId: Uuid | null = null;

    const setupLiveQuery = async () => {
      if (!surreal) return;
      try {
        const docSnapshot = await surreal.select(`document:${documentId}`) as Array<DocumentRecord>;
        if (!docSnapshot || docSnapshot.length === 0) {
          await surreal.create(`document:${documentId}`, { content: { ops: [] } });
        }

        const queryResult = await surreal.query(liveQuery) as Array<QueryResult>;
        if (queryResult && queryResult.length > 0 && queryResult[0] && typeof queryResult[0].result === 'string') {
          liveQueryId = queryResult[0].result;
          surreal.subscribeLive(liveQueryId, handleLiveChange);
        }
      } catch (error) {
        console.error('Failed to setup live query or create document:', error);
      }
    };

    const loadDocumentSnapshot = async () => {
      if (!surreal || !quillRef) return;
      const docSnapshotArray = await surreal.select(`document:${documentId}`) as Array<DocumentRecord>;
      const docSnapshot = docSnapshotArray && docSnapshotArray.length > 0 ? docSnapshotArray[0] : null;
      if (docSnapshot && docSnapshot.content) {
        const currentQuill = quillRef.current?.getQuill();
        if (currentQuill) {
          currentQuill.setContents(docSnapshot.content, 'api');
        }
      }
    };

    const fetchInitialContentAndSubscribe = async () => {
      const currentQuill = quillRef.current?.getQuill();
      if (!currentQuill || !surreal || !documentId) return;
      try {
        const deltasResult = await surreal.select<DeltaRecord>(`delta WHERE docId = '${documentId}' ORDER BY ts ASC`);

        if (deltasResult && deltasResult.length > 0) {
          const initialDeltas = deltasResult.filter((d: DeltaRecord) => d.deltaContent).map((d: DeltaRecord) => d.deltaContent);
          if (initialDeltas.length > 0) {
            // 使用Quill的Delta来合并变更
            const Quill = await import('quill');
            const DeltaStatic = Quill.default.import('delta');
            const combinedDelta = initialDeltas.reduce((acc: QuillDelta, current: QuillDelta | undefined) => {
              if (!current) return acc;
              return acc.compose(new DeltaStatic(current));
            }, new DeltaStatic());
            currentQuill.setContents(combinedDelta, 'api');
          } else {
            await loadDocumentSnapshot();
          }
        } else {
          await loadDocumentSnapshot();
        }
      } catch (error) {
        console.error('Failed to fetch initial deltas or document snapshot:', error);
      } finally {
        setupLiveQuery();
      }
    };

    fetchInitialContentAndSubscribe();

    return () => {
      if (liveQueryId && surreal) {
        surreal.kill(liveQueryId);
      }
    };
  }, [surreal?.status, documentId, userId, quillRef, surreal]);

  // 处理光标更新
  useEffect(() => {
    const quill = quillRef.current?.getQuill();
    if (!quill || !surreal || surreal.status !== 'connected' || !documentId || !userId) {
      console.log('[CollaborationManager] 跳过光标更新设置，条件不满足');
      return;
    }

    const selectionChangeHandler = async (range: QuillRange | null, oldRange: QuillRange | null, source: string) => {
      if (source === 'user' && range && surreal) {
        try {
          const cursorId = `cursor:${documentId}:${userId}`;
          await surreal.merge(cursorId, {
            docId: documentId,
            userId: userId,
            userName: userName,
            range: range,
            ts: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Failed to send cursor update to SurrealDB:', error);
        }
      }
    };

    quill.on('selection-change', selectionChangeHandler);

    const cleanupCursor = async () => {
      if (surreal) {
        try {
          const cursorId = `cursor:${documentId}:${userId}`;
          await surreal.delete(cursorId);
        } catch (error) {
          console.error('Failed to delete cursor information from SurrealDB:', error);
        }
      }
    };

    window.addEventListener('beforeunload', cleanupCursor);

    return () => {
      console.log('[CollaborationManager] 清理光标更新');
      if (quill) {
        quill.off('selection-change', selectionChangeHandler);
        cleanupCursor();
      }
      window.removeEventListener('beforeunload', cleanupCursor);
    };
  }, [surreal?.status, documentId, userId, userName, quillRef, surreal]);

  // 处理远程光标
  useEffect(() => {
    const quill = quillRef.current?.getQuill();
    if (!quill || !surreal || surreal.status !== 'connected' || !documentId || !userId) {
      console.log('[CollaborationManager] 跳过远程光标设置，条件不满足');
      return;
    }

    let remoteCursors: Record<string, RemoteCursor> = {};

    const updateRemoteCursorsDisplay = () => {
      const currentQuill = quillRef.current?.getQuill();
      if (!currentQuill) return;

      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());

      Object.values(remoteCursors).forEach((cursorData: RemoteCursor) => {
        if (cursorData.range && currentQuill.isEnabled()) {
          try {
            const { index, length } = cursorData.range;
            if (typeof index !== 'number' || typeof length !== 'number') return;

            const caretEl = document.createElement('span');
            caretEl.className = 'remote-cursor';
            caretEl.style.position = 'absolute';
            caretEl.style.backgroundColor = cursorData.color;
            caretEl.style.width = '2px';
            caretEl.style.zIndex = '10';

            const nameLabel = document.createElement('span');
            nameLabel.className = 'remote-cursor-name';
            nameLabel.textContent = cursorData.userName || cursorData.userId;
            nameLabel.style.position = 'absolute';
            nameLabel.style.top = '-22px';
            nameLabel.style.left = '-2px';
            nameLabel.style.fontSize = '12px';
            nameLabel.style.backgroundColor = cursorData.color;
            nameLabel.style.color = 'white';
            nameLabel.style.padding = '2px 4px';
            nameLabel.style.borderRadius = '4px';
            nameLabel.style.whiteSpace = 'nowrap';
            nameLabel.style.zIndex = '11';

            caretEl.appendChild(nameLabel);

            const bounds = currentQuill.getBounds(index, length);
            if (!bounds) return;

            caretEl.style.top = `${bounds.top}px`;
            caretEl.style.left = `${bounds.left}px`;
            caretEl.style.height = `${bounds.height}px`;

            if (length > 0) {
              const selectionEl = document.createElement('span');
              selectionEl.className = 'remote-selection';
              selectionEl.style.position = 'absolute';
              selectionEl.style.backgroundColor = hexToRgba(cursorData.color, 0.3);
              selectionEl.style.top = `${bounds.top}px`;
              selectionEl.style.left = `${bounds.left}px`;
              selectionEl.style.width = `${bounds.width}px`;
              selectionEl.style.height = `${bounds.height}px`;
              selectionEl.style.zIndex = '9';
              currentQuill.root.parentNode?.appendChild(selectionEl);
            }

            if (currentQuill.root.parentNode) {
              (currentQuill.root.parentNode as HTMLElement).style.position = 'relative';
              currentQuill.root.parentNode.appendChild(caretEl);
            }
          } catch (e) {
            console.error("Error displaying remote cursor:", e, cursorData);
          }
        }
      });
    };

    const liveCursorQuery = `LIVE SELECT * FROM cursor WHERE docId = '${documentId}' AND userId != '${userId}'`;
    let liveCursorQueryId: Uuid | null = null;

    const handleRemoteCursorChange: LiveHandler<CursorRecord> = (action: "CREATE" | "UPDATE" | "DELETE" | "CLOSE", result: CursorRecord | "killed" | "disconnected") => {
      if (result === 'killed' || result === 'disconnected') return;

      if (result && typeof result.docId === 'string' && result.docId === documentId && result.userId !== userId) {
        const { userId: remoteUserId, userName: remoteUserName, range, ts } = result;

        const userHash = remoteUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const color = USER_COLORS[userHash % USER_COLORS.length];

        if (action === 'CREATE' || action === 'UPDATE') {
          remoteCursors = {
            ...remoteCursors,
            [remoteUserId]: { userId: remoteUserId, userName: remoteUserName, range, ts, color },
          };
        } else if (action === 'DELETE') {
          const newCursors = { ...remoteCursors };
          delete newCursors[remoteUserId];
          remoteCursors = newCursors;
        }

        onRemoteCursorsChange(remoteCursors);
        updateRemoteCursorsDisplay();
      }
    };

    const setupLiveCursorQuery = async () => {
      if (!surreal) return;
      try {
        const queryResult = await surreal.query<Uuid[]>(liveCursorQuery);
        if (queryResult && queryResult.length > 0 && queryResult[0]) {
          liveCursorQueryId = queryResult[0];
          surreal.subscribeLive(liveCursorQueryId, handleRemoteCursorChange);
        }
      } catch (error) {
        console.error('Error setting up live query for remote cursors:', error);
      }
    };

    setupLiveCursorQuery();

    return () => {
      if (liveCursorQueryId && surreal) {
        surreal.kill(liveCursorQueryId);
      }
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());
    };
  }, [surreal?.status, documentId, userId, quillRef, onRemoteCursorsChange, surreal]);

  return null; // This component doesn't render anything
};

export default CollaborationManager; 