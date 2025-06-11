# Rsync Backup and Restore Documentation

## ✨ Purpose

Securely and correctly backup servers' `/etc` and `/home` folders to another (backup) VM and provide the ability to restore them.

## 📂 Backup with rsync

### ✅ Functionality

* Works from crontab as root user (Can be used as sudo, but strongly advised to run as root)
* Backs up `/etc` and `/home` folders
* Backups are differentiated by server hostname and date
* Suitable for all 4 servers at once

### 📁 Backup-VM preparation

```bash
sudo mkdir -p /backups/app-server /backups/web-server-1 /backups/web-server-2 /backups/load-balancer
sudo chown root:root /backups
sudo chmod 700 /backups
```

### 🚧 SSH key authentication (on each server)

```bash
ssh-keygen -t ed25519
ssh-copy-id root@backup-vm
```

### 📅 Backup script: `/usr/local/bin/weekly-backup.sh`

```bash
#!/bin/bash

REMOTE_HOST="backup-vm"
REMOTE_USER="root"
REMOTE_DIR="/backups"
LOG_FILE="/var/log/weekly-backup.log"
DATE=$(date '+%Y-%m-%d_%H-%M')
HOSTNAME=$(hostname)
TARGET="$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/$HOSTNAME/$DATE"

echo "[$DATE][$HOSTNAME] Backup started" >> "$LOG_FILE"

rsync -aAXv --delete \
  /etc /home \
  "$TARGET" >> "$LOG_FILE" 2>&1

if [ $? -eq 0 ]; then
  echo "[$DATE][$HOSTNAME] Backup completed successfully" >> "$LOG_FILE"
else
  echo "[$DATE][$HOSTNAME] Backup FAILED" >> "$LOG_FILE"
fi
```
To make the file executable use:
```bash
chmod +x /usr/local/bin/weekly-backup.sh
```

### ⌚ Crontab (under root user)

To open crontab use:

```bash
sudo crontab -e
```

Then add:

```cron
0 3 * * 1 /usr/local/bin/weekly-backup.sh
```

## 🛠️ Restore (under root user)

### ✅ Restore script: `/usr/local/bin/restore-backup.sh`

```bash
#!/bin/bash

REMOTE_HOST="backup-vm"
REMOTE_USER="root"
REMOTE_BASEDIR="/backups"
LOCAL_LOG="/var/log/restore-backup.log"

read -p "Enter server name to restore from backup (e.g. server1): " SERVER_NAME
read -p "Enter date from folder (e.g. 2025-06-04_03-00): " BACKUP_DATE

REMOTE_PATH="$REMOTE_USER@$REMOTE_HOST:$REMOTE_BASEDIR/$SERVER_NAME/$BACKUP_DATE"

echo "Restoring from backup: $REMOTE_PATH"
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelling."
  exit 1
fi

echo "[`date '+%Y-%m-%d %H:%M'`] [$SERVER_NAME] Restore started" >> "$LOCAL_LOG"

rsync -aAXv "$REMOTE_PATH/etc/" /etc/ >> "$LOCAL_LOG" 2>&1
rsync -aAXv "$REMOTE_PATH/home/" /home/ >> "$LOCAL_LOG" 2>&1

if [ $? -eq 0 ]; then
  echo "[`date '+%Y-%m-%d %H:%M'`] [$SERVER_NAME] Restore successful" >> "$LOCAL_LOG"
  echo "Restore completed."
else
  echo "[`date '+%Y-%m-%d %H:%M'`] [$SERVER_NAME] Restore FAILED" >> "$LOCAL_LOG"
  echo "Restore failed! Check log: $LOCAL_LOG"
fi
```

To make the file executable use:

```bash
chmod +x /usr/local/bin/restore-backup.sh
```

### 🧾 Usage guide for restore (under root user)

```bash
/usr/local/bin/restore-backup.sh
```

1. Enter the name of the server to backup (e.g. server1)
2. Enter the desired backup date
3. Confirm restore

Log is located at: `/var/log/restore-backup.log`

### ⚠️ Precautions

* Make a backup of the existing `/etc` folder before restore:

```bash
cp -a /etc /etc.backup.before-restore
```

* For testing you can change the target folder in the script from `/etc` to e.g. `/tmp/etc-test/`

## ✋ Root user privileges

### 📛 Why must it be root?

* Without root, rsync cannot correctly preserve permissions, symbolic links, device file metadata, etc.
* `/etc`, `/home` and many files there require root privileges for both reading and writing
* `sudo` may break during restore if `/etc/sudoers` or the sudo package is restored incorrectly

### 👤 How to become root user?

If you have sudo privileges, use:

```bash
sudo -i
```

or

```bash
sudo su -
```

When you're root, the prompt usually changes to end with `#`:

```bash
root@server:~#
```

Then you can run backup or restore scripts:

```bash
/usr/local/bin/weekly-backup.sh
```

## ✉ Log checking


```conf
tail -f /var/log/weekly-backup.log
```

## 🔄 Archive cleanup (if desired)

On the backup server, you can automatically remove old backups, e.g. 30 days old:

```bash
find /backups/*/* -type d -mtime +30 -exec rm -rf {} +
```

This can be added to crontab on the backup server.

---

Done! This solution provides automated, logged and secure backup with restore capability.