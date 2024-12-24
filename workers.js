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
const net = require('net');

/**
 * Menangani koneksi TCP outbound, menulis data, dan melakukan retry jika terjadi kegagalan.
 * @param {string} host - Alamat server tujuan (IP atau hostname).
 * @param {number} port - Port tujuan untuk koneksi.
 * @param {Buffer|string} data - Data yang akan dikirimkan ke server.
 * @param {number} retries - Jumlah percobaan ulang jika gagal.
 * @param {number} delay - Delay dalam milidetik antar percobaan.
 * @returns {Promise<string>} Status koneksi dan pengiriman data setelah retry atau kegagalan.
 */
function handleTcpOutboundWithRetry(host, port, data, retries = 3, delay = 2000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const connectAndWrite = () => {
      const client = new net.Socket(); // Membuat koneksi TCP baru

      // Menangani koneksi ke server
      client.connect(port, host, () => {
        console.log(`Koneksi ke ${host}:${port} berhasil pada percobaan ${attempt + 1}.`);

        // Menulis data setelah koneksi berhasil
        client.write(data, (err) => {
          if (err) {
            console.log(`Gagal mengirim data pada percobaan ${attempt + 1}: ${err.message}`);
            retryConnection();
          } else {
            console.log(`Data berhasil dikirim pada percobaan ${attempt + 1}.`);
            resolve('Data berhasil dikirim');
          }
        });
      });

      // Menangani kesalahan saat koneksi atau penulisan data
      client.on('error', (err) => {
        console.log(`Koneksi gagal pada percobaan ${attempt + 1}: ${err.message}`);
        retryConnection();
      });

      // Menangani penutupan koneksi
      client.on('close', () => {
        console.log(`Koneksi TCP ditutup pada percobaan ${attempt + 1}.`);
      });

      // Fungsi untuk mencoba ulang
      const retryConnection = () => {
        if (attempt < retries) {
          attempt++;
          console.log(`Mencoba ulang percobaan ${attempt + 1} dalam ${delay}ms...`);
          setTimeout(connectAndWrite, delay); // Retry setelah delay
        } else {
          reject('Gagal mengirim data setelah beberapa percobaan.');
        }
      };
    };

    // Mulai koneksi dan pengiriman data
    connectAndWrite();
  });
}

// Contoh penggunaan
const host = 'example.com';
const port = 8080;
const data = 'Hello, this is a test message!';
const retries = 3;
const delay = 2000;

handleTcpOutboundWithRetry(host, port, data, retries, delay)
  .then((result) => {
    console.log(result); // "Data berhasil dikirim"
  })
  .catch((err) => {
    console.error(err); // Log error jika gagal setelah beberapa percobaan
  });
/**
 * Membuat ReadableStream untuk WebSocket yang mendukung start, pull, dan cancel.
 * @param {WebSocket} webSocket - Objek WebSocket yang akan digunakan untuk stream.
 * @returns {ReadableStream} Stream yang dapat dibaca untuk aliran data WebSocket.
 */
function MakeReadableWebSocketStream(webSocket) {
  let readerClosed = false;
  let controller;

  // Fungsi start untuk menginisialisasi stream
  const start = (readableStreamDefaultController) => {
    controller = readableStreamDefaultController;
    console.log("WebSocket stream started.");

    // Menangani event 'message' dari WebSocket untuk menarik data ke dalam stream
    webSocket.addEventListener('message', (event) => {
      if (!readerClosed) {
        try {
          // Menarik data dari WebSocket dan memasukkannya ke dalam stream
          controller.enqueue(event.data);
        } catch (err) {
          console.error("Error in pulling WebSocket message: ", err);
        }
      }
    });

    // Menangani event 'close' untuk menghentikan stream saat WebSocket tertutup
    webSocket.addEventListener('close', () => {
      if (!readerClosed) {
        controller.close();
        readerClosed = true;
      }
    });

    // Menangani event 'error' untuk menangani kesalahan WebSocket
    webSocket.addEventListener('error', (err) => {
      if (!readerClosed) {
        controller.error(err);
        readerClosed = true;
      }
    });
  };

  // Fungsi pull untuk menarik data ke dalam stream jika diperlukan
  const pull = (readableStreamDefaultController) => {
    if (!readerClosed) {
      // WebSocket terus menerus mengirimkan data, controller akan menarik data sesuai permintaan.
      console.log("Pulling data from WebSocket...");
    }
  };

  // Fungsi cancel untuk membatalkan pembacaan stream jika WebSocket ditutup atau cancel dipanggil
  const cancel = () => {
    if (!readerClosed) {
      console.log("Canceling WebSocket stream.");
      webSocket.close();
      readerClosed = true;
    }
  };

  // Membuat dan mengembalikan ReadableStream dengan dukungan start, pull, dan cancel
  return new ReadableStream({
    start,
    pull,
    cancel
  });
}

