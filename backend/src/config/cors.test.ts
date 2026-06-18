import assert from "node:assert/strict";
import test from "node:test";
import { createCorsOriginMatcher } from "./cors.js";

test("allows configured app origin and public app url", () => {
  const matchOrigin = createCorsOriginMatcher({
    NODE_ENV: "production",
    APP_ORIGIN: "https://app.example.com",
    PUBLIC_APP_URL: "https://graficflow-graficflow-frontend.ic72mw.easypanel.host",
  });

  assert.equal(matchOrigin("https://app.example.com"), true);
  assert.equal(matchOrigin("https://graficflow-graficflow-frontend.ic72mw.easypanel.host"), true);
  assert.equal(matchOrigin("https://other.example.com"), false);
});

test("supports comma separated and wildcard origins", () => {
  const matchOrigin = createCorsOriginMatcher({
    NODE_ENV: "production",
    APP_ORIGIN: "https://app.example.com, https://*.ic72mw.easypanel.host",
    PUBLIC_APP_URL: "https://app.example.com",
  });

  assert.equal(matchOrigin("https://graficflow-graficflow-frontend.ic72mw.easypanel.host"), true);
  assert.equal(matchOrigin("https://other.easypanel.host"), false);
});

test("allows localhost only outside production", () => {
  const devMatchOrigin = createCorsOriginMatcher({
    NODE_ENV: "development",
    APP_ORIGIN: "https://app.example.com",
    PUBLIC_APP_URL: "https://app.example.com",
  });
  const productionMatchOrigin = createCorsOriginMatcher({
    NODE_ENV: "production",
    APP_ORIGIN: "https://app.example.com",
    PUBLIC_APP_URL: "https://app.example.com",
  });

  assert.equal(devMatchOrigin("http://localhost:3004"), true);
  assert.equal(devMatchOrigin("http://127.0.0.1:3004"), true);
  assert.equal(productionMatchOrigin("http://localhost:3004"), false);
});
