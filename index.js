addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const upgradeHeader = request.headers.get('Upgrade');

  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    // Tentukan endpoint untuk proxy WebSocket berdasarkan domain atau URL
    const protocol = url.hostname.split('.')[0]; // Mengambil subdomain sebagai protokol
    return await handleWebSocket(request, protocol);
  }

  return new Response('Only WebSocket connections are supported', { status: 400 });
}

async function handleWebSocket(request, protocol) {
  let targetUrl = '';
  let targetPort = '';

  // Tentukan URL backend dan port berdasarkan protokol
  if (protocol === 'vless') {
    targetUrl = VLESS_SERVER_URL;  // Dapatkan URL dari variabel lingkungan
    targetPort = VLESS_PORT || 443; // Port default VLESS
  } else if (protocol === 'vmess') {
    targetUrl = VMESS_SERVER_URL;  // Dapatkan URL dari variabel lingkungan
    targetPort = VMESS_PORT || 443; // Port default VMess
  } else if (protocol === 'trojan') {
    targetUrl = TROJAN_SERVER_URL;  // Dapatkan URL dari variabel lingkungan
    targetPort = TROJAN_PORT || 443; // Port default Trojan
  } else if (protocol === 'socks5') {
    targetUrl = SOCKS5_SERVER_URL;  // Dapatkan URL dari variabel lingkungan
    targetPort = SOCKS5_PORT || 1080; // Port default SOCKS5
  } else {
    return new Response('Unsupported protocol', { status: 400 });
  }

  // Membuka koneksi WebSocket ke server backend
  const { readable, writable } = new WebSocketPair();
  const ws = readable.getReader();
  const wsClient = writable.getWriter();

  // Hubungkan ke backend server melalui WebSocket
  const wsBackend = await fetch(`wss://${targetUrl}:${targetPort}`, {
    method: 'GET',
    headers: request.headers,
  });

  const backendReader = wsBackend.body.getReader();
  backendReader.pipeTo(wsClient);

  ws.pipeTo(backendReader);

  return new Response(null, { status: 101, webSocket: ws });
}