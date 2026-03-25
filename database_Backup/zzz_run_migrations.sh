#!/bin/bash
# Run all migration SQL files from the migrations subfolder
echo "Running migration scripts..."
for f in /docker-entrypoint-initdb.d/migrations/*.sql; do
  if [ -f "$f" ]; then
    echo "Executing migration: $f"
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < "$f"
  fi
done
echo "All migrations completed."
