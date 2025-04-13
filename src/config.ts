import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define configuration interface
export interface Config {
  port: number;
  aws: {
    region: string;
    profile: string;
  };
  templates: {
    path: string;
  };
}

// Default configuration
const defaultConfig: Config = {
  port: 3000,
  aws: {
    region: 'us-east-1',
    profile: 'default'
  },
  templates: {
    path: './templates'
  }
};

/**
 * Load configuration from config.json file or use defaults
 */
export function loadConfig(): Config {
  try {
    // Get the directory name of the current module
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const configPath = path.resolve(__dirname, '../config.json');
    
    // Check if config file exists
    if (fs.existsSync(configPath)) {
      const configFile = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(configFile);
      
      // Merge with default config
      return {
        ...defaultConfig,
        ...userConfig,
        aws: {
          ...defaultConfig.aws,
          ...(userConfig.aws || {})
        },
        templates: {
          ...defaultConfig.templates,
          ...(userConfig.templates || {})
        }
      };
    }
  } catch (error) {
    console.warn('Error loading config file:', error);
    console.warn('Using default configuration');
  }
  
  return defaultConfig;
}
