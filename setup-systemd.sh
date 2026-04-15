#!/bin/bash

set -e

echo "Setting up systemd services..."

# Create backend service
sudo bash -c 'cat > /etc/systemd/system/techsalesaxis-backend.service << '\''EOF'\''
[Unit]
Description=TechSalesAxis Backend (FastAPI + Gunicorn)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/TechSalesAxis/apps/api
Environment="PATH=/home/ubuntu/TechSalesAxis/apps/api/venv/bin"
ExecStart=/home/ubuntu/TechSalesAxis/apps/api/venv/bin/gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8005 src.main:app
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF'

echo "✓ Backend service file created"

# Create frontend service
sudo bash -c 'cat > /etc/systemd/system/techsalesaxis-frontend.service << '\''EOF'\''
[Unit]
Description=TechSalesAxis Frontend (Next.js)
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/TechSalesAxis/apps/web
Environment="PATH=/home/ubuntu/TechSalesAxis/apps/web/node_modules/.bin:/usr/bin"
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF'

echo "✓ Frontend service file created"

# Reload systemd daemon
sudo systemctl daemon-reload
echo "✓ Systemd daemon reloaded"

# Enable services for auto-start
sudo systemctl enable techsalesaxis-backend
sudo systemctl enable techsalesaxis-frontend
echo "✓ Services enabled for auto-start"

# Start services
sudo systemctl start techsalesaxis-backend
sudo systemctl start techsalesaxis-frontend
echo "✓ Services started"

# Show status
echo ""
echo "=== Backend Service Status ==="
sudo systemctl status techsalesaxis-backend --no-pager

echo ""
echo "=== Frontend Service Status ==="
sudo systemctl status techsalesaxis-frontend --no-pager

echo ""
echo "✓ Setup complete! Services will auto-restart on failure and auto-start on reboot."
