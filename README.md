<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deploy Worker Button</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
    }
    .button {
      background-color: #4CAF50;
      color: white;
      padding: 14px 20px;
      border: none;
      cursor: pointer;
      text-align: center;
      font-size: 16px;
    }
    .button:hover {
      background-color: #45a049;
    }
    .status {
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <h2>Deploy Cloudflare Worker</h2>

  <!-- Tombol untuk memulai deployment -->
  <button class="button" id="deployButton">Deploy Worker</button>

  <!-- Menampilkan status -->
  <div class="status" id="status"></div>

  <script>
    document.getElementById('deployButton').addEventListener('click', deployWorker);

    async function deployWorker() {
      document.getElementById('status').textContent = 'Deploying...';

      // Endpoint API Cloudflare untuk deploy worker (gunakan Wrangler API atau API Cloudflare)
      const deployApiUrl = 'https://api.cloudflare.com/client/v4/accounts/{account_id}/workers/scripts/{script_name}/deployments';
      
      const headers = {
        'Authorization': 'Bearer {YOUR_API_TOKEN}',  // Gantilah dengan token API Anda
        'Content-Type': 'application/json'
      };

      const response = await fetch(deployApiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          // Konfigurasi untuk worker, ini tergantung pada setup Anda
          "script": {
            "name": "my-worker",
            "type": "javascript"
          },
          // Data lain yang diperlukan oleh Cloudflare untuk deployment
        })
      });

      if (response.ok) {
        document.getElementById('status').textContent = 'Worker deployed successfully!';
      } else {
        const errorData = await response.json();
        document.getElementById('status').textContent = 'Failed to deploy: ' + errorData.errors[0].message;
      }
    }
  </script>
</body>
</html>
