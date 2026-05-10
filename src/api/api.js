import axios from "axios";

const API_BASE_URL = String(process.env.REACT_APP_API_URL || "").trim();

if (!API_BASE_URL) {
  throw new Error("Missing REACT_APP_API_URL. Set it in the frontend .env before starting or building the app.");
}

const API = axios.create({
  baseURL: API_BASE_URL,
});




// attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

export default API;

