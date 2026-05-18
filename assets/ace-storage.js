(function () {
  'use strict';

  var root = window;
  var store = root.ACEIndexedStore = root.ACEIndexedStore || {};
  var DB_NAME = 'ace_campo_local_v2';
  var STORE_NAME = 'records';
  var DB_VERSION = 1;
  var openPromise = null;

  function clone(value) {
    if (value === undefined) {
      return undefined;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function isSupported() {
    return typeof root.indexedDB !== 'undefined';
  }

  function openDb() {
    if (!isSupported()) {
      return Promise.resolve(null);
    }
    if (openPromise) {
      return openPromise;
    }
    openPromise = new Promise(function (resolve, reject) {
      var request = root.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error || new Error('Falha ao abrir IndexedDB.'));
      };
      request.onblocked = function () {
        reject(new Error('IndexedDB bloqueado.'));
      };
    }).catch(function (error) {
      openPromise = null;
      throw error;
    });
    return openPromise;
  }

  function getRecord(key) {
    if (!isSupported()) {
      return Promise.resolve(undefined);
    }
    return openDb().then(function (db) {
      if (!db) {
        return undefined;
      }
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readonly');
        var objectStore = tx.objectStore(STORE_NAME);
        var request = objectStore.get(String(key || '').trim());
        request.onsuccess = function () {
          var row = request.result;
          resolve(row && Object.prototype.hasOwnProperty.call(row, 'value') ? clone(row.value) : undefined);
        };
        request.onerror = function () {
          reject(request.error || new Error('Falha ao ler IndexedDB.'));
        };
      });
    });
  }

  function putRecord(key, value) {
    if (!isSupported()) {
      return Promise.resolve(false);
    }
    return openDb().then(function (db) {
      if (!db) {
        return false;
      }
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        var objectStore = tx.objectStore(STORE_NAME);
        objectStore.put({
          key: String(key || '').trim(),
          value: clone(value),
          updatedAt: new Date().toISOString()
        });
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          reject(tx.error || new Error('Falha ao gravar IndexedDB.'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('Gravacao abortada no IndexedDB.'));
        };
      });
    });
  }

  function removeRecord(key) {
    if (!isSupported()) {
      return Promise.resolve(false);
    }
    return openDb().then(function (db) {
      if (!db) {
        return false;
      }
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(String(key || '').trim());
        tx.oncomplete = function () {
          resolve(true);
        };
        tx.onerror = function () {
          reject(tx.error || new Error('Falha ao remover do IndexedDB.'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('Remocao abortada no IndexedDB.'));
        };
      });
    });
  }

  function readLegacyJson(keys, fallback) {
    var keyList = Array.isArray(keys) ? keys : [keys];
    var index;
    for (index = 0; index < keyList.length; index += 1) {
      try {
        var raw = root.localStorage.getItem(String(keyList[index] || '').trim());
        if (raw !== null && raw !== undefined && raw !== '') {
          return JSON.parse(raw);
        }
      } catch (error) {}
    }
    return clone(fallback);
  }

  function dropLegacyKeys(keys) {
    var keyList = Array.isArray(keys) ? keys : [keys];
    keyList.forEach(function (key) {
      try {
        root.localStorage.removeItem(String(key || '').trim());
      } catch (error) {}
    });
  }

  function hydrate(definitions) {
    var result = {};
    var logicalKeys = Object.keys(definitions || {});
    if (!logicalKeys.length) {
      return Promise.resolve(result);
    }
    return Promise.all(logicalKeys.map(function (logicalKey) {
      var definition = definitions[logicalKey] || {};
      var storageKey = String(definition.storageKey || logicalKey).trim();
      var legacyKeys = Array.isArray(definition.legacyKeys) && definition.legacyKeys.length
        ? definition.legacyKeys.slice()
        : [storageKey];
      var fallback = clone(definition.fallback);
      return getRecord(storageKey).then(function (value) {
        if (value !== undefined) {
          result[logicalKey] = clone(value);
          if (definition.dropLegacy) {
            dropLegacyKeys(legacyKeys);
          }
          return;
        }
        result[logicalKey] = readLegacyJson(legacyKeys, fallback);
        if (isSupported()) {
          return putRecord(storageKey, result[logicalKey]).catch(function () {
            return false;
          }).then(function () {
            if (definition.dropLegacy) {
              dropLegacyKeys(legacyKeys);
            }
          });
        }
      }).catch(function () {
        result[logicalKey] = readLegacyJson(legacyKeys, fallback);
      });
    })).then(function () {
      return result;
    });
  }

  store.clone = clone;
  store.isSupported = isSupported;
  store.open = openDb;
  store.get = getRecord;
  store.put = putRecord;
  store.remove = removeRecord;
  store.readLegacyJson = readLegacyJson;
  store.dropLegacyKeys = dropLegacyKeys;
  store.hydrate = hydrate;
}());
