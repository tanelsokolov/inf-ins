// Dashboard.js - Server Metrics Dashboard

// Configuration
const config = {
    apiUrl: 'http://192.168.189.104/metrics', // API endpoint to fetch metrics
    refreshInterval: 1000, // Update every 1 second
    webServerName: 'Web-server 1',
    colors: {
      low: '#2ecc71',    // Green
      medium: '#f39c12', // Orange
      high: '#e74c3c'    // Red
    }
  };

  // DOM Elements
  let elements = {};

  // Server cards cache to track changes
  const serverCardsCache = new Map();

  // Formatter functions
  const formatters = {
    // Format bytes to human-readable format
    bytes: function(bytes, decimals = 2) {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
      
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    // Format speed
    speed: function(bytesPerSecond) {
      if (bytesPerSecond < 1024) {
        return bytesPerSecond.toFixed(2) + ' B/s';
      } else if (bytesPerSecond < 1048576) {
        return (bytesPerSecond / 1024).toFixed(2) + ' KB/s';
      } else {
        return (bytesPerSecond / 1048576).toFixed(2) + ' MB/s';
      }
    },
    
    // Format uptime
    uptime: function(seconds) {
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      
      let result = '';
      if (days > 0) result += days + 'd ';
      if (hours > 0 || days > 0) result += hours + 'h ';
      if (minutes > 0 || hours > 0 || days > 0) result += minutes + 'm ';
      result += secs + 's';
      
      return result;
    }
  };

  // Update functions for different metrics
  const updaters = {
    // Update CPU usage
    cpu: function(element, server) {
      const cpuUsage = server.cpuInfo.usage;
      const cpuBar = element.querySelector('.cpu-usage-bar');
      const cpuText = element.querySelector('.cpu-usage-text');
      
      cpuBar.style.width = `${cpuUsage}%`;
      cpuText.textContent = `${cpuUsage.toFixed(1)}%`;
      
      // Update color
      cpuBar.className = 'progress-bar cpu-usage-bar';
      if (cpuUsage < 50) {
        cpuBar.classList.add('low');
      } else if (cpuUsage < 80) {
        cpuBar.classList.add('medium');
      } else {
        cpuBar.classList.add('high');
      }
    },
    
    // Update memory usage
    memory: function(element, server) {
      const memTotal = server.memoryUsage.total;
      const memUsed = server.memoryUsage.used;
      const memFree = server.memoryUsage.free;
      const memUsagePercent = (memUsed / memTotal) * 100;
      
      element.querySelector('.memory-total').textContent = formatters.bytes(memTotal);
      element.querySelector('.memory-used').textContent = formatters.bytes(memUsed);
      element.querySelector('.memory-free').textContent = formatters.bytes(memFree);
      
      const memBar = element.querySelector('.memory-usage-bar');
      const memText = element.querySelector('.memory-usage-text');
      
      memBar.style.width = `${memUsagePercent}%`;
      memText.textContent = `${memUsagePercent.toFixed(1)}%`;
      
      // Update color
      memBar.className = 'progress-bar memory-usage-bar';
      if (memUsagePercent < 50) {
        memBar.classList.add('low');
      } else if (memUsagePercent < 80) {
        memBar.classList.add('medium');
      } else {
        memBar.classList.add('high');
      }
    },
    
    // Update network stats
    network: function(element, server) {
      element.querySelector('.network-rx-speed').textContent = formatters.speed(server.networkTraffic.receiveSpeed);
      element.querySelector('.network-tx-speed').textContent = formatters.speed(server.networkTraffic.sendSpeed);
      element.querySelector('.network-rx-total').textContent = formatters.bytes(server.networkTraffic.bytesReceived);
      element.querySelector('.network-tx-total').textContent = formatters.bytes(server.networkTraffic.bytesSent);
    },
    
    // Update system info
    system: function(element, server) {
      element.querySelector('.uptime').textContent = formatters.uptime(server.uptime);
      element.querySelector('.load-average').textContent = server.loadAverage.map(load => load.toFixed(2)).join(', ');
    },
    
    // Update web server info
    webServer: function(element, server) {
      // Use the frontend server name from config, not backend data
      element.querySelector('.web-server').textContent = config.webServerName;
    }
  };

  // Create a new server card
  function createServerCard(server) {
    const card = document.importNode(elements.serverCardTemplate.content, true);
    const serverCard = document.createElement('div');
    serverCard.className = 'server-card';
    serverCard.dataset.hostname = server.hostname;
    serverCard.appendChild(card);
    
    // Set basic server info
    serverCard.querySelector('.hostname').textContent = server.hostname;
    serverCard.querySelector('.os-type').textContent = server.osType;
    
    // Set CPU model and cores (static info)
    serverCard.querySelector('.cpu-model').textContent = server.cpuInfo.model;
    serverCard.querySelector('.cpu-cores').textContent = server.cpuInfo.cores;
    
    // Initial update of all metrics including web server
    updaters.cpu(serverCard, server);
    updaters.memory(serverCard, server);
    updaters.network(serverCard, server);
    updaters.system(serverCard, server);
    updaters.webServer(serverCard, server);
    
    return serverCard;
  }

  // Update an existing server card
  function updateServerCard(cardElement, server) {
    updaters.cpu(cardElement, server);
    updaters.memory(cardElement, server);
    updaters.network(cardElement, server);
    updaters.system(cardElement, server);
    updaters.webServer(cardElement, server);
  }

  // Process metrics and update/create server cards
  function processMetrics(metrics) {
    const currentHostnames = new Set();
    
    metrics.forEach(server => {
      currentHostnames.add(server.hostname);
      
      // Check if we have a card for this server
      const existingCard = serverCardsCache.get(server.hostname);
      
      if (existingCard) {
        // Update existing card
        updateServerCard(existingCard, server);
      } else {
        // Create new card
        const newCard = createServerCard(server);
        elements.serversContainer.appendChild(newCard);
        serverCardsCache.set(server.hostname, newCard);
      }
    });
    
    // Remove cards for servers that no longer exist
    for (const [hostname, cardElement] of serverCardsCache.entries()) {
      if (!currentHostnames.has(hostname)) {
        elements.serversContainer.removeChild(cardElement);
        serverCardsCache.delete(hostname);
      }
    }
    
    // Update timestamp
    const now = new Date();
    elements.lastUpdated.textContent = `Last updated: ${now.toLocaleTimeString()}`;
  }

  // Fetch metrics from the API
  async function fetchMetrics() {
    try {
      const response = await fetch(config.apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const metrics = await response.json();
      
      // If this is the first load, clear the loading indicator
      if (elements.serversContainer.querySelector('.loading')) {
        elements.serversContainer.innerHTML = '';
      }
      
      processMetrics(metrics);
      return true;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      
      // Only show error if we haven't shown it before
      if (!elements.serversContainer.querySelector('.error')) {
        elements.serversContainer.innerHTML = `
          <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Failed to load server metrics. Please check your connection.</p>
            <p class="error-details">${error.message}</p>
          </div>
        `;
      }
      return false;
    }
  }

  // Initialize the dashboard
  function initDashboard() {
    // Get DOM elements
    elements = {
      serversContainer: document.getElementById('serversContainer'),
      refreshBtn: document.getElementById('refreshBtn'),
      lastUpdated: document.getElementById('lastUpdated'),
      serverCardTemplate: document.getElementById('serverCardTemplate')
    };
    
    // Initial fetch
    fetchMetrics();
    
    // Set up manual refresh button
    elements.refreshBtn.addEventListener('click', fetchMetrics);
    
    // Set up automatic refresh
    let refreshTimer = setInterval(fetchMetrics, config.refreshInterval);
    
    // Reset interval if the page is hidden/visible
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(refreshTimer);
      } else {
        fetchMetrics();
        refreshTimer = setInterval(fetchMetrics, config.refreshInterval);
      }
    });
  }

  // Start dashboard when DOM is ready
  document.addEventListener('DOMContentLoaded', initDashboard);
