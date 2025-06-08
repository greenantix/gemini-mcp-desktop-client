import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import { execSync } from "child_process";
import os from "os";
import { connectToMcpServers } from "./llmChat/getMcpTools";

// Enhanced project context gathering with MCP integration
async function getEnhancedProjectContext(preferredDistro?: string) {
  try {
    const baseContext = getSystemContext(preferredDistro);
    
    // Connect to MCP servers for enhanced context
    const mcpTools = await connectToMcpServers(false);
    
    // Gather current project information
    const projectContext = {
      currentFiles: await getCurrentDirectoryFiles(mcpTools),
      recentGitChanges: await getRecentGitActivity(),
      projectStructure: await getProjectStructure(mcpTools),
      packageInfo: await getPackageInfo(),
      openFiles: await getRecentlyModifiedFiles(mcpTools)
    };
    
    return {
      ...baseContext,
      project: projectContext,
      mcpToolsAvailable: mcpTools ? mcpTools.mcpClients.size : 0
    };
  } catch (error) {
    console.error("Failed to gather enhanced context:", error);
    return getSystemContext(preferredDistro);
  }
}

// System context gathering functions (basic)
function getSystemContext(preferredDistro?: string) {
  try {
    const username = os.userInfo().username;
    const hostname = os.hostname();
    const currentDir = process.cwd();
    
    // Get git info if in a git repo
    let gitInfo = null;
    try {
      const gitUser = execSync("git config user.name", { encoding: "utf-8" }).trim();
      const gitEmail = execSync("git config user.email", { encoding: "utf-8" }).trim();
      const gitBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
      const gitStatus = execSync("git status --porcelain", { encoding: "utf-8" }).trim();
      
      gitInfo = {
        user: gitUser,
        email: gitEmail,
        branch: gitBranch,
        hasChanges: gitStatus.length > 0,
        statusSummary: gitStatus
      };
    } catch (e) {
      // Not in a git repo or git not available
    }
    
    // Get distro info
    let distroInfo = "Linux";
    if (preferredDistro) {
      // Use preferred distro from settings
      const distroMap = {
        'pop-os': 'Pop!_OS',
        'ubuntu': 'Ubuntu',
        'debian': 'Debian',
        'fedora': 'Fedora',
        'arch': 'Arch Linux',
        'mint': 'Linux Mint',
        'generic': 'Linux'
      };
      distroInfo = distroMap[preferredDistro as keyof typeof distroMap] || 'Linux';
    } else {
      // Auto-detect from system
      try {
        const osRelease = fs.readFileSync("/etc/os-release", "utf-8");
        const prettyName = osRelease.match(/PRETTY_NAME="([^"]+)"/);
        if (prettyName) {
          distroInfo = prettyName[1];
        }
      } catch (e) {
        // Fallback
      }
    }
    
    return {
      username,
      hostname,
      currentDir,
      distro: distroInfo,
      git: gitInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error("Failed to gather system context:", error);
    return null;
  }
}

