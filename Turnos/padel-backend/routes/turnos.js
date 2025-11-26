// padel-backend/routes/turnos.js
import express from 'express';
import { Turno, Horario, Cancha } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// 💡 Exportación como función para inyectar keycloak y checkRole
export default (keycloak, checkRole) => {

    // --- DISPONIBILIDAD ---

    // GET /api/turnos/disponibles
    router.get('/disponibles', keycloak.protect(), async (req, res) => {
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

    // POST /api/turnos/reservar
    router.post('/reservar', keycloak.protect(), async (req, res) => {
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
        
        const fechaInicio = new Date(fechaReservaBase);
        fechaInicio.setHours(h, m, 0, 0); 
        
        // 3. Validación de HORA PASADA (SOLO si la reserva es para HOY)
        if (fechaReservaBase.getTime() === soloHoy.getTime()) {
            if (fechaInicio < new Date()) { 
                return res.status(400).json({ message: 'El horario seleccionado ya ha pasado para el día de hoy.' });
            }
        }

        const diaSemana = fechaReservaBase.getDay(); 

        const horarioConfig = await Horario.findOne({
          where: { cancha_id: canchaId, dia_semana: diaSemana }
        });

        if (!horarioConfig) return res.status(400).json({ message: 'Cancha cerrada' });

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

    // PUT /api/turnos/:id/cancelar
    router.put('/:id/cancelar', keycloak.protect(), checkRole('club-user'), async (req, res) => {
      try {
        const usuarioId = req.kauth.grant.access_token.content.sub;
        const turnoId = req.params.id;

        const turno = await Turno.findByPk(turnoId);

        if (!turno) return res.status(404).json({ message: 'Turno no encontrado' });

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

    // GET /api/turnos/mis-turnos
    router.get('/mis-turnos', keycloak.protect(), checkRole('club-user'), async (req, res) => {
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
    
    return router;
};