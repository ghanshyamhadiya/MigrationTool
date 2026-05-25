import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:8080',
    timeout: 300000, // 5 min timeout for AI processing
});

export default api;
