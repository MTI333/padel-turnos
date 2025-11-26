// padel-backend/routes/admin.js
import express from 'express';
import { Horario, Turno, Cancha } from '../models/index.js';
import { Op } from 'sequelize';

const router = express.Router();

// 💡 Exportación como función para inyectar keycloak y checkRole
export default (keycloak, checkRole) => {

    // --- HORARIOS (ADMIN) ---

    // GET /api/admin/horarios
    router.get('/horarios', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
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

    // POST /api/admin/horarios (Corrección: Evita duplicados / Actualiza)
    router.post('/horarios', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
      try {
        const { cancha_id, dia_semana } = req.body;

        const horarioExistente = await Horario.findOne({
          where: { cancha_id, dia_semana }
        });

        if (horarioExistente) {
          await horarioExistente.update(req.body);
          return res.status(200).json({ 
              message: 'Horario actualizado (evitando duplicado)', 
              horario: horarioExistente 
          });
        }

        const nuevo = await Horario.create(req.body);
        res.status(201).json(nuevo);
      } catch (error) {
        console.error('Error al crear/actualizar horario:', error);
        res.status(500).json({ message: error.message });
      }
    });

    // DELETE /api/admin/horarios/:id
    router.delete('/horarios/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
      try {
        const h = await Horario.findByPk(req.params.id);
        if (!h) return res.status(404).json({ message: 'No encontrado' });
        await h.destroy();
        res.json({ message: 'Eliminado' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });


    // --- DASHBOARD ADMIN ---

    // GET /api/admin/reservas
    router.get('/reservas', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
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
    
    return router;
};