const express = require('express');

const app = express();

// Test each route pattern individually
const testRoutes = [
  '/search/:query',
  '/:username',
  '/:username/followers',
  '/:username/following',
  '/:username/follow',
  '/:id',
  '/:id/like',
  '/:id/comments',
  '/user/:username',
  '/video',
  '/thumbnail/:videoId',
  '/progress/:uploadId'
];

console.log('Testing route patterns...');

testRoutes.forEach((route, index) => {
  try {
    const router = express.Router();
    router.get(route, (req, res) => res.send('test'));
    console.log(`✅ Route ${index + 1}: ${route} - OK`);
  } catch (error) {
    console.log(`❌ Route ${index + 1}: ${route} - ERROR:`, error.message);
  }
});

console.log('Route testing completed.'); 