export function getApiUrl(): string {
  // If explicitly configured in env with a non-localhost URL, use it
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
    return envUrl.replace(/\/$/, '');
  }

  // If running in browser, dynamically resolve current window hostname on port 8000
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || '127.0.0.1';
    return `${protocol}//${hostname}:8000`;
  }

  return envUrl || 'http://127.0.0.1:8000';
}
