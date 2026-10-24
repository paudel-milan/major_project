/**
 * CodeValidator — statically validates generated sandbox code for common issues.
 * Catches problems BEFORE the user sees a white screen, enabling the self-heal loop.
 *
 * Checks:
 *   1. Missing window.AppComponent in App.jsx
 *   2. Unbalanced braces / parentheses (common LLM truncation issue)
 *   3. Undefined component references (used in App but not defined in any file)
 *   4. Leftover ES module imports that won't work in the browser sandbox
 *   5. Functions/components referenced but never declared
 *   6. JSX rendering a component that wasn't exported to window
 */

import logger from '../utils/logger.js';

class CodeValidator {
  /**
   * Validate all project files for common rendering issues.
   * @param {Record<string, string>} files — { "src/App.jsx": "code...", ... }
   * @returns {{ valid: boolean, issues: string[] }}
   */
  validate(files) {
    const issues = [];

    // ── 1. App.jsx must exist and set window.AppComponent ──
    const appFile = files['src/App.jsx'];
    if (!appFile) {
      issues.push('MISSING_APP: src/App.jsx is missing from the generated files.');
    } else {
      if (!appFile.includes('window.AppComponent')) {
        issues.push('MISSING_EXPORT: src/App.jsx does not set window.AppComponent. The app will not render.');
      }
      // Check the App component actually has a return with JSX
      if (!this._hasJSXReturn(appFile)) {
        issues.push('NO_JSX_RETURN: The App component in src/App.jsx does not appear to return any JSX.');
      }
    }

    // ── 2. Check every JSX/JS file for syntax issues ──
    for (const [filePath, content] of Object.entries(files)) {
      if (!filePath.endsWith('.jsx') && !filePath.endsWith('.js')) continue;
      if (filePath === 'src/index.css') continue;

      // Balanced braces
      const braceIssue = this._checkBalancedBraces(content);
      if (braceIssue) {
        issues.push(`SYNTAX_${filePath}: ${braceIssue}`);
      }

      // Leftover ES imports that won't resolve in browser
      const badImports = this._findBadImports(content);
      if (badImports.length > 0) {
        issues.push(
          `BAD_IMPORTS_${filePath}: These import statements will fail in the browser sandbox: ${badImports.join('; ')}`
        );
      }
    }

    // ── 3. Check component references ──
    if (appFile) {
      const refIssues = this._checkComponentReferences(files);
      issues.push(...refIssues);
    }

    // ── 4. Check for empty/stub components ──
    for (const [filePath, content] of Object.entries(files)) {
      if (!filePath.endsWith('.jsx')) continue;
      if (filePath === 'src/App.jsx') continue;

      if (content.trim().length < 30) {
        issues.push(`EMPTY_COMPONENT_${filePath}: Component file appears empty or is a stub.`);
      }
    }

    const valid = issues.length === 0;
    if (!valid) {
      logger.info('CodeValidator', `Found ${issues.length} issue(s): ${issues.join(' | ')}`);
    } else {
      logger.info('CodeValidator', 'Validation passed — no issues found');
    }

    return { valid, issues };
  }

  /**
   * Build a repair prompt that tells the LLM exactly what to fix.
   * @param {string[]} issues — list of issues from validate()
   * @param {Record<string, string>} currentFiles — the current project files
   * @returns {string} repair prompt
   */
  buildRepairPrompt(issues, currentFiles) {
    let prompt = `The code you just generated has the following issues that prevent it from rendering correctly in the browser:\n\n`;

    for (let i = 0; i < issues.length; i++) {
      prompt += `${i + 1}. ${issues[i]}\n`;
    }

    prompt += `\nHere are the current files:\n\n`;
    for (const [filePath, content] of Object.entries(currentFiles)) {
      if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        prompt += `--- ${filePath} ---\n${content}\n\n`;
      }
    }

    prompt += `\nCRITICAL FIX INSTRUCTIONS:
1. Fix ALL the issues listed above.
2. Return the COMPLETE corrected code for EVERY file that needs changes.
3. Return ONLY valid JSON with a "files" object and a "description" string.
4. The main App component MUST have: window.AppComponent = App; at the end.
5. Do NOT use import statements for React — React, useState, useEffect, etc. are available globally.
6. Every component must assign itself to window. Example: window.Navbar = Navbar;
7. All files must have properly balanced braces, parentheses, and brackets.
8. Make sure every component referenced in App.jsx is defined in its own file.
9. Every function component must return valid JSX.
10. Use Tailwind CSS classes for styling.`;

