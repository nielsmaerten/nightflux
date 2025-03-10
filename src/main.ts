import config, { getAllEnvVars, loadConfig } from '@/config';
import cronjob from '@/cronjob';
import logger from '@/logger';

try {
  logger.info('Nightflux - Starting up...');

  // Load configuration
  loadConfig();
  logger.debug('Configuration loaded successfully');

  // Print all environment variables
  const envVars = getAllEnvVars();

  if (Object.keys(envVars).length === 0) {
    logger.warn('No NIGHTFLUX_ environment variables found');
  }
  else {
    Object.entries(envVars).forEach(([key, value]) => {
      logger.debug(`${key}: ${value}`);
    });
  }

  // Start the application
  logger.info('Nightflux - Ready');
  if (!config.runOnce) cronjob.start();
  else cronjob.fireOnTick().then(() => process.exit(0));
}
catch (error) {
  logger.error('Error loading configuration:', error instanceof Error ? error.message : error);
  process.exit(1);
}
