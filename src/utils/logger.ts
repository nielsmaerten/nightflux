import winston from 'winston';
import config from '../config';

const logger = winston.createLogger({
  level: config.logLevel || 'info',
  // defaultMeta: { service: 'user-service' },
  transports: [],
});

if (config.logfile) {
  logger.add(new winston.transports.File({ filename: config.logfile }));
  logger.format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  );
}
else {
  logger.add(new winston.transports.Console());
  logger.format = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    winston.format.printf((info) => {
      const { timestamp, level, message, ...metadata } = info;
      const hasMetadata = Object.keys(metadata).length > 0;
      const meta = hasMetadata ? JSON.stringify(metadata, null, 2) : '';
      return `${timestamp} ${level}: ${message}${meta}`;
    }),
  );
}

export default logger;
