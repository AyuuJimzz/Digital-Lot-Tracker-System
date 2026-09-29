const fs = require("node:fs");
const path = require("node:path");
const tls = require("node:tls");
const { X509Certificate } = require("node:crypto");

const getDatabaseSslConfig = (host, sslRequested = false) => {
  const isAiven = /(^|\.)aivencloud\.com$/i.test(String(host || ""));
  if (!sslRequested && !isAiven) return undefined;

  const inlineCa = process.env.DB_SSL_CA;
  const caPath = process.env.DB_SSL_CA_PATH;
  if (!inlineCa && !caPath) {
    throw new Error("Database TLS requires DB_SSL_CA or DB_SSL_CA_PATH (Aiven CA certificate).");
  }

  const ca = inlineCa
    ? inlineCa.replace(/\\n/g, "\n")
    : fs.readFileSync(path.resolve(caPath), "utf8");

  const certificates = ca.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!certificates?.length) {
    throw new Error("DB_SSL_CA must contain a PEM-encoded CA certificate.");
  }
  certificates.forEach((certificate) => new X509Certificate(certificate));
  // Validate the CA format before opening a connection, not after deployment.
  tls.createSecureContext({ ca });
  return { ca, rejectUnauthorized: true };
};

module.exports = { getDatabaseSslConfig };
