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

// Configuración de la IA
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Configuración del Correo
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post("/api/valuation", async (req, res) => {
  try {
    const { propertyData, userData } = req.body;

    // 1. Llamada a la IA para calcular la valoración
    const model = ai.models.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Actúa como un tasador inmobiliario experto en la Costa del Sol. 
    Calcula el valor de mercado de esta propiedad:
    Tipo: ${propertyData.type}, Ubicación: ${propertyData.location}, 
    Superficie: ${propertyData.size}m2, Habitaciones: ${propertyData.rooms}, 
    Estado: ${propertyData.condition}.
    Devuelve un informe profesional en formato JSON con: valuation (número), 
    minValuation, maxValuation y un breve análisis técnico.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Intentar extraer el JSON de la respuesta de la IA
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const valuationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { valuation: 0, analysis: "Error en cálculo" };

    // 2. Enviar Email al Administrador (Tú)
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // Te llega a ti
      subject: `Nuevo Lead: Valoración en ${propertyData.location}`,
      html: `
        <h2>Nuevo Cliente Interesado</h2>
        <p><strong>Nombre:</strong> ${userData.name}</p>
        <p><strong>Email:</strong> ${userData.email}</p>
        <p><strong>Teléfono:</strong> ${userData.phone}</p>
        <hr>
        <p><strong>Propiedad:</strong> ${propertyData.type} en ${propertyData.location}</p>
        <p><strong>Valoración Estimada:</strong> ${valuationResult.valuation} €</p>
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
