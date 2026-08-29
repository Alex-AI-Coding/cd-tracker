import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const apiClientSource = readFileSync(
  new URL("../frontend/script/api-client.js", import.meta.url),
  "utf8"
);

function jsonResponse(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async text() {
      return body == null ? "" : JSON.stringify(body);
    }
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  };
}

function loadApiClient(fetchImplementation) {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const document = {
    cookie: "",
    querySelector() {
      return null;
    }
  };
  const window = {
    location: {
      pathname: "/dashboard/",
      href: "",
      replace() {}
    }
  };

  const context = {
    window,
    document,
    localStorage,
    sessionStorage,
    fetch: fetchImplementation,
    FormData,
    Blob,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    console
  };

  vm.runInNewContext(apiClientSource, context, {
    filename: "api-client.js"
  });
  return window.ApiClient;
}

test("concurrent 401 responses share one refresh and all retry", async () => {
  let refreshCalls = 0;
  const endpointCalls = new Map();
  const client = loadApiClient(async (url) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return jsonResponse(200, { refreshed: true });
    }

    const count = (endpointCalls.get(url) || 0) + 1;
    endpointCalls.set(url, count);
    return count === 1
      ? jsonResponse(401, { message: "Expired access token" })
      : jsonResponse(200, { url });
  });

  const paths = ["/activity/a", "/activity/b", "/classroom/c"];
  const results = await Promise.all(
    paths.map((path) => client.request(path, {}, {
      redirectOnUnauthorized: false,
      retryOnRefresh: true
    }))
  );

  assert.equal(refreshCalls, 1);
  assert.equal(results.length, 3);
  for (const calls of endpointCalls.values()) {
    assert.equal(calls, 2);
  }
});

test("a 401 arriving just after refresh is retried without a refresh storm", async () => {
  let refreshCalls = 0;
  const endpointCalls = new Map();
  const client = loadApiClient(async (url) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return jsonResponse(200, { refreshed: true });
    }

    const count = (endpointCalls.get(url) || 0) + 1;
    endpointCalls.set(url, count);
    return count === 1
      ? jsonResponse(401, { message: "Expired access token" })
      : jsonResponse(200, { ok: true });
  });

  await client.request("/first", {}, {
    redirectOnUnauthorized: false,
    retryOnRefresh: true
  });
  await client.request("/second", {}, {
    redirectOnUnauthorized: false,
    retryOnRefresh: true
  });

  assert.equal(refreshCalls, 1);
  assert.equal(endpointCalls.get("https://codetracker-production-979d.up.railway.app/api/first"), 2);
  assert.equal(endpointCalls.get("https://codetracker-production-979d.up.railway.app/api/second"), 2);
});

test("403 permission errors never trigger token refresh", async () => {
  let refreshCalls = 0;
  const client = loadApiClient(async (url) => {
    if (url.endsWith("/auth/refresh")) {
      refreshCalls += 1;
      return jsonResponse(200);
    }
    return jsonResponse(403, { message: "Not allowed" });
  });

  await assert.rejects(
    client.request("/activity/private", {}, {
      redirectOnUnauthorized: false,
      retryOnRefresh: true
    }),
    /Not allowed/
  );
  assert.equal(refreshCalls, 0);
});
