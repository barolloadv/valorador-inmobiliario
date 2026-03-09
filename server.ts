import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import nodemailer from "nodemailer";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- SERVIR ARCHIVOS ESTÁTICOS (LA WEB) ---
// Esta parte es la que le dice al servidor: "Muestra la carpeta dist"
app.use(express.static(path.join(__dirname, "dist")));

// --- TUS RUTAS DE API (IA Y EMAIL) ---
app.post("/api/valuation", async (req, res) => {
  // Aquí va tu lógica de valoración que ya teníamos...
  res.json({ success: true }); 
});

// --- SIEMPRE MOSTRAR EL INDEX.HTML SI NO ES UNA RUTA DE API ---
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor listo en el puerto ${PORT}`);
});