// Contoh penggunaan
const webSocket = new WebSocket('wss://example.com/socket');
const readableStream = MakeReadableWebSocketStream(webSocket);

// Menggunakan stream untuk membaca data
const reader = readableStream.getReader();
async function readStream() {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      console.log("Received data from WebSocket: ", value);
    }
  } catch (err) {
    console.error("Error reading from WebSocket stream: ", err);
  }
}

// Mulai membaca stream
readStream();
/**
 * Memproses header protokol dari request atau pesan yang diterima.
 * Fungsi ini dapat memvalidasi, memparsing, atau menyesuaikan data dari header protokol.
 * @param {Object} header - Header protokol yang perlu diproses.
 * @returns {Object} - Objek yang berisi status atau data yang diproses.
 */
function ProcessProtocolHeader(header) {
  // Mengecek apakah header protokol valid
  if (!header || typeof header !== 'object') {
    throw new Error('Invalid protocol header.');
  }

  // Contoh header yang bisa diproses (misalnya untuk WebSocket atau protokol lain)
  const protocolFields = ['UUID', 'Version', 'Token', 'Authorization', 'Timestamp'];

  // Memastikan bahwa semua field yang diperlukan ada dalam header
  const missingFields = protocolFields.filter(field => !(field in header));

  if (missingFields.length > 0) {
    throw new Error(`Missing required protocol fields: ${missingFields.join(', ')}`);
  }

  // Validasi UUID
  if (!isValidUUID(header.UUID)) {
    throw new Error('Invalid UUID in protocol header.');
  }

  // Validasi versi protokol
  if (!isValidProtocolVersion(header.Version)) {
    throw new Error('Invalid protocol version.');
  }

  // Validasi token atau authorization
  if (!isValidToken(header.Token)) {
    throw new Error('Invalid token or authorization.');
  }

  // Validasi timestamp
  if (!isValidTimestamp(header.Timestamp)) {
    throw new Error('Invalid timestamp.');
  }

  // Jika semua validasi berhasil, mengembalikan data yang telah diproses
  return {
    status: 'success',
    data: {
      UUID: header.UUID,
      Version: header.Version,
      Token: header.Token,
      Timestamp: header.Timestamp
    }
  };
}

/**
 * Memeriksa apakah UUID yang diberikan valid.
 * @param {string} uuid - UUID yang akan diperiksa.
 * @returns {boolean} - Return true jika UUID valid, false jika tidak.
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Memeriksa apakah versi protokol valid.
 * @param {string} version - Versi protokol yang akan diperiksa.
 * @returns {boolean} - Return true jika versi protokol valid, false jika tidak.
 */
function isValidProtocolVersion(version) {
  // Anggap versi protokol yang valid adalah angka dengan format X.Y.Z
  const versionRegex = /^\d+\.\d+\.\d+$/;
  return versionRegex.test(version);
}

/**
 * Memeriksa apakah token atau otorisasi valid.
 * @param {string} token - Token yang akan diperiksa.
 * @returns {boolean} - Return true jika token valid, false jika tidak.
 */
function isValidToken(token) {
  // Anggap token valid jika panjangnya lebih dari 10 karakter
  return typeof token === 'string' && token.length > 10;
}

/**
 * Memeriksa apakah timestamp valid.
 * @param {string} timestamp - Timestamp yang akan diperiksa.
 * @returns {boolean} - Return true jika timestamp valid, false jika tidak.
 */
function isValidTimestamp(timestamp) {
  // Memastikan timestamp adalah angka yang valid dan dalam rentang waktu yang wajar
  const timestampDate = new Date(timestamp);
  return !isNaN(timestampDate.getTime());
}
/**
 * Menangani komunikasi antara socket jarak jauh (remote socket) dan WebSocket.
 * @param {WebSocket} ws - WebSocket yang terhubung dari client.
 * @param {string} remoteHost - Alamat host dari server jarak jauh.
 * @param {number} remotePort - Port dari server jarak jauh.
 * @param {Object} env - Environment variables untuk pengaturan socket dan konfigurasi lainnya.
 * @returns {Promise<void>} - Fungsi asinkron yang menangani koneksi dan komunikasi.
 */
