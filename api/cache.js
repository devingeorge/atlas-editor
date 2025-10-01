const NodeCache = require('node-cache');

let cache;

function initializeCache() {
  const ttl = parseInt(process.env.CACHE_TTL_SECONDS) || 300; // 5 minutes default
  
  cache = new NodeCache({
    stdTTL: ttl,
    checkperiod: ttl * 0.2,
    useClones: false,
  });

  cache.on('set', (key, value) => {
    console.log(`Cache SET: ${key}`);
  });

  cache.on('del', (key, value) => {
    console.log(`Cache DEL: ${key}`);
  });

  console.log('✅ Cache initialized');
}

function get(key) {
  return cache ? cache.get(key) : undefined;
}

function set(key, value, ttl) {
  if (cache) {
    return cache.set(key, value, ttl);
  }
  return false;
}

function del(key) {
  if (cache) {
    return cache.del(key);
  }
  return false;
}

function flush() {
  if (cache) {
    return cache.flushAll();
  }
  return false;
}

function keys() {
  return cache ? cache.keys() : [];
}

// Cache key generators
const CacheKeys = {
  user: (slackUserId) => `user:${slackUserId}`,
  users: () => 'users:all',
  profileFields: () => 'profile_fields:all',
  orgChart: () => 'org_chart:tree',
  draftChanges: (actorId) => `draft_changes:${actorId}`,
};

module.exports = {
  initializeCache,
  get,
  set,
  del,
  flush,
  keys,
  CacheKeys,
};
