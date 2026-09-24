import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import { test } from 'node:test';
import { clientIp, safeEqual, signBody, verifyHmac } from '../src/auth.ts';
import { mask } from '../src/log.ts';

test('safeEqual', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('HMAC verify', () => {
  const secret = 's'.repeat(40);
  const body = Buffer.from('{"v":1}');
  assert.equal(verifyHmac(body, signBody(body, secret), secret), true);
  assert.equal(verifyHmac(body, signBody(body, 'x'.repeat(40)), secret), false);
  assert.equal(verifyHmac(Buffer.from('{"v":2}'), signBody(body, secret), secret), false);
  assert.equal(verifyHmac(body, undefined, secret), false);
  assert.equal(verifyHmac(body, 'sha256=zz', secret), false);
});

function req(remote: string, xff?: string): IncomingMessage {
  return { headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: remote } } as unknown as IncomingMessage;
}

test('client IP uses the proxy-appended XFF entry only when trusted', () => {
  assert.equal(clientIp(req('::ffff:10.0.0.1', '1.2.3.4, 52.89.214.238'), false), '10.0.0.1');
  assert.equal(clientIp(req('10.0.0.1', '1.2.3.4, 52.89.214.238'), true), '52.89.214.238');
  assert.equal(clientIp(req('10.0.0.1'), true), '10.0.0.1');
});

test('logger masks configured secrets and stray bot tokens', () => {
  const out = mask('url=/bot123456789:AAHtestTokenValue_abcdefghijklmnopqrstu/sendMessage token=my-secret-token', ['my-secret-token']);
  assert.doesNotMatch(out, /AAHtest|my-secret-token/);
});
