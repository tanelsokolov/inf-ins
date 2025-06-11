# Infrastructure Insight Deployment Tutorial 🧐

## Overview

This tutorial guides you through deploying a containerized diagnostic application across a multi-server infrastructure. The application displays key infrastructure metrics and demonstrates load balancing, containerization, and server communication concepts.

## Architecture Overview

The setup consists of:
- **Application Server**: Hosts the backend container
- **Web Server 1 & 2**: Host frontend containers  
- **Load Balancer**: Distributes traffic using Nginx (bare metal installation)
- **Backup Server**: Handles automated backups 

## Prerequisites

- 5 Ubuntu virtual machines (app server, 2 web servers, load balancer, backup vm) with assigned IP's
- Root or sudo access on all servers
- Network connectivity between all servers
- Basic understanding of Docker and Nginx

## Step 1: Docker Installation on Application and Web Servers

Execute these commands on **all servers** (to prepare for containers):

### Add Docker's Official GPG Key
```bash
sudo apt-get update
sudo apt-get install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

### Add Docker Repository
```bash
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
```

### Install Docker
```bash
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Test Docker Installation
```bash
sudo docker run hello-world
```

### Verify Installation
```bash
docker --version
```

## Step 2: VPN Setup (WireGuard) 🔐

Install WireGuard on all VMs:

```bash
sudo apt install wireguard
```

Generate private and public keys for each VM:

```bash
wg genkey | tee privatekey | wg pubkey > publickey
chmod 600 privatekey
```

View the keys:

```bash
cat privatekey
cat publickey
```

Configure WireGuard for each VM:

```bash
sudo nano /etc/wireguard/wg0.conf
```

The Interface section changes for each VM. Example configuration for VM1 (App Server):
```bash
[Interface]
Address = 10.0.0.1/24
PrivateKey = <VM1_PrivateKey>
ListenPort = 51820

[Peer]
PublicKey = <VM2_PublicKey>
AllowedIPs = 10.0.0.2/32
Endpoint = 192.168.189.102:51820
PersistentKeepalive = 25

[Peer]
PublicKey = <VM3_PublicKey>
AllowedIPs = 10.0.0.3/32
Endpoint = 192.168.189.103:51820
PersistentKeepalive = 25

[Peer]
PublicKey = <VM4_PublicKey>
AllowedIPs = 10.0.0.4/32
Endpoint = 192.168.189.104:51820
PersistentKeepalive = 25

[Peer]
PublicKey = <VM5_PublicKey>
AllowedIPs = 10.0.0.5/32
Endpoint = 192.168.189.105:51820
PersistentKeepalive = 25
```

Start and enable WireGuard:

```bash
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
```

NB! We are setting up each server as WG hub during development, as creating only one hub would mean single point of failure and said server would have to run all of the time.\
During production you could create a different HUB/server where all traffic is directed to. 

## Step 3: Application File Deployment

### Backend Files (Application Server)
- Copy backend application files to `/metrics-backend` directory on the application server


### Frontend Files (Web Servers)
- Copy frontend application files to `/metrics-frontend` directory on both web servers
- Configure frontend-backend communication
- Open `dashboard.js` file in the frontend directory
- Change the backend API IP to match your application server VPN IP (10.0.0.1 by default)

## Step 4: Firewall Configuration

Configure firewall rules on each server to allow necessary traffic:

### Application Server
```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw enable
sudo ufw status
```
Our backend container ports are being opened by docker.

### Web Server 1 & 2
```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw enable
sudo ufw status
```
Our frontend container ports are being opened by docker.

### Load Balancer
```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 19999/tcp comment 'NetData dashboard'
sudo ufw enable
sudo ufw status
```

### Backup Server
```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 51820/udp comment 'WireGuard VPN'
sudo ufw enable
sudo ufw status
```

### Verify Firewall Status
```bash
sudo ufw status verbose
```

## Step 5: Load Balancer Setup (Bare Metal Nginx)

### Install Nginx on Load Balancer Server
```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx Load Balancer & Reverse Proxy for App server
Create the load balancer configuration:
```bash
sudo nano /etc/nginx/sites-available/load_balancer
```

Add the following configuration:
```nginx
upstream metrics_servers {
    server 10.0.0.1:3000; # app-server VPN IP
}

upstream frontend_servers {
    least_conn;
    server 10.0.0.2:5173; # web-server-1 VPN IP
    server 10.0.0.3:5173; # web-server-2 VPN IP
}

