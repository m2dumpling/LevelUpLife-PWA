#!/bin/sh
set -e
cd /opt/levelup-life-pwa
echo ">>> Pulling..."
git pull origin main
echo ">>> Building..."
npm run build
echo ">>> Syncing standalone..."
rm -rf .next/standalone/.next/static .next/standalone/public .next/standalone/data 2>/dev/null
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
ln -sf /opt/levelup-life/data .next/standalone/data
echo ">>> Reloading..."
pm2 reload leveluplife-pwa
echo ">>> Done."
pm2 status leveluplife-pwa
