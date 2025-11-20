import { useRef } from "react";

/**
 * SSE-подключение для user_id, subscribe/unsubscribe на события event_id.
 * Возвращает EventSource и subscribe/unsubscribe хелперы
 */
export function useSSE(user_id: string) {
  const eventSourceRef = useRef<EventSource | null>(null);

  if (!eventSourceRef.current && user_id) {
    const url = `${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/events?user_id=${encodeURIComponent(user_id)}`;
    eventSourceRef.current = new EventSource(url);
  }

  function on(event: string, handler: (event: MessageEvent) => void) {
    eventSourceRef.current?.addEventListener(event, handler);
  }
  function off(event: string, handler: (event: MessageEvent) => void) {
    eventSourceRef.current?.removeEventListener(event, handler);
  }

  async function subscribe(event: string, event_id: string) {
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, event, session_id: event_id }),
    });
  }
  async function unsubscribe(event: string, event_id: string) {
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, event, session_id: event_id }),
    });
  }

  return {
    eventSource: eventSourceRef.current,
    on,
    off,
    subscribe,
    unsubscribe,
  };
}
