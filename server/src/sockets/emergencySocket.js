export const alerts = new Map();
let io;
export function configureEmergencySocket(server) { io = server; server.on('connection', socket => { socket.on('sos:acknowledge', (id) => { const a = alerts.get(id); if (a) {
    a.status = 'acknowledged';
    a.acknowledgedAt = new Date().toISOString();
    io?.emit('sos:acknowledged', a);
} }); }); }
export function createSos(input) { const a = { id: `SOS-${Date.now().toString(36).toUpperCase()}`, coordinates: { latitude: input.latitude, longitude: input.longitude }, timestamp: new Date().toISOString(), urgency: input.urgency, conditionSummary: input.conditionSummary, status: 'received', etaMinutes: 12 }; alerts.set(a.id, a); io?.emit('sos:created', a); setTimeout(() => { if (alerts.has(a.id)) {
    a.status = 'dispatching';
    io?.emit('sos:update', a);
} }, 1200); setTimeout(() => { if (alerts.has(a.id)) {
    a.status = 'en_route';
    a.etaMinutes = 9;
    io?.emit('sos:update', a);
} }, 3000); return a; }
