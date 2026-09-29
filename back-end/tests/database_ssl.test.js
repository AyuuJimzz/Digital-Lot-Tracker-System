const assert = require("node:assert/strict");
const test = require("node:test");
const tls = require("node:tls");
const { getDatabaseSslConfig } = require("../config/database_ssl");

test("local MySQL stays unchanged and cloud TLS requires a verified CA", () => {
  const oldInline = process.env.DB_SSL_CA;
  const oldPath = process.env.DB_SSL_CA_PATH;
  try {
    delete process.env.DB_SSL_CA;
    delete process.env.DB_SSL_CA_PATH;
    assert.equal(getDatabaseSslConfig("localhost"), undefined);
    assert.throws(() => getDatabaseSslConfig("mysql.example.aivencloud.com"), /DB_SSL_CA/);
    process.env.DB_SSL_CA = "not-a-certificate";
    assert.throws(() => getDatabaseSslConfig("mysql.example.aivencloud.com"), /PEM-encoded/);
    process.env.DB_SSL_CA = tls.rootCertificates[0];
    const ssl = getDatabaseSslConfig("mysql.example.aivencloud.com");
    assert.equal(ssl.rejectUnauthorized, true);
    assert.equal(ssl.ca, tls.rootCertificates[0]);
  } finally {
    if (oldInline === undefined) delete process.env.DB_SSL_CA;
    else process.env.DB_SSL_CA = oldInline;
    if (oldPath === undefined) delete process.env.DB_SSL_CA_PATH;
    else process.env.DB_SSL_CA_PATH = oldPath;
  }
});
