/**
 * BuildEngine — handles building sandbox React projects.
 * Since we use CDN-loaded React + Babel (browser-based transpilation),
 * the "build" step is lightweight: validate files and prepare for serving.
 * For production, this could use Vite's programmatic build API.
 */

import fs from 'fs/promises';
import path from 'path';
import projectManager from './ProjectManager.js';
import logger from '../utils/logger.js';

class BuildEngine {
  constructor() {
    this._buildStatus = new Map(); // projectId -> { status, error, timestamp }
  }

  /**
   * "Build" a sandbox project — validate and prepare for serving.
   * Since we use CDN React + Babel, this is mainly validation + notification.
   * @param {string} projectId
   * @param {Function} [onStatus] - Callback for status updates
   * @returns {Promise<{success: boolean, error?: string, duration: number}>}
   */
  async build(projectId, onStatus = null) {
    const startTime = Date.now();

    this._updateStatus(projectId, 'building');
    if (onStatus) onStatus({ status: 'building', projectId });

    try {
      // 1. Verify project exists
      const projectPath = projectManager.getProjectPath(projectId);
      
      // 2. Verify index.html exists
      const indexPath = path.join(projectPath, 'index.html');
      try {
        await fs.access(indexPath);
      } catch {
        throw new Error('index.html not found in project');
      }

      // 3. Verify App.jsx exists
      const appPath = path.join(projectPath, 'src', 'App.jsx');
      try {
        await fs.access(appPath);
      } catch {
        throw new Error('src/App.jsx not found in project');
      }

      // 4. Process component files — inject window exports
      await this._processComponents(projectId);

      // 5. Update index.html to include all component scripts
      await this._updateIndexHtml(projectId);

      const duration = Date.now() - startTime;
      this._updateStatus(projectId, 'ready');
      logger.logBuildTime(projectId, duration, true);

      if (onStatus) onStatus({ status: 'ready', projectId, duration });

      return { success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      this._updateStatus(projectId, 'error', error.message);
      logger.logBuildTime(projectId, duration, false);
      logger.error('BuildEngine', `Build failed for ${projectId}: ${error.message}`);

      if (onStatus) onStatus({ status: 'error', projectId, error: error.message });

      return { success: false, error: error.message, duration };
    }
  }

  /**
   * Process component files to ensure they work with browser-based module system.
   * Adds window.ComponentName exports for each component.
   */
  async _processComponents(projectId) {
    const files = projectManager.getProjectFiles(projectId);

    for (const [filePath, content] of Object.entries(files)) {
      if (filePath.endsWith('.jsx') || filePath.endsWith('.js')) {
        // Ensure components are globally accessible
        let processed = content;

        // Remove ES module imports (React is global via CDN)
        processed = processed.replace(/^import\s+React.*from\s+['"]react['"];?\s*$/gm, '');
        processed = processed.replace(/^import\s+\{.*\}\s+from\s+['"]react['"];?\s*$/gm, '');

        // Extract default export name and add window assignment
        const defaultExportMatch = processed.match(/export\s+default\s+(\w+)/);
        if (defaultExportMatch) {
          const componentName = defaultExportMatch[1];
          processed = processed.replace(/export\s+default\s+\w+;?\s*$/, '');
          processed += `\nwindow.${componentName} = ${componentName};\n`;
        }

        // Handle `export default function ComponentName`
        const funcExportMatch = processed.match(/export\s+default\s+function\s+(\w+)/);
        if (funcExportMatch) {
          const componentName = funcExportMatch[1];
          processed = processed.replace('export default function', 'function');
          processed += `\nwindow.${componentName} = ${componentName};\n`;
        }

        // Replace relative imports with window references
        processed = processed.replace(
          /import\s+(\w+)\s+from\s+['"]\.\/(components\/)?(\w+)['"];?/g,
          (match, name) => `const ${name} = window.${name};`
        );

        // Write processed file
        const projectPath = projectManager.getProjectPath(projectId);
        await fs.writeFile(path.join(projectPath, filePath), processed, 'utf-8');
      }
    }
  }

  /**
   * Update index.html to include script tags for all component files.
   */
  async _updateIndexHtml(projectId) {
    const files = projectManager.getProjectFiles(projectId);
    const projectPath = projectManager.getProjectPath(projectId);
    const indexPath = path.join(projectPath, 'index.html');

    let indexContent = await fs.readFile(indexPath, 'utf-8');

    // Collect all JSX/JS files (order: components first, then App.jsx)
    const componentFiles = Object.keys(files)
      .filter(f => (f.endsWith('.jsx') || f.endsWith('.js')) && f !== 'src/App.jsx')
      .sort();

    // Build script tags for components (must load before App.jsx)
    const componentScripts = componentFiles
      .map(f => `  <script type="text/babel" src="./${f}"></script>`)
      .join('\n');

    // Inject component scripts before the App.jsx script
    if (componentScripts && !indexContent.includes('<!-- COMPONENT_SCRIPTS -->')) {
      indexContent = indexContent.replace(
        '<script type="text/babel" data-type="module" src="./src/App.jsx"></script>',
        `<!-- COMPONENT_SCRIPTS -->\n${componentScripts}\n  <script type="text/babel" data-type="module" src="./src/App.jsx"></script>`
      );
    } else if (componentScripts) {
      // Update existing component scripts block
      indexContent = indexContent.replace(
        /<!-- COMPONENT_SCRIPTS -->[\s\S]*?<script type="text\/babel" data-type="module" src="\.\/src\/App\.jsx"><\/script>/,
        `<!-- COMPONENT_SCRIPTS -->\n${componentScripts}\n  <script type="text/babel" data-type="module" src="./src/App.jsx"></script>`
      );
    }

    await fs.writeFile(indexPath, indexContent, 'utf-8');
  }

  /**
   * Rebuild only — for incremental updates.
   */
  async rebuild(projectId, onStatus = null) {
    logger.info('BuildEngine', `Incremental rebuild for project ${projectId}`);
    return this.build(projectId, onStatus);
  }

  /**
   * Get the current build status for a project.
   */
  getStatus(projectId) {
    return this._buildStatus.get(projectId) || { status: 'unknown' };
  }

  _updateStatus(projectId, status, error = null) {
    this._buildStatus.set(projectId, {
      status,
      error,
      timestamp: Date.now(),
    });
  }
}

const buildEngine = new BuildEngine();
export default buildEngine;
