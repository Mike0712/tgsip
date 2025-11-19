import { useEffect, useRef } from "react";

export type SSEHandlers = {
  [event: string]: (event: MessageEvent) => void;
};

export function useSSE({
  sessionId,
  userId,
  handlers,
}: {
  sessionId: string;
  userId: string;
  handlers: SSEHandlers;
}) {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId || !userId) return;
    const url = `${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/events?sessionId=${encodeURIComponent(
      sessionId
    )}&userId=${encodeURIComponent(userId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;
    Object.entries(handlers).forEach(([event, handler]) => {
      es.addEventListener(event, handler);
    });
    es.onerror = (err) => {};
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, userId, handlers]);

  return eventSourceRef.current;
}
