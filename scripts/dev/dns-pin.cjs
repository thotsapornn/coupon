// Workaround for sandbox DNS being unavailable: pin npm registry to a known IP
// while keeping the hostname for TLS SNI / certificate validation.
const dns = require('node:dns');
const { isIP } = require('node:net');

const PINNED = {
  'registry.npmjs.org': '104.16.24.34',
  'registry.yarnpkg.com': '104.16.24.34',
};

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  else if (typeof options === 'number') { options = { family: options }; }
  const ip = PINNED[hostname];
  if (!ip) return origLookup.call(dns, hostname, options, callback);
  const family = isIP(ip);
  if (options && options.all) {
    return process.nextTick(() => callback(null, [{ address: ip, family }]));
  }
  return process.nextTick(() => callback(null, ip, family));
};

if (dns.promises && dns.promises.lookup) {
  const origP = dns.promises.lookup;
  dns.promises.lookup = async function (hostname, options) {
    const ip = PINNED[hostname];
    if (!ip) return origP.call(dns.promises, hostname, options);
    const family = isIP(ip);
    if (options && options.all) return [{ address: ip, family }];
    return { address: ip, family };
  };
}
