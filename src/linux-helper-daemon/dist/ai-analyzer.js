"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIAnalyzer = void 0;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
class AIAnalyzer {
    constructor(logger, apiKey) {
        this.logger = logger;
        this.apiKey = apiKey || process.env.GEMINI_API_KEY || "AIzaSyC6oGrn1D62R5urFLAvDgUAhuDQxL-J8xc";
    }
    async analyzeScreenshot(screenshotDataUrl, settings) {
        try {
            this.logger.info('Starting AI analysis of screenshot');
            // Use real Gemini analysis
            const analysisText = await this.analyzeScreenshotWithGemini(screenshotDataUrl, settings);
            // Parse commands from the response
            const commands = this.parseCommandsFromResponse(analysisText);
            // Extract suggestions from the analysis
            const suggestions = this.extractSuggestions(analysisText, commands);
            // Extract summary
            const summary = this.extractSummary(analysisText);
            this.logger.info(`Analysis complete: ${commands.length} commands found`);
            return {
                summary,
                suggestions,
                commands,
                context: { analysisText }
            };
        }
        catch (error) {
            this.logger.error('Failed to analyze screenshot:', error);
            throw error;
        }
    }
    async analyzeScreenshotWithGemini(screenshotDataUrl, settings) {
        try {
            if (!this.apiKey) {
                throw new Error('No API key available for Gemini');
            }
            const genAI = new generative_ai_1.GoogleGenerativeAI(this.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            // Gather system context for personalized analysis
            const context = this.getSystemContext(settings?.linuxDistro);
            const prompt = this.createPersonalAssistantPrompt(context);
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
        }
        catch (error) {
            this.logger.error('Gemini API error:', error);
            return `❌ **Error analyzing screenshot**

Sorry, I couldn't analyze the screenshot. This might be due to:
- API key issues
- Network connectivity problems  
- Rate limiting

Please try again in a moment.`;
        }
    }
    getSystemContext(preferredDistro) {
        try {
            const username = os_1.default.userInfo().username;
            const hostname = os_1.default.hostname();
            const currentDir = process.cwd();
            // Get git info if in a git repo
            let gitInfo = null;
            try {
                const gitUser = (0, child_process_1.execSync)("git config user.name", { encoding: "utf-8" }).trim();
                const gitEmail = (0, child_process_1.execSync)("git config user.email", { encoding: "utf-8" }).trim();
                const gitBranch = (0, child_process_1.execSync)("git branch --show-current", { encoding: "utf-8" }).trim();
                const gitStatus = (0, child_process_1.execSync)("git status --porcelain", { encoding: "utf-8" }).trim();
                gitInfo = {
                    user: gitUser,
                    email: gitEmail,
                    branch: gitBranch,
                    hasChanges: gitStatus.length > 0,
                    statusSummary: gitStatus
                };
            }
            catch (e) {
                // Not in a git repo or git not available
            }
            // Get distro info
            let distroInfo = "Linux";
            if (preferredDistro) {
                const distroMap = {
                    'pop-os': 'Pop!_OS',
                    'ubuntu': 'Ubuntu',
                    'debian': 'Debian',
                    'fedora': 'Fedora',
                    'arch': 'Arch Linux',
                    'mint': 'Linux Mint',
                    'generic': 'Linux'
                };
                distroInfo = distroMap[preferredDistro] || 'Linux';
            }
            else {
                try {
                    const osRelease = fs_1.default.readFileSync("/etc/os-release", "utf-8");
                    const prettyName = osRelease.match(/PRETTY_NAME="([^"]+)"/);
                    if (prettyName) {
                        distroInfo = prettyName[1];
                    }
                }
                catch (e) {
                    // Fallback
                }
            }
            // Get package info if available
            let packageInfo = null;
            try {
                const packagePath = `${currentDir}/package.json`;
                if (fs_1.default.existsSync(packagePath)) {
                    const pkg = JSON.parse(fs_1.default.readFileSync(packagePath, 'utf-8'));
                    packageInfo = {
                        name: pkg.name,
                        version: pkg.version,
                        scripts: Object.keys(pkg.scripts || {}),
                        dependencies: Object.keys(pkg.dependencies || {}),
                        devDependencies: Object.keys(pkg.devDependencies || {})
                    };
                }
            }
            catch (error) {
                // Ignore
            }
            return {
                username,
                hostname,
                currentDir,
                distro: distroInfo,
                git: gitInfo,
                packageInfo,
                timestamp: new Date().toISOString()
            };
        }
        catch (error) {
            this.logger.error('Failed to gather system context:', error);
            return {
                username: 'user',
                hostname: 'linux',
                currentDir: process.cwd(),
                distro: 'Linux',
                git: null,
                packageInfo: null,
                timestamp: new Date().toISOString()
            };
        }
    }
    createPersonalAssistantPrompt(context) {
        return `You are ${context.username}'s Personal AI Coding Assistant - a deeply integrated AI that knows their development environment and project context.

═══════════════════════════════════════════════════════════════════
🖥️  SYSTEM ENVIRONMENT
═══════════════════════════════════════════════════════════════════
Host: ${context.username}@${context.hostname}
OS: ${context.distro}
Current Directory: ${context.currentDir}
Timestamp: ${context.timestamp}

═══════════════════════════════════════════════════════════════════
📂 CURRENT PROJECT ANALYSIS
═══════════════════════════════════════════════════════════════════
${context.packageInfo ? `
Project Name: ${context.packageInfo.name}
Version: ${context.packageInfo.version}
Type: Node.js project

📦 PACKAGE CONFIGURATION:
- Scripts Available: ${context.packageInfo.scripts.join(', ')}
- Runtime Dependencies: ${context.packageInfo.dependencies.join(', ')}
- Dev Dependencies: ${context.packageInfo.devDependencies.join(', ')}
` : 'No package.json found - may be non-Node.js project'}

═══════════════════════════════════════════════════════════════════
🔧 GIT REPOSITORY STATE
═══════════════════════════════════════════════════════════════════
${context.git ? `
Repository Status: Active Git repository
Current Branch: ${context.git.branch}
Working Tree: ${context.git.hasChanges ? "🔴 HAS UNCOMMITTED CHANGES" : "🟢 CLEAN"}
` : `
Repository Status: ❌ NOT A GIT REPOSITORY
- Consider: git init && git add . && git commit -m "Initial commit"
`}

═══════════════════════════════════════════════════════════════════
🎯 SCREENSHOT ANALYSIS CONTEXT
═══════════════════════════════════════════════════════════════════
You are analyzing a screenshot from ${context.username}'s development session.

PERSONAL CODING ASSISTANT GOALS:
1. 🔍 Analyze what they're showing you in the screenshot
2. 🧠 Connect it to their current project context
3. ⚡ Provide smart, project-specific solutions
4. 🔗 Chain commands intelligently for complete workflows
5. 📚 Educate while solving their immediate problem
6. 🛡️ Keep their development environment safe and organized

GUIDELINES:
1. FIRST: Describe what you SEE in the screenshot (errors, code, terminals, IDE, etc.)
2. CODING FOCUS: If you see code errors, provide fix commands tailored to THIS project
3. CONTEXT AWARE: Reference the specific project and context shown above
4. PERSONALIZED: Use their actual usernames, paths, project names from context
5. COMMAND CHAINS: Provide complete solutions using && operators
6. PROJECT INTEGRATION: Consider how this fits their current development workflow
7. EDUCATIONAL: Explain commands briefly
8. SAFETY: Warn about dangerous operations

RESPONSE FORMAT:
## 🔍 What I See
[Describe the screenshot: code, errors, terminals, IDE, etc.]

## 💻 Smart Solution
Based on what you see in the screenshot, provide specific commands that address the actual issue:

\`\`\`bash
# Actual commands here
\`\`\`

## 🧠 Context Analysis  
How this relates to their current ${context.packageInfo?.name || 'project'} development:

CRITICAL RULES:
- ACTUALLY LOOK AT THE SCREENSHOT - don't give generic responses
- If you see specific errors, provide commands to fix THOSE errors
- If you see specific code, reference THAT code
- If you see terminals, respond to what's actually shown
- NO GENERIC responses unless you actually see relevant issues
- Be specific to what's visually shown, not templated responses

Keep responses focused on their actual development workflow and current project state.`;
    }
    parseCommandsFromResponse(response) {
        const commands = [];
        // Look for code blocks with bash/shell commands
        const codeBlockRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
        let match;
        while ((match = codeBlockRegex.exec(response)) !== null) {
            const commandBlock = match[1].trim();
            // Split multiple commands by newlines
            const blockCommands = commandBlock.split('\n').filter(cmd => cmd.trim() && !cmd.trim().startsWith('#'));
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
    extractSuggestions(analysisText, commands) {
        const suggestions = [];
        // Try to extract structured suggestions from the analysis
        commands.forEach((command, index) => {
            let title = `Solution ${index + 1}`;
            let description = 'Execute this command';
            // Try to extract context around the command
            const commandIndex = analysisText.indexOf(command);
            if (commandIndex > -1) {
                // Look for context before the command
                const beforeCommand = analysisText.substring(Math.max(0, commandIndex - 200), commandIndex);
                const afterCommand = analysisText.substring(commandIndex + command.length, commandIndex + command.length + 200);
                // Try to find a title or description
                const titleMatch = beforeCommand.match(/##\s*(.+)$/m) || beforeCommand.match(/\*\*(.+)\*\*/);
                if (titleMatch) {
                    title = titleMatch[1].trim();
                }
                // Try to find a description
                const descMatch = afterCommand.match(/^[\s\S]*?(?=\n\n|$)/);
                if (descMatch) {
                    description = descMatch[0].trim().substring(0, 100) + '...';
                }
            }
            // Generate smart titles based on command content
            if (command.includes('npm run lint')) {
                title = 'Fix Linting Issues';
                description = 'Run linter to fix code style issues';
            }
            else if (command.includes('npm test')) {
                title = 'Run Tests';
                description = 'Execute test suite to verify functionality';
            }
            else if (command.includes('git')) {
                title = 'Git Operation';
                description = 'Perform git version control operation';
            }
            else if (command.includes('npm install')) {
                title = 'Install Dependencies';
                description = 'Install missing packages';
            }
            suggestions.push({ title, command, description });
        });
        return suggestions;
    }
    extractSummary(analysisText) {
        // Try to extract the first meaningful section as summary
        const lines = analysisText.split('\n');
        let summary = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('*') && !trimmed.startsWith('-')) {
                summary = trimmed;
                break;
            }
        }
        // If no good summary found, create one from context
        if (!summary) {
            if (analysisText.includes('error')) {
                summary = 'Detected errors that need attention';
            }
            else if (analysisText.includes('test')) {
                summary = 'Testing-related task identified';
            }
            else if (analysisText.includes('lint')) {
                summary = 'Code quality issues found';
            }
            else {
                summary = 'Analysis complete - review suggestions below';
            }
        }
        return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
    }
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }
    getApiKey() {
        return this.apiKey;
    }
}
exports.AIAnalyzer = AIAnalyzer;
//# sourceMappingURL=ai-analyzer.js.map