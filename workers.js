// Impor pustaka soket Cloudflare
// @ts-ignore
import { connect } from 'cloudflare:sockets';

// ======================================
// Konfigurasi
// ======================================

// UUID untuk autentikasi
let userID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

// Daftar alamat server proxy
const proxyIPs = ['cdn.xn--b6gac.eu.org:443', 'cdn-all.xn--b6gac.eu.org:443'];

// Pilih secara acak server proxy
let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];
let proxyPort = proxyIP.includes(':') ? proxyIP.split(':')[1] : '443';

// Konfigurasi SOCKS5
let socks5Address = ''; // Contoh: 'username:password@host:port' atau 'host:port'
let socks5Relay = false; // Mode relay SOCKS5

// Periksa apakah UUID valid
if (!isValidUUID(userID)) {
  throw new Error('UUID tidak valid.');
}

let parsedSocks5Address = parseSocks5(socks5Address);
let enableSocks = Boolean(parsedSocks5Address);

// ======================================
// Handler Cloudflare Worker
// ======================================

export default {
  async fetch(request, env, ctx) {
    const upgradeHeader = request.headers.get('Upgrade');

    // Hanya proses koneksi WebSocket
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const [client, server] = Object.values(new WebSocketPair());
      handleWebSocket(server, env, ctx);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Hanya koneksi WebSocket yang didukung.', { status: 400 });
  },
};

// ======================================
// Handler WebSocket
// ======================================

/**
 * Menangani koneksi WebSocket.
 * @param {WebSocket} webSocket - Koneksi WebSocket yang akan ditangani
 * @param {Object} env - Variabel lingkungan
 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx - Konteks
 */
function handleWebSocket(webSocket, env, ctx) {
  webSocket.accept();

  webSocket.addEventListener('message', async (event) => {
    try {
      const message = JSON.parse(event.data);

      // Validasi UUID
      if (message.type === 'auth') {
        if (message.uuid === userID) {
          webSocket.send(JSON.stringify({ status: 'success', message: 'Autentikasi berhasil.' }));
        } else {
          webSocket.send(JSON.stringify({ status: 'failed', message: 'UUID tidak valid.' }));
          webSocket.close(1000, 'Autentikasi gagal.');
          return;
        }
      } else if (message.type === 'proxy') {
        // Proxy lalu lintas melalui SOCKS5 atau langsung ke target
        const target = connectToTarget(proxyIP, proxyPort, parsedSocks5Address, socks5Relay);
        webSocket.send(JSON.stringify({ status: 'success', message: `Meneruskan ke ${target}` }));
      } else {
        webSocket.send(JSON.stringify({ status: 'error', message: 'Jenis permintaan tidak valid.' }));
      }
    } catch (error) {
      webSocket.send(JSON.stringify({ status: 'error', message: 'Kesalahan server internal.' }));
      webSocket.close(1011, 'Kesalahan server.');
    }
  });

  webSocket.addEventListener('close', () => {
    console.log('Koneksi WebSocket ditutup.');
  });

  webSocket.addEventListener('error', (event) => {
    console.error('Kesalahan WebSocket:', event);
  });
}

// ======================================
// Fungsi Pembantu
// ======================================

/**
 * Memvalidasi UUID.
 * @param {string} uuid - UUID yang akan divalidasi
 * @returns {boolean} Apakah UUID valid
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Mem-parse alamat SOCKS5 menjadi komponen-komponennya.
 * @param {string} address - Alamat SOCKS5
 * @returns {Object} Komponen alamat SOCKS5
 */
function parseSocks5(address) {
  if (!address) return {};
  const [auth, hostPort] = address.split('@');
  const [host, port] = hostPort.split(':');
  const [username, password] = auth.split(':');
  return { host, port, username, password };
}

/**
 * Menghubungkan ke server target melalui SOCKS5 atau langsung.
 * @param {string} proxyIP - Alamat IP server proxy
 * @param {string} proxyPort - Port server proxy
 * @param {Object} socks5Config - Konfigurasi SOCKS5
 * @param {boolean} useSocks5 - Apakah menggunakan SOCKS5
 * @returns {string} Detail koneksi
 */
function connectToTarget(proxyIP, proxyPort, socks5Config, useSocks5) {
  if (useSocks5) {
    return `Proxy SOCKS5: ${socks5Config.host}:${socks5Config.port}`;
  }
  return `Proxy Langsung: ${proxyIP}:${proxyPort}`;
}
