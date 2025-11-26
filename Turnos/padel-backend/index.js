// padel-backend/index.js (CÓDIGO PRINCIPAL CORREGIDO)
// --- Importaciones ---
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import Keycloak from 'keycloak-connect';
import sequelize from './config/database.js';

// Importar los nuevos módulos de rutas (las funciones)
import CanchasRoutes from './routes/canchas.js';
import AdminRoutes from './routes/admin.js';
import TurnosRoutes from './routes/turnos.js';

// --- Inicialización ---
const app = express();
const PORT = process.env.PORT || 8080;

// --- Configuración de Sesión ---
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'miClaveSecretaParaSession123!', 
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// --- Configuración de Keycloak ---
const keycloakConfig = {
  realm: 'padel-club',
  "auth-server-url": 'http://localhost:9090/',
  "ssl-required": 'none',
  resource: 'padel-backend', 
  credentials: {
    secret: 'alwoEazsSho35pHeYSbOmanHLS2vV2c0' // Tu secret
  },
  "confidential-port": 0,
  "bearer-only": true
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// --- Middlewares ---
app.use(cors()); 
app.use(express.json());
app.use(keycloak.middleware({ logout: '/logout', admin: '/' }));

// --- Middleware Manual de Roles (Mantenido) ---
const checkRole = (roleName) => {
  return (req, res, next) => {
    try {
      const token = req.kauth.grant.access_token.content;
      const rolesBackend = token.resource_access?.['padel-backend']?.roles || [];
      
      if (rolesBackend.includes(roleName)) {
        next();
      } else {
        res.status(403).json({ message: `Acceso denegado. Se requiere el rol: ${roleName}` });
      }
    } catch (error) {
      console.error("Error verificando roles:", error);
      res.status(403).json({ message: 'Error de autenticación interna' });
    }
  };
};

// =================================================================
// === MONTAJE DE ENDPOINTS MODULARIZADOS (SOLUCIÓN AL ERROR) ===
// =================================================================

app.use('/api/canchas', CanchasRoutes(keycloak, checkRole)); 
app.use('/api/admin', AdminRoutes(keycloak, checkRole));
app.use('/api/turnos', TurnosRoutes(keycloak, checkRole));


// --- 404 Handler ---
app.use((req, res) => {
  console.log("⚠️ 404:", req.path);
  res.status(404).json({ message: `Ruta no encontrada: ${req.path}` });
});

// --- Start ---
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB Conectada.');
    await sequelize.sync({ alter: true }); 
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar:', error);
  }
};

startServer();