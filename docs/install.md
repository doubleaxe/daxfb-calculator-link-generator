# Install instructions

This document is a hint for future myself about how to install `goatcounter` and `daxfb-calculator-link-generator` on fresh debian server. I wrote this while configuring fresh Debian 11 ("bullseye") VPS server, logging every command I executed and every file I changed. Of course I could use docker, but this VPS is cheap and low on resources, so I decided to go native.

Below steps also contain commands and files executed on separate (home) backup server and ssh client. To distinguish them, I will mark VPS server as `remote` and backup server as `local`.

## Remote

```
apt update
apt upgrade
reboot
apt autoremove


apt install locales
dpkg-reconfigure locales
locale-gen
en_US.UTF-8


apt install mc
groupadd -g 800 sysadmin
useradd -g sysadmin -m -s /bin/bash -u 800 sysadmin
passwd sysadmin
usermod -aG sudo sysadmin
apt install sudo
```

## Local, generating access keys

```
#ssh-keygen -t ed25519 -C "aousov-private" -f aousov-private.key
ssh-keygen -t rsa -b 4096 -C "aousov-private" -f aousov-private.key
cp aousov-private.key aousov-private.ssh
ssh-keygen -p -m pem -f aousov-private.ssh
```

## Remote

```
su sysadmin
mkdir -p ~/.ssh
cat aousov-private.key.pub >> ~/.ssh/authorized_keys
exit


mcedit /etc/ssh/sshd_config

***
ChallengeResponseAuthentication no
PasswordAuthentication no
UsePAM no
PermitRootLogin no
***
systemctl reload ssh


mcedit /etc/hostname
`xdax-remote`
mcedit /etc/hosts
`127.0.0.1 xdax-remote`


apt install ufw
ufw allow 22
ufw allow 80,443/tcp
ufw enable
ufw status
mcedit /etc/rsyslog.d/20-ufw.conf
***
& stop
***
systemctl restart rsyslog


curl -s -L https://github.com/go-acme/lego/releases/download/v4.10.2/lego_v4.10.2_linux_amd64.tar.gz | tar xvz -C /usr/local/bin --wildcards lego
lego --accept-tos --email="dax@xdax.ru" -d="remote.xdax.ru" -d="analytics.xdax.ru" -d="daxfb-blueprints.xdax.ru" -d="lbc.xdax.ru" --http --http.port :80 --path /etc/ssl/.lego run
echo '30 0 * * * root (/usr/local/bin/lego --accept-tos --email="dax@xdax.ru" -d="remote.xdax.ru" -d="analytics.xdax.ru" -d="daxfb-blueprints.xdax.ru" -d="lbc.xdax.ru" --http --http.webroot "/usr/share/nginx/html" --path /etc/ssl/.lego renew --renew-hook="service nginx force-reload" >> /var/log/lego.log 2>&1)' > /etc/cron.d/lego-renew
mkdir -p /usr/share/nginx/html
service cron reload


apt install curl gnupg2 ca-certificates lsb-release debian-archive-keyring
curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor | sudo tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null
gpg --dry-run --quiet --no-keyring --import --import-options import-show /usr/share/keyrings/nginx-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/debian `lsb_release -cs` nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
apt update
apt-cache policy nginx
apt install nginx=1.24.0-1~bullseye


mcedit /etc/nginx/nginx.conf
***
worker_connections  256;
http {
  server_tokens off;
  error_log /var/log/nginx/error.log;
  tcp_nopush on;
  tcp_nodelay on;
  gzip  on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
***

mcedit /etc/nginx/conf.d/proxy_params.conf
***
proxy_redirect off;
proxy_set_header Host $http_host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
***

mcedit /etc/nginx/conf.d/ssl.conf
***
ssl_session_cache   shared:SSL:1m;
ssl_certificate /etc/ssl/.lego/certificates/remote.xdax.ru.crt;
ssl_certificate_key /etc/ssl/.lego/certificates/remote.xdax.ru.key;
***

mcedit /etc/nginx/conf.d/default.conf
***
server {
  listen       80 default_server;

  location ^~ /.well-known/ {
    root /usr/share/nginx/html;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen       443 ssl;
  server_name
    analytics.xdax.ru
    lbc.xdax.ru
    ;

  location ~ ^/(.*) {
    set $upstream http://127.0.0.1:8081/$1;
    proxy_pass $upstream$is_args$args;
    proxy_cookie_flags ~ secure samesite=strict;
  }
}

server {
  listen       443 ssl;
  server_name
    daxfb-blueprints.xdax.ru
    ;

  location ~ ^/(.*) {
    set $upstream http://127.0.0.1:8082/$1;
    proxy_pass $upstream$is_args$args;
  }
}
***

systemctl enable nginx
systemctl start nginx


curl -s -L https://github.com/arp242/goatcounter/releases/download/v2.4.1/goatcounter-v2.4.1-linux-amd64.gz | gunzip > /usr/local/bin/goatcounter-v2.4.1-linux-amd64
chmod 755 /usr/local/bin/goatcounter-v2.4.1-linux-amd64
ln -s /usr/local/bin/goatcounter-v2.4.1-linux-amd64 /usr/local/bin/goatcounter

#goatcounter db create site -db "sqlite+/usr/local/var/goatcounter/goatcounter.sqlite3" -vhost lbc.xdax.ru -user.email="dax@xdax.ru"
#goatcounter db update user -site analytics.xdax.ru -email dax@xdax.ru -db "sqlite+/usr/local/var/goatcounter/goatcounter.sqlite3"
#goatcounter db create user -site analytics.xdax.ru -email dax@xdax.ru -db "sqlite+/usr/local/var/goatcounter/goatcounter.sqlite3" -access superuser


mcedit /usr/local/bin/goatcounter-serve
***
#!/bin/sh
exec /usr/local/bin/goatcounter serve -db "sqlite+/usr/local/var/goatcounter/goatcounter.sqlite3" -listen 127.0.0.1:8081 -tls http $@ >> /var/log/goatcounter.log 2>&1
***
chmod 755 /usr/local/bin/goatcounter-serve


mcedit /etc/systemd/system/goatcounter.service
***
# /etc/systemd/system/goatcounter.service
# Description of what the program does
[Unit]
Description=GoatCounter

[Service]
Type=simple
# If anything unexpected happens, Systemd will try to restart the program
Restart=always
# We need to send the absolute path of the database to GoatCounter.
ExecStart=/usr/bin/env /usr/local/bin/goatcounter-serve

[Install]
WantedBy=multi-user.target
***
```

