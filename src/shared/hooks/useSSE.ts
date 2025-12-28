type Handler = (event: MessageEvent) => void;

const sources: Record<string, EventSource> = {};
const listeners: Record<string, Record<string, Set<Handler>>> = {};

export function getSSE(user_id: string) {
  if (!user_id) return null;
  if (!sources[user_id]) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found');
      return null;
    }
    
    const sseServerUrl = process.env.NEXT_PUBLIC_SSE_SERVER_URL;
    if (!sseServerUrl) {
      console.error('[SSE] NEXT_PUBLIC_SSE_SERVER_URL is not configured');
      return null;
    }
    
    const url = `${sseServerUrl}/events?token=${encodeURIComponent(token)}`;
    try {
      sources[user_id] = new EventSource(url);
      listeners[user_id] = {};
    } catch (error) {
      console.error('[SSE] Failed to create EventSource:', error);
      return null;
    }
  }
  return sources[user_id];
}

export function useSSE(user_id: string) {
  const es = getSSE(user_id);

  function on(event: string, handler: Handler) {
    if (!es) return;
    if (!listeners[user_id][event]) listeners[user_id][event] = new Set();
    listeners[user_id][event].add(handler);
    es.addEventListener(event, handler);
  }

  function off(event: string, handler: Handler) {
    if (!es) return;
    listeners[user_id][event]?.delete(handler);
    es.removeEventListener(event, handler);
  }

  async function subscribe(event: string | string[], event_id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found for subscribe');
      return;
    }

    const sseServerUrl = process.env.NEXT_PUBLIC_SSE_SERVER_URL;
    if (!sseServerUrl) {
      console.error('[SSE] NEXT_PUBLIC_SSE_SERVER_URL is not configured');
      return;
    }

    try {
      const response = await fetch(`${sseServerUrl}/subscribe`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ event, event_id }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[SSE] Subscribe failed: ${response.status} ${response.statusText}`, errorText);
        return;
      }

      console.log(`[SSE] Successfully subscribed to event: ${event}, event_id: ${event_id}`);
    } catch (error) {
      console.error('[SSE] Subscribe request failed:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error(`[SSE] Cannot connect to SSE server at ${sseServerUrl}. Check if server is running and CORS is configured.`);
      }
    }
  }
  async function unsubscribe(event: string | string[], event_id: string) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      console.error('[SSE] No auth token found for unsubscribe');
      return;
    }

    const sseServerUrl = process.env.NEXT_PUBLIC_SSE_SERVER_URL;
    if (!sseServerUrl) {
      console.error('[SSE] NEXT_PUBLIC_SSE_SERVER_URL is not configured');
      return;
    }

    try {
      const response = await fetch(`${sseServerUrl}/unsubscribe`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ event, event_id }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[SSE] Unsubscribe failed: ${response.status} ${response.statusText}`, errorText);
        return;
      }

      console.log(`[SSE] Successfully unsubscribed from event: ${event}, event_id: ${event_id}`);
    } catch (error) {
      console.error('[SSE] Unsubscribe request failed:', error);
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error(`[SSE] Cannot connect to SSE server at ${sseServerUrl}. Check if server is running and CORS is configured.`);
      }
    }
  }

  return { eventSource: es, on, off, subscribe, unsubscribe };
}