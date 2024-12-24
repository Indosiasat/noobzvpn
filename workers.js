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
// Fungsi untuk menangani WebSocket dan protokol tertentu
async function ProtocolOverWSHandler(request) {
  try {
    // Membuka koneksi WebSocket
    const [client, server] = Object.values(new WebSocketPair());

    // Menangani pesan WebSocket
    server.accept();
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);

        // Log pesan yang diterima
        log('Pesan diterima: ', message);

        // Proses pesan berdasarkan tipe protokol
        const response = await handleProtocol(message);
        await write(server, response);

      } catch (error) {
        log('Error dalam pemrosesan pesan: ', error);
        close(server, 'Error dalam pemrosesan pesan');
      }
    });

    // Menangani koneksi WebSocket yang tertutup
    server.addEventListener('close', () => {
      log('Koneksi WebSocket ditutup.');
    });

    // Tangani error pada WebSocket
    server.addEventListener('error', (error) => {
      log('Error WebSocket: ', error);
      abort(server, 'Koneksi WebSocket dibatalkan karena error');
    });

    // Mengembalikan response WebSocket
    return new Response(null, {
      status: 101,
      webSocket: client
    });
  } catch (error) {
    // Log error yang terjadi selama pemrosesan
    log('Terjadi kesalahan dalam ProtocolOverWSHandler: ', error);
    throw new Error('Gagal memproses WebSocket');
  }
}

// Fungsi untuk menangani log
function log(message, data) {
  console.log(message, data); // Menampilkan log di konsol
}

// Fungsi untuk menulis data ke WebSocket
async function write(webSocket, data) {
  try {
    await webSocket.send(JSON.stringify(data)); // Menulis data ke WebSocket
  } catch (error) {
    log('Gagal menulis data ke WebSocket: ', error);
    close(webSocket, 'Gagal menulis data');
  }
}

// Fungsi untuk menutup WebSocket
function close(webSocket, reason) {
  try {
    webSocket.close(1000, reason); // Menutup koneksi WebSocket
    log('WebSocket ditutup: ', reason);
  } catch (error) {
    log('Gagal menutup WebSocket: ', error);
  }
}

// Fungsi untuk membatalkan operasi WebSocket
function abort(webSocket, reason) {
  try {
    webSocket.close(4000, reason); // Menutup WebSocket dengan kode 4000 untuk abort
    log('Operasi WebSocket dibatalkan: ', reason);
  } catch (error) {
    log('Gagal membatalkan operasi WebSocket: ', error);
  }
}

