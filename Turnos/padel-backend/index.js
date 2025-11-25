// --- Importaciones ---
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import Keycloak from 'keycloak-connect';
import sequelize from './config/database.js';
import { Op } from 'sequelize'; 
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

// --- Middleware Manual de Roles ---
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
// === ENDPOINTS ===
// =================================================================

// --- CANCHAS ---

app.get('/api/canchas', async (req, res) => {
  try {
    const canchas = await Cancha.findAll();
    res.json(canchas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/canchas', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const nuevaCancha = await Cancha.create(req.body);
    res.status(201).json(nuevaCancha); 
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/canchas/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const cancha = await Cancha.findByPk(req.params.id);
    if (!cancha) return res.status(404).json({ message: 'No encontrada' });
    await cancha.update(req.body);
    res.json(cancha);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/canchas/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const cancha = await Cancha.findByPk(req.params.id);
    if (!cancha) return res.status(404).json({ message: 'No encontrada' });
    await cancha.destroy();
    res.json({ message: 'Eliminada' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- HORARIOS (ADMIN) ---

app.get('/api/admin/horarios', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  const { canchaId } = req.query;
  try {
    const horarios = await Horario.findAll({
      where: { cancha_id: canchaId },
      order: [['dia_semana', 'ASC'], ['hora_apertura', 'ASC']]
    });
    res.json(horarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/admin/horarios', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const { cancha_id, dia_semana } = req.body;

    // 1. Verificar duplicidad: Buscar si ya existe un horario para esta cancha y día
    const horarioExistente = await Horario.findOne({
      where: { cancha_id, dia_semana }
    });

    if (horarioExistente) {
      // 2. Si existe, actualizar el horario existente (previene duplicados)
      await horarioExistente.update(req.body);
      return res.status(200).json({ 
          message: 'Horario actualizado (evitando duplicado)', 
          horario: horarioExistente 
      });
    }

    // 3. Si no existe, creamos el nuevo horario (comportamiento original)
    const nuevo = await Horario.create(req.body);
    res.status(201).json(nuevo);
  } catch (error) {
    console.error('Error al crear/actualizar horario:', error);
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/admin/horarios/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const h = await Horario.findByPk(req.params.id);
    if (!h) return res.status(404).json({ message: 'No encontrado' });
    await h.destroy();
    res.json({ message: 'Eliminado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ¡ESTE ES EL QUE FALTABA! DASHBOARD ADMIN ---
app.get('/api/admin/reservas', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
  try {
    const { fecha } = req.query; 
    if (!fecha) return res.status(400).json({ message: 'Falta la fecha' });

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day);
    
    const inicioDia = new Date(fechaObj); inicioDia.setHours(0,0,0,0);
    const finDia = new Date(fechaObj); finDia.setHours(23,59,59,999);

    const reservas = await Turno.findAll({
      where: {
        hora_inicio: { [Op.between]: [inicioDia, finDia] }
      },
      include: [ Cancha ], 
      order: [['hora_inicio', 'ASC']]
    });

    res.json(reservas);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener reservas' });
  }
});


// --- DISPONIBILIDAD (Lógica de Negocio) ---

app.get('/api/turnos/disponibles', keycloak.protect(), async (req, res) => {
  try {
    const { canchaId, fecha } = req.query; 

    if (!canchaId || !fecha) {
      return res.status(400).json({ message: 'Faltan parámetros' });
    }

    const [year, month, day] = fecha.split('-').map(Number);
    const fechaObj = new Date(year, month - 1, day); 
    const diaSemana = fechaObj.getDay(); 

    const horarioBase = await Horario.findOne({
      where: { cancha_id: canchaId, dia_semana: diaSemana }
    });

    if (!horarioBase) return res.json([]); 

    const inicioDia = new Date(fechaObj); inicioDia.setHours(0,0,0,0);
    const finDia = new Date(fechaObj); finDia.setHours(23,59,59,999);

    const turnosOcupados = await Turno.findAll({
      where: {
        cancha_id: canchaId,
        hora_inicio: { [Op.between]: [inicioDia, finDia] },
        estado: { [Op.ne]: 'Cancelado' }
      }
    });

    const slotsDisponibles = [];
    const timeToMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h*60 + m; };
    const minutesToTime = (tm) => { 
      const h = Math.floor(tm / 60).toString().padStart(2, '0'); 
      const m = (tm % 60).toString().padStart(2, '0'); 
      return `${h}:${m}`; 
    };

    let currentMin = timeToMinutes(horarioBase.hora_apertura);
    const closeMin = timeToMinutes(horarioBase.hora_cierre);
    const duracion = horarioBase.duracion_turno_min;

    while (currentMin + duracion <= closeMin) {
      const horaInicioStr = minutesToTime(currentMin);
      const slotInicio = new Date(fechaObj);
      slotInicio.setHours(Math.floor(currentMin/60), currentMin%60, 0);
      
      const estaOcupado = turnosOcupados.some(t => {
        const tInicio = new Date(t.hora_inicio);
        return tInicio.getTime() === slotInicio.getTime();
      });

      if (!estaOcupado) {
        slotsDisponibles.push({ hora: horaInicioStr, disponible: true });
      }
      currentMin += duracion;
    }
    res.json(slotsDisponibles);

  } catch (error) {
    console.error('Error calculando disponibles:', error);
    res.status(500).json({ message: 'Error interno' });
  }
});

// --- RESERVAR TURNO ---
app.post('/api/turnos/reservar', keycloak.protect(), async (req, res) => {
  try {
    const usuarioId = req.kauth.grant.access_token.content.sub; 
    const { canchaId, fecha, hora } = req.body; 

    if (!canchaId || !fecha || !hora) return res.status(400).json({ message: 'Faltan datos' });

    // === VALIDACIÓN DE FECHA Y DÍA ===
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaReservaBase = new Date(year, month - 1, day); 

    const hoy = new Date();
    const soloHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()); 

    // 1. Validación de DÍA PASADO
    if (fechaReservaBase < soloHoy) {
      return res.status(400).json({ message: 'No se puede reservar turnos para fechas pasadas.' });
    }
    
    // 2. Cálculo del inicio del turno
    const [h, m] = hora.split(':').map(Number);
    
    // Creamos la fecha de inicio final que guardaremos en la DB (con la hora correcta)
    const fechaInicio = new Date(fechaReservaBase); // Usamos la fecha limpia de la reserva
    fechaInicio.setHours(h, m, 0, 0); 
    
    // 3. Validación de HORA PASADA (SOLO si la reserva es para HOY)
    if (fechaReservaBase.getTime() === soloHoy.getTime()) {
        // Comparamos la fecha de inicio del turno con la hora actual
        if (fechaInicio < new Date()) { 
            return res.status(400).json({ message: 'El horario seleccionado ya ha pasado para el día de hoy.' });
        }
    }

    // 🔴 CORRECCIÓN: Usar fechaReservaBase para obtener el día de la semana
    const diaSemana = fechaReservaBase.getDay(); 

    const horarioConfig = await Horario.findOne({
      where: { cancha_id: canchaId, dia_semana: diaSemana }
    });

    if (!horarioConfig) return res.status(400).json({ message: 'Cancha cerrada' });

    // ⚠️ IMPORTANTE: ¡fechaInicio ya fue calculada arriba! La reutilizamos aquí.
    // const fechaInicio = new Date(fechaBase); // ELIMINADA
    // fechaInicio.setHours(h, m, 0, 0);       // ELIMINADA

    const fechaFin = new Date(fechaInicio.getTime() + horarioConfig.duracion_turno_min * 60000);

    const ocupado = await Turno.findOne({
      where: {
        cancha_id: canchaId,
        hora_inicio: fechaInicio,
        estado: { [Op.ne]: 'Cancelado' }
      }
    });

    if (ocupado) return res.status(409).json({ message: 'Turno ya reservado' });

    const nuevoTurno = await Turno.create({
      cancha_id: canchaId,
      usuario_id: usuarioId,
      hora_inicio: fechaInicio,
      hora_fin: fechaFin,
      estado: 'Confirmado'
    });

    res.status(201).json(nuevoTurno);

  } catch (error) {
    console.error('Error reservando:', error);
    res.status(500).json({ message: 'Error al reservar' });
  }
});

// --- CANCELAR TURNO (USUARIO) ---
app.put('/api/turnos/:id/cancelar', keycloak.protect(), checkRole('club-user'), async (req, res) => {
  try {
    const usuarioId = req.kauth.grant.access_token.content.sub;
    const turnoId = req.params.id;

    const turno = await Turno.findByPk(turnoId);

    if (!turno) return res.status(404).json({ message: 'Turno no encontrado' });

    // Validar que sea el dueño
    if (turno.usuario_id !== usuarioId) {
      return res.status(403).json({ message: 'No puedes cancelar un turno que no es tuyo' });
    }

    if (turno.estado === 'Cancelado') {
      return res.status(400).json({ message: 'El turno ya está cancelado' });
    }

    await turno.update({ estado: 'Cancelado' });
    res.json({ message: 'Turno cancelado', turno });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al cancelar' });
  }
});

// --- MIS TURNOS ---
app.get('/api/turnos/mis-turnos', keycloak.protect(), checkRole('club-user'), async (req, res) => {
  try {
    const usuarioId = req.kauth.grant.access_token.content.sub;
    const turnos = await Turno.findAll({
      where: { usuario_id: usuarioId },
      include: [ Cancha ] 
    });
    res.json(turnos.map(t => ({
      id: t.id,
      hora_inicio: t.hora_inicio,
      hora_fin: t.hora_fin,
      estado: t.estado,
      cancha: { nombre: t.Cancha?.nombre }
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

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