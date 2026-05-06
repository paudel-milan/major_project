/**
 * ProjectManager — creates and manages sandbox project directories.
 * Handles file CRUD, project scaffolding, and cleanup.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { templateFiles } from './templateFiles.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX_ROOT = path.join(__dirname, '..', 'sandbox');

class ProjectManager {
  constructor() {
    this._projects = new Map(); // projectId -> { path, files, createdAt }
    this._ensureSandboxDir();
  }

  async _ensureSandboxDir() {
    try {
      await fs.mkdir(SANDBOX_ROOT, { recursive: true });
    } catch (e) {
      // Already exists
    }
  }

  /**
   * Create a new sandbox project with default template files.
   * @returns {Promise<string>} Project ID
   */
  async createProject() {
    const projectId = uuidv4().slice(0, 8);
    const projectPath = path.join(SANDBOX_ROOT, projectId);

    // Create project directories
    await fs.mkdir(projectPath, { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'src', 'components'), { recursive: true });

    // Write template files
    for (const [filePath, content] of Object.entries(templateFiles)) {
      const fullPath = path.join(projectPath, filePath);
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    this._projects.set(projectId, {
      path: projectPath,
      files: { ...templateFiles },
      createdAt: Date.now(),
    });

    logger.info('ProjectManager', `Created project: ${projectId} at ${projectPath}`);
    return projectId;
  }

  /**
   * Update files in an existing project. Only overwrites specified files.
   * @param {string} projectId
   * @param {Record<string, string>} fileMap - { "src/App.jsx": "content", ... }
   * @returns {Promise<string[]>} List of updated file paths
   */
  async updateFiles(projectId, fileMap) {
    const project = this._projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const updatedFiles = [];

    for (const [filePath, content] of Object.entries(fileMap)) {
      const fullPath = path.join(project.path, filePath);
      const dir = path.dirname(fullPath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(fullPath, content, 'utf-8');

      // Update in-memory manifest
      project.files[filePath] = content;
      updatedFiles.push(filePath);

      logger.debug('ProjectManager', `Updated: ${filePath} (${content.length} bytes)`);
    }

    logger.info('ProjectManager', `Updated ${updatedFiles.length} files in project ${projectId}`);
    return updatedFiles;
  }

  /**
   * Get the filesystem path for a project.
   * @param {string} projectId
   * @returns {string}
   */
  getProjectPath(projectId) {
    const project = this._projects.get(projectId);
    if (!project) throw new Error(`Project ${projectId} not found`);
    return project.path;
  }

  /**
   * Get all files for a project.
   * @param {string} projectId
   * @returns {Record<string, string>}
   */
  getProjectFiles(projectId) {
    const project = this._projects.get(projectId);
    if (!project) return {};
    return { ...project.files };
  }

  /**
   * Check if a project exists.
   */
  hasProject(projectId) {
    return this._projects.has(projectId);
  }

  /**
   * Delete a project and its files.
   */
  async deleteProject(projectId) {
    const project = this._projects.get(projectId);
    if (!project) return;

    try {
      await fs.rm(project.path, { recursive: true, force: true });
      this._projects.delete(projectId);
      logger.info('ProjectManager', `Deleted project: ${projectId}`);
    } catch (error) {
      logger.error('ProjectManager', `Failed to delete project ${projectId}: ${error.message}`);
    }
  }

  /**
   * List all projects.
   */
  listProjects() {
    return [...this._projects.entries()].map(([id, p]) => ({
      id,
      fileCount: Object.keys(p.files).length,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Get the sandbox root directory path.
   */
  getSandboxRoot() {
    return SANDBOX_ROOT;
  }
}

const projectManager = new ProjectManager();
export default projectManager;
