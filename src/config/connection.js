import dotenv from "dotenv";
import { makeOdooClient } from "../auth/odooClient.js"

dotenv.config();

export const origin = makeOdooClient({
  url: process.env.ODOO_URL_ORIGIN,
  db: process.env.ODOO_DB_ORIGIN,
  user: process.env.ODOO_USER_ORIGIN,
  apiKey: process.env.ODOO_API_ORIGIN,
});

export const dest = makeOdooClient({
  url: process.env.ODOO_URL_DEST,
  db: process.env.ODOO_DB_DEST,
  user: process.env.ODOO_USER_DEST,
  apiKey: process.env.ODOO_API_DEST,
});
