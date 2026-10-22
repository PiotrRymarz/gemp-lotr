#!/bin/bash
# Starts a local Gemp server for mobile client development, in a Linux environment where you are root
# (for example a Claude Code cloud session). Not for production.
#
#   1. MariaDB in Docker with the Gemp schema and the test users from docker/initial_user_setup.sql
#   2. The web and cards folders bind-mounted where gemp-lotr.properties expects them (/etc/gemp-lotr/...)
#   3. "db" pointed at localhost, then the server built with Maven and started on port 80
#
# Open http://localhost/gemp-lotr/ afterwards. Log: $LOG_DIR/server.log
set -e

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
GEMP="$REPO/gemp-lotr"
LOG_DIR="${LOG_DIR:-/tmp/gemp-dev}"
mkdir -p "$LOG_DIR/dbinit"

if ! docker ps > /dev/null 2>&1; then
    echo "Starting Docker daemon..."
    (dockerd > "$LOG_DIR/dockerd.log" 2>&1 &)
    for i in $(seq 1 30); do docker ps > /dev/null 2>&1 && break; sleep 1; done
fi

if ! docker ps -a --format '{{.Names}}' | grep -q '^gemp_db$'; then
    echo "Creating database container..."
    cp "$GEMP/database_script.sql" "$GEMP/docker/initial_user_setup.sql" "$LOG_DIR/dbinit/"
    docker run -d --name gemp_db -p 3306:3306 \
        -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=gemp_db \
        -e MYSQL_USER=gempuser -e MYSQL_PASSWORD=gemppassword \
        -v "$LOG_DIR/dbinit:/docker-entrypoint-initdb.d:ro" mariadb:10.5
else
    docker start gemp_db > /dev/null
fi

# A symlink would not do: the server refuses files whose real path is outside web.path
for dir in web:gemp-lotr-async/src/main/web gemp-lotr-cards:gemp-lotr-cards; do
    target="/etc/gemp-lotr/${dir%%:*}"
    mkdir -p "$target"
    mountpoint -q "$target" || mount --bind "$GEMP/${dir#*:}" "$target"
done
mkdir -p /etc/gemp-lotr/replay
grep -q " db$" /etc/hosts || echo "127.0.0.1 db" >> /etc/hosts

echo "Waiting for the database..."
for i in $(seq 1 60); do
    docker exec gemp_db mysql -ugempuser -pgemppassword gemp_db -e "select 1" > /dev/null 2>&1 && break
    sleep 1
done

if [ ! -f "$GEMP/gemp-lotr-async/target/web.jar" ] || [ "$1" == "--build" ]; then
    echo "Building the server (several minutes the first time)..."
    (cd "$GEMP" && mvn -q -B install -DskipTests)
fi

echo "Starting the server..."
(cd "$GEMP/gemp-lotr-async" && nohup java -jar target/web.jar > "$LOG_DIR/server.log" 2>&1 &)
echo "Server starting: http://localhost/gemp-lotr/ (log: $LOG_DIR/server.log)"
