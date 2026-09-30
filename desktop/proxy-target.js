/* The /_proxy target rule, in one place for the desktop shell.

   https anywhere, http only on loopback.

   Why the exception exists (issue #5): the https rule is there so an API key
   never crosses the network in clear. A loopback target never crosses the
   network — Ollama, LM Studio and llama.cpp all serve plain http on
   127.0.0.1, and demanding https there refused exactly the local-first setup
   this client is built around. Everything that is not loopback still has to
   be https.

   The same rule lives in scripts/serve.py and
   android/app/src/main/java/com/ryza/chat/AssetServer.java; config/layers.json
   (proxyContract) pins the three together so one cannot drift.

   It sits in its own file rather than inline in main.js so a regression can
   exercise it without booting Electron — and desktop/package.json lists it
   explicitly, which scripts/proxy_target_regression.js checks, because a
   missing entry there means a require() failure in the packaged shell only. */
   
'use strict';

function isLoopbackHost(host) {
  const h = String(host || '').replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  for (let i = 1; i <= 4; i++) if (Number(m[i]) > 255) return false;
  return m[1] === '127';
}

function proxyTargetAllowed(target) {
  let u;
  try { u = new URL(String(target || '')); } catch (e) { return false; }
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && isLoopbackHost(u.hostname);
}

module.exports = { isLoopbackHost, proxyTargetAllowed };
