addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const protocol = url.hostname.split('.')[0];  // Menentukan protokol (vless, vmess, trojan)
  const uuid = url.pathname.split('/')[1];     // Mengambil UUID dari URL

  if (!uuid) {
    return new Response('UUID is missing', { status: 400 });
  }

  // Tentukan port dan server berdasarkan protokol
  let server = '';
  let port = '443';  // Default port untuk VLESS/VMess
  let path = `/${uuid}`;
  let security = 'tls';
  let encryption = 'none';

  if (protocol === 'vless') {
    server = 'example-vless-server.com'; // Server VLESS
  } else if (protocol === 'vmess') {
    server = 'example-vmess-server.com'; // Server VMess
  } else if (protocol === 'trojan') {
    server = 'example-trojan-server.com'; // Server Trojan
  } else {
    return new Response('Unsupported protocol', { status: 400 });
  }

  // Menyusun konfigurasi VLESS secara dinamis
  const configUrl = generateConfigUrl(protocol, uuid, server, port, path, security, encryption);

  return new Response(configUrl, {
    headers: { 'Content-Type': 'text/plain' },
  });
}

// Fungsi untuk menghasilkan URL konfigurasi VLESS
function generateConfigUrl(protocol, uuid, server, port, path, security, encryption) {
  if (protocol === 'vless') {
    return `vless://${uuid}@${server}:${port}?path=${encodeURIComponent(path)}&security=${security}&encryption=${encryption}&host=${server}&sni=${server}#${server}`;
  } else if (protocol === 'vmess') {
    return `vmess://${uuid}@${server}:${port}?path=${encodeURIComponent(path)}&security=${security}&encryption=${encryption}&host=${server}&sni=${server}#${server}`;
  } else if (protocol === 'trojan') {
    return `trojan://${uuid}@${server}:${port}?path=${encodeURIComponent(path)}&security=${security}&encryption=${encryption}&host=${server}&sni=${server}#${server}`;
  }
}
