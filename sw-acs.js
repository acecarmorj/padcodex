/* ACE Campo - service worker offline
 * Garante abertura 100% offline somente do INDEX após o primeiro carregamento online.
 * Painel, 007, Laboratório, Secretaria e Supervisão são módulos online e ficam fora do pacote offline do agente.
 */
'use strict';

const ACE_CACHE_VERSION = 'ace-campo-offline-20260519-stable-v65-mapa-icones';
const ACE_CACHE_NAME = ACE_CACHE_VERSION;
const ACE_LEGACY_BRAND_ASSETS = [
  './assets/logo-prefeitura-carmo.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];
const ACE_STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw-acs.js',
  './assets/ace-theme.css',
  './assets/ace-ui-standard.css',
  './assets/runtime-config.js',
  './assets/carmo-territorios-data.js',
  './assets/ruas-carmo-data.js',
  './assets/ace-storage.js',
  './assets/index-core.js',
  './assets/index-render.js',
  './assets/index-actions.js',
  './assets/lgpd-hardening.js',
  './assets/operation-mode.js',
  './assets/liraa-mode.js',
];

function absoluteUrl(path) {
  return new URL(path, self.registration.scope).toString();
}

function getIndexUrl() {
  return absoluteUrl('./index.html');
}

function getScopeUrl() {
  return new URL('./', self.registration.scope).toString();
}

function stripUrlSearch(url) {
  var copy = new URL(url.toString());
  copy.search = '';
  copy.hash = '';
  return copy.toString();
}

function isIndexNavigation(url) {
  var cleanUrl = stripUrlSearch(url);
  return cleanUrl === stripUrlSearch(getScopeUrl()) || cleanUrl === stripUrlSearch(getIndexUrl());
}

function isIndexOfflineAsset(url) {
  var cleanUrl = stripUrlSearch(url);
  return ACE_STATIC_ASSETS.some(function (asset) {
    return cleanUrl === stripUrlSearch(absoluteUrl(asset));
  });
}

function isRuntimeConfigAsset(url) {
  return stripUrlSearch(url) === stripUrlSearch(absoluteUrl('./assets/runtime-config.js'));
}

function deleteLegacyBrandAssets(cache) {
  return Promise.all(ACE_LEGACY_BRAND_ASSETS.map((asset) => {
    return cache.delete(absoluteUrl(asset));
  }));
}

function precacheAsset(cache, asset) {
  const url = absoluteUrl(asset);
  return fetch(url, { cache: 'reload', credentials: 'same-origin' }).then((response) => {
    if (!response || !response.ok) {
      throw new Error('Falha ao baixar asset offline essencial: ' + asset);
    }
    return cache.put(url, response.clone()).then(() => true);
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ACE_CACHE_NAME)
      .then((cache) => Promise.all(ACE_STATIC_ASSETS.map((asset) => precacheAsset(cache, asset))))
      .then(() => self.skipWaiting())
      .catch((error) => caches.delete(ACE_CACHE_NAME).then(() => {
        throw error;
      }))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => {
      if (key.indexOf('ace-campo-offline-') === 0 && key !== ACE_CACHE_NAME) {
        return caches.delete(key);
      }
      return caches.open(key).then(deleteLegacyBrandAssets);
    }))).then(() => self.clients.claim()).then(() => self.clients.matchAll({ includeUncontrolled: true })).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: 'ACE_SW_UPDATED', version: ACE_CACHE_VERSION });
      });
    })
  );
});

function cacheFirst(request) {
  return caches.match(request, { ignoreSearch: true }).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type === 'opaque') {
        return response;
      }
      const copy = response.clone();
      caches.open(ACE_CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => null);
      return response;
    });
  });
}

function networkFirstIndex(request) {
  return fetch(request).then((response) => {
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(ACE_CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => null);
    }
    return response;
  }).catch(() => caches.match(getIndexUrl(), { ignoreSearch: true }));
}

function networkFirstAsset(request) {
  return fetch(request, { cache: 'reload', credentials: 'same-origin' }).then((response) => {
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(ACE_CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => null);
    }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true }));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    if (isIndexNavigation(url)) {
      event.respondWith(networkFirstIndex(request));
    }
    return;
  }

  if (isRuntimeConfigAsset(url)) {
    event.respondWith(networkFirstAsset(request));
    return;
  }

  if (isIndexOfflineAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});
