/**
 * Code Generator — converts structured LLM response into project files.
 * Handles JSON parsing, file mapping, and incremental updates.
 */

import projectManager from '../builder/ProjectManager.js';
import logger from '../utils/logger.js';

class CodeGenerator {
  parseResponse(response) {
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      const jsonMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[1]); } catch {}
      }
    }
    if (!parsed) {
      const braceMatch = response.match(/\{[\s\S]*"files"[\s\S]*\}/);
      if (braceMatch) {
        try { parsed = JSON.parse(braceMatch[0]); } catch {}
      }
    }
    if (!parsed || !parsed.files) {
      throw new Error('Could not parse file structure from LLM response');
    }
    const files = {};
    for (const [fp, content] of Object.entries(parsed.files)) {
      files[this._normalizePath(fp)] = content;
    }
    return { files, description: parsed.description || 'Files updated' };
  }

  async writeFiles(projectId, files) {
    if (!projectManager.hasProject(projectId)) {
      throw new Error(`Project ${projectId} does not exist`);
    }
    const existing = projectManager.getProjectFiles(projectId);
    const changed = {};
    for (const [fp, content] of Object.entries(files)) {
      if (existing[fp] !== content) changed[fp] = content;
    }
    if (Object.keys(changed).length === 0) {
      return { updatedFiles: [], projectId };
    }
    const updatedFiles = await projectManager.updateFiles(projectId, changed);
    logger.logAgentStep('CodeGen', `Wrote ${updatedFiles.length} files`, { files: updatedFiles });
    return { updatedFiles, projectId };
  }

  async processResponse(projectId, llmResponse) {
    const { files, description } = this.parseResponse(llmResponse);
    const { updatedFiles } = await this.writeFiles(projectId, files);
    return { updatedFiles, description, projectId };
  }

  _normalizePath(fp) {
    let p = fp.replace(/^\.?\//, '');
    if (p.match(/^components\//)) p = `src/${p}`;
    if (p === 'App.jsx') p = 'src/App.jsx';
    if (p === 'index.css' || p === 'styles.css') p = `src/${p}`;
    return p;
  }
}

const codeGenerator = new CodeGenerator();
export default codeGenerator;
