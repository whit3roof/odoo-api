import dotenv from "dotenv";
import { makeOdooClient } from "./app.js";
import { createIfNotExists } from "./utils.js";

dotenv.config();

// Origin
const origin = makeOdooClient({
  url: process.env.ODOO_URL_ORIGIN,
  db: process.env.ODOO_DB_ORIGIN,
  user: process.env.ODOO_USER_ORIGIN,
  apiKey: process.env.ODOO_API_ORIGIN,
});

// Destiny
const dest = makeOdooClient({
  url: process.env.ODOO_URL_DEST,
  db: process.env.ODOO_DB_DEST,
  user: process.env.ODOO_USER_DEST,
  apiKey: process.env.ODOO_API_DEST,
});

async function migrateContacts() {
  try {
    console.log("🔐 Authenticating origin...");
    const uidOrigin = await origin.authenticate();

    console.log("🔐 Authenticating destiny...");
    const uidDest = await dest.authenticate();

    console.log("📦 Reading contacts from origin...");
    
    const contacts = await origin.readModel(
      uidOrigin,
      "res.partner",
      ["name", "email", "phone", "is_company"],
      [], 
      5    
    );

    console.log(`📋 Total: ${contacts.length}`);

    let created = 0;
    let skipped = 0;
    let errors = 0;


    console.log("🔍 Precargando contactos existentes en destino...");
    const existingContacts = await dest.readModel(
      uidDest,
      "res.partner",
      ["id", "name", "email", "phone"],
      [],
      1000
    );
    
    console.log(`📊 Contacts already un destiny DB: ${existingContacts.length}`);

    for (const c of contacts) {
      if (!c.email && !c.phone) {
        console.log(`⚠️ Omitido: ${c.name} (no email no teléfono)`);
        skipped++;
        continue;
      }

      const uniqueField = c.email ? "email" : "phone";
      const uniqueValue = c[uniqueField]?.trim().toLowerCase();

      const alreadyExists = existingContacts.some(existing => {
        const existingValue = existing[uniqueField]?.toString().toLowerCase().trim();
        return existingValue === uniqueValue;
      });

      if (alreadyExists) {
        console.log(`⚠️ Omitido: ${c.name} (already exist ${uniqueField} = "${uniqueValue}")`);
        skipped++;
        continue;
      }

      
      try {
        console.log(`🆕 Creating: ${c.name}...`);
        const newId = await dest.createModel(uidDest, "res.partner", {
          name: c.name,
          email: c.email,
          phone: c.phone,
          is_company: c.is_company,
        });
        created++;
        console.log(`✅ Created: ${c.name} (ID: ${newId})`);
        
        
        existingContacts.push({
          id: newId,
          name: c.name,
          email: c.email,
          phone: c.phone
        });
        
      } catch (err) {
        console.error(`❌ Error creating ${c.name}: ${err.message}`);
        errors++;
      }
    }

    console.log(`🎉 Migración completada: ${created} creados, ${skipped} omitidos, ${errors} errores`);
  } catch (err) {
    console.error("❌ Error in migration:", err.message);
  }
}

migrateContacts();