## Local, existing db migration

```
systemctl stop goatcounter
systemctl disable goatcounter
tar -cjf goatcounter.tar.bz2 -C /usr/local/var/goatcounter .
```

## Remote

```
mkdir -p /usr/local/var/goatcounter
curl https://home.xdax.ru/goatcounter.tar.bz2 -O
tar -xvf goatcounter.tar.bz2 -C /usr/local/var/goatcounter


systemctl enable goatcounter
systemctl start goatcounter
systemctl status goatcounter
```

## Remote

```
sudo su -
apt install mariadb-server
mysql_secure_installation
<enter>
n
n
y
y
y
y

mariadb
GRANT ALL ON *.* TO 'admin'@'localhost' IDENTIFIED BY 'password' WITH GRANT OPTION;
CREATE DATABASE daxfb_blueprints;
SHOW DATABASES;
CREATE USER 'daxfb_blueprints'@'localhost' IDENTIFIED BY 'password';
SELECT user FROM mysql.user;
GRANT ALL ON daxfb_blueprints.* TO 'daxfb_blueprints'@'localhost';
SHOW GRANTS FOR 'daxfb_blueprints'@'localhost';
FLUSH PRIVILEGES;
exit

systemctl status mariadb

mcedit /etc/mysql/mariadb.conf.d/50-server.cnf
***
[mysqld]
performance_schema = off
key_buffer_size = 16M
tmp_table_size = 1M
innodb_buffer_pool_size = 8M #1M
innodb_log_buffer_size = 8M #1M
max_connections = 25
sort_buffer_size = 512K
read_buffer_size = 256K
read_rnd_buffer_size = 512K
join_buffer_size = 128K
thread_stack = 196K
***

systemctl restart mariadb
systemctl status mariadb

curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node --version
npm i -g pnpm
pnpm -v
```

## Local, setting up backup

```
apt install rsync
#groupadd -g 801 backup
useradd -g backup -m -s /bin/bash -u 801 ubackup
su ubackup
ssh-keygen -t ed25519 -C "backup"
cat /home/ubackup/.ssh/id_ed25519.pub
#ssh-keygen -t rsa -b 2048 -C "backup-rsa"
#cat /home/ubackup/.ssh/id_rsa.pub
touch /var/log/backup.log
chown ubackup:backup /var/log/backup.log
chmod 664 /var/log/backup.log
```

## Remote

```
apt install rsync
#groupadd -g 801 backup
useradd -g backup -m -s /bin/bash -u 801 ubackup
passwd ubackup
su ubackup
mcedit ~/id_ed25519.pub
#mcedit ~/id_rsa.pub
mkdir -p ~/.ssh
cat ~/id_ed25519.pub >> ~/.ssh/authorized_keys
#cat ~/id_rsa.pub >> ~/.ssh/authorized_keys
exit
```

## Local, setting up backup

```
su ubackup
mcedit ~/backup.sh
*** paste backup/backup.sh ***

mcedit ~/backup-cron.sh
***
#!/bin/sh
if (/home/ubackup/backup.sh >> /var/log/backup.log 2>&1) ; then
  echo "$(date +'%Y%m%d_%H%M%S') backup success" >> /var/log/backup.log
else
  echo "$(date +'%Y%m%d_%H%M%S') backup failed" >> /var/log/backup.log
fi
***

chmod 755  ~/backup.sh
chmod 755  ~/backup-cron.sh
echo '0 */6 * * * ubackup /home/ubackup/backup-cron.sh' > /etc/cron.d/remote-backup
service cron reload
```