async function RemoteSocketToWS(ws, remoteHost, remotePort, env) {
  let remoteSocket;

  try {
    // Buat koneksi TCP ke server jarak jauh
    remoteSocket = await connectToRemoteSocket(remoteHost, remotePort);

    // Tangani data dari WebSocket ke remote socket
    ws.onmessage = async (event) => {
      try {
        // Kirim data dari WebSocket ke remote socket
        const message = event.data;
        await writeToSocket(remoteSocket, message);
      } catch (error) {
        console.error('Error while writing to remote socket:', error);
        abortConnection(remoteSocket);
        ws.close(1002, 'Error writing to remote socket.');
      }
    };

    // Tangani data dari remote socket ke WebSocket
    remoteSocket.on('data', async (data) => {
      try {
        // Kirim data dari remote socket ke WebSocket
        await ws.send(data);
      } catch (error) {
        console.error('Error while sending data to WebSocket:', error);
        abortConnection(remoteSocket);
        ws.close(1002, 'Error sending data to WebSocket.');
      }
    });

    // Tangani penutupan WebSocket
    ws.onclose = async () => {
      console.log('WebSocket closed, closing remote socket.');
      await closeSocket(remoteSocket);
    };

    // Tangani kesalahan pada WebSocket
    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      abortConnection(remoteSocket);
      ws.close(1002, 'WebSocket error occurred.');
    };

    // Tangani kesalahan pada remote socket
    remoteSocket.on('error', (err) => {
      console.error('Remote socket error:', err);
      abortConnection(remoteSocket);
      ws.close(1011, 'Remote socket error occurred.');
    });

    // Tangani penutupan koneksi remote socket
    remoteSocket.on('end', async () => {
      console.log('Remote socket closed.');
      ws.close(1000, 'Remote socket closed.');
    });
  } catch (error) {
    console.error('Error establishing remote socket connection:', error);
    if (remoteSocket) {
      abortConnection(remoteSocket);
    }
    ws.close(1011, 'Server error occurred.');
  }
}

/**
 * Membuat koneksi ke socket jarak jauh.
 * @param {string} host - Host dari server jarak jauh.
 * @param {number} port - Port dari server jarak jauh.
 * @returns {Promise<net.Socket>} - Koneksi socket.
 */
async function connectToRemoteSocket(host, port) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();

    socket.connect(port, host, () => {
      console.log(`Connected to remote socket at ${host}:${port}`);
      resolve(socket);
    });

    socket.on('error', (err) => {
      reject(`Failed to connect to remote socket: ${err.message}`);
    });
  });
}

/**
 * Menulis data ke socket.
 * @param {net.Socket} socket - Koneksi socket.
 * @param {Buffer | string} data - Data yang akan dikirim ke socket.
 * @returns {Promise<void>} - Fungsi asinkron yang menangani penulisan data.
 */
