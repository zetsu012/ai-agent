---
title: Getting Started
nav_order: 2
has_children: true
---

# Getting Started

This chapter will guide you through the initial setup and basic configuration of CoolCline.

## Installation Guide

Install through VSCode Extension Marketplace

1. Open VSCode
2. Click on the Extensions icon on the left sidebar or press `Ctrl+Shift+X`
3. Type `CoolCline` in the search box
4. Click the Install button

## Initial Configuration

### Language Settings

1. A welcome page will be displayed on first launch
2. Select your preferred interface language on the welcome page
    - Default is English
    - Supports Chinese, Russian, and other languages
    - Changes are saved automatically
3. If you missed the welcome page, you can modify the language through the `Settings`⚙️ button in the top right corner

### LLM Provider Configuration

You must configure at least one LLM Provider to use CoolCline:

1. Select an LLM Provider in the welcome page or settings page
2. Fill in the required information:
    - API Key (quick application links are provided below some input fields)
    - Select a model
    - Configure other related parameters
3. Changes are saved automatically

## Interface Layout Optimization

The following settings are recommended for better experience:

1. Move the extension to the right side:
    - Right-click on the CoolCline extension icon
    - Select "Move to Secondary Sidebar"
2. If you accidentally close the right extension panel:
    - Click the "Toggle Secondary Sidebar" button in the top right corner of VSCode
    - Or use the shortcut `Ctrl+Shift+L`

## Next Steps

After completing the basic setup, you can:

- Explore [Basic Features](../basic-features/index.md) to learn basic usage

## FAQ

**Q: What if I can't see the welcome page?**
A: The welcome page has two configuration items: language configuration and LLM Provider configuration. Once you've configured an LLM Provider, the welcome page will not be shown again. Subsequent configurations can be made through the settings icon in the top right corner, or you can click the "Reset" button at the bottom of the settings page to show the welcome page again (Note: resetting will clear all configurations for this extension, use with caution).

**Q: Where can I get the API Key?**
A: Quick links are provided below the API Key input field on the configuration page, which will direct you to the respective LLM Provider's application page.

**Q: How do I change the language?**
A: You can change the interface language at any time in the settings page, and the changes will take effect immediately.
