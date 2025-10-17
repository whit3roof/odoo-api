import { authenticate, readOdooModel } from "./app.js";

async function getContacts() {
  try {
    console.log("🔐 Authenticating...");
    const uid = await authenticate();
    console.log(`✅ Authenticated as UID: ${uid}`);

    console.log("📇 Fetching contacts...");
    const contacts = await readOdooModel(
      uid,
      "res.partner",
      ["name", "email", "is_company"], // Campos que pediste
      [[]],                            // Dominio vacío (todos)
      20                               // Límite: puedes ajustarlo
    );

    if (contacts.length === 0) {
      console.log("No contacts found.");
      return;
    }

    console.log("✅ Contacts:");
    contacts.forEach((c, i) => {
      console.log(
        `${i + 1}. ${c.name || "(Sin nombre)"} | ${c.email || "(Sin correo)"} | ${
          c.is_company ? "Empresa" : "Persona"
        }`
      );
    });
  } catch (err) {
    console.error("❌ Error fetching contacts:", err.message);
  }
}

// Ejecutar al correr el archivo
getContacts();
