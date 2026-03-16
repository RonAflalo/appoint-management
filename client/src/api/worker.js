import api from './axios';
export const getWorkerAppointments = (params) => api.get('/worker/appointments', { params }).then(r => r.data);
export const updateWorkerAppointmentStatus = (id, status) => api.put(`/worker/appointments/${id}/status`, { status }).then(r => r.data);
export const getAvailability = () => api.get('/worker/availability').then(r => r.data);
export const setAvailability = (data) => api.post('/worker/availability', data).then(r => r.data);
