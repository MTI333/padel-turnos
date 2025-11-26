// padel-backend/routes/canchas.js
import express from 'express';
import { Cancha } from '../models/index.js'; 

const router = express.Router();

// 💡 Exportación como función para inyectar keycloak y checkRole
export default (keycloak, checkRole) => {
    
    // GET /api/canchas
    router.get('/', async (req, res) => {
      try {
        const canchas = await Cancha.findAll();
        res.json(canchas);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    
    // POST /api/canchas (CON LA CORRECCIÓN DE UNICIDAD)
    router.post('/', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
      try {
        const { nombre } = req.body;
        
        // Validación de unicidad
        const canchaExistente = await Cancha.findOne({
            where: { nombre: nombre }
        });

        if (canchaExistente) {
            return res.status(409).json({ message: `Ya existe una cancha con el nombre: ${nombre}` });
        }

        const nuevaCancha = await Cancha.create(req.body);
        res.status(201).json(nuevaCancha); 
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    
    // PUT /api/canchas/:id
    router.put('/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
      try {
        const cancha = await Cancha.findByPk(req.params.id);
        if (!cancha) return res.status(404).json({ message: 'No encontrada' });
        await cancha.update(req.body);
        res.json(cancha);
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });
    
    // DELETE /api/canchas/:id
    router.delete('/:id', keycloak.protect(), checkRole('club-admin'), async (req, res) => {
      try {
        const cancha = await Cancha.findByPk(req.params.id);
        if (!cancha) return res.status(404).json({ message: 'No encontrada' });
        await cancha.destroy();
        res.json({ message: 'Eliminada' });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
    });

    return router;
};