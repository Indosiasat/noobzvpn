export default {
  async fetch(request, env) {
    // Handle Upgrade to WebSocket
    if (request.headers.get("Upgrade") === "websocket") {
      return handleWebSocket(request);
    }
    return new Response("Endpoint hanya mendukung WebSocket", { status: 400 });
  },
};

async function handleWebSocket(request) {
  const [client, server] = Object.values(new WebSocketPair());

  server.accept();

  server.addEventListener("message", async (event) => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === "auth") {
        const { password } = message;

        if (isValidPassword(password)) {
          const userUUID = generateUUID();
          server.send(
            JSON.stringify({
              type: "auth_success",
              message: "Autentikasi berhasil",
              uuid: userUUID,
            })
          );
        } else {
          server.send(
            JSON.stringify({
              type: "auth_failure",
              message: "Autentikasi gagal. Password salah.",
            })
          );
          server.close(1000, "Autentikasi gagal");
        }
      } else {
        server.send(
          JSON.stringify({
            type: "error",
            message: "Tipe pesan tidak dikenali.",
          })
        );
      }
    } catch (error) {
      server.send(
        JSON.stringify({
          type: "error",
          message: "Kesalahan pada server.",
        })
      );
      server.close(1011, "Internal server error");
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

function isValidPassword(password) {
  const validPassword = "yourpassword"; // Ganti dengan password Anda
  return password === validPassword;
}

function generateUUID() {
  // Generate UUID versi 4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}