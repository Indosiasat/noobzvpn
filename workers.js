addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const upgradeHeader = request.headers.get('Upgrade');

  // Jika permintaan adalah WebSocket, lanjutkan dengan proxy WebSocket
  if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
    const protocol = url.hostname.split('.')[0]; // Mengambil subdomain sebagai protokol
    return await handleWebSocket(request, protocol);
  }

  // Jika URL mengandung UUID, ambil konfigurasi untuk UUID tersebut
  const uuid = url.pathname.split('/')[1]; // Mengambil UUID dari URL
  if (uuid) {
    return await handleConfigRequest(uuid);
  }

  // Jika tidak ada UUID atau WebSocket, kembalikan respons error
  return new Response('Invalid request', { status: 400 });
}

// Fungsi untuk menangani WebSocket
async function handleWebSocket(request, protocol) {
  let targetUrl = '';
  let targetPort = '';

  // Tentukan URL backend berdasarkan protokol dengan menggunakan environment variable
  if (protocol === 'vless') {
    targetUrl = VLESS_SERVER_URL; // Gunakan environment variable
    targetPort = VLESS_PORT || 443; // Port untuk server VLESS, default 443
  } else if (protocol === 'vmess') {
    targetUrl = VMESS_SERVER_URL; // Gunakan environment variable
    targetPort = VMESS_PORT || 443; // Port untuk server VMess, default 443
  } else if (protocol === 'trojan') {
    targetUrl = TROJAN_SERVER_URL; // Gunakan environment variable
    targetPort = TROJAN_PORT || 443; // Port untuk server Trojan, default 443
  } else if (protocol === 'socks5') {
    targetUrl = SOCKS5_SERVER_URL; // Gunakan environment variable
    targetPort = SOCKS5_PORT || 1080; // Port untuk server SOCKS5, default 1080
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

// Fungsi untuk menangani permintaan konfigurasi berdasarkan UUID
async function handleConfigRequest(uuid) {
  const config = await getConfigForUUID(uuid);

  if (!config) {
    return new Response('Configuration not found for this UUID', { status: 404 });
  }

  // Mengembalikan file konfigurasi (misalnya VLESS, VMess, Trojan, dll)
  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// Fungsi untuk mengambil konfigurasi berdasarkan UUID
async function getConfigForUUID(uuid) {
  // Anda bisa menambahkan logika untuk mengambil konfigurasi dari suatu tempat
  // misalnya database atau penyimpanan lainnya. Berikut adalah contoh konfigurasi statis.

  const configMap = {
    "f091c96d-419a-4c69-994c-6944182c46af": {
      "vless": {
        "address": "vless-server.com",
        "port": 443,
        "id": "vless-id",
        "alterId": 64
      },
      "vmess": {
        "address": "vmess-server.com",
        "port": 443,
        "id": "vmess-id",
        "alterId": 64
      },
      "trojan": {
        "address": "trojan-server.com",
        "port": 443,
        "password": "trojan-password"
      },
      "socks5": {
        "address": "socks5-server.com",
        "port": 1080
      }
    }
  };

  return configMap[uuid];
}
