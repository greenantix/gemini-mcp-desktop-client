#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SERVICE_NAME = 'linux-helper-daemon';
const homeDir = os.homedir();
const systemdUserDir = path.join(homeDir, '.config', 'systemd', 'user');
const servicePath = path.join(systemdUserDir, `${SERVICE_NAME}.service`);

function stopAndDisableService() {
  console.log('🛑 Stopping and disabling service...');
  
  try {
    // Stop the service
    execSync(`systemctl --user stop ${SERVICE_NAME}.service`, { stdio: 'inherit' });
    console.log('✅ Service stopped');
    
    // Disable the service
    execSync(`systemctl --user disable ${SERVICE_NAME}.service`, { stdio: 'inherit' });
    console.log('✅ Service disabled');
    
    // Reload systemd
    execSync('systemctl --user daemon-reload', { stdio: 'inherit' });
    console.log('✅ Systemd reloaded');
    
  } catch (error) {
    console.warn('⚠️ Could not stop/disable service (may not be running):', error.message);
  }
}

function removeServiceFile() {
  console.log('🗑️ Removing service file...');
  
  if (fs.existsSync(servicePath)) {
    fs.unlinkSync(servicePath);
    console.log(`Removed: ${servicePath}`);
  } else {
    console.log('📝 Service file not found (may already be removed)');
  }
}

function cleanupFiles() {
  console.log('🧹 Cleaning up temporary files...');
  
  // Remove socket file if it exists
  const socketPath = '/tmp/linux-helper.sock';
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
    console.log(`Removed: ${socketPath}`);
  }
  
  // Kill any remaining xbindkeys processes
  try {
    execSync('pkill -f "xbindkeys.*linux-helper"', { stdio: 'ignore' });
    console.log('✅ Cleaned up hotkey processes');
  } catch {
    // Ignore if no processes found
  }
  
  // Remove xbindkeys config
  const xbindkeysConfig = path.join(homeDir, '.xbindkeysrc.linux-helper');
  if (fs.existsSync(xbindkeysConfig)) {
    fs.unlinkSync(xbindkeysConfig);
    console.log(`Removed: ${xbindkeysConfig}`);
  }
}

function askAboutConfig() {
  const configDir = path.join(homeDir, '.config', 'linux-helper');
  
  if (fs.existsSync(configDir)) {
    console.log('');
    console.log('📝 Configuration files found:');
    console.log(`   ${configDir}`);
    console.log('');
    console.log('💡 These files contain your settings and logs.');
    console.log('   To remove them manually:');
    console.log(`   rm -rf "${configDir}"`);
    console.log('');
    console.log('   To keep them for future use, leave them as they are.');
  }
}

function checkIfRunning() {
  try {
    const output = execSync(`systemctl --user is-active ${SERVICE_NAME}.service 2>/dev/null || echo "inactive"`, 
                           { encoding: 'utf8' }).trim();
    return output === 'active';
  } catch {
    return false;
  }
}

function main() {
  console.log('🤖 Linux Helper Daemon - Service Uninstallation');
  console.log('==============================================');
  
  if (os.platform() !== 'linux') {
    console.error('❌ This service is only supported on Linux');
    process.exit(1);
  }
  
  const isRunning = checkIfRunning();
  if (isRunning) {
    console.log('🟡 Service is currently running');
  } else {
    console.log('🔴 Service is not running');
  }
  
  stopAndDisableService();
  removeServiceFile();
  cleanupFiles();
  askAboutConfig();
  
  console.log('');
  console.log('🎉 Uninstallation complete!');
  console.log('');
  console.log('The Linux Helper daemon has been removed from your system.');
  console.log('You can reinstall it anytime by running: npm run install-service');
}

if (require.main === module) {
  main();
}