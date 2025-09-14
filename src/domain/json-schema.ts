import { NightfluxReportSchema } from './schema.js';
import { z } from 'zod';

export function getJsonSchema() {
  return z.toJSONSchema(NightfluxReportSchema);
}

export function writeJsonSchema(out: string) {
  const fs = require('fs');
  fs.writeFileSync(out, getJsonSchemaString());
}

export function getJsonSchemaString() {
  return JSON.stringify(getJsonSchema(), null, 2);
}

const schema = getJsonSchemaString();
console.log(schema);