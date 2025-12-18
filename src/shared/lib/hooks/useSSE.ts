type Handler = (event: MessageEvent) => void;

const sources: Record<string, EventSource> = {};
const listeners: Record<string, Record<string, Set<Handler>>> = {};

export function getSSE(user_id: string) {
  if (!user_id) return null;

  // 1. Singleton EventSource map
  if (!sources[user_id]) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found');
      return null;
    }
    const url = `${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/events?token=${encodeURIComponent(token)}`;
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
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found for subscribe');
      return;
    }
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/subscribe`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ event, event_id }),
    });
  }
  async function unsubscribe(event: string, event_id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found for unsubscribe');
      return;
    }
    await fetch(`${process.env.NEXT_PUBLIC_SSE_SERVER_URL}/unsubscribe`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ event, event_id }),
    });
  }

  return { eventSource: es, on, off, subscribe, unsubscribe };
}