    return prompt;
  }

  // ─── Private helpers ───

  /**
   * Check if code has a JSX return statement.
   */
  _hasJSXReturn(code) {
    // Look for return ( <... ) or return <...
    return /return\s*\(?\s*</.test(code);
  }

  /**
   * Check for balanced braces, parens, and brackets.
   */
  _checkBalancedBraces(code) {
    // Strip strings and comments first to avoid false positives
    const stripped = code
      .replace(/\/\/.*$/gm, '')            // line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')    // block comments
      .replace(/'(?:[^'\\]|\\.)*'/g, '')    // single-quoted strings
      .replace(/"(?:[^"\\]|\\.)*"/g, '')    // double-quoted strings
      .replace(/`(?:[^`\\]|\\.)*`/g, '');   // template literals

    const pairs = { '{': '}', '(': ')', '[': ']' };
    const stack = [];

    for (const ch of stripped) {
      if (ch in pairs) {
        stack.push(pairs[ch]);
      } else if (ch === '}' || ch === ')' || ch === ']') {
        if (stack.length === 0 || stack[stack.length - 1] !== ch) {
          return `Unmatched '${ch}' — the code may be truncated or have a syntax error.`;
        }
        stack.pop();
      }
    }

    if (stack.length > 0) {
      const missing = stack.reverse().join('');
      return `Missing closing characters: ${missing} — the code appears to be truncated.`;
    }

    return null;
  }

  /**
   * Find leftover import statements that won't work in browser sandbox.
   * React/ReactDOM imports are OK (they get stripped by BuildEngine).
   * Relative imports are OK (they get converted to window references).
   */
  _findBadImports(code) {
    const importLines = code.match(/^import\s+.+from\s+['"]([^'"]+)['"];?\s*$/gm) || [];
    const badImports = [];

    for (const line of importLines) {
      const moduleMatch = line.match(/from\s+['"]([^'"]+)['"]/);
      if (!moduleMatch) continue;
      const moduleName = moduleMatch[1];

      // These are handled by BuildEngine
      if (moduleName === 'react' || moduleName === 'react-dom') continue;
      // Relative imports get converted to window references
      if (moduleName.startsWith('./') || moduleName.startsWith('../')) continue;

      // Anything else (npm packages like 'axios', 'react-router-dom', etc.) will break
      badImports.push(`import from '${moduleName}'`);
    }

    return badImports;
  }

  /**
   * Check that all components referenced in App.jsx actually exist in other files.
   */
  _checkComponentReferences(files) {
    const issues = [];
    const appCode = files['src/App.jsx'] || '';

    // Find all `window.ComponentName` references in App.jsx
    const windowRefs = appCode.match(/window\.(\w+)/g) || [];
    const referencedComponents = windowRefs
      .map(ref => ref.replace('window.', ''))
      .filter(name => name !== 'AppComponent' && name !== 'addEventListener' && name !== 'scrollY');

    // Find all `const X = window.X;` references
    const constRefs = appCode.match(/const\s+(\w+)\s*=\s*window\.\1/g) || [];
    const constComponents = constRefs.map(r => r.match(/const\s+(\w+)/)?.[1]).filter(Boolean);

    // Find all JSX component usages (capitalized tags like <Navbar />, <Hero />)
    const jsxComponents = [...new Set(
      (appCode.match(/<([A-Z]\w+)/g) || []).map(m => m.slice(1))
    )];

    // Combine all referenced component names
    const allReferenced = [...new Set([...referencedComponents, ...constComponents, ...jsxComponents])];

    // Check if each referenced component is defined somewhere
    for (const compName of allReferenced) {
      if (compName === 'React' || compName === 'Fragment') continue;

      // Check if any file exports this component to window
      const hasDefinition = Object.entries(files).some(([fp, content]) => {
        if (fp === 'src/App.jsx') return false;
        return content.includes(`window.${compName}`) || 
               content.includes(`function ${compName}`) ||
               content.includes(`const ${compName}`);
      });

      if (!hasDefinition) {
        issues.push(
          `MISSING_COMPONENT: App.jsx uses <${compName} /> but no file defines or exports it. ` +
          `Create src/components/${compName}.jsx with the component code and window.${compName} = ${compName};`
        );
      }
    }

    return issues;
  }
}

const codeValidator = new CodeValidator();
export default codeValidator;
