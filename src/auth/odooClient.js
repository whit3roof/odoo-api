import dotenv from "dotenv";
dotenv.config();

export function makeOdooClient({ url, db, user, apiKey }) {
  async function jsonRpcCall(service, method, args = []) {
    const payload = {
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Math.floor(Math.random() * 1000000000),
    };

    const response = await fetch(`${url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) throw new Error(`Odoo Error: ${data.error.message} - ${data.error.data?.debug || "Unknown Error"}`);

    return data.result;
  }

  async function authenticate() {
    const uid = await jsonRpcCall("common", "login", [db, user, apiKey]);
    if (!uid) throw new Error("❌ Auth failed.");
    return uid;
  }

  async function readModel(uid, model, fields = ["name"], domain = [], limit = 3) {

    let validDomain = [];
    
    if (Array.isArray(domain) && domain.length > 0) {

      if (Array.isArray(domain[0])) {
        validDomain = domain;
      } else {

        validDomain = [domain];
      }
    }
    
 
    const args = [
      db, 
      uid, 
      apiKey, 
      model, 
      "search_read", 
      validDomain,  
      { fields, limit }  
    ];
    
    return jsonRpcCall("object", "execute_kw", args);
  }

  async function createModel(uid, model, values) {
    const args = [db, uid, apiKey, model, "create", [values]];
    return jsonRpcCall("object", "execute_kw", args);
  }

  return { jsonRpcCall, authenticate, readModel, createModel, db, apiKey };
}
