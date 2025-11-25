import { useState, useEffect } from 'react';
import axios from 'axios';
import { useKeycloak } from '@react-keycloak/web';
import './App.css'; // ¡IMPORTANTE! Importamos los estilos

const API_URL = 'http://localhost:8080/api';

function App() {
  const { keycloak, initialized } = useKeycloak();

  // --- Estados ---
  const [canchas, setCanchas] = useState([]);
  const [error, setError] = useState(null);
  const [misTurnos, setMisTurnos] = useState([]);
  const [turnosError, setTurnosError] = useState(null);

  // Admin
  const [horariosAdmin, setHorariosAdmin] = useState([]);
  const [canchaSeleccionadaAdmin, setCanchaSeleccionadaAdmin] = useState(null);
  const [reservasDiaAdmin, setReservasDiaAdmin] = useState([]);
  const [fechaDashboard, setFechaDashboard] = useState(new Date().toISOString().split('T')[0]);

  // Reserva
  const [canchaReserva, setCanchaReserva] = useState(null);
  const [fechaReserva, setFechaReserva] = useState(new Date().toISOString().split('T')[0]); 
  const [slotsDisponibles, setSlotsDisponibles] = useState([]);
  const [buscandoSlots, setBuscandoSlots] = useState(false);

  // --- Axios ---
  const apiClient = axios.create({ baseURL: API_URL });
  apiClient.interceptors.request.use((config) => {
    if (keycloak.authenticated) config.headers.Authorization = `Bearer ${keycloak.token}`;
    return config;
  }, (error) => Promise.reject(error));

  // Roles
  const isAdmin = keycloak.authenticated && keycloak.hasResourceRole('club-admin', 'padel-backend');
  const isUser = keycloak.authenticated && keycloak.hasResourceRole('club-user', 'padel-backend');

  // --- Funciones Fetch ---
  const fetchCanchas = async () => {
    try {
      const response = await apiClient.get('/canchas');
      setCanchas(response.data);
      if (response.data.length > 0) {
        if (!canchaSeleccionadaAdmin) setCanchaSeleccionadaAdmin(response.data[0].id);
        if (!canchaReserva) setCanchaReserva(response.data[0].id);
      }
    } catch (err) { setError("Error al cargar canchas."); }
  };

  const fetchMisTurnos = async () => {
    if (keycloak.authenticated) {
      try {
        const response = await apiClient.get('/turnos/mis-turnos');
        setMisTurnos(response.data);
        setTurnosError(null); 
      } catch (err) { setTurnosError("No se pudieron cargar tus turnos."); }
    }
  };

  const fetchDashboardReservas = async () => {
    if (!isAdmin) return;
    try {
      const response = await apiClient.get('/admin/reservas', { params: { fecha: fechaDashboard } });
      setReservasDiaAdmin(response.data);
    } catch (error) { console.error(error); }
  };

  const fetchHorariosConfig = async (canchaId) => {
    if (!canchaId || !isAdmin) return setHorariosAdmin([]);
    try {
      const response = await apiClient.get(`/admin/horarios?canchaId=${canchaId}`);
      setHorariosAdmin(response.data);
    } catch (err) { console.error(err); }
  };

  const buscarDisponibilidad = async () => {
    if (!canchaReserva || !fechaReserva) return;
    setBuscandoSlots(true);
    setSlotsDisponibles([]); 
    try {
      const response = await apiClient.get(`/turnos/disponibles`, {
        params: { canchaId: canchaReserva, fecha: fechaReserva }
      });
      setSlotsDisponibles(response.data);
    } catch (error) { alert("Error al buscar horarios."); } 
    finally { setBuscandoSlots(false); }
  };

  // --- Handlers ---
  const handleCrearCanchaPrueba = async () => {
    try {
      await apiClient.post('/canchas', { nombre: `Cancha #${Math.floor(Math.random() * 100)}`, tipo: 'Blindex' });
      alert('Cancha creada'); fetchCanchas();
    } catch (error) { alert(error.message); }
  };

  const handleCrearAgendaSemanal = async () => {
    if (!canchaSeleccionadaAdmin || !confirm("¿Crear agenda semanal (90 min)?")) return;
    try {
      const diasSemana = [0, 1, 2, 3, 4, 5, 6];
      await Promise.all(diasSemana.map(dia => {
        return apiClient.post('/admin/horarios', {
          cancha_id: canchaSeleccionadaAdmin, dia_semana: dia,
          hora_apertura: "09:00", hora_cierre: "23:00", duracion_turno_min: 90 
        });
      }));
      alert('Agenda creada.');
      fetchHorariosConfig(canchaSeleccionadaAdmin);
      const hoy = new Date().toISOString().split('T')[0];
      setCanchaReserva(canchaSeleccionadaAdmin);
      setFechaReserva(hoy);
      buscarDisponibilidad();
    } catch (error) { alert(error.message); }
  };

  const handleBorrarHorario = async (id) => {
    if (confirm("¿Borrar horario?")) {
      try {
        await apiClient.delete(`/admin/horarios/${id}`);
        fetchHorariosConfig(canchaSeleccionadaAdmin);
      } catch (error) { alert(error.message); }
    }
  };

  const handleReservarTurno = async (hora) => {
    if (!confirm(`¿Reservar el ${fechaReserva} a las ${hora}?`)) return;
    try {
      await apiClient.post('/turnos/reservar', { canchaId: canchaReserva, fecha: fechaReserva, hora: hora });
      alert("✅ ¡Turno reservado!");
      setSlotsDisponibles([]); fetchMisTurnos(); 
      if (isAdmin) fetchDashboardReservas();
    } catch (error) { alert(`❌ Error: ${error.response?.data?.message || "Error"}`); }
  };

  const handleCancelarTurno = async (id) => {
    if (!confirm("¿Cancelar turno?")) return;
    try {
      await apiClient.put(`/turnos/${id}/cancelar`);
      alert("Turno cancelado");
      fetchMisTurnos();
      if (isAdmin) fetchDashboardReservas();
    } catch (error) { alert(`Error: ${error.response?.data?.message}`); }
  };

  // --- Effects ---
  useEffect(() => {
    if (initialized) {
      fetchCanchas();
      if (keycloak.authenticated) fetchMisTurnos();
    }
  }, [initialized, keycloak.authenticated]);

  useEffect(() => {
    if (canchaSeleccionadaAdmin && initialized && isAdmin) fetchHorariosConfig(canchaSeleccionadaAdmin);
  }, [canchaSeleccionadaAdmin, initialized, isAdmin]);

  useEffect(() => {
    if (initialized && isAdmin) fetchDashboardReservas();
  }, [fechaDashboard, initialized, isAdmin]);

  if (!initialized) return <div className="loading">Cargando Sistema...</div>;

  const todayISO = new Date().toISOString().split('T')[0];

  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">🎾 Pádel-Club Manager</h1>
        <div className="user-info">
          {!keycloak.authenticated ? (
            <button className="btn-primary" onClick={() => keycloak.login()}>Iniciar Sesión</button>
          ) : (
            <>
              <span>Hola, <span className="user-name">{keycloak.tokenParsed?.preferred_username}</span></span>
              <button className="btn-danger" onClick={() => keycloak.logout()}>Salir</button>
            </>
          )}
        </div>
      </header>

      <main className="main-grid">
        
        {/* --- PANEL PRINCIPAL (USUARIO) --- */}
        {keycloak.authenticated && (
          <>
            {/* RESERVAR */}
            <section className="card">
              <h2>📅 Reservar Turno</h2>
              <div className="form-group">
                <label>Cancha:</label>
                <select value={canchaReserva || ''} onChange={e => setCanchaReserva(e.target.value)}>
                  <option value="">Seleccione...</option>
                  {canchas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Fecha:</label>
                <input type="date" value={fechaReserva} onChange={e => setFechaReserva(e.target.value)} min={todayISO} />
              </div>
              <button className="btn-primary" style={{width: '100%', marginTop: '10px'}} onClick={buscarDisponibilidad}>
                {buscandoSlots ? '...' : '🔍 Buscar Disponibilidad'}
              </button>

              <div className="slots-grid">
                {slotsDisponibles.map((slot, index) => (
                  <button key={index} className="btn-slot" onClick={() => handleReservarTurno(slot.hora)}>
                    {slot.hora}
                  </button>
                ))}
              </div>
              {slotsDisponibles.length === 0 && !buscandoSlots && <p style={{textAlign:'center', color:'#666', marginTop:'20px'}}>Selecciona fecha y busca.</p>}
            </section>

            {/* MIS RESERVAS */}
            {isUser && (
              <section className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                  <h3 style={{margin:0}}>Mis Reservas</h3>
                  <button className="btn-primary" onClick={fetchMisTurnos} style={{padding:'5px 10px', fontSize:'0.8rem'}}>↻</button>
                </div>
                {turnosError && <div className="error-box">{turnosError}</div>}
                <ul>
                  {misTurnos.map(t => {
                    const cancelado = t.estado === 'Cancelado';
                    return (
                      <li key={t.id} className={`list-item ${cancelado ? 'cancelado' : ''}`}>
                        <div>
                          <div style={{fontWeight:'bold', color: cancelado ? 'inherit' : 'var(--primary)'}}>
                            {new Date(t.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          <div style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>
                            {new Date(t.hora_inicio).toLocaleDateString()} - {t.cancha?.nombre}
                          </div>
                        </div>
                        {!cancelado && <button className="btn-danger" onClick={() => handleCancelarTurno(t.id)}>Cancelar</button>}
                        {cancelado && <span style={{color:'var(--danger)', fontSize:'0.8rem'}}>Cancelado</span>}
                      </li>
                    )
                  })}
                </ul>
                {misTurnos.length === 0 && <p style={{color:'var(--text-muted)'}}>No tienes reservas activas.</p>}
              </section>
            )}
          </>
        )}

        {/* --- ZONA ADMIN --- */}
        {isAdmin && (
          <section className="card admin-zone">
            <h2 className="admin-header">👑 Zona Admin</h2>
            
            {/* DASHBOARD */}
            <div style={{ marginBottom: '30px' }}>
              <h3>📊 Ocupación del Día</h3>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                <input type="date" value={fechaDashboard} onChange={e => setFechaDashboard(e.target.value)} style={{maxWidth:'200px'}} />
                <button className="btn-primary" onClick={fetchDashboardReservas}>Refrescar</button>
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Hora</th>
                      <th>Cancha</th>
                      <th>Usuario</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservasDiaAdmin.length === 0 ? (
                      <tr><td colSpan="4" style={{textAlign: 'center', color:'var(--text-muted)'}}>Sin reservas.</td></tr>
                    ) : (
                      reservasDiaAdmin.map(r => (
                        <tr key={r.id} style={{ opacity: r.estado === 'Cancelado' ? 0.5 : 1 }}>
                          <td style={{color: 'var(--primary)'}}>{new Date(r.hora_inicio).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                          <td>{r.Cancha?.nombre}</td>
                          <td style={{fontSize: '0.85em', color:'var(--text-muted)'}}>{r.usuario_id}</td>
                          <td style={{color: r.estado==='Cancelado' ? 'var(--danger)' : 'var(--primary)'}}>{r.estado}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="divider"></div>

            {/* CONFIGURACIÓN */}
            <div>
              <h3>⚙️ Configuración</h3>
              <div className="form-group" style={{flexDirection:'row', flexWrap:'wrap'}}>
                <select value={canchaSeleccionadaAdmin || ''} onChange={e => setCanchaSeleccionadaAdmin(e.target.value)} style={{maxWidth:'250px'}}>
                  {canchas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button className="btn-admin" onClick={handleCrearAgendaSemanal}>⚡ Agenda Semanal (90 min)</button>
                <button className="btn-admin" onClick={handleCrearCanchaPrueba}>+ Cancha</button>
              </div>
              
              <div className="admin-grid">
                {horariosAdmin.map(h => (
                  <div key={h.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', border:'1px solid #444', display:'flex', justifyContent:'space-between' }}>
                    <span><strong style={{color:'var(--admin-border)'}}>{dias[h.dia_semana]}</strong>: {h.hora_apertura}-{h.hora_cierre}</span>
                    <button onClick={() => handleBorrarHorario(h.id)} style={{color:'var(--danger)', background:'none', padding:0}}>✖</button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* LISTA PÚBLICA (Solo visible si no hay admin seleccionado para no saturar, o abajo) */}
        <section className="card" style={{gridColumn: '1 / -1'}}>
          <h3>📍 Canchas del Club</h3>
          <ul style={{display:'flex', gap:'15px', flexWrap:'wrap'}}>
            {canchas.map(c => (
              <li key={c.id} style={{background:'var(--bg-input)', padding:'10px 20px', borderRadius:'20px', border:'1px solid #444'}}>
                {c.nombre} <span style={{color:'var(--text-muted)', fontSize:'0.8em'}}>({c.tipo})</span>
              </li>
            ))}
          </ul>
        </section>

      </main>
    </div>
  );
}

export default App;