type Handler = (event: MessageEvent) => void;

const sources: Record<string, EventSource> = {};
const listeners: Record<string, Record<string, Set<Handler>>> = {};

export function getSSE(user_id: string) {
  if (!user_id) return null;

  // 1. Singleton EventSource map
  if (!sources[user_id]) {
    const url = `${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/events?user_id=${encodeURIComponent(user_id)}`;
    sources[user_id] = new EventSource(url);
    listeners[user_id] = {};
  }
  return sources[user_id];
}

export function useSSE(user_id: string) {
  const es = getSSE(user_id);
  // API ниже НЕ useEffect-хук! Можно дергать из любого места

  // subscribe: добавляет слушателя к своему user_id/source
  function on(event: string, handler: Handler) {
    if (!es) return;
    if (!listeners[user_id][event]) listeners[user_id][event] = new Set();
    listeners[user_id][event].add(handler);
    es.addEventListener(event, handler);
  }

  // unsubscribe: удаляет слушателя
  function off(event: string, handler: Handler) {
    if (!es) return;
    listeners[user_id][event]?.delete(handler);
    es.removeEventListener(event, handler);
  }

  // subscribe/unsubscribe на событие у сервера
  async function subscribe(event: string, event_id: string) {
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, event, event_id }),
    });
  }
  async function unsubscribe(event: string, event_id: string) {
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id, event, event_id }),
    });
  }

  return { eventSource: es, on, off, subscribe, unsubscribe };
}