/**
 * Agora v007 Token Builder
 *
 * Generates tokens and auth headers for Agora's REST APIs using only
 * appId + appCertificate — no customer ID/secret required.
 *
 * Usage:
 *   // Auth header for Agora REST API calls (e.g. ConvoAI join)
 *   const authHeader = await buildAgoraAuthHeader(appId, appCertificate);
 *   // → 'agora token=007eJ...'
 *
 *   // RTC+RTM channel token (e.g. for SDK join)
 *   const token = await buildAgoraToken(channelName, uid, appId, appCertificate);
 */

import { deflate } from 'zlib';

// --------------------------------------------------------------------------
// Low-level pack helpers
// --------------------------------------------------------------------------

function packUint16(v: number): Uint8Array {
  const buf = new Uint8Array(2);
  new DataView(buf.buffer).setUint16(0, v, true);
  return buf;
}

function packUint32(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, v, true);
  return buf;
}

function packString(s: string): Uint8Array {
  const encoded = new TextEncoder().encode(s);
  return concatBytes(packUint16(encoded.length), encoded);
}

function packMapUint32(map: Record<number, number>): Uint8Array {
  const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
  const parts: Uint8Array[] = [packUint16(keys.length)];
  for (const k of keys) {
    parts.push(packUint16(k), packUint32(map[k]));
  }
  return concatBytes(...parts);
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

// --------------------------------------------------------------------------
// Crypto helpers (Web Crypto API — available in Node.js 18+ and edge runtime)
// --------------------------------------------------------------------------

async function hmacSha256(
  key: Uint8Array | string,
  message: Uint8Array
): Promise<Uint8Array> {
  const keyData =
    typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(sig);
}

function deflateAsync(data: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    deflate(Buffer.from(data), (err, result) => {
      if (err) reject(err);
      else resolve(new Uint8Array(result));
    });
  });
}

// --------------------------------------------------------------------------
// Token builder
// --------------------------------------------------------------------------

/**
 * Build an Agora v007 token with RTC + RTM privileges for a channel/uid pair.
 *
 * Pass empty strings for channelName and uid when building a general-purpose
 * API auth token (e.g. for REST calls).
 */
export async function buildAgoraToken(
  channelName: string,
  uid: string,
  appId: string,
  appCertificate: string,
  rtmUid?: string
): Promise<string> {
  const issueTs = Math.floor(Date.now() / 1000);
  const expire = 86400; // 24 h
  const salt = Math.floor(Math.random() * 99_999_999) + 1;

  // Derive signing key: HMAC(key=salt, HMAC(key=issueTs, message=certificate))
  let signing = await hmacSha256(
    packUint32(issueTs),
    new TextEncoder().encode(appCertificate)
  );
  signing = await hmacSha256(packUint32(salt), signing);

  // Pack RTC service (type 1) with join + publish + subscribe privileges
  const rtcPrivileges: Record<number, number> = { 1: expire, 2: expire, 3: expire, 4: expire };
  const rtcPacked = concatBytes(
    packUint16(1),
    packMapUint32(rtcPrivileges),
    packString(channelName),
    packString(uid)
  );

  // Pack RTM service (type 2) with login privilege
  const rtmPrivileges: Record<number, number> = { 1: expire };
  const rtmPacked = concatBytes(
    packUint16(2),
    packMapUint32(rtmPrivileges),
    packString(rtmUid ?? uid)
  );

  // Build signing payload and sign it
  const signingInfo = concatBytes(
    packString(appId),
    packUint32(issueTs),
    packUint32(expire),
    packUint32(salt),
    packUint16(2), // service count
    rtcPacked,
    rtmPacked
  );
  const signature = await hmacSha256(signing, signingInfo);

  // Compress and encode
  const content = concatBytes(packUint16(signature.length), signature, signingInfo);
  const compressed = await deflateAsync(content);
  return '007' + Buffer.from(compressed).toString('base64');
}

// --------------------------------------------------------------------------
// Auth header helper
// --------------------------------------------------------------------------

/**
 * Build the Authorization header value for Agora REST API calls.
 * Returns: 'agora token=<007token>'
 *
 * This replaces Basic auth (customer ID + secret) — only appId and
 * appCertificate are required.
 */
export async function buildAgoraAuthHeader(
  appId: string,
  appCertificate: string
): Promise<string> {
  // Empty channel/uid → general-purpose API token (not scoped to a channel)
  const token = await buildAgoraToken('', '', appId, appCertificate);
  return `agora token=${token}`;
}
