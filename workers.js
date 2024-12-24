// noobzvpn - Sebuah Proxy VLESS, VMESS, Trojan berbasis Cloudflare Worker dengan Transport WebSocket
// @ts-ignore
import { connect } from 'cloudflare:sockets';

// ======================================
// Konfigurasi
// ======================================

let userID = 'd342d11e-d424-4583-b36e-524ab1f0afa4'; // UUID pengguna
let password = 'your_password'; // Password pengguna

const proxyIPs = ['cdn.xn--b6gac.eu.org:443', 'cdn-all.xn--b6gac.eu.org:443']; // Daftar proxy
let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];
let proxyPort = proxyIP.includes(':') ? proxyIP.split(':')[1] : '443'; // Port proxy

let socks5Address = ''; // Alamat SOCKS5
let socks5Relay = false; // Relay SOCKS5

// Menentukan protokol yang digunakan (VLESS, VMESS, Trojan)
let protocol = 'VLESS'; // Gantilah ini sesuai protokol yang digunakan

// Memvalidasi UUID
if (!isValidUUID(userID)) {
  throw new Error('UUID tidak valid');
}

// ======================================
// Fungsi Pembantu
// ======================================

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Fungsi untuk memilih alamat proxy secara acak
 * @param {Array} proxyAddresses - Daftar alamat proxy
 * @returns {string} - Alamat proxy yang dipilih
 */
function selectRandomAddress(proxyAddresses) {
  if (!proxyAddresses || proxyAddresses.length === 0) {
    throw new Error('Daftar alamat proxy kosong.');
  }
  const randomIndex = Math.floor(Math.random() * proxyAddresses.length);
  return proxyAddresses[randomIndex];
}

// ======================================
// WebSocket Handler
// ======================================

/**
 * Fungsi untuk menangani WebSocket dengan protokol tertentu
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @param {Object} env - Variabel lingkungan
 * @param {ExecutionContext} ctx - Konteks eksekusi
 */
function handleWebSocket(webSocket, env, ctx) {
  webSocket.accept();
  
  // Menangani pesan WebSocket yang masuk
  webSocket.addEventListener('message', async (event) => {
    const message = JSON.parse(event.data);
    
    // Verifikasi UUID dan PASSWORD saat autentikasi
    if (message.type === 'auth') {
      if (message.uuid === userID && message.password === password) {
        webSocket.send(JSON.stringify({ status: 'success', message: 'Autentikasi berhasil.' }));
      } else {
        webSocket.send(JSON.stringify({ status: 'failed', message: 'UUID atau password tidak valid.' }));
        webSocket.close(1000, 'Autentikasi gagal.');
        return;
      }
    }
    
    if (message.type === 'proxy') {
      // Menangani proxy sesuai protokol
      const target = await handleProtocol(message, webSocket);
      webSocket.send(JSON.stringify({ status: 'success', message: `Proksi ke ${target}` }));
    }
  });
  
  // Tangani penutupan koneksi WebSocket
  webSocket.addEventListener('close', () => {
    console.log('Koneksi WebSocket ditutup.');
  });

  // Tangani error WebSocket
  webSocket.addEventListener('error', (event) => {
    console.error('Error WebSocket:', event);
  });
}

/**
 * Fungsi untuk menangani setiap protokol (VLESS, VMESS, Trojan, SOCKS5)
 * @param {Object} message - Pesan yang masuk
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @returns {string} - Alamat tujuan atau pesan dari proxy
 */
async function handleProtocol(message, webSocket) {
  let protocolHandler;

  switch (protocol) {
    case 'VLESS':
      protocolHandler = handleVLESS;
      break;
    case 'VMESS':
      protocolHandler = handleVMESS;
      break;
    case 'Trojan':
      protocolHandler = handleTrojan;
      break;
    case 'SOCKS5':
      protocolHandler = handleSOCKS5;
      break;
    default:
      throw new Error('Protokol tidak dikenali.');
  }

  return protocolHandler(message, webSocket);
}

// ======================================
// Fungsi untuk Menangani Setiap Protokol
// ======================================

/**
 * Menangani VLESS proxy
 * @param {Object} message - Pesan yang masuk
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @returns {string} - Pesan atau alamat tujuan
 */
async function handleVLESS(message, webSocket) {
  // Implementasi untuk VLESS
  return `VLESS proxy untuk ${message.target}`;
}

/**
 * Menangani VMESS proxy
 * @param {Object} message - Pesan yang masuk
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @returns {string} - Pesan atau alamat tujuan
 */
async function handleVMESS(message, webSocket) {
  // Implementasi untuk VMESS
  return `VMESS proxy untuk ${message.target}`;
}

/**
 * Menangani Trojan proxy
 * @param {Object} message - Pesan yang masuk
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @returns {string} - Pesan atau alamat tujuan
 */
async function handleTrojan(message, webSocket) {
  // Implementasi untuk Trojan
  return `Trojan proxy untuk ${message.target}`;
}

/**
 * Menangani SOCKS5 proxy
 * @param {Object} message - Pesan yang masuk
 * @param {WebSocket} webSocket - Koneksi WebSocket
 * @returns {string} - Pesan atau alamat tujuan
 */
async function handleSOCKS5(message, webSocket) {
  // Implementasi untuk SOCKS5
  return `SOCKS5 proxy untuk ${message.target}`;
}

// ======================================
// Fungsi untuk Menangani Path Default
// ======================================

/**
 * Fungsi untuk menangani permintaan pada path default
 * Jika tidak ada jalur yang cocok dengan protokol atau URL tertentu
 * @param {URL} url - URL yang diminta
 * @param {Request} request - Permintaan HTTP
 * @returns {Response} - Respon default jika tidak ada kecocokan
 */
async function handleDefaultPath(url, request) {
  const defaultContent = `
    <html>
      <head><title>Proxy Default</title></head>
      <body>
        <h1>Selamat datang di Proxy Default</h1>
        <p>Path yang Anda akses tidak dikenali. Silakan coba path yang valid untuk menggunakan proxy.</p>
      </body>
    </html>
  `;
  return new Response(defaultContent, {
    status: 200,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}

// ======================================
// Fetch Handler untuk WebSocket
// ======================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    const upgradeHeader = request.headers.get('Upgrade');
    
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      handleWebSocket(server, env, ctx);
      return new Response(null, { status: 101, webSocket: client });
    }
    
    // Tangani path default jika tidak ditemukan path yang cocok
    if (!url.pathname.startsWith('/sub/') && !url.pathname.startsWith('/bestip/') && !url.pathname.startsWith('/cf')) {
      return handleDefaultPath(url, request);
    }
    
    // Tangani path yang terkait dengan proxy atau konfigurasi lainnya
    return new Response('Path yang valid harus dipilih.', { status: 400 });
  },
};
