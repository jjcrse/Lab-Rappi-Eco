const API = "http://localhost:5050/api";
let auth = { token: null, user: null };
const view = document.getElementById("view");

document.getElementById("nav-login").onclick = renderLogin;
document.getElementById("nav-register").onclick = renderRegister;
document.getElementById("nav-available").onclick = renderAvailable;
document.getElementById("nav-accepted").onclick = renderAccepted;

renderLogin();

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") el.className = v; else if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (typeof c === "string") el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c);
  });
  return el;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  if (!res.ok) throw new Error((await res.json()).message || "Error");
  return res.json();
}

function renderLogin() {
  view.innerHTML = "";
  const email = h("input", { placeholder: "email" });
  const password = h("input", { placeholder: "password", type: "password" });
  const btn = h("button", { onclick: async () => {
    try {
      const payload = {
        email: (email.value || "").trim().toLowerCase(),
        password: (password.value || "").trim(),
        role: "courier"
      };
      const data = await api("/login", { method: "POST", body: payload });
      auth = { token: data.token, user: data.user };
      renderAvailable();
    } catch (e) { alert("Credenciales inválidas. Intente nuevamente."); }
  } }, "Entrar");
  view.append(h("div", { class: "card" }, h("h2", null, "Login repartidor"), email, password, btn));
}

function renderRegister() {
  view.innerHTML = "";
  const name = h("input", { placeholder: "Nombre completo" });
  const email = h("input", { placeholder: "email" });
  const password = h("input", { placeholder: "password", type: "password" });
  const btn = h("button", { onclick: async () => {
    try {
      const regPayload = {
        name: (name.value || "").trim(),
        email: (email.value || "").trim().toLowerCase(),
        password: (password.value || "").trim(),
        role: "courier"
      };
      await api("/register", { method: "POST", body: regPayload });
      // Auto-login tras registro
      try {
        const data = await api("/login", { method: "POST", body: { email: regPayload.email, password: regPayload.password, role: "courier" } });
        auth = { token: data.token, user: data.user };
        alert("Registro exitoso. Sesión iniciada.");
        renderAvailable();
      } catch {
        alert("Cuenta creada, pero no se pudo iniciar sesión automáticamente. Inicie sesión manualmente.");
        renderLogin();
      }
    } catch (e) {
      alert((e && e.message) || "No se pudo registrar. Revise los datos e intente nuevamente.");
    }
  } }, "Crear cuenta");
  view.append(h("div", { class: "card" }, h("h2", null, "Registrar repartidor"), name, email, password, btn));
}

async function renderAvailable() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";
  const list = await api("/courier/orders/available");
  const cards = list.map(o => h("div", { class: "card" },
    h("div", { class: "row" }, `Orden #${o.id}`, `$ ${o.total}`),
    h("div", null, `Dirección: ${o.address}`),
    h("button", { onclick: async () => {
      try {
        await api(`/courier/orders/${o.id}/accept`, { method: "POST", body: { token: auth.token } });
        renderAccepted();
      } catch (e) { alert(e.message); }
    } }, "Aceptar")
  ));
  view.append(h("h2", null, "Órdenes disponibles"), ...(cards.length ? cards : [h("div", null, "Sin disponibles")]));
}

async function renderAccepted() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";
  const list = await api("/courier/orders/accepted");
  const cards = list.map(o => h("div", { class: "card" },
    h("div", { class: "row" }, `Orden #${o.id}`, o.status),
    h("div", null, `Total $ ${o.total}`),
    h("div", null, `Cliente ${o.consumerId}`)
  ));
  view.append(h("h2", null, "Órdenes aceptadas"), ...(cards.length ? cards : [h("div", null, "Ninguna aceptada")]));
}
