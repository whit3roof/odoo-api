import { dest, origin } from "./config/connection.js";

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
      [
        "name",
        "email",
        "phone",
        "is_company",
        "vat",
        "parent_id",
        "function",
        "street",
        "street2",
        "city",
        // "state_id",    // ← OMITIR estado completamente
        "country_id",   
        "zip",
        "website",
      ],
      [],
      10
    );

    console.log(`📋 Total: ${contacts.length}`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    console.log("🔍 Preloading existing contacts in destination...");
    const existingContacts = await dest.readModel(
      uidDest,
      "res.partner",
      ["id", "name", "email", "phone", "vat"],
      [],
      1000
    );

    // ✅ SOLO precargar países
    console.log("🌍 Preloading countries from destination...");
    const destCountries = await dest.readModel(
      uidDest, 
      "res.country", 
      ["id", "name", "code"], 
      [], 
      1000
    );

    // ✅ Precargar países del origen para mapeo
    console.log("🗺️ Preloading countries from origin...");
    const originCountries = await origin.readModel(
      uidOrigin, 
      "res.country", 
      ["id", "name", "code"], 
      [], 
      1000
    );

    // ✅ Crear maps para búsqueda
    const originCountryMap = new Map(originCountries.map(country => [country.id, country]));
    const destCountryMap = new Map(destCountries.map(country => [country.name.toLowerCase(), country]));

    console.log(`📊 Countries in destination: ${destCountries.length}`);

    for (const contact of contacts) {
      if (!contact.email && !contact.phone && !contact.vat) {
        console.warn(`⚠️ Omitted: ${contact.name} (no email, phone or vat available)`);
        skipped++;
        continue;
      }

      const uniqueField = contact.email ? "email" : contact.phone ? "phone" : "vat";
      const rawValue = contact[uniqueField];
      const uniqueValue = String(rawValue || "").trim().toLowerCase();

      const alreadyExists = existingContacts.some(existing => {
        const existingValue = existing[uniqueField]?.toString().toLowerCase().trim();
        return existingValue === uniqueValue;
      });

      if (alreadyExists) {
        console.log(`⚠️ Omitted: ${contact.name} (already exists ${uniqueField}="${uniqueValue}")`);
        skipped++;
        continue;
      }

      try {
        // 🔗 Manejar empresa asociada
        let parentCompanyId = false;
        if (contact.parent_id && Array.isArray(contact.parent_id)) {
          const parentName = contact.parent_id[1];
          const match = existingContacts.find(ec => ec.name === parentName);
          if (match) {
            parentCompanyId = match.id;
          }
        }

        // ✅ MAPEAR SOLO PAÍS (omitir estado completamente)
        let destCountryId = false;
        if (contact.country_id && Array.isArray(contact.country_id)) {
          const originCountryId = contact.country_id[0];
          const originCountry = originCountryMap.get(originCountryId);
          
          if (originCountry) {
            const destCountry = destCountryMap.get(originCountry.name.toLowerCase());
            if (destCountry) {
              destCountryId = destCountry.id;
              console.log(`🌍 Mapped country: ${originCountry.name} -> ID: ${destCountryId}`);
            } else {
              console.warn(`🌍 Country not found in destination: ${originCountry.name}`);
            }
          }
        }

        // ✅ CREAR CONTACTO SIN CAMPOS DE ESTADO
        const newId = await dest.createModel(uidDest, "res.partner", {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          is_company: contact.is_company,
          vat: contact.vat,
          function: contact.function,
          street: contact.street,
          street2: contact.street2,
          city: contact.city,
          zip: contact.zip,
          website: contact.website,
          parent_id: parentCompanyId || false,
          country_id: destCountryId || false,
          // NO INCLUIR state NI state_id
        });

        created++;
        console.log(`✅ Created: ${contact.name} (ID: ${newId})`);

        // Agregarlo a la lista local
        existingContacts.push({
          id: newId,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          vat: contact.vat,
        });

      } catch (err) {
        console.error(`❌ Error creating ${contact.name}: ${err.message}`);
        errors++;
      }
    }

    console.log(`🎉 Migration done: ${created} created, ${skipped} omitted, ${errors} errors`);
  } catch (err) {
    console.error("❌ Error in migration:", err.message);
  }
}

migrateContacts();