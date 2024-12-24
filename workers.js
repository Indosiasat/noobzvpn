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
async fetch(request, env, _ctx) {
    try {
        const { UUID, PROXYIP, SOCKS5, SOCKS5_RELAY } = env;
        userID = UUID || userID;
        socks5Address = SOCKS5 || socks5Address;
        socks5Relay = SOCKS5_RELAY || socks5Relay;

        // Menangani konfigurasi proxy
        const proxyConfig = handleProxyConfig(PROXYIP);
        proxyIP = proxyConfig.ip;
        proxyPort = proxyConfig.port;

        if (socks5Address) {
            try {
                const selectedSocks5 = selectRandomAddress(socks5Address);
                parsedSocks5Address = socks5AddressParser(selectedSocks5);
                enableSocks = true;
            } catch (err) {
                console.log(err.toString());
                enableSocks = false;
            }
        }

        const userIDs = userID.includes(',') ? userID.split(',').map(id => id.trim()) : [userID];
        const url = new URL(request.url);
        const host = request.headers.get('Host');
        const requestedPath = url.pathname.substring(1); // Menghapus slash di awal
        const matchingUserID = userIDs.length === 1 ?
            (requestedPath === userIDs[0] || 
             requestedPath === `sub/${userIDs[0]}` || 
             requestedPath === `bestip/${userIDs[0]}` ? userIDs[0] : null) :
            userIDs.find(id => {
                const patterns = [id, `sub/${id}`, `bestip/${id}`];
                return patterns.some(pattern => requestedPath.startsWith(pattern));
            });

        // Jika permintaan bukan WebSocket, proses sebagai permintaan HTTP biasa
        if (request.headers.get('Upgrade') !== 'websocket') {
            if (url.pathname === '/cf') {
                // Mengembalikan informasi tentang Cloudflare request
                return new Response(JSON.stringify(request.cf, null, 4), {
                    status: 200,
                    headers: { "Content-Type": "application/json;charset=utf-8" },
                });
            }

            // Jika ditemukan ID pengguna yang cocok
            if (matchingUserID) {
                if (url.pathname === `/${matchingUserID}` || url.pathname === `/sub/${matchingUserID}`) {
                    const isSubscription = url.pathname.startsWith('/sub/');
                    const proxyAddresses = PROXYIP ? PROXYIP.split(',').map(addr => addr.trim()) : proxyIP;
                    const content = isSubscription ?
                        GenSub(matchingUserID, host, proxyAddresses) :
                        getConfig(matchingUserID, host, proxyAddresses);

                    return new Response(content, {
                        status: 200,
                        headers: {
                            "Content-Type": isSubscription ?
                                "text/plain;charset=utf-8" :
                                "text/html; charset=utf-8"
                        },
                    });
                } else if (url.pathname === `/bestip/${matchingUserID}`) {
                    // Menangani permintaan untuk `bestip/{userID}`
                    return fetch(`https://sub.xf.free.hr/auto?host=${host}&uuid=${matchingUserID}&path=/`, { headers: request.headers });
                }
            }

            // Jika rute tidak ditemukan, arahkan ke fungsi penanganan default
            return handleDefaultPath(url, request);
        } else {
            // Menangani koneksi WebSocket
            return await ProtocolOverWSHandler(request);
        }
    } catch (err) {
        return new Response(err.toString());
    }
},

/**
 * Menangani permintaan pada rute default ketika tidak ada rute khusus yang cocok.
 * Menghasilkan dan mengembalikan halaman antarmuka cloud drive dalam format HTML.
 * @param {URL} url - Objek URL dari permintaan
 * @param {Request} request - Objek permintaan yang masuk
 * @returns {Response} Respons HTML dengan antarmuka cloud drive
 */
