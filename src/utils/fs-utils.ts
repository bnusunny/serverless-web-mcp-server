/**
 * File System Utilities
 * 
 * Cross-platform file system utilities for the deployment service.
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const mkdirAsync = promisify(fs.mkdir);
const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const copyFileAsync = promisify(fs.copyFile);

/**
 * Copy a directory recursively
 * 
 * @param src - Source directory
 * @param dest - Destination directory
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    await mkdirAsync(dest, { recursive: true });
  }
  
  // Get all files and directories in the source directory
  const entries = await readdirAsync(src);
  
  // Process each entry
  for (const entry of entries) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    
    // Get entry stats
    const stats = await statAsync(srcPath);
    
    if (stats.isDirectory()) {
      // Recursively copy directory
      await copyDirectory(srcPath, destPath);
    } else {
      // Copy file
      await copyFileAsync(srcPath, destPath);
    }
  }
}

/**
 * Get a temporary directory path
 * 
 * @param prefix - Directory name prefix
 * @returns - Path to temporary directory
 */
export function getTempDir(prefix: string): string {
  const tempDir = path.join(fs.realpathSync(require('os').tmpdir()), prefix);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  return tempDir;
}

/**
 * Write JSON to a file
 * 
 * @param filePath - Path to file
 * @param data - Data to write
 */
export function writeJsonFile(filePath: string, data: any): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * Read JSON from a file
 * 
 * @param filePath - Path to file
 * @returns - Parsed JSON data
 */
export function readJsonFile(filePath: string): any {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

export default {
  copyDirectory,
  getTempDir,
  writeJsonFile,
  readJsonFile
};
