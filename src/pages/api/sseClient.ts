const baseUrl = process.env.SSE_SERVER_URL || process.env.NEXT_PUBLIC_SSE_SERVER_URL;

export async function sseClient(
  path: string,
  options?: RequestInit
) {
  if (!baseUrl) throw new Error("SSE_SERVER_URL is not set");
  const url = baseUrl.endsWith("/") || path.startsWith("/")
    ? `${baseUrl}${path}`.replace(/\/\//g, "/")
    : `${baseUrl}/${path}`;

  return fetch(url, {...options, headers: { 'Content-Type': 'application/json' }});
}