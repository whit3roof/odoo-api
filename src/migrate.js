import fs from "fs";
import dotenv from "dotenv";
import { makeOdooClient } from "./app.js";

dotenv.config(); // carga el .env de origen

// ✅ Conexión origen (Odoo 17)
const origin = makeOdooClient({
  url: process.env.ODOO_URL,
  db: process.env.DATABASE,
  user: process.env.USERNAME,
  apiKey: process.env.PASSWORD,
});

// ✅ Conexión destino (Odoo 19)
const destEnv = dotenv.config({ path: ".env.dest" }).parsed;

const dest = makeOdooClient({
  url: destEnv.ODOO_URL,
  db: destEnv.DATABASE,
  user: destEnv.USERNAME,
  apiKey: destEnv.PASSWORD,
});

async function migrateContacts() {
  try {
    console.log("🔐 Autenticando origen...");
    const uidOrigin = await origin.authenticate();

    console.log("🔐 Autenticando destino...");
    const uidDest = await dest.authenticate();

    console.log("📥 Leyendo contactos del origen...");
    const contacts = await origin.readModel(uidOrigin, "res.partner", [
      "name",
      "email",
      "phone",
      //obile",
      "is_company",
    ]);

    console.log(`Encontrados ${contacts.length} contactos.`);

    let count = 0;
    for (const c of contacts) {
      try {
        const newId = await dest.createModel(uidDest, "res.partner", {
          name: c.name,
          email: c.email,
          phone: c.phone,
         //obile: c.mobile,
          is_company: c.is_company,
        });
        count++;
        console.log(`✅ ${count}. Contacto creado en destino (ID: ${newId})`);
      } catch (err) {
        console.warn(`⚠️ Error creando ${c.name}: ${err.message}`);
      }
    }

    console.log(`🎉 Migración completa. ${count} contactos creados en destino.`);
  } catch (err) {
    console.error("❌ Error en la migración:", err.message);
  }
}

migrateContacts();