// Helper functions for enhanced project context
async function getCurrentDirectoryFiles(mcpTools: any) {
  try {
    if (mcpTools?.mcpClients) {
      // Look for filesystem MCP client
      for (const [serverKey, client] of mcpTools.mcpClients) {
        try {
          const result = await client.callTool({
            name: "list_directory",
            arguments: { path: process.cwd() }
          });
          if (result.content && Array.isArray(result.content)) {
            return result.content.slice(0, 20);
          }
        } catch (toolError) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error("Failed to get directory files:", error);
  }
  return [];
}

async function getRecentGitActivity() {
  try {
    const recentCommits = execSync("git log --oneline -5", { encoding: "utf-8" }).trim();
    const currentBranch = execSync("git branch --show-current", { encoding: "utf-8" }).trim();
    const modifiedFiles = execSync("git diff --name-only HEAD~1", { encoding: "utf-8" }).trim();
    
    return {
      recentCommits: recentCommits.split('\n'),
      currentBranch,
      recentlyModified: modifiedFiles.split('\n').filter(f => f)
    };
  } catch (error) {
    return null;
  }
}

async function getProjectStructure(mcpTools: any) {
  try {
    if (mcpTools?.mcpClients) {
      // Look for filesystem MCP client
      for (const [serverKey, client] of mcpTools.mcpClients) {
        try {
          const result = await client.callTool({
            name: "read_file",
            arguments: { path: `${process.cwd()}/package.json` }
          });
          if (result.content) {
            return {
              type: 'nodejs',
              config: JSON.parse(result.content)
            };
          }
        } catch (toolError) {
          continue;
        }
      }
    }
  } catch (error) {
    // Try other project types
    try {
      if (fs.existsSync(`${process.cwd()}/Cargo.toml`)) {
        return { type: 'rust' };
      }
      if (fs.existsSync(`${process.cwd()}/requirements.txt`)) {
        return { type: 'python' };
      }
      if (fs.existsSync(`${process.cwd()}/Dockerfile`)) {
        return { type: 'docker' };
      }
    } catch (e) {
      // Ignore
    }
  }
  return { type: 'unknown' };
}

async function getPackageInfo() {
  try {
    const packagePath = `${process.cwd()}/package.json`;
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      return {
        name: pkg.name,
        version: pkg.version,
        scripts: Object.keys(pkg.scripts || {}),
        dependencies: Object.keys(pkg.dependencies || {}),
        devDependencies: Object.keys(pkg.devDependencies || {})
      };
    }
  } catch (error) {
    // Ignore
  }
  return null;
}

async function getRecentlyModifiedFiles(mcpTools: any) {
  try {
    if (mcpTools?.mcpClients) {
      // Look for filesystem MCP client
      for (const [serverKey, client] of mcpTools.mcpClients) {
        try {
          const result = await client.callTool({
            name: "list_directory", 
            arguments: { path: process.cwd() }
          });
          if (result.content && Array.isArray(result.content)) {
            return result.content.slice(0, 10);
          }
        } catch (toolError) {
          continue;
        }
      }
    }
  } catch (error) {
    // Ignore
  }
  return [];
}

// Personal Coding Assistant prompt template
function createPersonalAssistantPrompt(enhancedContext: any) {
  const base = enhancedContext;
  const project = enhancedContext.project || {};
  
  return `You are ${enhancedContext.username}'s Personal AI Coding Assistant - a deeply integrated AI that knows their entire development environment, coding patterns, and project history.

═══════════════════════════════════════════════════════════════════
🖥️  SYSTEM ENVIRONMENT
═══════════════════════════════════════════════════════════════════
Host: ${base.username}@${base.hostname}
OS: ${base.distro} (Pop!_OS - Ubuntu-based, APT package manager)
Shell: bash (assuming standard Pop!_OS setup)
Current Directory: ${base.currentDir}
Timestamp: ${base.timestamp}

═══════════════════════════════════════════════════════════════════
📂 CURRENT PROJECT ANALYSIS
═══════════════════════════════════════════════════════════════════
Project Name: ${project.packageInfo?.name || 'Unknown'}
Version: ${project.packageInfo?.version || 'Unknown'}
Type: ${project.projectStructure?.type || 'unknown'} project
${project.packageInfo ? `
📦 PACKAGE CONFIGURATION:
- Scripts Available: ${project.packageInfo.scripts.join(', ')}
- Runtime Dependencies: ${project.packageInfo.dependencies.join(', ')}
- Dev Dependencies: ${project.packageInfo.devDependencies.join(', ')}
- Total Dependencies: ${project.packageInfo.dependencies.length + project.packageInfo.devDependencies.length}

🔧 PROJECT STRUCTURE DETECTED:
${project.projectStructure?.type === 'nodejs' ? `
  - Node.js/JavaScript project
  - Package manager: npm (based on package.json presence)
  - Likely using: React/Vue/Node.js based on dependencies
  - Build system: Likely Vite/Webpack (check scripts)
` : project.projectStructure?.type === 'rust' ? `
  - Rust project (Cargo.toml detected)
  - Package manager: Cargo
  - Build system: Cargo
` : project.projectStructure?.type === 'python' ? `
  - Python project (requirements.txt detected)
  - Package manager: pip/pipenv/poetry
` : `
  - Unknown project type
  - No standard config files detected
`}` : '- No package.json found - may be non-Node.js project'}

═══════════════════════════════════════════════════════════════════
🔧 GIT REPOSITORY STATE
═══════════════════════════════════════════════════════════════════
${base.git ? `
Repository Status: Active Git repository
Current Branch: ${base.git.branch}
Working Tree: ${base.git.hasChanges ? "🔴 HAS UNCOMMITTED CHANGES" : "🟢 CLEAN"}

📝 RECENT DEVELOPMENT ACTIVITY:
${project.recentGitChanges ? `
Last 5 Commits:
${project.recentGitChanges.recentCommits?.map((commit, i) => `  ${i + 1}. ${commit}`).join('\n') || '  No recent commits'}

Files Modified Since Last Commit:
${project.recentGitChanges.recentlyModified?.map(file => `  - ${file}`).join('\n') || '  No recent modifications'}

DEVELOPMENT PATTERN ANALYSIS:
- Recent work focus: ${project.recentGitChanges.recentCommits?.[0]?.includes('fix') ? 'Bug fixes' : 
                      project.recentGitChanges.recentCommits?.[0]?.includes('feat') ? 'Feature development' :
                      project.recentGitChanges.recentCommands?.[0]?.includes('refactor') ? 'Code refactoring' : 'General development'}
- Commit frequency: ${project.recentGitChanges.recentCommits?.length || 0} commits recently
` : '- No recent git activity data available'}` : `
Repository Status: ❌ NOT A GIT REPOSITORY
- This directory is not version controlled
- Consider: git init && git add . && git commit -m "Initial commit"
`}

═══════════════════════════════════════════════════════════════════
🛠️ DEVELOPMENT TOOLS & CONTEXT
═══════════════════════════════════════════════════════════════════
MCP Filesystem Tools: ${base.mcpToolsAvailable || 0} tools available
- Can read/write files directly
- Can analyze project structure
- Can access recent file modifications

DEVELOPMENT ENVIRONMENT DETECTION:
${project.packageInfo?.scripts.includes('dev') ? '✅ Development server available (npm run dev)' : '❌ No dev script detected'}
${project.packageInfo?.scripts.includes('build') ? '✅ Build process available (npm run build)' : '❌ No build script detected'}
${project.packageInfo?.scripts.includes('test') ? '✅ Testing setup available (npm run test)' : '❌ No test script detected'}
${project.packageInfo?.scripts.includes('lint') ? '✅ Linting available (npm run lint)' : '❌ No lint script detected'}

═══════════════════════════════════════════════════════════════════
🎯 SCREENSHOT ANALYSIS CONTEXT
═══════════════════════════════════════════════════════════════════
You are analyzing a screenshot from ${base.username}'s development session.

CONTEXT AWARENESS:
- They are actively developing ${project.packageInfo?.name || 'a project'} 
- Working in: ${base.currentDir}
- Recent activity: ${project.recentGitChanges?.recentCommits?.[0] || 'Unknown'}
- Project state: ${base.git?.hasChanges ? 'Has uncommitted work' : 'Clean state'}

PERSONAL CODING ASSISTANT GOALS:
1. 🔍 Analyze what they're showing you in the screenshot
2. 🧠 Connect it to their current project and recent work
3. ⚡ Provide smart, project-specific solutions
4. 🔗 Chain commands intelligently for complete workflows
5. 📚 Educate while solving their immediate problem
6. 🛡️ Keep their development environment safe and organized

Remember: You know their project intimately. Reference actual file names, dependencies, scripts, and recent changes when relevant.

GUIDELINES:
1. FIRST: Describe what you SEE in the screenshot (errors, code, terminals, etc.)
2. CODING FOCUS: If you see code errors, provide fix commands tailored to THIS project
3. CONTEXT AWARE: Reference the specific project, dependencies, and recent changes shown above
4. PERSONALIZED: Use their actual usernames, paths, project names from context
5. COMMAND CHAINS: Provide complete solutions using && operators (like you've learned)
6. PROJECT INTEGRATION: Consider how this fits their current development workflow
7. MCP ENHANCED: You have filesystem access - reference actual files when relevant
8. EDUCATIONAL: Explain commands briefly since they're learning
9. SAFETY: Warn about dangerous operations but trust their development judgment

RESPONSE FORMAT:
## 🔍 What I See
[Describe the screenshot: code, errors, terminals, IDE, etc.]

## 💻 Smart Solution
Provide ONE intelligent command chain that solves the coding issue:

\`\`\`bash
# Fix the specific issue and continue development workflow
npm run lint && npm run dev
\`\`\`

## 🧠 Context Analysis  
How this relates to their current ${enhancedContext.project?.packageInfo?.name || 'project'} development:
- Reference their recent commits/changes
- Connect to their project dependencies  
- Suggest workflow improvements

CRITICAL RULES:
- ONE command chain in ONE \`\`\`bash block
- Chain with && operators for complete solutions
- Skip unnecessary navigation (they're in ${enhancedContext.currentDir})
- Reference actual project files and context when relevant
- Make solutions project-specific, not generic

Keep responses focused on their actual development workflow and current project state.`;
}

// Initialize Gemini with vision capabilities for Linux Helper
export async function initializeLinuxHelperModel() {
  try {
    // Use the same API key as the main chat system
    const GEMINI_API_KEY = "AIzaSyC6oGrn1D62R5urFLAvDgUAhuDQxL-J8xc";
    console.log(`[Linux Helper] Using direct API key for vision analysis`);
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    
    // Use Gemini 1.5 Flash for vision (cost-effective and fast)
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    
    return model;
  } catch (error) {
    console.error("Failed to initialize Linux Helper model:", error);
    throw error;
  }
}

// Analyze screenshot with Enhanced Personal Assistant context
export async function analyzeScreenshotWithLinuxHelper(
  screenshotDataUrl: string,
  settings?: {
    linuxDistro?: string;
    showSystemContext?: boolean;
  }
): Promise<string> {
  try {
    const model = await initializeLinuxHelperModel();
    
    // Use enhanced context with MCP integration
    const enhancedContext = await getEnhancedProjectContext(settings?.linuxDistro);
    
    if (!enhancedContext) {
      throw new Error("Failed to gather system context");
    }
    
    const prompt = createPersonalAssistantPrompt(enhancedContext);
    
    // Convert data URL to the format Gemini expects
    const base64Data = screenshotDataUrl.split(",")[1];
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/png"
      }
    };
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    return response.text();
    
  } catch (error) {
    console.error("Failed to analyze screenshot:", error);
    return `❌ **Error analyzing screenshot**

Sorry, I couldn't analyze the screenshot. This might be due to:
- API key issues
- Network connectivity problems  
- Rate limiting

Please try again in a moment.`;
  }
}

