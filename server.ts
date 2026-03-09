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
app.use(express.static(path.join(__dirname, "dist")));

// Inicialización de la IA (Gemini 3 Flash - Versión recomendada)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Configuración del Correo (Ajustada para Hostinger)
const smtpPort = parseInt(process.env.SMTP_PORT || "465");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465, // Si usas 465 en Hostinger, esto se activa automáticamente
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Esto ayuda a evitar bloqueos de certificados en Hostinger
  }
});

app.post("/api/valuation", async (req, res) => {
  try {
    const { propertyData, userData } = req.body;

    // 1. Llamada a la IA usando el método correcto
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Actúa como un tasador inmobiliario experto en la Costa del Sol. 
      Calcula el valor de mercado de esta propiedad:
      Tipo: ${propertyData.type}, Ubicación: ${propertyData.location}, 
      Superficie: ${propertyData.size}m2, Habitaciones: ${propertyData.rooms}, 
      Estado: ${propertyData.condition}.
      Devuelve un informe profesional en formato JSON con: valuation (número), 
      minValuation, maxValuation y un breve análisis técnico.`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const valuationResult = JSON.parse(response.text);

    // 2. Enviar Email al Administrador (Tú)
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: `Nuevo Lead: Valoración en ${propertyData.location}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #1a1a1a;">Nuevo Cliente Interesado</h2>
          <p><strong>Nombre:</strong> ${userData.name}</p>
          <p><strong>Email:</strong> ${userData.email}</p>
          <p><strong>Teléfono:</strong> ${userData.phone}</p>
          <hr style="border: 1px solid #eee;">
          <p><strong>Propiedad:</strong> ${propertyData.type} en ${propertyData.location}</p>
          <p><strong>Superficie:</strong> ${propertyData.size} m²</p>
          <p style="font-size: 18px; color: #2e7d32;"><strong>Valoración Estimada:</strong> ${valuationResult.valuation.toLocaleString()} €</p>
          <p><strong>Análisis:</strong> ${valuationResult.analysis || 'N/A'}</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, data: valuationResult });
  } catch (error) {
    console.error("Error en el servidor:", error);
    res.status(500).json({ success: false, error: "Error interno del servidor" });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor funcionando en puerto ${PORT}`);
});
