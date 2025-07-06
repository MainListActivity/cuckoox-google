#!/usr/bin/env node
import { buildServiceWorker } from './vite.config.ts';

console.log('🚀 Building Service Worker...');
buildServiceWorker()
  .then(() => {
    console.log('✅ Service Worker built successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Failed to build Service Worker:', err);
    process.exit(1);
  });