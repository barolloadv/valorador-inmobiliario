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

// 1. Inicialización de la IA (Usamos 1.5-flash que es la más estable)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// 2. Configuración del Correo (Hostinger)
const smtpPort = parseInt(process.env.SMTP_PORT || "587");
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false }
});

app.post("/api/valuation", async (req, res) => {
  console.log("--- Nueva petición de valoración recibida ---");
  try {
    const { propertyData, userData } = req.body;

    // VALIDACIÓN DE CLAVE API
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("Falta la clave GEMINI_API_KEY en Render");
    }

    // LLAMADA A LA IA
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Cambiado a 1.5-flash para máxima estabilidad
      contents: `Actúa como un tasador inmobiliario experto en la Costa del Sol. 
      Calcula el valor de mercado de esta propiedad:
      Tipo: ${propertyData.type}, Ubicación: ${propertyData.location}, 
      Superficie: ${propertyData.size}m2, Habitaciones: ${propertyData.rooms}, 
      Estado: ${propertyData.condition}.
      Devuelve un informe profesional en formato JSON con: valuation (número), 
      minValuation (número), maxValuation (número) y un breve análisis técnico.`,
      config: { responseMimeType: "application/json" }
    });

    // LIMPIEZA Y PARSEO DEL JSON
    let text = response.text || "";
    // A veces la IA devuelve ```json ... ```, lo limpiamos:
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const valuationResult = JSON.parse(cleanJson);

    console.log("Valoración calculada con éxito:", valuationResult.valuation);

    // ENVÍO DE EMAIL (En un bloque separado para que si falla no rompa la web)
    try {
      const mailOptions = {
        from: process.env.SMTP_USER,
        to: process.env.SMTP_USER,
        subject: `Nuevo Lead: ${userData.name} - ${propertyData.location}`,
        html: `<h3>Nuevo Lead</h3><p>Nombre: ${userData.name}</p><p>Valor: ${valuationResult.valuation} €</p>`
      };
      await transporter.sendMail(mailOptions);
      console.log("Email enviado correctamente");
    } catch (mailError) {
      console.error("Error enviando email (pero la valoración sigue):", mailError);
    }

    // RESPUESTA AL CLIENTE
    res.json({ success: true, data: valuationResult });

  } catch (error: any) {
    console.error("ERROR CRÍTICO EN EL SERVIDOR:", error.message);
    res.status(500).json({ 
      success: false, 
      error: "Error en el cálculo",
      details: error.message 
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
