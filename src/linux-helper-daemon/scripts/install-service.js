#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SERVICE_NAME = 'linux-helper-daemon';
const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'linux-helper');
const systemdUserDir = path.join(homeDir, '.config', 'systemd', 'user');

function createDirectories() {
  console.log('📁 Creating configuration directories...');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`Created: ${configDir}`);
  }
  
  if (!fs.existsSync(systemdUserDir)) {
    fs.mkdirSync(systemdUserDir, { recursive: true });
    console.log(`Created: ${systemdUserDir}`);
  }
}

function createDefaultConfig() {
  const configPath = path.join(configDir, 'daemon.json');
  
  if (!fs.existsSync(configPath)) {
    console.log('⚙️ Creating default configuration...');
    
    const defaultConfig = {
      port: 3847,
      socketPath: '/tmp/linux-helper.sock',
      logLevel: 'info',
      hotkey: 'F10',
      popupTheme: 'dark',
      autoStart: true
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`Created: ${configPath}`);
  } else {
    console.log('✅ Configuration file already exists');
  }
}

function createSystemdService() {
  console.log('🔧 Creating systemd service...');
  
  const daemonPath = path.resolve(__dirname, '..', 'main.js');
  const servicePath = path.join(systemdUserDir, `${SERVICE_NAME}.service`);
  
  const serviceContent = `[Unit]
Description=Linux Helper Daemon - AI-powered development assistant
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/node "${daemonPath}"
Restart=always
RestartSec=5
Environment=DISPLAY=:0
Environment=HOME=${homeDir}
Environment=XDG_RUNTIME_DIR=/run/user/%i
WorkingDirectory=${path.dirname(daemonPath)}
User=%i
Group=%i

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=${configDir}
ReadWritePaths=/tmp

# Resource limits
MemoryMax=100M
CPUQuota=50%

[Install]
WantedBy=default.target
`;
  
  fs.writeFileSync(servicePath, serviceContent);
  console.log(`Created: ${servicePath}`);
  
  return servicePath;
}

function enableAndStartService() {
  console.log('🚀 Enabling and starting service...');
  
  try {
    // Reload systemd user daemon
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    
    // Enable the service
    execSync(`systemctl --user enable ${SERVICE_NAME}.service`, { stdio: 'inherit' });
    
    // Start the service
    execSync(`systemctl --user start ${SERVICE_NAME}.service`, { stdio: 'inherit' });
    
    console.log('✅ Service installed and started successfully!');
    console.log('');
    console.log('🔍 Check service status with:');
    console.log(`   systemctl --user status ${SERVICE_NAME}`);
    console.log('');
    console.log('📋 View logs with:');
    console.log(`   journalctl --user -f -u ${SERVICE_NAME}`);
    console.log('');
    console.log('🛑 Stop service with:');
    console.log(`   systemctl --user stop ${SERVICE_NAME}`);
    
  } catch (error) {
    console.error('❌ Failed to enable/start service:', error.message);
    console.log('');
    console.log('💡 You can try manually:');
    console.log('   systemctl --user daemon-reload');
    console.log(`   systemctl --user enable ${SERVICE_NAME}.service`);
    console.log(`   systemctl --user start ${SERVICE_NAME}.service`);
    process.exit(1);
  }
}

function checkPrerequisites() {
  console.log('🔍 Checking prerequisites...');
  
  // Check if we're on Linux
  if (os.platform() !== 'linux') {
    console.error('❌ This service is only supported on Linux');
    process.exit(1);
  }
  
  // Check if systemd is available
  try {
    execSync('which systemctl', { stdio: 'ignore' });
    console.log('✅ systemd is available');
  } catch {
    console.error('❌ systemd is not available on this system');
    process.exit(1);
  }
  
  // Check if Node.js is available
  try {
    execSync('which node', { stdio: 'ignore' });
    console.log('✅ Node.js is available');
  } catch {
    console.error('❌ Node.js is not available. Please install Node.js first.');
    process.exit(1);
  }
  
  // Check if the daemon script exists
  const daemonPath = path.resolve(__dirname, '..', 'main.js');
  if (!fs.existsSync(daemonPath)) {
    console.error(`❌ Daemon script not found: ${daemonPath}`);
    console.log('💡 Make sure to build the project first: npm run build');
    process.exit(1);
  }
  console.log('✅ Daemon script found');
}

function main() {
  console.log('🤖 Linux Helper Daemon - Service Installation');
  console.log('============================================');
  
  checkPrerequisites();
  createDirectories();
  createDefaultConfig();
  createSystemdService();
  enableAndStartService();
  
  console.log('');
  console.log('🎉 Installation complete!');
  console.log('');
  console.log('The Linux Helper daemon is now running and will start automatically on boot.');
  console.log(`Press ${process.env.HOTKEY || 'F10'} to trigger screenshot analysis.`);
}

if (require.main === module) {
  main();
}