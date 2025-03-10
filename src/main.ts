import { getAllEnvVars, loadConfig } from './config';

try {
  console.log('Nightflux - Starting up...');

  // Load configuration
  loadConfig();
  console.log('Configuration loaded successfully');

  // Print all environment variables
  const envVars = getAllEnvVars();

  if (Object.keys(envVars).length === 0) {
    console.log('No NIGHTFLUX_ environment variables found');
  }
  else {
    Object.entries(envVars).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });
  }
}
catch (error) {
  console.error('Error loading configuration:', error instanceof Error ? error.message : error);
  process.exit(1);
}
