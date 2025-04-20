/**
 * Dependency Installer
 * 
 * Handles installation of dependencies in the build artifacts directory
 * based on the runtime environment.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../utils/logger.js';
import { executeCommand } from '../utils/process.js';
import { existsSync } from 'fs';

/**
 * Install dependencies in the build artifacts directory based on runtime
 * @param projectRoot - Root directory of the project
 * @param builtArtifactsPath - Path to the built artifacts
 * @param runtime - Lambda runtime (e.g., nodejs18.x, python3.9)
 */
export async function installDependencies(
  projectRoot: string,
  builtArtifactsPath: string,
  runtime: string
): Promise<void> {
  logger.info(`Installing dependencies for runtime: ${runtime} in ${builtArtifactsPath}`);
  
  try {
    if (runtime.startsWith('nodejs')) {
      await installNodeDependencies(projectRoot, builtArtifactsPath);
    } else if (runtime.startsWith('python')) {
      await installPythonDependencies(projectRoot, builtArtifactsPath);
    } else if (runtime.startsWith('java')) {
      // Java dependencies are typically bundled in the JAR/WAR file
      logger.info('Java dependencies are expected to be bundled in the artifact');
    } else if (runtime.startsWith('dotnet')) {
      // .NET dependencies are typically bundled in the published output
      logger.info('.NET dependencies are expected to be bundled in the artifact');
    } else if (runtime.startsWith('go')) {
      // Go dependencies are typically compiled into the binary
      logger.info('Go dependencies are expected to be compiled into the binary');
    } else if (runtime.startsWith('ruby')) {
      await installRubyDependencies(projectRoot, builtArtifactsPath);
    } else {
      logger.warn(`Unsupported runtime: ${runtime}, dependencies may need to be installed manually`);
    }
  } catch (error) {
    logger.error(`Error installing dependencies: ${error.message}`);
    throw new Error(`Failed to install dependencies: ${error.message}`);
  }
}

/**
 * Install Node.js dependencies
 */
async function installNodeDependencies(
  projectRoot: string,
  builtArtifactsPath: string
): Promise<void> {
  // Check if package.json exists in the built artifacts path
  const targetPackageJsonPath = path.join(builtArtifactsPath, 'package.json');
  const sourcePackageJsonPath = path.join(projectRoot, 'package.json');
  
  if (!existsSync(targetPackageJsonPath)) {
    // If package.json doesn't exist in the built artifacts, check if it exists in the project root
    if (existsSync(sourcePackageJsonPath)) {
      logger.info(`Copying package.json from ${sourcePackageJsonPath} to ${targetPackageJsonPath}`);
      await fs.copyFile(sourcePackageJsonPath, targetPackageJsonPath);
    } else {
      logger.warn('No package.json found, skipping Node.js dependency installation');
      return;
    }
  }
  
  // Check if package-lock.json exists and copy it if available
  const sourcePackageLockPath = path.join(projectRoot, 'package-lock.json');
  const targetPackageLockPath = path.join(builtArtifactsPath, 'package-lock.json');
  
  if (existsSync(sourcePackageLockPath) && !existsSync(targetPackageLockPath)) {
    logger.info('Copying package-lock.json for faster installation');
    await fs.copyFile(sourcePackageLockPath, targetPackageLockPath);
  }
  
  // Install production dependencies
  logger.info('Installing Node.js production dependencies');
  await executeCommand('npm install --production', {
    cwd: builtArtifactsPath
  });
}

/**
 * Install Python dependencies
 */
async function installPythonDependencies(
  projectRoot: string,
  builtArtifactsPath: string
): Promise<void> {
  // Check if requirements.txt exists in the built artifacts path
  const targetRequirementsPath = path.join(builtArtifactsPath, 'requirements.txt');
  const sourceRequirementsPath = path.join(projectRoot, 'requirements.txt');
  
  if (!existsSync(targetRequirementsPath)) {
    // If requirements.txt doesn't exist in the built artifacts, check if it exists in the project root
    if (existsSync(sourceRequirementsPath)) {
      logger.info(`Copying requirements.txt from ${sourceRequirementsPath} to ${targetRequirementsPath}`);
      await fs.copyFile(sourceRequirementsPath, targetRequirementsPath);
    } else {
      logger.warn('No requirements.txt found, skipping Python dependency installation');
      return;
    }
  }
  
  // Install Python dependencies to the current directory
  logger.info('Installing Python dependencies');
  await executeCommand('pip install -r requirements.txt -t .', {
    cwd: builtArtifactsPath
  });
}

/**
 * Install Ruby dependencies
 */
async function installRubyDependencies(
  projectRoot: string,
  builtArtifactsPath: string
): Promise<void> {
  // Check if Gemfile exists in the built artifacts path
  const targetGemfilePath = path.join(builtArtifactsPath, 'Gemfile');
  const sourceGemfilePath = path.join(projectRoot, 'Gemfile');
  
  if (!existsSync(targetGemfilePath)) {
    // If Gemfile doesn't exist in the built artifacts, check if it exists in the project root
    if (existsSync(sourceGemfilePath)) {
      logger.info(`Copying Gemfile from ${sourceGemfilePath} to ${targetGemfilePath}`);
      await fs.copyFile(sourceGemfilePath, targetGemfilePath);
      
      // Copy Gemfile.lock if it exists
      const sourceGemfileLockPath = path.join(projectRoot, 'Gemfile.lock');
      const targetGemfileLockPath = path.join(builtArtifactsPath, 'Gemfile.lock');
      
      if (existsSync(sourceGemfileLockPath)) {
        await fs.copyFile(sourceGemfileLockPath, targetGemfileLockPath);
      }
    } else {
      logger.warn('No Gemfile found, skipping Ruby dependency installation');
      return;
    }
  }
  
  // Install Ruby dependencies to vendor/bundle
  logger.info('Installing Ruby dependencies');
  await executeCommand('bundle config set --local path vendor/bundle', {
    cwd: builtArtifactsPath
  });
  await executeCommand('bundle install', {
    cwd: builtArtifactsPath
  });
}
