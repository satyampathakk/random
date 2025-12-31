#!/bin/bash

# SSL Certificate Generator for randomchats.in
# Run this script on your server after pointing DNS to your server IP

DOMAIN="randomchatt.com"
EMAIL="admin@randomchatt.com"  # Change this to your email

echo "=========================================="
echo "SSL Certificate Setup for $DOMAIN"
echo "=========================================="

# Create required directories
mkdir -p ./certbot/conf
mkdir -p ./certbot/www

# Check if certificates already exist
if [ -d "./certbot/conf/live/$DOMAIN" ]; then
    echo "Certificates already exist. To renew, run:"
    echo "docker compose run --rm certbot renew"
    exit 0
fi

echo ""
echo "Step 1: Starting Nginx for domain verification..."
docker compose up -d nginx

echo ""
echo "Step 2: Requesting SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "SUCCESS! SSL Certificate installed!"
    echo "=========================================="
    echo ""
    echo "Now restart with HTTPS enabled:"
    echo "  docker compose down"
    echo "  docker compose up -d"
    echo ""
    echo "Your site will be available at:"
    echo "  https://$DOMAIN"
    echo ""
    echo "Certificate auto-renewal is configured."
else
    echo ""
    echo "=========================================="
    echo "ERROR: Certificate generation failed!"
    echo "=========================================="
    echo ""
    echo "Make sure:"
    echo "1. DNS for $DOMAIN points to this server"
    echo "2. Ports 80 and 443 are open"
    echo "3. No other service is using port 80"
fi
