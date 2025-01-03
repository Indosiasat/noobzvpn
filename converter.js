addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  if (url.pathname === "/convert") {
    const formData = await request.formData();
    const inputText = formData.get("configurations");
    const configList = inputText.split("\n").filter(line => line.trim() !== "");

    const clashYaml = {
      proxies: [],
      proxyGroups: [
        {
          name: "Auto",
          type: "select",
          proxies: []
        }
      ],
      rules: []
    };

    configList.forEach(config => {
      try {
        const proxy = parseTrojanConfig(config);
        if (proxy) {
          clashYaml.proxies.push(proxy);
          clashYaml.proxyGroups[0].proxies.push(proxy.name);
        }
      } catch (error) {
        console.error(`Error parsing config: ${config}`, error);
      }
    });

    const yamlOutput = toYAML(clashYaml);

    return new Response(yamlOutput, {
      headers: { 'Content-Type': 'text/yaml' }
    });
  }

  if (url.pathname === "/") {
    return new Response(html(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

function html() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Clash YAML Converter</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f9; color: #333; margin: 0; padding: 0; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; background-color: white; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); border-radius: 8px; }
        h1 { text-align: center; color: #4CAF50; }
        textarea, pre { width: 100%; padding: 10px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; }
        select, button { display: inline-block; width: 48%; padding: 10px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin: 10px 1%; }
        select:hover, button:hover { background-color: #45a049; }
        .button-container { display: flex; justify-content: space-between; margin-top: 20px; }
        .button-container button { width: 30%; }
        pre { background-color: #f4f4f9; white-space: pre-wrap; word-wrap: break-word; overflow: hidden; font-family: monospace; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Trojan YAML Converter</h1>
        <form id="config-form" method="POST" action="/convert">
          <label for="configurations">Paste Trojan Configurations Below:</label>
          <textarea id="configurations" name="configurations" placeholder="Paste your Trojan configurations here..."></textarea>
          <button type="submit">Convert to Clash YAML</button>
        </form>
        <p id="error-message" style="color: red; display: none;"></p>
        <hr>
        <h2>Converted YAML Output</h2>
        <pre id="yaml-output" readonly></pre>
        <div class="button-container">
          <button id="copy-btn">Copy Text</button>
          <button id="download-btn">Download File</button>
          <button id="share-btn">Share</button>
        </div>
      </div>
      <script>
        const form = document.getElementById('config-form');
        const yamlOutputArea = document.getElementById('yaml-output');
        const errorMessage = document.getElementById('error-message');
        const copyBtn = document.getElementById('copy-btn');
        const downloadBtn = document.getElementById('download-btn');
        const shareBtn = document.getElementById('share-btn');

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          
          const formData = new FormData(form);
          const configurations = formData.get("configurations");
          if (!configurations.trim()) {
            errorMessage.textContent = "Configuration input is empty!";
            errorMessage.style.display = "block";
            return;
          }

          errorMessage.style.display = "none"; 

          const response = await fetch('/convert', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const yamlText = await response.text();
            yamlOutputArea.textContent = yamlText; 
          } else {
            errorMessage.textContent = "An error occurred while converting.";
            errorMessage.style.display = "block";
          }
        });

        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(yamlOutputArea.textContent)
            .then(() => alert('YAML text copied to clipboard!'))
            .catch(err => alert('Failed to copy: ' + err));
        });

        downloadBtn.addEventListener('click', () => {
          const yamlText = yamlOutputArea.textContent;
          const blob = new Blob([yamlText], { type: 'text/yaml' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'clash_config.yaml';
          link.click();
        });

        shareBtn.addEventListener('click', () => {
          const yamlText = yamlOutputArea.textContent;

          if (!yamlText.trim()) {
            alert('No YAML data to share!');
            return;
          }

          if (navigator.share) {
            navigator.share({
              title: 'Clash YAML Config',
              text: \`Check out this Clash YAML config:\n\n\${yamlText}\`,
              url: window.location.href 
            }).then(() => {
              console.log('Shared successfully');
            }).catch((error) => {
              console.log('Share failed', error);
            });
          } else {
            alert('Share functionality is not supported by this browser.');
          }
        });
      </script>
    </body>
    </html>
  `;
}

function parseTrojanConfig(config) {
  const url = new URL(config.split('#')[0]);
  const protocol = config.split('://')[0].toUpperCase();

  if (protocol !== 'TROJAN') {
    throw new Error("Unsupported protocol. Only Trojan is allowed.");
  }

  const details = parseQueryString(url.searchParams);
  const remark = decodeURIComponent(config.split('#')[1] || '');

  let proxy = {
    name: remark || 'No Remark',
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    password: url.username || '',
    skipCertVerify: true,
    network: 'tcp',
    sni: details.sni || '',
  };

  if (details.type === 'ws') {
    proxy.network = 'ws';
    proxy['ws-opts'] = {
      path: details.path || '/',
      headers: { Host: details.sni || url.hostname }
    };
  }

  proxy.udp = true; 

  return proxy;
}

function parseQueryString(queryParams) {
  const params = {};
  queryParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

function toYAML(obj) {
  let yamlOutput = `proxies:\n`;
  obj.proxies.forEach(proxy => {
    yamlOutput += `  - name: ${proxy.name}\n`;
    yamlOutput += `    type: ${proxy.type}\n`; 
    yamlOutput += `    server: ${proxy.server}\n`;
    yamlOutput += `    port: ${proxy.port}\n`;
    yamlOutput += `    password: ${proxy.password}\n`;
    yamlOutput += `    skip-cert-verify: ${proxy.skipCertVerify}\n`;
    yamlOutput += `    network: ${proxy.network}\n`;
    yamlOutput += `    sni: ${proxy.sni}\n`;

    if (proxy.network === 'ws') {
      yamlOutput += `    ws-opts:\n`;
      yamlOutput += `      path: ${proxy['ws-opts'].path}\n`;
      yamlOutput += `      headers:\n`;
      yamlOutput += `        Host: ${proxy['ws-opts'].headers.Host}\n`;
    }

    yamlOutput += `    udp: ${proxy.udp}\n`;
  });

  yamlOutput += `proxy-groups:\n`;
  obj.proxyGroups.forEach(group => {
    yamlOutput += `  - name: ${group.name}\n`;
    yamlOutput += `    type: ${group.type}\n`;
    yamlOutput += `    proxies:\n`;
    group.proxies.forEach(proxyName => {
      yamlOutput += `      - ${proxyName}\n`;
    });
  });

  yamlOutput += `rules:\n`;
  obj.rules.forEach(rule => {
    for (const [key, value] of Object.entries(rule)) {
      yamlOutput += `  - ${key},${value}\n`;
    }
  });

  return yamlOutput;
}
