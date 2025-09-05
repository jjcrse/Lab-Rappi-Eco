const express = require("express")
const path = require("path")
const cors = require("cors")
const fs = require("fs")
const DB_FILE = path.join(__dirname, "db.json")

const app = express()

app.use(cors())
app.use(express.json())
app.use("/app1", express.static(path.join(__dirname, "app1")))
app.use("/app2", express.static(path.join(__dirname, "app2")))
app.use("/app3", express.static(path.join(__dirname, "app3")))

//! JSON file database helpers
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const seed = {
      users: [
        { id: 1, email: "alice@demo.com", password: "1234", role: "consumer", name: "Alice" },
        { id: 2, email: "store@demo.com", password: "1234", role: "store", name: "Demo Store Admin", storeId: 1 },
        { id: 3, email: "rider@demo.com", password: "1234", role: "courier", name: "Rider Rick" }
      ],
      stores: [ { id: 1, name: "Demo Store", address: "Main St 123", isOpen: true } ],
      products: [
        { id: 1, storeId: 1, name: "Apple", price: 1.25 },
        { id: 2, storeId: 1, name: "Banana", price: 0.9 }
      ],
      orders: [],
      sequences: { order: 1, product: 3 }
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2))
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"))
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)) }
let { users, stores, products, orders, sequences } = loadDB()
let orderSeq = sequences.order
let productSeq = sequences.product

//* Utils
function generateToken(user) {
  return Buffer.from(`${user.id}:${user.role}`).toString("base64")
}
function parseToken(token) {
  try {
    const [idStr, role] = Buffer.from(token, "base64").toString("utf8").split(":")
    const id = Number(idStr)
    const user = users.find(u => u.id === id && u.role === role)
    if (!user) return null
    return user
  } catch {
    return null
  }
}

//* Auth
app.post("/api/login", (req, res) => {
  const { email, password, role } = req.body || {}
  const db = loadDB()
  const user = db.users.find(u => u.email === email && u.password === password && (!role || u.role === role))
  if (!user) return res.status(401).send({ message: "Credenciales inválidas" })
  res.send({ token: generateToken(user), user })
})

//? Register new user
app.post("/api/register", (req, res) => {
  const { email, password, name, role } = req.body || {}
  const db = loadDB()
  
  //* Check if user already exists
  if (db.users.find(u => u.email === email)) {
    return res.status(400).send({ message: "Usuario ya existe" })
  }
  
  //? Generate new user ID
  const newUserId = Math.max(...db.users.map(u => u.id), 0) + 1
  const newUser = { id: newUserId, email, password, name, role }
  
  //* If it's a store admin, create store too
  if (role === "store") {
    const newStoreId = Math.max(...db.stores.map(s => s.id), 0) + 1
    const newStore = { id: newStoreId, name: `${name}'s Store`, address: "Dirección por definir", isOpen: false }
    newUser.storeId = newStoreId
    db.stores.push(newStore)
  }
  
  db.users.push(newUser)
  saveDB(db)
  res.status(201).send({ message: "Usuario creado exitosamente", user: newUser })
})

//? Stores
app.get("/api/stores", (req, res) => {
  const { stores } = loadDB()
  res.send(stores)
})

app.get("/api/stores/:id", (req, res) => {
  const storeId = Number(req.params.id)
  const { stores, products } = loadDB()
  const store = stores.find(s => s.id === storeId)
  if (!store) return res.status(404).send({ message: "Tienda no encontrada" })
  const storeProducts = products.filter(p => p.storeId === storeId)
  res.send({ store, products: storeProducts })
})

//* Store admin: toggle open/close and create product
app.put("/api/store/toggle", (req, res) => {
  const { token, isOpen } = req.body
  const user = parseToken(token)
  if (!user || user.role !== "store") return res.status(403).send({ message: "No autorizado" })
  const db = loadDB()
  const store = db.stores.find(s => s.id === user.storeId)
  if (!store) return res.status(404).send({ message: "Tienda no encontrada" })
  if (typeof isOpen === "boolean") store.isOpen = isOpen
  saveDB(db)
  res.send(store)
})

//? Update store information
app.put("/api/store/update", (req, res) => {
  const { token, name, address } = req.body
  const user = parseToken(token)
  if (!user || user.role !== "store") return res.status(403).send({ message: "No autorizado" })
  const db = loadDB()
  const store = db.stores.find(s => s.id === user.storeId)
  if (!store) return res.status(404).send({ message: "Tienda no encontrada" })
  if (name) store.name = name
  if (address) store.address = address
  saveDB(db)
  res.send(store)
})

app.post("/api/store/products", (req, res) => {
  const { token, name, price } = req.body
  const user = parseToken(token)
  if (!user || user.role !== "store") return res.status(403).send({ message: "No autorizado" })
  const db = loadDB()
  const storeId = db.users.find(u => u.id === user.id).storeId
  const product = { id: db.sequences.product++, storeId, name, price: Number(price) }
  db.products.push(product)
  saveDB(db)
  res.status(201).send(product)
})

