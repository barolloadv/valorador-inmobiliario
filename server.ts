import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting server...");
  try {
    const db = new Database("leads.db");

    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not set in environment variables.");
    }
    const ai = new GoogleGenAI({ apiKey: apiKey || "" });

    // Initialize database
    db.exec(`
      CREATE TABLE IF NOT EXISTS leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        property_type TEXT,
        size INTEGER,
        rooms INTEGER,
        bathrooms INTEGER,
        half_baths INTEGER,
        floor INTEGER,
        house_floors INTEGER,
        construction_year INTEGER,
        last_full_renovation_year INTEGER,
        last_partial_renovation_year INTEGER,
        accessibility TEXT,
        estimated_value TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: Add missing columns if they don't exist
    const columns = db.prepare("PRAGMA table_info(leads)").all() as any[];
    const columnNames = columns.map(c => c.name);

    if (!columnNames.includes('last_full_renovation_year')) {
      db.exec("ALTER TABLE leads ADD COLUMN last_full_renovation_year INTEGER");
    }
    if (!columnNames.includes('last_partial_renovation_year')) {
      db.exec("ALTER TABLE leads ADD COLUMN last_partial_renovation_year INTEGER");
    }
    if (!columnNames.includes('accessibility')) {
      db.exec("ALTER TABLE leads ADD COLUMN accessibility TEXT");
    }
    if (!columnNames.includes('address')) {
      db.exec("ALTER TABLE leads ADD COLUMN address TEXT");
    }
    if (!columnNames.includes('property_type')) {
      db.exec("ALTER TABLE leads ADD COLUMN property_type TEXT");
    }
    if (!columnNames.includes('size')) {
      db.exec("ALTER TABLE leads ADD COLUMN size INTEGER");
    }
    if (!columnNames.includes('rooms')) {
      db.exec("ALTER TABLE leads ADD COLUMN rooms INTEGER");
    }
    if (!columnNames.includes('bathrooms')) {
      db.exec("ALTER TABLE leads ADD COLUMN bathrooms INTEGER");
    }
    if (!columnNames.includes('half_baths')) {
      db.exec("ALTER TABLE leads ADD COLUMN half_baths INTEGER");
    }
    if (!columnNames.includes('floor')) {
      db.exec("ALTER TABLE leads ADD COLUMN floor INTEGER");
    }
    if (!columnNames.includes('house_floors')) {
      db.exec("ALTER TABLE leads ADD COLUMN house_floors INTEGER");
    }
    if (!columnNames.includes('construction_year')) {
      db.exec("ALTER TABLE leads ADD COLUMN construction_year INTEGER");
    }

    const app = express();
    const PORT = parseInt(process.env.PORT || "3000", 10);

    app.use(cors());
    app.use(express.json());

    // Detailed logging for debugging
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      console.log(`  Referer: ${req.headers.referer || 'none'}`);
      console.log(`  Origin: ${req.headers.origin || 'none'}`);
      console.log(`  User-Agent: ${req.headers['user-agent']}`);
      next();
    });

    // Allow embedding in iframes (important for WordPress/WPBakery)
    app.use((req, res, next) => {
      res.removeHeader("X-Frame-Options");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      next();
    });

    // Simple health check
    app.get("/api/health", (req, res) => {
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        headers: req.headers 
      });
    });

    app.get("/ping", (req, res) => res.send("pong"));

    // Valuation API (Handles AI + DB Save + Email)
    app.post("/api/valuation", async (req, res) => {
      const { propertyData, userData } = req.body;
      
      try {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not configured on the server");
        }

        // 1. Generate Valuation with Gemini
        const prompt = `
          SISTEMA DE VALORACIÓN TÉCNICA PROFESIONAL (MÉTODO DE REPOSICIÓN Y COMPARACIÓN):
          
          Actúa como un experto tasador inmobiliario senior en la Costa del Sol. 
          
          DATOS DE LA PROPIEDAD:
          - Ubicación: ${propertyData.address}, ${propertyData.city}
          - Tipo: ${propertyData.propertyType}
          - Planta: ${propertyData.floor || 'N/A'}
          - Superficie: ${propertyData.size} m²
          - Dormitorios: ${propertyData.rooms}
          - Baños: ${propertyData.bathrooms}
          - Estado: ${propertyData.condition}
          - Extras: ${propertyData.features?.join(', ') || 'Ninguno'}

          TAREA:
          Genera una respuesta en formato JSON con dos campos:
          - "summary": Un resumen ejecutivo profesional (2 párrafos) con el rango de precio final.
          - "breakdown": Un desglose técnico detallado que explique los coeficientes aplicados.
        `;

        console.log("Generating valuation for:", propertyData.address);
        
        // 1. Generate Valuation with Gemini with Retry Logic
        let response;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
          try {
            response = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: prompt,
              config: { 
                responseMimeType: "application/json"
              }
            });
            console.log("Gemini response received successfully");
            break; // Success!
          } catch (error: any) {
            retryCount++;
            console.error(`Gemini error (attempt ${retryCount}):`, error.message || error);
            if (error.status === 503 || error.status === 429 || error.message?.includes("503") || error.message?.includes("429") || error.message?.includes("quota") || error.message?.includes("high demand")) {
              if (retryCount === maxRetries) throw error;
              // For 429, we wait a bit longer
              const waitTime = error.status === 429 ? 5000 * retryCount : 2000 * retryCount;
              await new Promise(resolve => setTimeout(resolve, waitTime)); 
            } else {
              throw error; // Other error, don't retry
            }
          }
        }
        
        if (!response) throw new Error("Could not get response from Gemini");

        let valuationData;
        try {
          const text = response.text || "{}";
          console.log("Raw Gemini text:", text.substring(0, 100) + "...");
          valuationData = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse Gemini JSON response:", e);
          throw new Error("Invalid response format from AI");
        }

        // 2. Save to Database
        const stmt = db.prepare(`
          INSERT INTO leads (
            name, email, phone, address, property_type, size, rooms, bathrooms, half_baths,
            floor, house_floors, construction_year,
            last_full_renovation_year, last_partial_renovation_year, accessibility, estimated_value
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
          userData.name, userData.email, userData.phone, propertyData.address, propertyData.propertyType, 
          propertyData.size, propertyData.rooms, propertyData.bathrooms, propertyData.halfBaths || 0,
          propertyData.floor || null, propertyData.houseFloors || null, propertyData.constructionYear || null,
          propertyData.lastFullRenovationYear || null, propertyData.lastPartialRenovationYear || null, 
          propertyData.accessibility || 'Ninguna', valuationData.summary
        );

        // 3. Send to Webhook (Google Sheets / Zapier / Make)
        if (process.env.WEBHOOK_URL) {
          console.log("Sending data to Webhook...");
          fetch(process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              nombre: userData.name,
              email: userData.email,
              telefono: userData.phone,
              direccion: propertyData.address,
              ciudad: propertyData.city,
              tipo_propiedad: propertyData.propertyType,
              superficie: propertyData.size,
              habitaciones: propertyData.rooms,
              baños: propertyData.bathrooms,
              aseos: propertyData.halfBaths || 0,
              planta: propertyData.floor || 'N/A',
              plantas_casa: propertyData.houseFloors || 'N/A',
              año_construccion: propertyData.constructionYear || 'N/A',
              reforma_integral: propertyData.lastFullRenovationYear || 'N/A',
              reforma_parcial: propertyData.lastPartialRenovationYear || 'N/A',
              accesibilidad: propertyData.accessibility || 'Ninguna',
              estado: propertyData.condition,
              extras: propertyData.features?.join(', ') || 'Ninguno',
              valoracion_resumen: valuationData.summary,
              valoracion_desglose: valuationData.breakdown
            })
          }).catch(e => console.error("Webhook error:", e));
        }

        res.json({ success: true, data: valuationData });
      } catch (error: any) {
        console.error("Valuation error:", error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // API Routes
    app.post("/api/leads", async (req, res) => {
      const { 
        name, email, phone, address, city, propertyType, size, rooms, bathrooms, halfBaths,
        floor, houseFloors, constructionYear,
        lastFullRenovationYear, lastPartialRenovationYear, accessibility, estimatedValue,
        valuationSummary, valuationBreakdown
      } = req.body;
      
      try {
        const stmt = db.prepare(`
          INSERT INTO leads (
            name, email, phone, address, property_type, size, rooms, bathrooms, half_baths,
            floor, house_floors, construction_year,
            last_full_renovation_year, last_partial_renovation_year, accessibility, estimated_value
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(
          name, email, phone, address, propertyType, size, rooms, bathrooms, halfBaths,
          floor, houseFloors, constructionYear,
          lastFullRenovationYear, lastPartialRenovationYear, accessibility, estimatedValue
        );

        // Send to Webhook if configured
        if (process.env.WEBHOOK_URL) {
          fetch(process.env.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              nombre: name,
              email: email,
              telefono: phone,
              direccion: address,
              ciudad: city,
              tipo_propiedad: propertyType,
              superficie: size,
              habitaciones: rooms,
              baños: bathrooms,
              aseos: halfBaths,
              planta: floor,
              plantas_casa: houseFloors,
              año_construccion: constructionYear,
              reforma_integral: lastFullRenovationYear,
              reforma_parcial: lastPartialRenovationYear,
              accesibilidad: accessibility,
              valoracion_estimada: estimatedValue,
              valoracion_resumen: valuationSummary,
              valoracion_desglose: valuationBreakdown
            })
          }).catch(e => console.error("Webhook error:", e));
        }
        
        res.json({ success: true, id: info.lastInsertRowid });
      } catch (error) {
        console.error("Error saving lead:", error);
        res.status(500).json({ error: "Failed to save lead" });
      }
    });

    app.get("/api/leads", (req, res) => {
      try {
        const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
        res.json(leads);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch leads" });
      }
    });

    // Vite middleware for development or if dist is missing
    const isProduction = process.env.NODE_ENV === "production";
    const distExists = fs.existsSync(path.join(__dirname, "dist"));

    if (!isProduction || !distExists) {
      console.log("Using Vite middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      console.log("Serving static files from dist...");
      app.use(express.static(path.join(__dirname, "dist")));
      app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
