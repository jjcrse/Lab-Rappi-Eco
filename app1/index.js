const API = "http://localhost:5050/api";
const view = document.getElementById("view");
const cart = { items: [] };
let auth = { token: null, user: null };

// Navigation
document.getElementById("nav-login").onclick = renderLogin;
document.getElementById("nav-register").onclick = renderRegister;
document.getElementById("nav-stores").onclick = renderStores;
document.getElementById("nav-cart").onclick = renderCart;
document.getElementById("nav-orders").onclick = renderMyOrders;

renderStores();

function setCartCount() {
  const count = cart.items.reduce((s, it) => s + it.quantity, 0);
  document.getElementById("cart-count").textContent = count;
}

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
  const role = h("select", null, h("option", { value: "consumer" }, "consumer"));
  const btn = h("button", { onclick: async () => {
      try {
        const payload = {
          email: (email.value || "").trim().toLowerCase(),
          password: (password.value || "").trim(),
          role: role.value
        };
        const data = await api("/login", { method: "POST", body: payload });
        auth = { token: data.token, user: data.user };
        renderStores();
      } catch (e) { alert("Credenciales inválidas. Intente nuevamente."); }
    } }, "Entrar");
  view.append(
    h("div", { class: "card" }, h("h2", null, "Login"), email, password, role, btn)
  );
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
        role: "consumer"
      };
      await api("/register", { method: "POST", body: regPayload });
      // Auto-login tras registro
      try {
        const data = await api("/login", { method: "POST", body: { email: regPayload.email, password: regPayload.password, role: "consumer" } });
        auth = { token: data.token, user: data.user };
        alert("Registro exitoso. Sesión iniciada.");
        renderStores();
      } catch {
        alert("Cuenta creada, pero no se pudo iniciar sesión automáticamente. Inicie sesión manualmente.");
        renderLogin();
      }
    } catch (e) {
      alert((e && e.message) || "No se pudo registrar. Revise los datos e intente nuevamente.");
    }
  } }, "Crear cuenta");
  view.append(h("div", { class: "card" }, h("h2", null, "Registrar consumidor"), name, email, password, btn));
}

async function renderStores() {
  view.innerHTML = "";
  const list = await api("/stores");
  const grid = h("div", { class: "grid" }, list.map(s => h("div", { class: "card" },
    h("div", { class: "row" }, h("strong", null, s.name), h("span", { class: "muted" }, s.isOpen ? "Abierta" : "Cerrada")),
    h("div", null, s.address),
    h("button", { onclick: () => renderStoreDetail(s.id) }, "Ver tienda")
  )));
  view.append(h("h2", null, "Tiendas"), grid);
}

async function renderStoreDetail(storeId) {
  view.innerHTML = "";
  const data = await api(`/stores/${storeId}`);
  const header = h("div", { class: "card" },
    h("h2", null, data.store.name),
    h("div", { class: "muted" }, data.store.address, " — ", data.store.isOpen ? "Abierta" : "Cerrada")
  );
  const items = data.products.map(p => h("div", { class: "card" },
    h("div", { class: "row" },
      h("div", null, h("strong", null, p.name), h("div", { class: "muted" }, `$ ${p.price}`)),
      h("div", null, h("button", { onclick: () => addToCart(p) }, "+ Carrito"))
    )
  ));
  view.append(header, h("div", { class: "grid" }, ...items));
}

function addToCart(product) {
  const existing = cart.items.find(i => i.productId === product.id);
  if (existing) existing.quantity += 1; else cart.items.push({ productId: product.id, name: product.name, price: product.price, quantity: 1, storeId: product.storeId });
  setCartCount();
}

function renderCart() {
  view.innerHTML = "";
  const rows = cart.items.map(it => h("div", { class: "row" }, `${it.name} x${it.quantity}`, `$ ${Number(it.price * it.quantity).toFixed(2)}`));
  const total = cart.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const address = h("input", { placeholder: "Dirección de entrega" });
  const payment = h("select", null, h("option", { value: "cash" }, "Efectivo"), h("option", { value: "card" }, "Tarjeta"));
  const btn = h("button", { onclick: async () => {
      if (!auth.token) { alert("Inicia sesión"); return; }
      if (cart.items.length === 0) { alert("Carrito vacío"); return; }
      if (!address.value) { alert("Ingrese una dirección de entrega"); return; }
      // Inferir storeId desde los items del carrito y validar que todos sean de la misma tienda
      const firstStoreId = cart.items[0]?.storeId;
      if (!firstStoreId) { alert("No se pudo determinar la tienda. Añade productos nuevamente desde una tienda."); return; }
      const allSameStore = cart.items.every(i => i.storeId === firstStoreId);
      if (!allSameStore) { alert("Todos los productos deben ser de la misma tienda."); return; }
      try {
        const order = await api("/orders", { method: "POST", body: {
          token: auth.token,
          storeId: Number(firstStoreId),
          items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod: payment.value,
          address: address.value,
        }});
        cart.items = [];
        setCartCount();
        alert(`Orden creada #${order.id} - total $${order.total}`);
        renderMyOrders();
      } catch (e) { alert(e.message); }
    } }, "Crear orden");
  view.append(
    h("h2", null, "Carrito"),
    h("div", { class: "card" }, rows.length ? rows : h("div", { class: "muted" }, "Vacío"), h("div", { class: "row" }, h("strong", null, "Total"), `$ ${total.toFixed(2)}`)),
    h("div", { class: "card" }, h("h3", null, "Entrega y pago"), address, payment, btn)
  );
}

async function renderMyOrders() {
  view.innerHTML = "";
  if (!auth.token) { renderLogin(); return; }
  const list = await api("/my/orders");
  const cards = list.map(o => h("div", { class: "card" },
    h("div", { class: "row" }, `Orden #${o.id}`, h("span", { class: "muted" }, o.status)),
    h("div", null, `Total: $ ${o.total}`),
    h("div", { class: "muted" }, o.items.map(i => `${i.productId} x${i.quantity}`).join(", "))
  ));
  view.append(h("h2", null, "Mis órdenes"), ...(cards.length ? cards : [h("div", { class: "muted" }, "Sin órdenes")]));
}