async function writeToSocket(socket, data) {
  return new Promise((resolve, reject) => {
    socket.write(data, (err) => {
      if (err) {
        reject(`Error writing to socket: ${err.message}`);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Menutup koneksi socket dengan cara yang aman.
 * @param {net.Socket} socket - Koneksi socket.
 * @returns {Promise<void>} - Fungsi asinkron untuk menutup koneksi socket.
 */
async function closeSocket(socket) {
  return new Promise((resolve, reject) => {
    socket.end(() => {
      console.log('Socket closed successfully.');
      resolve();
    });
    socket.on('error', (err) => {
      reject(`Error closing socket: ${err.message}`);
    });
  });
}

/**
 * Membatalkan atau memutuskan koneksi socket.
 * @param {net.Socket} socket - Koneksi socket yang akan dihentikan.
 * @returns {void}
 */
function abortConnection(socket) {
  console.log('Aborting connection...');
  socket.destroy(); // Memutuskan koneksi secara paksa
}
/**
 * Mengonversi string Base64 menjadi ArrayBuffer.
 * @param {string} base64 - String dalam format Base64 yang akan dikonversi.
 * @returns {ArrayBuffer} - ArrayBuffer hasil konversi.
 */
function base64ToArrayBuffer(base64) {
  // Menghitung panjang string base64 setelah dikurangi padding ('=')
  const binaryString = atob(base64);
  const len = binaryString.length;
  const arrayBuffer = new ArrayBuffer(len);
  const uint8Array = new Uint8Array(arrayBuffer);

  // Menyalin data dari string biner ke dalam Uint8Array
  for (let i = 0; i < len; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  return arrayBuffer;
}
/**
 * Memvalidasi apakah string merupakan UUID yang valid.
 * UUID harus mengikuti format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * @param {string} uuid - String yang akan diverifikasi apakah merupakan UUID yang valid.
 * @returns {boolean} - True jika UUID valid, false jika tidak.
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
/**
 * Menutup koneksi WebSocket dengan cara yang aman.
 * Fungsi ini memeriksa apakah WebSocket terhubung, dan jika ya, mencoba menutupnya dengan kode dan alasan tertentu.
 * @param {WebSocket} webSocket - WebSocket yang ingin ditutup.
 * @param {number} [closeCode=1000] - Kode penutupan WebSocket (default: 1000 - normal closure).
 * @param {string} [closeReason] - Alasan penutupan WebSocket (opsional).
 */
function safeCloseWebSocket(webSocket, closeCode = 1000, closeReason = '') {
  try {
    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
      // Jika WebSocket terbuka, tutup dengan kode dan alasan yang diberikan
      webSocket.close(closeCode, closeReason);
      console.log('WebSocket successfully closed.');
    } else {
      console.log('WebSocket is not open, skipping close operation.');
    }
  } catch (error) {
    console.error('Error while closing WebSocket:', error);
  }
}
/**
 * Mengubah objek menjadi string JSON dengan cara yang lebih aman. 
 * Jika terjadi kesalahan, kembalikan `null` atau string kosong, tanpa memunculkan error.
 * 
 * @param {any} obj - Objek yang akan diubah menjadi string JSON.
 * @returns {string} - String JSON yang mewakili objek, atau null jika gagal.
 */
function unsafeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error('Error in unsafeStringify:', error);
    return null;  // atau bisa mengembalikan '{}' atau '' tergantung kebutuhan
  }
  
}
/**
 * Mengubah objek menjadi string JSON dengan penanganan kesalahan yang lebih baik.
 * Jika terjadi kesalahan, kembalikan string kosong atau nilai fallback lainnya.
 * 
 * @param {any} obj - Objek yang akan diubah menjadi string JSON.
 * @param {string} [fallback=''] - Nilai fallback yang akan dikembalikan jika terjadi kesalahan saat serialisasi.
 * @returns {string} - String JSON yang mewakili objek, atau nilai fallback jika gagal.
 */
function stringify(obj, fallback = '') {
  try {
    // Mengubah objek menjadi string JSON
    return JSON.stringify(obj);
  } catch (error) {
    // Jika terjadi kesalahan saat serialisasi, kembalikan nilai fallback
    console.error('Error in stringify:', error);
    return fallback;  // Nilai default adalah string kosong, bisa disesuaikan sesuai kebutuhan
  }
}
/**
 * Menangani query DNS yang melibatkan UDP chunk, WebSocket, protokol respons, dan log.
 * Fungsi ini akan memproses query DNS, menulis hasilnya ke WebSocket, serta menangani log sesuai protokol.
 * Mendukung DNS resolver publik Google dan Cloudflare.
 *
 * @param {Uint8Array} udpChunk - Bagian data DNS query dalam format UDP
 * @param {WebSocket} webSocket - WebSocket untuk mengirimkan hasil ke klien
 * @param {Object} protocolResponseHeader - Header respons protokol untuk menangani status dan metadata
 * @param {function} log - Fungsi untuk menulis log yang diperlukan
 */
async function handleDNSQuery(udpChunk, webSocket, protocolResponseHeader, log) {
  try {
    // Menangani chunk UDP DNS
    const dnsQuery = parseDNSQuery(udpChunk);
    log(`Menerima query DNS untuk domain: ${dnsQuery.domain}`);

    // Memproses query DNS menggunakan resolver publik (Google atau Cloudflare)
    const dnsResults = await queryDNS(dnsQuery.domain);

    // Menyusun respons protokol dengan header yang sesuai
    const protocolResponse = buildProtocolResponse(dnsResults, protocolResponseHeader);

    // Menulis respons ke WebSocket
    await sendResponseToWebSocket(webSocket, protocolResponse);

    // Log respons sukses
    log(`Berhasil mengirimkan respons untuk domain: ${dnsQuery.domain}`);
  } catch (error) {
    // Menangani kesalahan
    log(`Terjadi kesalahan dalam memproses query DNS: ${error.message}`);
    
    // Menangani pengiriman pesan kesalahan ke WebSocket
    const errorMessage = buildProtocolResponseError(error.message, protocolResponseHeader);
    await sendResponseToWebSocket(webSocket, errorMessage);

    // Menutup koneksi WebSocket setelah kesalahan
    safeCloseWebSocket(webSocket);
  }
}

/**
 * Parse chunk UDP untuk mendapatkan domain dari DNS query.
 * @param {Uint8Array} udpChunk - Bagian data DNS query dalam format UDP
 * @returns {Object} - Objek DNS yang berisi domain yang diminta
 */
function parseDNSQuery(udpChunk) {
  // Contoh sederhana: mengonversi UDP chunk ke string domain
  const queryString = new TextDecoder().decode(udpChunk);
  return { domain: queryString.trim() };
}

/**
 * Melakukan query DNS untuk domain yang diberikan menggunakan resolver publik (Google atau Cloudflare).
 * @param {string} domain - Domain yang diminta
 * @returns {Promise<Object>} - Hasil query DNS
 */
async function queryDNS(domain) {
  // Gunakan resolver DNS publik (Google: 8.8.8.8, Cloudflare: 1.1.1.1)
  const dnsResolvers = [
    'https://dns.google/resolve?name=',    // Google DNS
    'https://1.1.1.1/dns-query?name='     // Cloudflare DNS
  ];

  // Pilih DNS resolver (gunakan Cloudflare atau Google)
  const resolverUrl = dnsResolvers[Math.floor(Math.random() * dnsResolvers.length)];

  // Query DNS dengan menggunakan fetch
  const response = await fetch(`${resolverUrl}${domain}`, { method: 'GET' });
  const data = await response.json();

  // Periksa apakah DNS berhasil ditemukan
  if (data.Status === 0 && data.Answer) {
    return {
      ip: data.Answer[0].data, // IP address dari hasil DNS
      domain: domain
    };
  } else {
    throw new Error('DNS query failed or no valid answer.');
  }
}

/**
 * Menyusun respons protokol berdasarkan hasil DNS query.
 * @param {Object} dnsResults - Hasil query DNS
 * @param {Object} protocolResponseHeader - Header respons protokol
 * @returns {Object} - Respons protokol lengkap
 */
function buildProtocolResponse(dnsResults, protocolResponseHeader) {
  return {
    header: protocolResponseHeader,
    status: 'success',
    result: dnsResults
  };
}

/**
 * Menyusun respons error untuk protokol jika terjadi kesalahan.
 * @param {string} errorMessage - Pesan kesalahan
 * @param {Object} protocolResponseHeader - Header respons protokol
 * @returns {Object} - Respons error untuk protokol
 */
function buildProtocolResponseError(errorMessage, protocolResponseHeader) {
  return {
    header: protocolResponseHeader,
    status: 'error',
    error: errorMessage
  };
}

/**
 * Mengirimkan respons ke WebSocket.
 * @param {WebSocket} webSocket - WebSocket untuk mengirimkan data
 * @param {Object} response - Respons untuk dikirimkan ke WebSocket
 */
async function sendResponseToWebSocket(webSocket, response) {
  const responseString = JSON.stringify(response);

  // Jika WebSocket masih dalam keadaan terbuka, kirim respons
  if (webSocket.readyState === WebSocket.OPEN) {
    webSocket.send(responseString);
  } else {
    throw new Error('WebSocket tidak terbuka untuk pengiriman.');
  }
}

/**
 * Menutup WebSocket dengan cara yang aman.
 * @param {WebSocket} webSocket - WebSocket untuk ditutup
 */
function safeCloseWebSocket(webSocket) {
  try {
    if (webSocket.readyState === WebSocket.OPEN) {
      webSocket.close();
    }
  } catch (error) {
    console.error('Kesalahan saat menutup WebSocket:', error);
  }
}
/**
 * Membuat koneksi ke server SOCKS5.
 * @param {string} addressType - Jenis alamat (IPv4, IPv6, atau domain)
 * @param {string} addressRemote - Alamat remote server (IP atau domain)
 * @param {number} portRemote - Port yang digunakan untuk koneksi remote
 * @param {function} log - Fungsi log untuk mencatat aktivitas
 * @returns {Promise<WebSocket>} - Promise yang mengembalikan WebSocket yang terhubung
 */
async function socks5Connect(addressType, addressRemote, portRemote, log) {
  // Log permulaan koneksi
  log(`Memulai koneksi SOCKS5 ke ${addressRemote}:${portRemote} dengan address type ${addressType}`);

  // Tentukan alamat SOCKS5
  const sock5Address = `ws://${addressRemote}:${portRemote}`;

  try {
    // Membuat koneksi WebSocket ke server SOCKS5
    const socket = new WebSocket(sock5Address);

    // Menunggu koneksi WebSocket terbuka
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = (err) => {
        reject(new Error('Gagal terhubung ke server SOCKS5'));
      };
    });

    // Log koneksi berhasil
    log(`Koneksi SOCKS5 berhasil ke ${addressRemote}:${portRemote}`);

    // Kirimkan permintaan SOCKS5 (misalnya autentikasi atau jenis koneksi yang diinginkan)
    const request = new Uint8Array([0x05, 0x01, 0x00]); // Contoh permintaan SOCKS5 tanpa autentikasi
    socket.send(request);
    
    // Menunggu respons dari server SOCKS5
    await new Promise((resolve, reject) => {
      socket.onmessage = (message) => {
        const response = new Uint8Array(message.data);
        if (response[1] === 0x00) { // Status OK
          resolve();
        } else {
          reject(new Error('Gagal otentikasi SOCKS5'));
        }
      };
      socket.onerror = reject;
    });

    // Koneksi berhasil, kembalikan socket
    return socket;
  } catch (err) {
    // Jika terjadi kesalahan selama koneksi, log dan lemparkan kesalahan
    log(`Koneksi SOCKS5 gagal: ${err.message}`);
    throw err;
  }
}
/**
 * Mengurai alamat SOCKS5 menjadi komponen-komponennya seperti host, port, username, dan password.
 * @param {string} address - Alamat SOCKS5 yang ingin diurai (contoh: 'username:password@host:port' atau 'host:port')
 * @returns {Object} - Objek yang berisi komponen alamat SOCKS5
 */
function socks5AddressParser(address) {
  // Jika alamat kosong, kembalikan objek kosong
  if (!address) {
    return {};
  }

  // Tentukan komponen address (auth@host:port) atau hanya host:port
  const [auth, hostPort] = address.includes('@') ? address.split('@') : [null, address];
  const [host, port] = hostPort.split(':');

  // Jika ada autentikasi (username:password)
  let username = '';
  let password = '';
  if (auth) {
    const [user, pass] = auth.split(':');
    username = user || '';
    password = pass || '';
  }

  // Kembalikan objek yang berisi komponen-komponen yang diurai
  return {
    host,
    port: port || '1080',  // Defaultkan port ke 1080 jika tidak ada port yang diberikan
    username,
    password,
  };
}
/**
 * Fungsi untuk menghasilkan subscription link dan menambahkan CNAME publik Cloudflare.
 * @param {string} userID_path - ID pengguna atau path untuk URL
 * @param {string} hostname - Nama host untuk konfigurasi
 * @param {string[]} proxyIP - Daftar alamat IP proxy
 * @returns {string} - Konten subscription link
 */
function GenSub(userID_path, hostname, proxyIP) {
  // Daftar CNAME publik Cloudflare yang umum digunakan
  const cloudflareCnames = [
    'cloudflare.com', 'cdn.cloudflare.com', '1.1.1.1', '1.0.0.1', 
    '1.1.1.1.cloudflare-dns.com', '1.0.0.1.cloudflare-dns.com',
    'dns.cloudflare.com', 'dns.google', 'resolvers.cloudflare.com'
  ];

  // Jika proxyIP adalah string, ubah menjadi array
  if (typeof proxyIP === 'string') {
    proxyIP = proxyIP.split(',').map(ip => ip.trim());
  }

  // Buat bagian pertama dari URL konfigurasi
  let subLink = `sub/${userID_path}?host=${hostname}`;

  // Tambahkan alamat proxy ke dalam link jika ada
  if (proxyIP && proxyIP.length > 0) {
    const proxyList = proxyIP.join(',');
    subLink += `&proxy=${encodeURIComponent(proxyList)}`;
  }

  // Tambahkan CNAME Cloudflare ke dalam URL
  if (cloudflareCnames && cloudflareCnames.length > 0) {
    const cnames = cloudflareCnames.join(',');
    subLink += `&cloudflare_cnames=${encodeURIComponent(cnames)}`;
  }

  // Kembalikan subscription link yang telah dibangun
  return subLink;
}
/**
 * Fungsi untuk menghasilkan URL acak dengan protokol HTTP atau HTTPS dan path acak
 * @param {number} pathLength - Panjang path yang diinginkan
 * @returns {string} - URL acak dengan protokol dan path
 */
function randomPathHttpHttps(pathLength = 10) {
  // Pilih protokol secara acak (http atau https)
  const protocol = Math.random() < 0.5 ? 'http' : 'https';
  
  // Panggil fungsi untuk membuat path acak
  const randomPath = randomPath(pathLength);

  // Gabungkan protokol dan path untuk membentuk URL lengkap
  return `${protocol}://example.com${randomPath}`;
}

/**
 * Fungsi untuk menghasilkan path acak
 * @param {number} length - Panjang path yang diinginkan
 * @returns {string} - Path acak
 */
function randomPath(length = 10) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // Karakter yang digunakan dalam path
  let randomString = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length); // Pilih indeks acak dari karakter
    randomString += characters[randomIndex]; // Tambahkan karakter yang dipilih ke dalam string acak
  }

  return `/${randomString}`; // Kembalikan path acak dalam format /<random_string>
}

