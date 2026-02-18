const BASE = "/api";

function getToken() {
  return localStorage.getItem("tradesk_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export const authApi = {
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login:    (body) => request("/auth/login",    { method: "POST", body: JSON.stringify(body) }),
  me:       ()     => request("/auth/me"),
};

export const purchasesApi = {
  list:   (params={}) => request("/purchases?" + new URLSearchParams(params)),
  create: (body)      => request("/purchases",      { method: "POST",   body: JSON.stringify(body) }),
  update: (id, body)  => request(`/purchases/${id}`,{ method: "PUT",    body: JSON.stringify(body) }),
  remove: (id)        => request(`/purchases/${id}`,{ method: "DELETE" }),
};

export const salesApi = {
  list:   (params={}) => request("/sales?" + new URLSearchParams(params)),
  create: (body)      => request("/sales",      { method: "POST",   body: JSON.stringify(body) }),
  update: (id, body)  => request(`/sales/${id}`,{ method: "PUT",    body: JSON.stringify(body) }),
  remove: (id)        => request(`/sales/${id}`,{ method: "DELETE" }),
};

export const analyticsApi = {
  summary:   () => request("/analytics/summary"),
  monthly:   () => request("/analytics/monthly"),
  inventory: () => request("/analytics/inventory"),
};