// Fungsi untuk menangani protokol tertentu
async function handleProtocol(message) {
  // Implementasikan logika untuk menangani berbagai protokol seperti VLESS, VMESS, Trojan
  // Ini hanya contoh dasar, implementasi lebih lanjut tergantung pada protokol yang digunakan.
  if (message.type === 'vless') {
    return { status: 'success', message: 'Menangani VLESS' };
  } else if (message.type === 'vmess') {
    return { status: 'success', message: 'Menangani VMESS' };
  } else if (message.type === 'trojan') {
    return { status: 'success', message: 'Menangani Trojan' };
  } else {
    return { status: 'failed', message: 'Protokol tidak dikenali' };
  }
}
async function HandleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, protocolResponseHeader, log, useSocks = false) {
  // Fungsi untuk mencoba membuat koneksi TCP dan menulis data
  const MAX_RETRIES = 3; // Tentukan jumlah maksimal percobaan ulang
  let retries = 0;

  // Fungsi untuk menghubungkan ke remote socket melalui SOCKS jika diperlukan
  const connectToRemoteSocket = async (addressRemote, portRemote) => {
    try {
      // Jika menggunakan SOCKS, lakukan koneksi melalui SOCKS
      if (useSocks) {
        log(`Menghubungkan ke ${addressRemote}:${portRemote} melalui SOCKS...`);

        // Gantilah dengan metode spesifik Anda untuk menghubungkan melalui SOCKS
        // Implementasi koneksi SOCKS
        const socks5Address = 'socks5-proxy.example.com:1080'; // Proxy SOCKS
        const socksConnection = await socks5Connect(socks5Address, addressRemote, portRemote, log);
        return socksConnection;
      } else {
        // Koneksi langsung tanpa SOCKS
        log(`Menghubungkan langsung ke ${addressRemote}:${portRemote}...`);

        const socket = await connect({
          host: addressRemote,
          port: portRemote,
          protocol: addressType // Menentukan tipe alamat (IPv4, IPv6)
        });

        return socket;
      }
    } catch (error) {
      // Jika gagal, tangani percobaan ulang
      retries++;
      log(`Percobaan ${retries} gagal: ${error.message}`);

      if (retries < MAX_RETRIES) {
        log(`Mencoba ulang koneksi (${retries}/${MAX_RETRIES})...`);
        return connectToRemoteSocket(addressRemote, portRemote); // Coba lagi jika belum mencapai batas retry
      } else {
        // Jika sudah mencapai maksimal percobaan, lemparkan error
        log('Koneksi gagal setelah beberapa kali percobaan.');
        throw new Error(`Gagal menghubungkan ke ${addressRemote}:${portRemote}`);
      }
    }
  };

  // Fungsi untuk menunggu dan menulis data ke remote socket
  const writeToSocket = async (socket, data) => {
    try {
      await socket.write(data); // Menulis data ke remote socket
      log(`Data berhasil dikirim ke ${addressRemote}:${portRemote}`);
    } catch (error) {
      log(`Error saat menulis data ke socket: ${error.message}`);
      throw error;
    }
  };

  // Fungsi utama untuk menangani TCP outbound
  const handleOutbound = async () => {
    try {
      // Coba untuk menghubungkan ke remote socket
      const socket = await connectToRemoteSocket(addressRemote, portRemote);

      // Setelah terkoneksi, kirim data ke socket
      await writeToSocket(socket, rawClientData);

      // Tunggu respons dari remote server (bisa menggunakan socket.read atau mekanisme lain sesuai implementasi)
      const response = await socket.read();
      if (response) {
        log('Respon diterima dari server:', response);
        // Kirimkan kembali data ke WebSocket jika ada
        if (webSocket) {
          webSocket.send(response); // Mengirim data ke WebSocket
        }
      }

      // Menutup socket setelah selesai
      socket.close();
      log('Koneksi ditutup setelah komunikasi selesai.');
    } catch (error) {
      log(`Terjadi kesalahan: ${error.message}`);
      throw error;
    }
  };

  // Menjalankan proses utama untuk outbound TCP
  await handleOutbound();
}
function MakeReadableWebSocketStream(webSocketServer, earlyDataHeader, log, start, pull, cancel) {
  // Membuat ReadableStream yang dapat dibaca dari WebSocket
  const webSocketStream = new ReadableStream({
    start(controller) {
      // Mulai streaming data dari WebSocket
      start(controller);
    },
    async pull(controller) {
      try {
        // Tarik data dari WebSocket server jika tersedia
        const message = await webSocketServer.receive(); // Mengambil pesan dari WebSocket server
        if (message) {
          // Jika ada data, masukkan ke dalam stream controller
          controller.enqueue(message);
        } else {
          // Jika tidak ada data, tutup stream
          controller.close();
        }
      } catch (err) {
        // Menangani error jika terjadi masalah saat menarik data
        log(`Error saat menarik data dari WebSocket: ${err.message}`);
        controller.error(err); // Menghentikan stream jika ada error
      }
    },
    cancel(reason) {
      // Menghentikan stream dengan alasan tertentu
      log(`Stream dibatalkan karena: ${reason}`);
      cancel(reason); // Memanggil cancel untuk membersihkan jika diperlukan
    }
  });

  // Mengembalikan ReadableStream
  return webSocketStream;
}

// Contoh penggunaan
const webSocketServer = {
  // Simulasi menerima pesan dari WebSocket server
  async receive() {
    // Fungsi untuk menerima data dari WebSocket
    // Biasanya, ini akan memanggil webSocket.receive() atau metode serupa
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve("Data dari WebSocket"), 1000); // Simulasi menerima data
    });
  }
};

const log = (message) => console.log(message);

// Fungsi start untuk memulai stream
const startController = (controller) => {
  console.log('Stream dimulai.');
};

// Fungsi pull untuk menarik data
const pullController = (controller) => {
  console.log('Menarik data dari WebSocket...');
};

// Fungsi cancel untuk membatalkan stream
const cancelController = (reason) => {
  console.log(`Stream dibatalkan: ${reason}`);
};

// Membuat WebSocket stream yang dapat dibaca
const readableStream = MakeReadableWebSocketStream(webSocketServer, null, log, startController, pullController, cancelController);

// Menggunakan stream untuk membaca data
const reader = readableStream.getReader();
async function readStream() {
  try {
    let done = false;
    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) {
        done = true;
      } else {
        console.log('Data diterima:', value);
      }
    }
  } catch (err) {
    console.error('Error membaca stream:', err);
  }
}

readStream();
function ProcessProtocolHeader(protocolBuffer, userID) {
  try {
    // Pastikan protocolBuffer adalah objek tipe Buffer atau ArrayBuffer
    if (!(protocolBuffer instanceof ArrayBuffer || Buffer.isBuffer(protocolBuffer))) {
      throw new Error('Protocol buffer harus berupa ArrayBuffer atau Buffer.');
    }

    // Decode buffer menjadi string atau objek yang sesuai
    const decoder = new TextDecoder(); // Dekoder untuk mengubah buffer menjadi string
    const protocolHeader = decoder.decode(protocolBuffer);

    // Logika untuk memproses header protokol sesuai dengan kebutuhan
    if (!protocolHeader || protocolHeader.length === 0) {
      throw new Error('Header protokol kosong.');
    }

    // Misalkan kita memeriksa apakah userID ada di dalam header
    if (protocolHeader.includes(userID)) {
      console.log('UserID ditemukan dalam header protokol.');
    } else {
      console.log('UserID tidak ditemukan dalam header protokol.');
    }

    // Proses lebih lanjut sesuai kebutuhan, misalnya ekstraksi informasi dari header
    const headerInfo = {
      protocol: protocolHeader.split(' ')[0],  // Misalnya, protokol ada di awal header
      data: protocolHeader.slice(protocolHeader.indexOf(' ') + 1), // Data setelah protokol
    };

    console.log('Header Protocol:', headerInfo);

    // Mengembalikan hasil dari pemrosesan header
    return headerInfo;

  } catch (err) {
    // Tangani error yang mungkin terjadi selama pemrosesan
    console.error('Error memproses header protokol:', err.message);
    return null; // Kembalikan null jika terjadi kesalahan
  }
}

