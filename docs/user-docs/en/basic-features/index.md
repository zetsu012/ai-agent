---
title: Basic Features
nav_order: 3
has_children: true
---

# Basic Features

This chapter introduces the basic functionality and daily usage of CoolCline.

## Interface Overview

CoolCline's main interface consists of several key components:

- Top right corner: Page navigation buttons
- Above input box: Auto-approve settings (more settings available in the Settings page)
- Input box: Use `@` to add context, `/` to switch role modes, `Enter` to send message, `Shift+Enter` for new line
- Below input box: Role mode switch, LLM Provider switch, Enhance Prompt button, image selection button, send button

## Basic Usage

### Basic Conversation

1. Type your question or request in the input box
2. Click the ✨ button below the input box to enhance your input (optional)
3. Press Enter or click the send button below the input box
4. Wait for the AI assistant's response
5. Continue the conversation or confirm actions as needed

### Context Reference Feature

Type `@` in the input box to quickly reference various contexts:

- `@Problems` - Provide workspace errors/warnings
- `Past URL to fetch contents` - Simply paste links directly in the input box
- `@Add Folder` - Reference an entire folder
- `@Add File` - Reference specific files
- `@Git Commits` - Reference Git history

### Role Mode Switching

Switch button located at the bottom left of the input box

- `Agent` mode: An autonomous AI programming agent with comprehensive code understanding, generation, and project management capabilities (automatic code reading/editing, command execution, context understanding, task decomposition, tool usage. Note: this mode is not restricted by auto-approve settings)
- `Code` mode: Helps you write, refactor, fix code and run commands (write code, execute commands)
- `Architect` mode: Suitable for high-level technical design and system architecture discussions (cannot write code or execute commands)
- `Ask` mode: Suitable for codebase-related questions and concept exploration (cannot write code or execute commands)

### LLM Provider Switching

Switch button located at the bottom center of the input box

> Dropdown list options are maintained in the `Settings` page

- You can open the `Settings`⚙️ page and find the configuration area at the top, where there's a `default` option
- Here, you can create and manage multiple LLM Provider options
    - You can even create separate options for different Models of the same LLM Provider, each option storing complete configuration information
    - After creation, you can switch configurations in real-time at the bottom of the chat input box
    - Configuration information includes: LLM Provider, API Key, Model, and other provider-specific settings
    - Steps to create LLM Provider options (step 4 can be swapped with steps 2 and 3):
        1. Click the + button to automatically `copy` an option based on current settings, named xx (copy)
        2. Click the ✏️ icon to modify the option name
        3. Click ☑️ to save the option name
        4. Adjust core parameters like Model as needed (saves automatically when focus is lost)
    - Naming suggestions for options: Recommended structure "Provider-ModelVersion-Feature", e.g.: openrouter-deepseek-v3-free; openrouter-deepseek-r1-free; deepseek-v3-official; deepseek-r1-official

### Enhance Prompt

After typing your question in the input box, you can click the ✨ button at the bottom, which will enhance your question content. You can set the LLM Provider used for `Support Prompt Settings` in the `Prompt Enhancement` section of the `Prompts` page.

### Terminal Content Integration

1. Select content in the command line terminal
2. Right-click
3. Choose "CoolCline:Add Terminal Content to Context"
4. Terminal content will be added to the input box

## Operation Feedback

CoolCline provides multiple feedback mechanisms:

- Text responses: Direct answers and explanations
- Code display: Formatted code blocks
- Operation confirmation: Key actions requiring your confirmation
- Error messages: When operations fail
- Sound effects: When enabled in settings, you'll hear audio feedback

## Quick Operations

### Common Shortcuts

- `Ctrl+Shift+L` - Show/hide secondary sidebar
- `Tab` - Autocomplete @ suggestions
- `Enter` - Send message
- `Shift+Enter` - New line in input box

### Toolbar Buttons

- New Task - Create new chat session
- Prompts - View and edit Prompts
- MCP Servers - View and edit MCP Servers
- History - View conversation history
- Open in Editor - Open current page in editor
- Settings - Open settings panel

## Best Practices

1. Make good use of context references:
    - Use `@` to provide relevant files and error information
    - Provide sufficient context for AI, faster and more accurate processing
    - Can save your Tokens cost
2. Keep it simple and clear:
    - Focus on one topic per question
    - Use clear language to describe requirements
3. Confirm important operations:
    - Review AI-suggested modifications
    - Check git status before executing important actions