server {
    listen 80;

    location /metrics {
        proxy_pass http://metrics_servers/metrics;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://frontend_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```


### Enable the Configuration
```bash
sudo ln -s /etc/nginx/sites-available/load_balancer /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 6: Docker Container Deployment

#### Start Backend Container (Application Server)
```bash
cd /metrics-backend
sudo docker compose up -d
```

#### Start Frontend Container (Web Server 1)
```bash
cd /metrics-frontend
sudo docker compose up -d
```

#### Start Frontend Container (Web Server 2)
```bash
cd /metrics-frontend
sudo docker compose up -d
```

## Step 7: Verification and Testing

### Check Container Status
On each server, verify containers are running:
```bash
sudo docker compose ps
```

### Test VPN Connectivity
Test VPN connection between servers:
```bash
ping 10.0.0.1  # From any server to app server
ping 10.0.0.2  # To web server 1
ping 10.0.0.3  # To web server 2
ping 10.0.0.4  # To load balancer
```

### Test Application Access
Test the application through the load balancer:
```bash
curl http://10.0.0.4  # Load balancer VPN IP
curl http://10.0.0.4/metrics
curl -I http://10.0.0.4  # Check headers for server identification
```

### Verify Load Balancing
Refresh the application multiple times and confirm responses alternate between web servers by checking response headers or page content.

## Step 8: Monitoring and Logs

### Check Container Logs
```bash
sudo docker compose logs
```

### Monitor Container Performance
```bash
sudo docker stats
```

### Check Nginx Status and Logs
```bash
# Check if nginx is running
sudo systemctl status nginx

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Test nginx configuration
sudo nginx -t
```

## Step 9: Brute-Force Attack Protection (Fail2Ban) 🚨

Install and configure Fail2Ban to protect against brute-force attacks:

```bash
sudo apt install fail2ban
sudo systemctl enable --now fail2ban
```

Create a `jail.local` file to avoid overwriting the default configuration:

```bash
sudo nano /etc/fail2ban/jail.local
```

Add the following configuration:

```bash
[DEFAULT]
# Ignore the IP addresses of your local machine to avoid banning yourself during testing, commented out for testing
#ignoreip = 127.0.0.1/8 ::1 your-ip-address

# Ban settings
bantime  = 60  # 1 minute ban time (in seconds), for testing
findtime = 600  # Time window for detecting failed login attempts (in seconds)
maxretry = 3    # Number of failed login attempts before banning

# Log level for Fail2Ban logs
loglevel = INFO

# Whether to send email notifications on bans (not needed for learning purposes, can be disabled)
# destemail = your-email@example.com
# action = %(action_mwl)s

[sshd]
enabled  = true
port     = ssh
logpath  = /var/log/auth.log
maxretry = 3
```

Restart the Fail2Ban service:

```bash
sudo systemctl restart fail2ban
```

Check the status of Fail2Ban:

```bash
sudo fail2ban-client status sshd
```

## Step 10: Additional Monitoring System (NetData) 📊

If you wish, you can install additional monitoring system. Install NetData for server monitoring:

```bash
curl https://get.netdata.cloud/kickstart.sh > /tmp/netdata-kickstart.sh && sh /tmp/netdata-kickstart.sh
```

Configure a Multinode setup. On the parent node (I chose load balancer), generate an API key:

```bash
uuidgen
```

Edit the `stream.conf` file:

```bash
cd /etc/netdata 2>/dev/null || cd /opt/netdata/etc/netdata
sudo ./edit-config stream.conf
```

```bash
[api-key] # Use your own api key
enabled = yes
```

On child nodes, edit the `stream.conf` file:

```bash
cd /etc/netdata 2>/dev/null || cd /opt/netdata/etc/netdata
sudo ./edit-config stream.conf
```

Under the `[stream]` section, configure the connection to the parent node:

```bash
[stream]
    enabled = yes
    destination = 10.0.0.4:19999  # Load balancer VPN IP
    api key = Your-Api-Parent-Key
```

Restart the NetData service:

```bash
sudo systemctl restart netdata
```

## Load Balancing Algorithm: Round Robin

The currently used **Round Robin** algorithm was selected because:

- **Equal Server Capacity**: All web servers have identical specifications, so simple rotation works effectively.
- **Straightforward Distribution**: Requests are distributed sequentially across servers, ensuring even traffic under consistent load.
- **Simple and Reliable**: Ideal for applications where request processing times are roughly similar.
- **Built-in Nginx Support**: Nginx uses Round Robin by default, requiring no extra configuration or modules.

Although **Least Connection** can offer better performance under uneven or variable load, Round Robin remains sufficient due to the uniform server specs and predictable request patterns.

## Rsync Backup Setup

If you wish to setup Rsync backup continue to this file:
[Rsync Backup Setup](Rsync_backup.md)

## Troubleshooting

### Common Issues

1. **Container Won't Start**
   - Check Docker logs: `sudo docker compose logs`
   - Verify port conflicts: `sudo netstat -tulpn`
   - Check firewall rules: `sudo ufw status`

2. **Load Balancer Returns 502/503**
   - Verify backend containers are running
   - Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
   - Verify VPN connectivity between load balancer and frontend servers
   - Test Nginx configuration: `sudo nginx -t`

3. **Frontend Can't Reach Backend**
   - Verify VPN connectivity between servers
   - Check firewall rules allow inter-server communication via VPN
   - Confirm backend API endpoints are accessible

### Health Checks
```bash
# Check container status
sudo docker compose ps

# Check container health
sudo docker compose logs

# Test nginx configuration
sudo nginx -t
```


### Useful Docker Compose Commands
```bash
# Start services
sudo docker compose up -d

# Stop services
sudo docker compose down

# Restart services
sudo docker compose restart

# View logs
sudo docker compose logs -f

# Check status
sudo docker compose ps

# Rebuild and restart
sudo docker compose up -d --build
```

## Conclusion

You now have a fully functional containerized application deployed across multiple servers with load balancing and VPN connectivity. The infrastructure demonstrates key DevOps concepts including containerization, service orchestration, network security, and high availability design.
