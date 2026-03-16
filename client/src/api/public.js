import api from './axios';

const base = (slug) => `/public/${slug}`;

export const getBusinessInfo = (slug) => api.get(`${base(slug)}/info`).then(r => r.data);
export const getPublicServices = (slug) => api.get(`${base(slug)}/services`).then(r => r.data);
export const getPublicWorkers = (slug) => api.get(`${base(slug)}/workers`).then(r => r.data);
export const getPublicSlots = (slug, params) => api.get(`${base(slug)}/slots`, { params }).then(r => r.data);
export const getPublicAvailableDays = (slug, params) => api.get(`${base(slug)}/available-days`, { params }).then(r => r.data);
export const publicBook = (slug, data) => api.post(`${base(slug)}/book`, data).then(r => r.data);
export const checkSlug = (slug) => api.get('/public/check-slug', { params: { slug } }).then(r => r.data);
export const registerBusiness = (data) => api.post('/register-business', data).then(r => r.data);
