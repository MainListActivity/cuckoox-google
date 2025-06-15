import { useEffect } from 'react';
import type { CollaborationManagerProps, RemoteCursor } from './types';

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

  // 处理文本变化事件
  useEffect(() => {
    const quill = quillRef.current?.getQuill();
    if (!quill) return;
    
    const textChangeHandler = (delta: any, oldDelta: any, source: string) => {
      const currentQuill = quillRef.current?.getQuill();
      if (!currentQuill) return;
      
      const currentContents = currentQuill.getContents();
      
      if (onTextChange) {
        onTextChange(currentContents, delta, source);
      }

      // 发送delta到SurrealDB
      if (source === 'user' && surreal && documentId && userId) {
        surreal.create(`delta`, {
          docId: documentId,
          delta,
          userId,
          ts: new Date().toISOString(),
        }).catch((error: any) => console.error('Failed to send delta to SurrealDB:', error));
      }
    };

    const selectionChangeHandler = (range: any, oldRange: any, source: string) => {
      if (onSelectionChange) {
        onSelectionChange(range, oldRange, source);
      }
    };

    quill.on('text-change', textChangeHandler);
    quill.on('selection-change', selectionChangeHandler);

    return () => {
      quill.off('text-change', textChangeHandler);
      quill.off('selection-change', selectionChangeHandler);
    };
  }, [quillRef, onTextChange, onSelectionChange, surreal, documentId, userId]);

  // 订阅SurrealDB变化
  useEffect(() => {
    if (!quillRef || !surreal || !documentId || !userId) return;

    const handleLiveChange = (data: any) => {
      if (data && data.result && typeof data.result.docId === 'string' && data.result.docId === documentId) {
        if (data.action === 'CREATE') {
          const incomingDeltaRecord = data.result as { deltaContent?: any, userId?: string };
          if (incomingDeltaRecord.deltaContent && incomingDeltaRecord.userId !== userId) {
            const currentQuill = quillRef.current?.getQuill();
            currentQuill?.updateContents(incomingDeltaRecord.deltaContent, 'api');
          }
        }
      }
    };

    const liveQuery = `LIVE SELECT * FROM delta WHERE docId = '${documentId}' ORDER BY ts ASC`;
    let liveQueryId: string | null = null;

    const setupLiveQuery = async () => {
      if (!surreal) return;
      try {
        const docSnapshot = await surreal.select(`document:${documentId}`) as Array<{ content?: any }>;
        if (!docSnapshot || docSnapshot.length === 0) {
          await surreal.create(`document:${documentId}`, { content: { ops: [] } });
        }

        const queryResult = await surreal.query(liveQuery) as Array<{ result: string }>;
        if (queryResult && queryResult.length > 0 && queryResult[0] && typeof queryResult[0].result === 'string') {
          liveQueryId = queryResult[0].result;
          (surreal as any).listenLive(liveQueryId, handleLiveChange);
        }
      } catch (error) {
        console.error('Failed to setup live query or create document:', error);
      }
    };

    const loadDocumentSnapshot = async () => {
      if (!surreal || !quillRef) return;
      const docSnapshotArray = await surreal.select(`document:${documentId}`);
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
        const deltasResult = await surreal.select(`delta WHERE docId = '${documentId}' ORDER BY ts ASC`);

        if (deltasResult && deltasResult.length > 0) {
          const initialDeltas = deltasResult.filter((d: any) => d.deltaContent).map((d: any) => d.deltaContent);
          if (initialDeltas.length > 0) {
            // 使用Quill的Delta来合并变更
            const Quill = await import('quill');
            const DeltaStatic = Quill.default.import('delta');
            const combinedDelta = initialDeltas.reduce((acc: any, current: any) => acc.compose(new DeltaStatic(current)), new DeltaStatic());
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
        (surreal as any).kill(liveQueryId);
      }
    };
  }, [surreal, documentId, userId, quillRef]);

  // 处理光标更新
  useEffect(() => {
    const quill = quillRef.current?.getQuill();
    if (!quill || !surreal || !documentId || !userId) return;

    const selectionChangeHandler = async (range: any, oldRange: any, source: string) => {
      if (source === 'user' && range && surreal) {
        try {
          const cursorId = `cursor:${documentId}:${userId}`;
          await (surreal as any).merge(cursorId, {
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
      quill.off('selection-change', selectionChangeHandler);
      cleanupCursor();
      window.removeEventListener('beforeunload', cleanupCursor);
    };
  }, [surreal, documentId, userId, userName, quillRef]);

  // 处理远程光标
  useEffect(() => {
    const quill = quillRef.current?.getQuill();
    if (!quill || !surreal || !documentId || !userId) return;

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
    let liveCursorQueryId: string | null = null;

    const handleRemoteCursorChange = (data: any) => {
      if (data && data.result && typeof data.result.docId === 'string' && data.result.docId === documentId && data.result.userId !== userId) {
        const { userId: remoteUserId, userName: remoteUserName, range, ts } = data.result;

        const userHash = remoteUserId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const color = USER_COLORS[userHash % USER_COLORS.length];

        if (data.action === 'CREATE' || data.action === 'UPDATE') {
          remoteCursors = {
            ...remoteCursors,
            [remoteUserId]: { userId: remoteUserId, userName: remoteUserName, range, ts, color },
          };
        } else if (data.action === 'DELETE') {
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
        const queryResult = await surreal.query(liveCursorQuery) as Array<{ result: string }>;
        if (queryResult && queryResult.length > 0 && queryResult[0] && typeof queryResult[0].result === 'string') {
          liveCursorQueryId = queryResult[0].result;
          (surreal as any).listenLive(liveCursorQueryId, handleRemoteCursorChange);
        }
      } catch (error) {
        console.error('Error setting up live query for remote cursors:', error);
      }
    };

    setupLiveCursorQuery();

    return () => {
      if (liveCursorQueryId && surreal) {
        (surreal as any).kill(liveCursorQueryId);
      }
      document.querySelectorAll('.remote-cursor').forEach(el => el.remove());
      document.querySelectorAll('.remote-selection').forEach(el => el.remove());
    };
  }, [surreal, documentId, userId, quillRef, onRemoteCursorsChange]);

  return null; // This component doesn't render anything
};

export default CollaborationManager; 