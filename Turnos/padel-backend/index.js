// --- Importaciones ---
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import Keycloak from 'keycloak-connect';
import sequelize from './config/database.js';
import { Cancha, Horario, Turno } from './models/index.js'; 

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
// (Esta configuración estaba bien)
const keycloakConfig = {
  realm: 'padel-club',
  "auth-server-url": 'http://localhost:9090/',
  "ssl-required": 'none',
  resource: 'padel-backend', // El Client ID del backend
  credentials: {
    secret: 'bHqsq9qcY5eId5NV2TuYu9kMKks5aXcN' // Tu secret
  },
  "confidential-port": 0
};

const keycloak = new Keycloak({ store: memoryStore }, keycloakConfig);

// --- Middlewares ---
app.use(cors()); 
app.use(express.json());
app.use(keycloak.middleware({
  logout: '/logout', 
  admin: '/'
}));

// ------------------------------------
// --- API ENDPOINTS PARA CANCHAS ---
// ------------------------------------

// GET /api/canchas (Público - Sin cambios)
app.get('/api/canchas', async (req, res) => {
  // ... (código sin cambios)
  try {
    const canchas = await Cancha.findAll();
    res.json(canchas);
  } catch (error) {
    console.error('Error al consultar canchas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * @route   POST /api/canchas
 * @desc    Crea una nueva cancha
 * @access  PROTEGIDO (¡CAMBIO AQUÍ!)
 */
// ANTES: keycloak.protect('club-admin')
// AHORA: keycloak.protect('realm:club-admin')
app.post('/api/canchas', keycloak.protect('realm:club-admin'), async (req, res) => {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre || !tipo) {
      return res.status(400).json({ message: 'Faltan los campos "nombre" o "tipo"' });
    }
    const nuevaCancha = await Cancha.create({ nombre, tipo });
    res.status(201).json(nuevaCancha); 
  } catch (error) {
    console.error('Error al crear cancha:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Ya existe una cancha con ese nombre' });
    }
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * @route   PUT /api/canchas/:id
 * @desc    Actualiza una cancha existente
 * @access  PROTEGIDO (¡CAMBIO AQUÍ!)
 */
// ANTES: keycloak.protect('club-admin')
// AHORA: keycloak.protect('realm:club-admin')
app.put('/api/canchas/:id', keycloak.protect('realm:club-admin'), async (req, res) => {
  try {
    const cancha = await Cancha.findByPk(req.params.id);
    if (!cancha) return res.status(404).json({ message: 'Cancha no encontrada' });
    const { nombre, tipo } = req.body;
    await cancha.update({ nombre: nombre || cancha.nombre, tipo: tipo || cancha.tipo });
    res.json(cancha);
  } catch (error) {
    console.error('Error al actualizar cancha:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

/**
 * @route   DELETE /api/canchas/:id
 * @desc    Elimina una cancha
 * @access  PROTEGIDO (¡CAMBIO AQUÍ!)
 */
// ANTES: keycloak.protect('club-admin')
// AHORA: keycloak.protect('realm:club-admin')
app.delete('/api/canchas/:id', keycloak.protect('realm:club-admin'), async (req, res) => {
  try {
    const cancha = await Cancha.findByPk(req.params.id);
    if (!cancha) return res.status(404).json({ message: 'Cancha no encontrada' });
    await cancha.destroy();
    res.json({ message: 'Cancha eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar cancha:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ------------------------------------
// --- API ENDPOINTS PARA HORARIOS (ADMIN) ---
// ------------------------------------

// GET /api/admin/horarios (Protegido - ¡CAMBIO AQUÍ!)
app.get('/api/admin/horarios', keycloak.protect('realm:club-admin'), async (req, res) => {
  const { canchaId } = req.query;
  if (!canchaId) return res.status(400).json({ message: 'Se requiere el canchaId' });
  try {
    const horarios = await Horario.findAll({
      where: { cancha_id: canchaId },
      order: [['dia_semana', 'ASC'], ['hora_apertura', 'ASC']]
    });
    res.json(horarios);
  } catch (error) {
    console.error('Error al obtener horarios:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// POST /api/admin/horarios (Protegido - ¡CAMBIO AQUÍ!)
app.post('/api/admin/horarios', keycloak.protect('realm:club-admin'), async (req, res) => {
  try {
    const { cancha_id, dia_semana, hora_apertura, hora_cierre, duracion_turno_min } = req.body;
    if (cancha_id == null || dia_semana == null || !hora_apertura || !hora_cierre || !duracion_turno_min) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }
    const nuevoHorario = await Horario.create({
      cancha_id, dia_semana, hora_apertura, hora_cierre, duracion_turno_min
    });
    res.status(201).json(nuevoHorario);
  } catch (error) {
    console.error('Error al crear horario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// DELETE /api/admin/horarios/:id (Protegido - ¡CAMBIO AQUÍ!)
app.delete('/api/admin/horarios/:id', keycloak.protect('realm:club-admin'), async (req, res) => {
  try {
    const horario = await Horario.findByPk(req.params.id);
    if (!horario) return res.status(404).json({ message: 'Horario no encontrado' });
    await horario.destroy();
    res.json({ message: 'Horario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ------------------------------------
// --- API ENDPOINTS PARA TURNOS (USUARIO) ---
// ------------------------------------

/**
 * @route   GET /api/turnos/mis-turnos
 * @desc    Obtiene los turnos del usuario logueado
 * @access  PROTEGIDO (¡CAMBIO AQUÍ!)
 */
// ANTES: keycloak.protect('club-user')
// AHORA: keycloak.protect('realm:club-user')
app.get('/api/turnos/mis-turnos', keycloak.protect('realm:club-user'), async (req, res) => {
  try {
    const usuarioId = req.kauth.grant.access_token.content.sub;
    const turnos = await Turno.findAll({
      where: { usuario_id: usuarioId },
      include: [ Cancha ] 
    });
    const resultado = turnos.map(t => ({
      id: t.id,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      cancha: { id: t.Cancha.id, nombre: t.Cancha.nombre }
    }));
    res.json(resultado);
  } catch (error) {
    console.error('Error al consultar mis-turnos:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
});

// ------------------------------------
// --- RUTA DE DEBUG (La dejamos por si acaso) ---
// ------------------------------------
app.get('/api/debug/token', keycloak.protect(), (req, res) => {
  res.json({
    message: "Contenido del token visto por el backend",
    tokenContent: req.kauth.grant.access_token.content
  });
});


// --- Función de arranque ---
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión con la base de datos (SQLite) establecida.');
    await sequelize.sync({ alter: true }); 
    console.log('✅ Modelos (Cancha, Horario, Turno) sincronizados.');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ No se pudo conectar o iniciar el servidor:', error);
  }
};

startServer();