// Contoh penggunaan
const protocolBuffer = new TextEncoder().encode('HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n');
const userID = 'd342d11e-d424-4583-b36e-524ab1f0afa4';

// Memanggil fungsi untuk memproses protocol header
const result = ProcessProtocolHeader(protocolBuffer, userID);
console.log(result);
async function RemoteSocketToWS(remoteSocket, webSocket, protocolResponseHeader, retry, log) {
  let retries = 3; // Jumlah maksimal retry jika koneksi gagal
  let connected = false;

  // Fungsi untuk menulis data ke WebSocket
  async function writeToWebSocket(data) {
    try {
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(data); // Mengirim data ke WebSocket
        log('Data dikirim ke WebSocket');
      } else {
        log('WebSocket tidak terbuka. Data tidak dapat dikirim.');
      }
    } catch (error) {
      log('Error saat menulis ke WebSocket: ' + error.message);
      throw error; // Melempar error untuk penanganan lebih lanjut
    }
  }

  // Fungsi untuk menutup WebSocket dan mengirimkan status
  async function closeWebSocket() {
    try {
      if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close(); // Menutup WebSocket
        log('WebSocket ditutup.');
      }
    } catch (error) {
      log('Error saat menutup WebSocket: ' + error.message);
    }
  }

  // Fungsi untuk membatalkan operasi jika terjadi masalah
  async function abortConnection() {
    try {
      if (remoteSocket) {
        remoteSocket.destroy(); // Menghancurkan koneksi remote socket
        log('Koneksi remote socket dibatalkan.');
      }
      await closeWebSocket(); // Menutup WebSocket
    } catch (error) {
      log('Error saat membatalkan koneksi: ' + error.message);
    }
  }

  // Fungsi utama untuk menangani data antara remote socket dan WebSocket
  async function handleSocketData() {
    try {
      while (retries > 0 && !connected) {
        try {
          // Menunggu data dari remoteSocket
          const chunk = await new Promise((resolve, reject) => {
            remoteSocket.once('data', resolve);
            remoteSocket.once('error', reject);
          });

          // Mengirimkan data yang diterima ke WebSocket
          await writeToWebSocket(chunk);
          
          connected = true; // Koneksi berhasil
          log('Koneksi berhasil dan data telah diterima.');
        } catch (error) {
          retries--;
          log(`Gagal menghubungkan ke WebSocket, mencoba lagi. Retries tersisa: ${retries}`);

          // Jika ada retry, kita mencoba lagi setelah delay
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Tunggu 2 detik sebelum retry
          } else {
            log('Retry gagal. Koneksi tidak berhasil.');
            await abortConnection(); // Batalkan koneksi jika retry habis
            break;
          }
        }
      }
    } catch (error) {
      log('Error saat menangani data socket: ' + error.message);
      await abortConnection(); // Jika terjadi kesalahan, batalkan koneksi
    }
  }

  // Menambahkan protocol response header ke WebSocket (jika perlu)
  if (protocolResponseHeader) {
    log('Menambahkan header respons protokol ke WebSocket.');
    // Anda bisa menambahkan header ini pada tahap awal pengaturan WebSocket
  }

  // Mulai proses pengiriman data antara remoteSocket dan WebSocket
  await handleSocketData();
}
function base64ToArrayBuffer(base64Str) {
  // Meng-decode string base64 menjadi string biner
  const binaryString = atob(base64Str);

  // Membuat ArrayBuffer dengan panjang sesuai dengan panjang string biner
  const length = binaryString.length;
  const arrayBuffer = new ArrayBuffer(length);

  // Membuat Uint8Array untuk mengakses data dalam ArrayBuffer
  const uint8Array = new Uint8Array(arrayBuffer);

  // Menyalin setiap byte dari string biner ke Uint8Array
  for (let i = 0; i < length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }

  // Mengembalikan ArrayBuffer yang berisi data dari Base64
  return arrayBuffer;
}
function isValidUUID(uuid) {
  // Regex untuk memvalidasi format UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Mengembalikan true jika UUID valid, false jika tidak
  return uuidRegex.test(uuid);
}
function safeCloseWebSocket(socket) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      // Mengirimkan close frame dan menunggu hingga WebSocket benar-benar ditutup
      socket.close(1000, 'Normal closure');
      
      // Menangani event 'close' untuk memastikan socket tertutup dengan baik
      socket.addEventListener('close', () => {
        console.log('WebSocket connection closed safely.');
      });
    } catch (error) {
      console.error('Error closing WebSocket:', error);
    }
  } else {
    console.log('WebSocket is not open or already closed.');
  }
}