// Parse commands from Gemini response for execution
export function parseCommandsFromResponse(response: string): string[] {
  const commands: string[] = [];
  
  // Look for code blocks with bash/shell commands
  const codeBlockRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
  let match;
  
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const commandBlock = match[1].trim();
    // Split multiple commands by newlines
    const blockCommands = commandBlock.split('\n').filter(cmd => 
      cmd.trim() && !cmd.trim().startsWith('#')
    );
    commands.push(...blockCommands);
  }
  
  // Also look for inline commands (lines starting with $)
  const lines = response.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('$ ')) {
      commands.push(trimmed.substring(2));
    }
  }
  
  return commands;
}

// Safety check for dangerous commands
export function isDangerousCommand(command: string): boolean {
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,        // rm -rf /
    /rm\s+-rf\s+\*/,        // rm -rf *
    /rm\s+-rf\s+~\//,       // rm -rf ~/
    /chmod\s+777\s+\//,     // chmod 777 /
    /chown\s+.*\s+\//,      // chown on root
    /dd\s+if=.*of=\/dev/,   // dd to block devices
    /mkfs\./,               // filesystem creation
    /fdisk/,                // disk partitioning
    /\:\(\)\{\s*\:\|\:\&\s*\}\;\:/,  // fork bomb
  ];
  
  return dangerousPatterns.some(pattern => pattern.test(command));
}

export { getSystemContext };