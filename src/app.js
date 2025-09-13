import dotenv from "dotenv";

dotenv.config();

const ODOO_URL = process.env.ODOO_URL;
const DB_NAME = process.env.DATABASE;
const ODOO_USER = process.env.USERNAME;
const ODOO_API_KEY = process.env.PASSWORD;

async function jsonRpcCall(service, method, args = []) {
  const url = `${ODOO_URL}/jsonrpc`;
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    params: {
      service,
      method,
      args,
    },
    id: Math.floor(Math.random() * 1000000000),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Network error: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (data.error) throw new Error(`Odoo Error: ${data.error.message} - ${data.error.data.debug}`);

  return data.result;
}

async function getOdooCompanyName() {
  try {
    console.log('Authenticating...');

    const uid = await jsonRpcCall('common', 'login', [DB_NAME, ODOO_USER, ODOO_API_KEY]);
    if (!uid) throw new Error('Authentication failed. Check your credentials.');

    console.log(`Authentication successful. UID: ${uid}`);

    console.log('Fetching company name...');
    const searchArgs = [
      DB_NAME,
      uid,
      ODOO_API_KEY,
      'res.company',      // Model to query
      'search_read',      // Method to use
      [[]],               // Domain (empty for all records)
      { fields: ['name'], limit: 1 }, // Options: get only the 'name' field, limit to 1 result
    ];

    const companies = await jsonRpcCall('object', 'execute_kw', searchArgs);

    if (!companies || companies.length === 0) throw new Error('No companies found in the database.');

    // 3. Return the name of the first company
    return companies[0].name;

  } catch (error) {
    console.error('Failed to retrieve company name:', error.message);
    throw error;
  }
}

(async () => {
  try {
    const companyName = await getOdooCompanyName();
    console.log(`\n✅ Success! Company Name: ${companyName}`);
  } catch (error) {
    console.error('\n❌ Script failed.');
  }
})();