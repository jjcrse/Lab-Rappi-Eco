const API = "http://localhost:5050/api";
let auth = { token: null, user: null };
const view = document.getElementById("view");

document.getElementById("nav-login").onclick = renderLogin;
document.getElementById("nav-register").onclick = renderRegister;
document.getElementById("nav-store").onclick = renderStoreInfo;
document.getElementById("nav-products").onclick = renderProducts;
document.getElementById("nav-edit").onclick = renderEditStore;

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
        role: "store"
      };
      const data = await api("/login", { method: "POST", body: payload });
      auth = { token: data.token, user: data.user };
      renderStoreInfo();
    } catch (e) { alert("Credenciales inválidas. Intente nuevamente."); }
  } }, "Entrar");
  view.append(h("div", { class: "card" }, h("h2", null, "Login tienda"), email, password, btn));
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
        role: "store"
      };
      await api("/register", { method: "POST", body: regPayload });
      // Auto-login tras registro
      try {
        const data = await api("/login", { method: "POST", body: { email: regPayload.email, password: regPayload.password, role: "store" } });
        auth = { token: data.token, user: data.user };
        alert("¡Tienda creada y sesión iniciada!");
        renderStoreInfo();
      } catch {
        alert("Tienda creada, pero no se pudo iniciar sesión automáticamente. Inicie sesión manualmente.");
        renderLogin();
      }
    } catch (e) { alert((e && e.message) || "No se pudo registrar. Revise los datos e intente nuevamente."); }
  } }, "Crear tienda");
  view.append(h("div", { class: "card" }, h("h2", null, "Registrar nueva tienda"), name, email, password, btn));
}

async function renderStoreInfo() {
  if (!auth.token) { renderLogin(); return; }
  // Require explicit storeId from user
  let storeId = auth.user && auth.user.storeId;
  if (!storeId) {
    const input = prompt("Ingrese su ID de tienda");
    if (!input || isNaN(Number(input))) { alert("ID de tienda inválido"); return; }
    storeId = Number(input);
    auth.user.storeId = storeId;
  }
  const data = await api(`/stores/${storeId}`);
  view.innerHTML = "";
  const toggleBtn = h("button", { onclick: async () => {
      try {
        const updated = await api("/store/toggle", { method: "PUT", body: { token: auth.token, isOpen: !data.store.isOpen } });
        renderStoreInfo();
      } catch (e) { alert(e.message); }
    } }, data.store.isOpen ? "Cerrar tienda" : "Abrir tienda");
  view.append(
    h("div", { class: "card" }, h("h2", null, data.store.name), h("div", null, data.store.address), h("div", null, `Estado: ${data.store.isOpen ? "Abierta" : "Cerrada"}`), toggleBtn),
    h("div", { class: "grid" }, ...data.products.map(p => h("div", { class: "card" }, `${p.name} — $ ${p.price}`)))
  );
}

async function renderProducts() {
  if (!auth.token) { renderLogin(); return; }
  const name = h("input", { placeholder: "Nombre" });
  const price = h("input", { placeholder: "Precio", type: "number", step: "0.01" });
  const btn = h("button", { onclick: async () => {
    try {
      await api("/store/products", { method: "POST", body: { token: auth.token, name: name.value, price: Number(price.value) } });
      alert("Producto creado");
      renderStoreInfo();
    } catch (e) { alert(e.message); }
  } }, "Crear producto");
  view.innerHTML = "";
  view.append(h("div", { class: "card" }, h("h2", null, "Nuevo producto"), name, price, btn));
}

function renderEditStore() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";
  const name = h("input", { placeholder: "Nombre de la tienda" });
  const address = h("input", { placeholder: "Dirección" });
  const btn = h("button", { onclick: async () => {
    try {
      await api("/store/update", { method: "PUT", body: { token: auth.token, name: name.value, address: address.value } });
      alert("Tienda actualizada");
      renderStoreInfo();
    } catch (e) { alert(e.message); }
  } }, "Actualizar tienda");
  view.append(h("div", { class: "card" }, h("h2", null, "Editar información de tienda"), name, address, btn));
}