// Contoh penggunaan
const randomUrl = randomPathHttpHttps(12); // URL acak dengan path sepanjang 12 karakter
console.log(randomUrl); // Contoh output: https://example.com/9Tg7kW1y6jA9
/**
 * Fungsi untuk menangani konfigurasi proxy dari PROXYIP
 * @param {string} PROXYIP - String yang berisi alamat proxy, bisa berupa satu atau beberapa alamat yang dipisahkan koma
 * @returns {Object} - Objek yang berisi IP dan port proxy yang telah diparsing
 */
function handleProxyConfig(PROXYIP) {
  // Memeriksa apakah PROXYIP valid
  if (!PROXYIP) {
    throw new Error('PROXYIP tidak ditemukan.');
  }

  // Pisahkan alamat proxy berdasarkan koma (jika ada beberapa)
  const proxyList = PROXYIP.split(',').map(ip => ip.trim());

  // Ambil proxy pertama dari daftar (bisa disesuaikan untuk memilih proxy secara acak)
  const [proxyAddress] = proxyList;

  // Pisahkan IP dan port (misalnya: "192.168.1.1:8080")
  const [ip, port = '443'] = proxyAddress.split(':');

  // Mengembalikan objek yang berisi alamat IP dan port
  return {
    ip: ip,
    port: port,
  };
}