//* Products by store
app.get("/api/stores/:id/products", (req, res) => {
  const storeId = Number(req.params.id)
  const { products } = loadDB()
  const list = products.filter(p => p.storeId === storeId)
  res.send(list)
})

//! Orders
//* Create order by consumer
app.post("/api/orders", (req, res) => {
  const { token, storeId, items, paymentMethod, address } = req.body
  const user = parseToken(token)
  if (!user || user.role !== "consumer") return res.status(403).send({ message: "No autorizado" })
  const db = loadDB()
  const store = db.stores.find(s => s.id === Number(storeId))
  if (!store || !store.isOpen) return res.status(400).send({ message: "Tienda no disponible" })
  const normalizedItems = (items || []).map(it => ({ productId: it.productId, quantity: Number(it.quantity || 1) }))
  const total = normalizedItems.reduce((sum, it) => {
    const product = db.products.find(p => p.id === it.productId)
    return sum + (product ? product.price * it.quantity : 0)
  }, 0)
  const order = {
    id: db.sequences.order++,
    storeId: Number(storeId),
    consumerId: user.id,
    courierId: null,
    status: "created", //* created -> accepted -> delivering -> delivered
    items: normalizedItems,
    paymentMethod,
    address,
    total: Number(total.toFixed(2)),
    createdAt: Date.now(),
  }
  db.orders.push(order)
  saveDB(db)
  res.status(201).send(order)
})

//? List consumer orders
app.get("/api/my/orders", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token
  const user = parseToken(token)
  if (!user || user.role !== "consumer") return res.status(403).send({ message: "No autorizado" })
  const { orders } = loadDB()
  res.send(orders.filter(o => o.consumerId === user.id))
})

//* List available orders for couriers
app.get("/api/courier/orders/available", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token
  const user = parseToken(token)
  if (!user || user.role !== "courier") return res.status(403).send({ message: "No autorizado" })
  const { orders } = loadDB()
  res.send(orders.filter(o => o.status === "created"))
})

//* Accept an order
app.post("/api/courier/orders/:id/accept", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.body.token
  const user = parseToken(token)
  if (!user || user.role !== "courier") return res.status(403).send({ message: "No autorizado" })
  const id = Number(req.params.id)
  const db = loadDB()
  const order = db.orders.find(o => o.id === id)
  if (!order) return res.status(404).send({ message: "Orden no encontrada" })
  if (order.status !== "created") return res.status(400).send({ message: "No disponible" })
  order.status = "accepted"
  order.courierId = user.id
  saveDB(db)
  res.send(order)
})

//? List courier accepted orders
app.get("/api/courier/orders/accepted", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token
  const user = parseToken(token)
  if (!user || user.role !== "courier") return res.status(403).send({ message: "No autorizado" })
  const { orders } = loadDB()
  res.send(orders.filter(o => o.courierId === user.id))
})

//* Basic root message
app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.end(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>MiTiendita</title><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;background:linear-gradient(45deg,#ff6b6b,#4ecdc4,#45b7d1,#feca57);color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .container{max-width:600px;width:100%;text-align:center;background:rgba(255,255,255,0.1);padding:40px;border-radius:20px;backdrop-filter:blur(10px)}
  .logo{font-size:3.5rem;font-weight:bold;margin-bottom:20px;text-shadow:2px 2px 4px rgba(0,0,0,0.3)}
  .subtitle{font-size:1.2rem;margin-bottom:40px;opacity:0.9}
  .buttons{display:flex;flex-direction:column;gap:15px}
  .btn{display:block;padding:15px 25px;background:rgba(255,255,255,0.2);color:#fff;text-decoration:none;border-radius:15px;font-size:1.1rem;font-weight:bold;transition:all 0.3s ease;border:2px solid rgba(255,255,255,0.3)}
  .btn:hover{background:rgba(255,255,255,0.3);transform:translateY(-2px);box-shadow:0 5px 15px rgba(0,0,0,0.2)}
  .btn.consumer{background:linear-gradient(45deg,#ff6b6b,#ff8e8e)}
  .btn.store{background:linear-gradient(45deg,#4ecdc4,#6dd5db)}
  .btn.courier{background:linear-gradient(45deg,#45b7d1,#6bc5d8)}
  .features{margin-top:30px;display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
  .feature{font-size:0.9rem;opacity:0.8}
  @media(max-width:600px){.container{padding:30px 20px}.logo{font-size:2.5rem}.buttons{gap:12px}.btn{padding:12px 20px;font-size:1rem}}
  </style></head><body>
  <div class="container">
    <h1 class="logo">MiTiendita</h1>
    <p class="subtitle">Tu app de delivery favorita</p>
    
    <div class="buttons">
      <a href="/app1" class="btn consumer">Consumidor</a>
      <a href="/app2" class="btn store">Tienda</a>
      <a href="/app3" class="btn courier">Repartidor</a>
    </div>
    
    <div class="features">
      <span class="feature">Rápido</span>
      <span class="feature">Eco</span>
      <span class="feature">Seguro</span>
    </div>
  </div>
  </body></html>`)
})

app.listen(5050, () => {
  console.log("Server listening on http://localhost:5050")
})
