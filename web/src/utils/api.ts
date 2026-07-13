export function getApiUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  // 1. If NEXT_PUBLIC_API_URL is set in .env.local, always use it
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  // 2. In the browser: dynamically build URL from current window hostname
  //    This works whether you open via localhost, 127.0.0.1, or a network IP
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000`;
  }

  // 3. SSR fallback: no window, no env — derive from host header if possible,
  //    otherwise Next.js internal loopback (always same machine as backend)
  return 'http://localhost:8000';
}



// export function getApiUrl(): string {
//   // If explicitly configured in env with a non-localhost URL, use it
//   const envUrl = process.env.NEXT_PUBLIC_API_URL;
//   if (envUrl && !envUrl.includes('127.0.0.1') && !envUrl.includes('localhost')) {
//     return envUrl.replace(/\/$/, '');
//   }

//   // If running in browser, dynamically resolve current window hostname on port 8000
//   if (typeof window !== 'undefined') {
//     const protocol = window.location.protocol || 'http:';
//     const hostname = window.location.hostname || '127.0.0.1';
//     return `${protocol}//${hostname}:8000`;
//   }

//   return envUrl || 'http://127.0.0.1:8000';
// }