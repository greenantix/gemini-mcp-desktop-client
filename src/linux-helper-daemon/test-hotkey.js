#!/usr/bin/env node

// Simple test script to verify hotkey registration works
const { HotkeyManager } = require('./dist/hotkey-manager');
const { Logger } = require('./dist/logger');

async function testHotkey() {
  console.log('🔥 Testing Linux Helper Hotkey Registration');
  console.log('=========================================');
  
  const logger = new Logger('debug', false);
  const hotkeyManager = new HotkeyManager('F10', logger);
  
  console.log('🎯 Setting up hotkey callback...');
  hotkeyManager.onHotkeyPress(() => {
    console.log('🚀 HOTKEY TRIGGERED! F10 was pressed');
    console.log('This would normally:');
    console.log('  1. Capture a screenshot');
    console.log('  2. Analyze it with AI');
    console.log('  3. Show popup with suggestions');
  });
  
  try {
    console.log('🔧 Registering F10 hotkey...');
    await hotkeyManager.register();
    
    console.log('✅ Hotkey registered successfully!');
    console.log('');
    console.log('🎮 Press F10 to test the hotkey (Ctrl+C to exit)');
    console.log('');
    
    // Keep the process running to listen for hotkeys
    process.on('SIGINT', async () => {
      console.log('\n🗱️ Cleaning up...');
      await hotkeyManager.unregister();
      console.log('✅ Hotkey unregistered');
      process.exit(0);
    });
    
    // Simulate hotkey trigger every 10 seconds for testing
    let testCount = 0;
    const testInterval = setInterval(async () => {
      testCount++;
      console.log(`🧪 Test trigger ${testCount} (simulating F10 press)`);
      await hotkeyManager.triggerHotkey();
      
      if (testCount >= 3) {
        console.log('🏁 Test complete! Press Ctrl+C to exit.');
        clearInterval(testInterval);
      }
    }, 10000);
    
  } catch (error) {
    console.error('❌ Failed to register hotkey:', error.message);
    console.log('');
    console.log('💡 This might happen if:');
    console.log('  - xbindkeys is not installed (sudo apt install xbindkeys)');
    console.log('  - You are not in a graphical session');
    console.log('  - Another application is using the F10 key');
    process.exit(1);
  }
}

if (require.main === module) {
  testHotkey();
}