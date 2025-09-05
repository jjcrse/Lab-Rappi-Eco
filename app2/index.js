//! URL base de la API
const API = "http://localhost:5050/api";

//* Estado de autenticación: guarda token y usuario
let auth = { token: null, user: null };

//* Contenedor principal donde se muestra el contenido
const view = document.getElementById("view");

// ! Navegación !
//? Asignar funciones a los botones de la barra de navegación
document.getElementById("nav-login").onclick = renderLogin;
document.getElementById("nav-register").onclick = renderRegister;
document.getElementById("nav-store").onclick = renderStoreInfo;
document.getElementById("nav-products").onclick = renderProducts;
document.getElementById("nav-edit").onclick = renderEditStore;

//* Vista inicial → formulario de login
renderLogin();

// ! Utilidad para crear nodos !
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);

  //? Configurar atributos
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });

  //* Agregar hijos (texto o elementos)
  children.flat().forEach(c => {
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });

  return el;
}

// ! Función para llamadas a la API !
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  //? Si hay token, incluirlo en la cabecera
  if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;

  //* Petición a la API
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  //? Manejo de errores
  if (!res.ok) throw new Error((await res.json()).message || "Error");
  return res.json();
}

// ! Login de tienda !
function renderLogin() {
  view.innerHTML = "";

  //* Campos de entrada
  const email = h("input", { placeholder: "email" });
  const password = h("input", { placeholder: "password", type: "password" });

  //? Botón de login
  const btn = h("button", {
    onclick: async () => {
      try {
        //* Datos de login
        const payload = {
          email: (email.value || "").trim().toLowerCase(),
          password: (password.value || "").trim(),
          role: "store" //? rol fijo para tiendas
        };

        //* Petición al backend
        const data = await api("/login", { method: "POST", body: payload });

        //* Guardar autenticación
        auth = { token: data.token, user: data.user };

        //* Mostrar información de la tienda
        renderStoreInfo();
      } catch (e) {
        alert("Credenciales inválidas. Intente nuevamente.");
      }
    }
  }, "Entrar");

  //? Render de la tarjeta de login
  view.append(h("div", { class: "card" }, h("h2", null, "Login tienda"), email, password, btn));
}

// ! Registro de tienda !
function renderRegister() {
  view.innerHTML = "";

  //* Campos de entrada
  const name = h("input", { placeholder: "Nombre completo" });
  const email = h("input", { placeholder: "email" });
  const password = h("input", { placeholder: "password", type: "password" });

  //? Botón de registro
  const btn = h("button", {
    onclick: async () => {
      try {
        //* Datos de registro
        const regPayload = {
          name: (name.value || "").trim(),
          email: (email.value || "").trim().toLowerCase(),
          password: (password.value || "").trim(),
          role: "store" //? rol fijo tienda
        };

        //? Registrar tienda en backend
        await api("/register", { method: "POST", body: regPayload });

        //* Intentar login automático
        try {
          const data = await api("/login", {
            method: "POST",
            body: { email: regPayload.email, password: regPayload.password, role: "store" }
          });
          auth = { token: data.token, user: data.user };
          alert("¡Tienda creada y sesión iniciada!");
          renderStoreInfo();
        } catch {
          alert("Tienda creada, pero no se pudo iniciar sesión automáticamente. Inicie sesión manualmente.");
          renderLogin();
        }
      } catch (e) {
        alert((e && e.message) || "No se pudo registrar. Revise los datos e intente nuevamente.");
      }
    }
  }, "Crear tienda");

  //? Render tarjeta de registro
  view.append(h("div", { class: "card" }, h("h2", null, "Registrar nueva tienda"), name, email, password, btn));
}

// ! Información de la tienda !
async function renderStoreInfo() {
  if (!auth.token) { renderLogin(); return; }

  //? Obtener storeId del usuario autenticado
  let storeId = auth.user && auth.user.storeId;

  //* Si no existe, pedirlo manualmente
  if (!storeId) {
    const input = prompt("Ingrese su ID de tienda");
    if (!input || isNaN(Number(input))) { alert("ID de tienda inválido"); return; }
    storeId = Number(input);
    auth.user.storeId = storeId;
  }

  //* Pedir datos de la tienda
  const data = await api(`/stores/${storeId}`);
  view.innerHTML = "";

  //? Botón para abrir/cerrar tienda
  const toggleBtn = h("button", {
    onclick: async () => {
      try {
        await api("/store/toggle", {
          method: "PUT",
          body: { token: auth.token, isOpen: !data.store.isOpen }
        });
        renderStoreInfo();
      } catch (e) { alert(e.message); }
    }
  }, data.store.isOpen ? "Cerrar tienda" : "Abrir tienda");

  //? Render de información de tienda + productos
  view.append(
    h("div", { class: "card" },
      h("h2", null, data.store.name),
      h("div", null, data.store.address),
      h("div", null, `Estado: ${data.store.isOpen ? "Abierta" : "Cerrada"}`),
      toggleBtn
    ),
    h("div", { class: "grid" },
      ...data.products.map(p => h("div", { class: "card" }, `${p.name} — $ ${p.price}`))
    )
  );
}

// ! Crear productos !
async function renderProducts() {
  if (!auth.token) { renderLogin(); return; }

  //* Campos de entrada
  const name = h("input", { placeholder: "Nombre" });
  const price = h("input", { placeholder: "Precio", type: "number", step: "0.01" });

  //? Botón para crear producto
  const btn = h("button", {
    onclick: async () => {
      try {
        await api("/store/products", {
          method: "POST",
          body: { token: auth.token, name: name.value, price: Number(price.value) }
        });
        alert("Producto creado");
        renderStoreInfo();
      } catch (e) { alert(e.message); }
    }
  }, "Crear producto");

  //* Render de formulario
  view.innerHTML = "";
  view.append(h("div", { class: "card" }, h("h2", null, "Nuevo producto"), name, price, btn));
}

// ! Editar tienda 
function renderEditStore() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";

  //* Campos de entrada
  const name = h("input", { placeholder: "Nombre de la tienda" });
  const address = h("input", { placeholder: "Dirección" });

  //* Botón actualizar
  const btn = h("button", {
    onclick: async () => {
      try {
        await api("/store/update", {
          method: "PUT",
          body: { token: auth.token, name: name.value, address: address.value }
        });
        alert("Tienda actualizada");
        renderStoreInfo();
      } catch (e) { alert(e.message); }
    }
  }, "Actualizar tienda");

  //? Render de formulario
  view.append(h("div", { class: "card" },
    h("h2", null, "Editar información de tienda"), name, address, btn));
}