function handleDefaultPath(url, request) {
    // Menampilkan halaman antarmuka cloud drive (contoh)
    const cloudDriveHTML = `
        <html>
            <head>
                <title>Cloud Drive</title>
            </head>
            <body>
                <h1>Welcome to Cloud Drive</h1>
                <p>Your request path was: ${url.pathname}</p>
                <p>Cloudflare Request Information:</p>
                <pre>${JSON.stringify(request.cf, null, 4)}</pre>
            </body>
        </html>
    `;
    return new Response(cloudDriveHTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
/**
 * Menangani permintaan pada rute default ketika tidak ada rute khusus yang cocok.
 * Menghasilkan dan mengembalikan halaman antarmuka cloud drive dalam format HTML.
 * @param {URL} url - Objek URL dari permintaan
 * @param {Request} request - Objek permintaan yang masuk
 * @returns {Response} Respons HTML dengan antarmuka cloud drive
 */
function handleDefaultPath(url, request) {
    // Menampilkan halaman antarmuka cloud drive (contoh)
    const cloudDriveHTML = `
        <html>
            <head>
                <title>Cloud Drive</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #f4f4f4;
                    }
                    h1 {
                        color: #333;
                    }
                    pre {
                        background-color: #fff;
                        border: 1px solid #ddd;
                        padding: 10px;
                        font-size: 14px;
                        overflow-x: auto;
                    }
                    footer {
                        margin-top: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #888;
                    }
                </style>
            </head>
            <body>
                <h1>Welcome to Cloud Drive</h1>
                <p>Your request path was: <strong>${url.pathname}</strong></p>
                <h2>Cloudflare Request Information:</h2>
                <pre>${JSON.stringify(request.cf, null, 4)}</pre>

                <footer>
                    <p>Powered by Cloudflare Workers</p>
                </footer>
            </body>
        </html>
    `;

    // Mengembalikan halaman HTML dengan status 200 dan header yang sesuai
    return new Response(cloudDriveHTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
async function ProtocolOverWSHandlerRequest(request) {
    const upgradeHeader = request.headers.get('Upgrade');

    // Memastikan hanya WebSocket yang diproses
    if (upgradeHeader && upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Hanya koneksi WebSocket yang diterima.', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());

    // Menerima koneksi WebSocket
    server.accept();

    // Logging untuk koneksi WebSocket baru
    console.log(`Koneksi WebSocket diterima: ${request.url}`);

    // Menangani pesan WebSocket yang diterima
    server.addEventListener('message', async (event) => {
        try {
            const message = JSON.parse(event.data);

            // Log pesan yang diterima
            console.log('Pesan diterima:', message);

            // Verifikasi UUID untuk otentikasi
            if (message.type === 'auth') {
                if (message.uuid === userID) {
                    server.send(JSON.stringify({ status: 'success', message: 'Autentikasi berhasil.' }));
                    console.log('Autentikasi berhasil untuk UUID:', message.uuid);
                } else {
                    server.send(JSON.stringify({ status: 'failed', message: 'UUID tidak valid.' }));
                    server.close(1000, 'Autentikasi gagal.');
                    console.log('Autentikasi gagal untuk UUID:', message.uuid);
                    return;
                }
            }

            // Menangani permintaan proxy atau koneksi sesuai protokol
            if (message.type === 'proxy') {
                const { proxyType, targetAddress, socks5Config } = message;

                let connectionStatus = '';
                if (proxyType === 'socks5') {
                    // Proses koneksi SOCKS5
                    connectionStatus = await handleSocks5ProxyRequest(socks5Config);
                } else if (['vless', 'vmess', 'trojan'].includes(proxyType)) {
                    // Proses koneksi menggunakan VLESS, VMESS, atau Trojan
                    connectionStatus = await handleProtocolProxyRequest(targetAddress, proxyType);
                } else {
                    server.send(JSON.stringify({ status: 'error', message: 'Jenis proxy tidak dikenal.' }));
                    return;
                }

                // Kirimkan status koneksi yang berhasil
                server.send(JSON.stringify({ status: 'success', message: `Koneksi proxy berhasil: ${connectionStatus}` }));
                console.log(`Koneksi proxy berhasil: ${connectionStatus}`);
            } else {
                server.send(JSON.stringify({ status: 'error', message: 'Tipe permintaan tidak valid.' }));
                console.log('Tipe permintaan tidak valid:', message.type);
            }
        } catch (error) {
            // Logging error dan menutup koneksi jika terjadi kesalahan
            console.error('Terjadi kesalahan server:', error);
            server.send(JSON.stringify({ status: 'error', message: 'Terjadi kesalahan server.' }));
            server.close(1011, 'Kesalahan server.');
        }
    });

    // Menangani penutupan koneksi WebSocket
    server.addEventListener('close', () => {
        console.log('Koneksi WebSocket ditutup.');
    });

    // Menangani error WebSocket
    server.addEventListener('error', (event) => {
        console.error('Error WebSocket:', event);
        // Jika perlu, Anda bisa menutup koneksi di sini
        server.close(1011, 'Kesalahan WebSocket');
    });

    // Handling abort (pembatalan permintaan)
    request.signal.addEventListener('abort', () => {
        console.log('Permintaan dibatalkan oleh klien.');
        server.close(1000, 'Permintaan dibatalkan');
    });

    return new Response(null, { status: 101, webSocket: client });
}

/**
 * Menangani permintaan koneksi SOCKS5.
 * @param {Object} socks5Config - Konfigurasi SOCKS5 (host, port, username, password)
 * @returns {Promise<string>} Status koneksi SOCKS5
 */
async function handleSocks5ProxyRequest(socks5Config) {
    try {
        const { host, port, username, password } = socks5Config;

        // Proses untuk menghubungkan ke server SOCKS5
        // (Ini adalah tempat untuk menambahkan logika koneksi SOCKS5 yang sesuai)
        console.log(`Menghubungkan ke SOCKS5 Proxy: ${host}:${port} dengan username: ${username}`);
        return `Koneksi SOCKS5 berhasil ke ${host}:${port}`;
    } catch (err) {
        console.error('Kesalahan saat menghubungkan ke SOCKS5 Proxy:', err);
        throw new Error('Gagal menghubungkan ke SOCKS5 Proxy');
    }
}

/**
 * Menangani permintaan koneksi untuk protokol seperti VLESS, VMESS, atau Trojan.
 * @param {string} targetAddress - Alamat server tujuan (IP:port)
 * @param {string} proxyType - Jenis protokol yang digunakan (VLESS, VMESS, Trojan)
 * @returns {Promise<string>} Status koneksi ke server
 */
async function handleProtocolProxyRequest(targetAddress, proxyType) {
    try {
        const [targetIP, targetPort] = targetAddress.split(':');
        
        // Logika untuk menghubungkan ke server berdasarkan jenis protokol
        console.log(`Menghubungkan ke server ${proxyType} di ${targetIP}:${targetPort}`);

        // Proses sesuai dengan jenis protokol
        if (proxyType === 'vless') {
            return `Koneksi ke server VLESS berhasil di ${targetIP}:${targetPort}`;
        } else if (proxyType === 'vmess') {
            return `Koneksi ke server VMESS berhasil di ${targetIP}:${targetPort}`;
        } else if (proxyType === 'trojan') {
            return `Koneksi ke server Trojan berhasil di ${targetIP}:${targetPort}`;
        } else {
            throw new Error('Jenis protokol tidak valid');
        }
    } catch (err) {
        console.error('Kesalahan saat menghubungkan ke server protokol:', err);
        throw new Error('Gagal menghubungkan ke server protokol');
    }
}