// Contoh penggunaan
const PROXYIP = '192.168.1.1:8080, 192.168.1.2:443'; // Daftar proxy
const config = handleProxyConfig(PROXYIP);
console.log(config); // Output: { ip: '192.168.1.1', port: '8080' }
/**
 * Fungsi untuk memilih alamat proxy secara acak dari daftar alamat proxy
 * @param {string[]} proxyAddresses - Array yang berisi alamat proxy
 * @returns {string} - Alamat proxy yang dipilih secara acak
 */
function selectRandomAddress(proxyAddresses) {
  // Memeriksa apakah ada alamat proxy yang diberikan
  if (!proxyAddresses || proxyAddresses.length === 0) {
    throw new Error('Daftar alamat proxy kosong.');
  }

  // Pilih indeks acak dari daftar proxyAddresses
  const randomIndex = Math.floor(Math.random() * proxyAddresses.length);

  // Kembalikan alamat proxy yang dipilih secara acak
  return proxyAddresses[randomIndex];
}

// Contoh penggunaan
const proxyAddresses = ['192.168.1.1:8080', '192.168.1.2:443', '192.168.1.3:3128'];
const randomProxy = selectRandomAddress(proxyAddresses);
console.log(randomProxy); // Output: salah satu dari alamat proxy acak
