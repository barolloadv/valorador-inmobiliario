import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import cors from "cors";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting server...");
  try {
    const db = new Database("leads.db");

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
    const PORT = 3000;

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

        // Send Email if configured
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          console.log("Sending email to:", email);
          const nodemailer = await import("nodemailer");
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          const mailOptions = {
            from: `"Alberto Barollo" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Informe de Valoración - ${address}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
                <h2 style="color: #059669;">Informe de Valoración Técnica</h2>
                <p>Hola <strong>${name || ''}</strong>,</p>
                <p>Aquí tienes el informe de valoración para tu propiedad en <strong>${address || ''}, ${city || ''}</strong>.</p>
                <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #065f46;">Resumen Ejecutivo</h3>
                  <p>${(valuationSummary || '').replace(/\n/g, '<br>')}</p>
                </div>
                <div style="background: #f8fafc; padding: 15px; border-radius: 8px;">
                  <h3 style="margin-top: 0; color: #1e293b;">Desglose Técnico</h3>
                  <p style="font-family: monospace; font-size: 12px;">${(valuationBreakdown || '').replace(/\n/g, '<br>')}</p>
                </div>
                <p style="margin-top: 30px;">Si tienes alguna duda, puedes contactarme directamente por WhatsApp:</p>
                <a href="https://wa.me/34622946504" style="display: inline-block; background: #25D366; color: white; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: bold;">Contactar por WhatsApp</a>
                <p style="font-size: 12px; color: #94a3b8; margin-top: 40px;">Este es un informe automático generado por ValoraCasa Pro.</p>
              </div>
            `,
          };

          await transporter.sendMail(mailOptions);
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
