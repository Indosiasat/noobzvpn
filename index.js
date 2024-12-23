addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const upgradeHeader = request.headers.get('Upgrade');

  // Mendapatkan IP pengunjung dari header Cloudflare
  const ip = request.headers.get('CF-Connecting-IP') || 'Unknown IP';
  
  // Mengambil informasi geolocation berdasarkan IP pengunjung
  const geolocationInfo = await getGeolocation(ip);

  // Log informasi geolocation
  console.log(`Visitor IP: ${ip}`);
  console.log(`Geolocation Info: ${JSON.stringify(geolocationInfo)}`);

  // Jika permintaan WebSocket, lakukan WebSocket handshake
  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    const protocol = url.hostname.split('.')[0]; // Mengambil subdomain untuk menentukan protokol (vless, vmess, trojan)
    return await handleWebSocket(request, protocol, ip, geolocationInfo);
  }

  // Jika bukan WebSocket, tangani sebagai permintaan HTTP biasa dan balas dengan 200 OK beserta geolocation info
  return new Response(`HTTP request received from IP: ${ip}\nGeolocation Info: ${JSON.stringify(geolocationInfo)}`, { status: 200 });
}

// Fungsi untuk mendapatkan informasi geolocation berdasarkan IP
async function getGeolocation(ip) {
  const API_KEY = 'YOUR_API_KEY';  // Ganti dengan API key dari ipinfo.io atau layanan lain
  const url = `https://ipinfo.io/${ip}/json?token=${API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    return { error: 'Unable to fetch geolocation data' };
  }
  
  const data = await response.json();
  return data;
}

async function handleWebSocket(request, protocol, ip, geolocationInfo) {
  let targetUrl = '';
  let targetPort = 443;  // Default port for secure WebSocket

  // Tentukan URL dan port berdasarkan protokol (vless, vmess, trojan)
  if (protocol === 'vless') {
    targetUrl = VLESS_SERVER_URL;
  } else if (protocol === 'vmess') {
    targetUrl = VMESS_SERVER_URL;
  } else if (protocol === 'trojan') {
    targetUrl = TROJAN_SERVER_URL;
  } else {
    return new Response('Unsupported protocol', { status: 400 });
  }

  // Membuka koneksi WebSocket ke backend server
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

  // Menanggapi dengan status 101 (WebSocket handshake sukses)
  console.log(`WebSocket connection established from IP: ${ip}`);
  return new Response(
    `WebSocket connection established from IP: ${ip}\nGeolocation Info: ${JSON.stringify(geolocationInfo)}`,
    { status: 101, webSocket: ws }
  );
}
