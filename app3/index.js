// ! Configuración base !
//* URL base de la API
const API = "http://localhost:5050/api";

//? Estado de autenticación: token + usuario logueado
let auth = { token: null, user: null };

//* Contenedor principal donde se renderizan las vistas dinámicas
const view = document.getElementById("view");

// ! Navegación !
//? Asignar eventos de navegación a los botones del menú
document.getElementById("nav-login").onclick = renderLogin;
document.getElementById("nav-register").onclick = renderRegister;
document.getElementById("nav-available").onclick = renderAvailable;
document.getElementById("nav-accepted").onclick = renderAccepted;

//* Vista inicial → login
renderLogin();

// ! Función utilitaria para crear nodos !

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);

  //? Asignar atributos y eventos
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });

  //* Insertar hijos
  children.flat().forEach(c => {
    if (typeof c === "string") el.appendChild(document.createTextNode(c));
    else if (c) el.appendChild(c);
  });

  return el;
}

// ! Función para llamadas a la API !

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  //? Incluir token si existe
  if (auth.token) headers["Authorization"] = `Bearer ${auth.token}`;

  //* Ejecutar fetch
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  //? Manejo de errores
  if (!res.ok) throw new Error((await res.json()).message || "Error");
  return res.json();
}

// ! Login de repartidor !

function renderLogin() {
  view.innerHTML = "";

  //* Campos de entrada
  const email = h("input", { placeholder: "email" });
  const password = h("input", { placeholder: "password", type: "password" });

  //? Botón de login
  const btn = h("button", {
    onclick: async () => {
      try {
        const payload = {
          email: (email.value || "").trim().toLowerCase(),
          password: (password.value || "").trim(),
          role: "courier"
        };

        //* Login en API
        const data = await api("/login", { method: "POST", body: payload });

        //* Guardar autenticación
        auth = { token: data.token, user: data.user };

        //* Redirigir a órdenes disponibles
        renderAvailable();
      } catch (e) {
        alert("Credenciales inválidas. Intente nuevamente.");
      }
    }
  }, "Entrar");

  //? Render de tarjeta login
  view.append(h("div", { class: "card" },
    h("h2", null, "Login repartidor"),
    email, password, btn
  ));
}

// ! Registro de repartidor !

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
        const regPayload = {
          name: (name.value || "").trim(),
          email: (email.value || "").trim().toLowerCase(),
          password: (password.value || "").trim(),
          role: "courier"
        };

        //* Registrar en backend
        await api("/register", { method: "POST", body: regPayload });

        //* Intento de auto-login
        try {
          const data = await api("/login", {
            method: "POST",
            body: { email: regPayload.email, password: regPayload.password, role: "courier" }
          });
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
    }
  }, "Crear cuenta");

  //? Render de tarjeta registro
  view.append(h("div", { class: "card" },
    h("h2", null, "Registrar repartidor"),
    name, email, password, btn
  ));
}

// ! Órdenes disponibles !
async function renderAvailable() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";

  //* Obtener lista de órdenes disponibles
  const list = await api("/courier/orders/available");

  //? Tarjetas de órdenes
  const cards = list.map(o => h("div", { class: "card" },
    h("div", { class: "row" }, `Orden #${o.id}`, `$ ${o.total}`),
    h("div", null, `Dirección: ${o.address}`),
    h("button", {
      onclick: async () => {
        try {
          await api(`/courier/orders/${o.id}/accept`, {
            method: "POST",
            body: { token: auth.token }
          });
          renderAccepted();
        } catch (e) { alert(e.message); }
      }
    }, "Aceptar")
  ));

  //* Render vista
  view.append(
    h("h2", null, "Órdenes disponibles"),
    ...(cards.length ? cards : [h("div", null, "Sin disponibles")])
  );
}

// ! Órdenes aceptadas !

async function renderAccepted() {
  if (!auth.token) { renderLogin(); return; }
  view.innerHTML = "";

  //* Obtener lista de órdenes aceptadas
  const list = await api("/courier/orders/accepted");

  //? Tarjetas de órdenes aceptadas
  const cards = list.map(o => h("div", { class: "card" },
    h("div", { class: "row" }, `Orden #${o.id}`, o.status),
    h("div", null, `Total $ ${o.total}`),
    h("div", null, `Cliente ${o.consumerId}`)
  ));

  //* Render vista
  view.append(
    h("h2", null, "Órdenes aceptadas"),
    ...(cards.length ? cards : [h("div", null, "Ninguna aceptada")])
  );
}
