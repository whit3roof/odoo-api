import dotenv from "dotenv";
import { makeOdooClient } from "./auth/odooClient.js";
import { createIfNotExists } from "./utils.js";

dotenv.config();

// Origin
const origin = makeOdooClient({
  url: process.env.ODOO_URL_ORIGIN,
  db: process.env.ODOO_DB_ORIGIN,
  user: process.env.ODOO_USER_ORIGIN,
  apiKey: process.env.ODOO_API_ORIGIN,
});

// Destination
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
      ["name", "email", "phone", "is_company", "vat"],
      [], 
      5 // Contacts read limit
    );

    console.log(`📋 Total: ${contacts.length}`);

    let created = 0;
    let skipped = 0;
    let errors = 0;


    console.log("🔍 Preloading contacts in ...");
    const existingContacts = await dest.readModel(
      uidDest,
      "res.partner",
      ["id", "name", "email", "phone", "vat"],
      [],
    );
    
    for (const contact of contacts) {
      if (!contact.email && !contact.phone && !contact.vat) {
        console.warn(`⚠️ Omitted: ${contact.name} (no email, phone and vat available)`);
        skipped++;
        continue;
      }

      const uniqueField = 
        contact.email ? "email" :
        contact.phone ? "phone":
        "vat";

      const rawValue = contact[uniqueField];
      const uniqueValue = String(rawValue || "").trim().toLowerCase();

      const alreadyExists = existingContacts.some(existing => {
        const existingValue = existing[uniqueField]?.toString().toLowerCase().trim();
        return existingValue === uniqueValue;
      });

      if (alreadyExists) {
        console.log(`⚠️ Omitted: ${contact.name} (already exist ${uniqueField} = "${uniqueValue}")`);
        skipped++;
        continue;
      }

      
      try {
        const newId = await dest.createModel(uidDest, "res.partner", {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          is_company: contact.is_company,
          vat: contact.vat,
        });
        created++;
        console.log(`✅ Created: ${contact.name} (ID: ${newId})`);
        
        
        existingContacts.push({
          id: newId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          vat: contact.vat,
        });
        
      } catch (err) {
        console.error(`❌ Error creating ${c.name}: ${err.message}`);
        errors++;
      }
    }

    console.log(`🎉 Migration done: ${created} created, ${skipped} omitted, ${errors} errors`);
  } catch (err) {
    console.error("❌ Error in migration:", err.message);
  }
}

migrateContacts();