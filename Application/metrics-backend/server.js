import express from 'express';
import cors from 'cors';
import si from 'systeminformation';
import os from 'os';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Function to collect local metrics
async function getLocalMetrics() {
  const [cpu, mem, currentLoad, networkStats] = await Promise.all([
    si.cpu(),
    si.mem(),
    si.currentLoad(),
    si.networkStats(),
  ]);

  // Sum up total network traffic across all interfaces
  const totalNetwork = networkStats.reduce((acc, iface) => ({
    rx_bytes: acc.rx_bytes + iface.rx_bytes,
    tx_bytes: acc.tx_bytes + iface.tx_bytes,
    rx_sec: acc.rx_sec + (iface.rx_sec || 0),
    tx_sec: acc.tx_sec + (iface.tx_sec || 0),
  }), { rx_bytes: 0, tx_bytes: 0, rx_sec: 0, tx_sec: 0 });

  return {
    hostname: os.hostname(),
    osType: `${os.type()} ${os.release()}`,
    webServer: 'nginx',
    memoryUsage: {
      total: mem.total,
      used: mem.used,
      free: mem.free
    },
    cpuInfo: {
      model: cpu.manufacturer + ' ' + cpu.brand,
      cores: cpu.cores,
      usage: currentLoad.currentLoad
    },
    networkTraffic: {
      bytesReceived: totalNetwork.rx_bytes,
      bytesSent: totalNetwork.tx_bytes,
      receiveSpeed: totalNetwork.rx_sec,
      sendSpeed: totalNetwork.tx_sec
    },
    uptime: os.uptime(),
    loadAverage: os.loadavg()
  };
}

// Endpoint for local metrics collection
app.get('/local-metrics', async (req, res) => {
  try {
    const metrics = await getLocalMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching local metrics:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

// Main metrics endpoint (only on app-server)
app.get('/metrics', async (req, res) => {
  try {
    const targetServer = req.headers['x-target-server'];

    if (targetServer) {
      // If X-Target-Server header is present, return only the metrics for that server
      const localMetrics = await getLocalMetrics();
      localMetrics.hostname = targetServer; // Override hostname to match target server name
      res.json([localMetrics]);
    } else {
      // Get local metrics
      const localMetrics = await getLocalMetrics();

      // Configuration for remote servers using WireGuard VPN IPs
      const servers = [
        //{ url: 'http://10.0.0.2:3000/local-metrics' }, // web-server-1
       // { url: 'http://10.0.0.3:3000/local-metrics' }, // web-server-2
       // { url: 'http://10.0.0.4:3000/local-metrics' }  // load-balancer
      ];

      // Fetch metrics from all servers
      const remoteMetricsPromises = servers.map(server =>
        axios.get(server.url)
          .then(response => response.data)
          .catch(error => {
            console.error(`Error fetching metrics from ${server.url}:`, error);
            return null;
          })
      );

      // Wait for all requests to complete
      const remoteMetrics = await Promise.allSettled(remoteMetricsPromises);

      // Combine all metrics
      const allMetrics = [
        localMetrics,
        ...remoteMetrics
          .filter(result => result.status === 'fulfilled' && result.value)
          .map(result => result.value)
      ];

      res.json(allMetrics);
    }
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch system metrics' });
  }
});

// Docker healthcheck
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Metrics server running on port ${PORT}`);
});
