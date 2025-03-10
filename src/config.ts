/* eslint-disable no-process-env */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file if it exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  // System environment variables take precedence
  dotenv.config({ override: false });
}

export interface NightfluxConfig {
  nightscoutUrl: string;
  nightscoutToken: string;
  influxDbUrl: string;
  influxDbOrg: string;
  influxDbBucket: string;
  influxDbToken: string;
  cronSchedule: string;
  logfile?: string;
  logLevel?: string;
  timezone?: string;
  runOnce: boolean;
}

/**
 * Get all Nightflux environment variables with their values
 */
export function getAllEnvVars(): Record<string, string | undefined> {
  const allEnvVars: Record<string, string | undefined> = {};

  // Extract all NIGHTFLUX_ prefixed environment variables
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith('NIGHTFLUX_')) {
      allEnvVars[key] = process.env[key];
    }
  });

  return allEnvVars;
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): NightfluxConfig {
  return {
    // Nightscout Settings
    nightscoutUrl: getRequiredEnv('NIGHTFLUX_NIGHTSCOUT_URL'),
    nightscoutToken: getRequiredEnv('NIGHTFLUX_NIGHTSCOUT_TOKEN'),

    // InfluxDB Settings
    influxDbUrl: getRequiredEnv('NIGHTFLUX_INFLUXDB_URL'),
    influxDbOrg: getRequiredEnv('NIGHTFLUX_INFLUXDB_ORG'),
    influxDbBucket: getRequiredEnv('NIGHTFLUX_INFLUXDB_BUCKET'),
    influxDbToken: getRequiredEnv('NIGHTFLUX_INFLUXDB_TOKEN'),

    // Scheduling
    cronSchedule: getRequiredEnv('NIGHTFLUX_CRON_SCHEDULE'),

    // Optional settings
    logfile: process.env.NIGHTFLUX_LOGFILE,
    logLevel: process.env.NIGHTFLUX_LOGLEVEL,
    timezone: process.env.NIGHTFLUX_TIMEZONE,
    runOnce: parseInt(process.env.NIGHTFLUX_RUN_ONCE || '0', 10) === 1,
  };
}

/**
 * Helper function to get required environment variables
 * Throws an error if the environment variable is not defined
 */
function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not defined`);
  }
  return value;
}

const config = loadConfig();
export default config;
