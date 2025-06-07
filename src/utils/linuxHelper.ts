import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { app } from "electron";
import { execSync } from "child_process";
import os from "os";

const isDev = process.env.NODE_ENV === "development";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = isDev
  ? "/home/greenantix/AI/gemini-mcp-desktop-client/static/serverConfig.json" // Fixed path for development
  : path.join(app.getPath("userData"), "serverConfig.json");

// System context gathering functions
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

// Linux Helper prompt template
function createLinuxHelperPrompt(systemContext: any) {
  return `You are a helpful Linux assistant for a user who is NEW TO LINUX (Pop!_OS).
Your job is to analyze screenshots and provide beginner-friendly explanations with specific, accurate commands.

SYSTEM CONTEXT:
- User: ${systemContext.username}@${systemContext.hostname}
- OS: ${systemContext.distro}
- Current Directory: ${systemContext.currentDir}
${systemContext.git ? `- Git User: ${systemContext.git.user} (${systemContext.git.email})
- Git Branch: ${systemContext.git.branch}
- Git Status: ${systemContext.git.hasChanges ? "Has uncommitted changes" : "Clean"}` : "- Not in a git repository"}

ANALYZE THIS SCREENSHOT and provide helpful suggestions:

GUIDELINES:
1. FIRST AND MOST IMPORTANT: Describe what you actually SEE in the screenshot
2. If you see ERROR MESSAGES or RED TEXT, provide the exact fix command
3. If you see specific text, code, or UI elements, mention them specifically
4. Only suggest git/GitHub commands if you actually see git-related content in the screenshot
5. Use ACTUAL usernames/paths from the context above (never use placeholders like {username})
6. Explain what commands do (user is learning Linux)
7. Be specific - use real file paths, not placeholders
8. If nothing urgent visible, suggest 2-3 helpful next steps based on what's shown
9. Prioritize safety - warn about dangerous commands

RESPONSE FORMAT:
## 🔍 What I See
[Brief description of what's in the screenshot]

## 💡 Suggested Commands
For each command you suggest, format it EXACTLY like this (one command per code block):

\`\`\`bash
# Check available disk space
df -h
\`\`\`

\`\`\`bash
# Install a missing package
sudo apt install package-name
\`\`\`

\`\`\`bash
# Navigate to home directory
cd ~
\`\`\`

CRITICAL: 
- Use ONLY \`\`\`bash (not \`\`\`sh or \`\`\`shell)
- One command per code block
- Always include a # comment above each command
- Make comments descriptive and educational

## 📚 Explanation
[Educational notes about the commands and concepts]

IMPORTANT: Always wrap commands in \`\`\`bash code blocks with descriptive comments. One command per block.

Keep responses concise but educational. Focus on practical next steps.`;
}

// Initialize Gemini with vision capabilities for Linux Helper
export async function initializeLinuxHelperModel() {
  try {
    const data = fs.readFileSync(configPath, "utf-8");
    if (!data) {
      throw new Error("No configuration file found");
    }
    
    const serverConfigurations = JSON.parse(data);
    const { GEMINI_API_KEY } = serverConfigurations;
    
    if (!GEMINI_API_KEY) {
      throw new Error("No Gemini API key found");
    }
    
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

// Analyze screenshot with Linux Helper context
export async function analyzeScreenshotWithLinuxHelper(
  screenshotDataUrl: string,
  settings?: {
    linuxDistro?: string;
    showSystemContext?: boolean;
  }
): Promise<string> {
  try {
    const model = await initializeLinuxHelperModel();
    const systemContext = getSystemContext(settings?.linuxDistro);
    
    if (!systemContext) {
      throw new Error("Failed to gather system context");
    }
    
    const prompt = createLinuxHelperPrompt(systemContext);
    
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