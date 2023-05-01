#!/bin/sh
set -e
ssh ubackup@remote.xdax.ru 'rm -rf /home/ubackup/backup-tmp && \
  mkdir -p /home/ubackup/backup-tmp/backup && \
  (
    sqlite3 "/usr/local/var/goatcounter/goatcounter.sqlite3" ".backup /home/ubackup/backup-tmp/backup/goatcounter.sqlite3" || \
    sqlite3 "/usr/local/var/goatcounter/goatcounter.sqlite3" .dump > "/home/ubackup/backup-tmp/backup/goatcounter.sql" || \
    echo "sqlite dump failed" \
  ) && \
  (
    mysqldump --single-transaction --user=daxfb_blueprints --password="password" daxfb_blueprints > "/home/ubackup/backup-tmp/backup/daxfb_blueprints.sql" || \
    echo "mysql dump failed" \
  ) && \
  tar -cjf /home/ubackup/backup-tmp/last_backup.tar.bz2 -C /home/ubackup/backup-tmp backup || \
  exit 1'

mkdir -p /home/ubackup/remote-backups
rsync ubackup@remote.xdax.ru:"/home/ubackup/backup-tmp/last_backup.tar.bz2" "/home/ubackup/remote-backups/$(date +"%Y%m%d_%H%M%S")_remote_backup.tar.bz2"
find /home/ubackup/remote-backups -type f -name '*remote_backup.tar.bz2' -mtime +100 -exec rm {} \;
find /home/ubackup/remote-backups -type f -name '*remote_backup.tar.bz2' -mtime +30 | grep -v '_0000' | xargs -0 -r rm
