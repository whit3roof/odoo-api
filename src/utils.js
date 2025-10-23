export async function createIfNotExists(odoo, uid, model, uniqueField, recordData) {
  const value = recordData[uniqueField];


  if (!value || typeof value !== "string" || value.trim() === '') {
    console.log(`⚠️ Omitido: ${recordData.name} (campo ${uniqueField} inválido: ${value})`);
    return null;
  }

  const cleanValue = value.trim().toLowerCase();
  
  try {
    console.log(`🔍 Verificando si existe ${recordData.name} con ${uniqueField}: ${cleanValue}`);
    

    const allRecords = await odoo.readModel(
      uid, 
      model, 
      ["id", "name", "email", "phone"], 
      [],  
      1000  
    );


    const existing = allRecords.find(record => {
      const recordValue = record[uniqueField];
      return recordValue && 
             recordValue.toString().toLowerCase().trim() === cleanValue;
    });

    if (existing) {
      console.log(`⚠️ Omitido: ${recordData.name} (ya existe como "${existing.name}" con ${uniqueField} = "${cleanValue}")`);
      return existing.id;
    }

  
    console.log(`🆕 Creando: ${recordData.name}...`);
    const newId = await odoo.createModel(uid, model, recordData);
    console.log(`✅ Creado: ${recordData.name} (ID: ${newId})`);
    return newId;
    
  } catch (err) {
    console.error(`❌ Error al procesar ${recordData.name}: ${err.message}`);
    return null;
  }
}