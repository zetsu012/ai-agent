# LLM Provider 配置

## GitHub Copilot LLM Provider 配置（推荐）

CoolCline 可以通过 GitHub Copilot LLM API 使用 GitHub Copilot 提供的模型，如 Claude 3.5 Sonnet、gpt-4o 等。

价格：每月的免费额度为 2000 次 code completions 和 50 次聊天，Pro 计划价格为 $10/月，详情请查看 [https://github.com/settings/copilot](https://github.com/settings/copilot)。

具体使用方法如下：

- 注册 [GitHub](https://github.com) 账号
- 在这个页面 [https://github.com/settings/copilot](https://github.com/settings/copilot) 进行管理，比如启用 Claude 3.5 Sonnet 模型
- 安装 [GitHub Copilot](https://code.visualstudio.com/) 插件
- 用 GitHub 账号登录 GitHub Copilot 插件
- 重启 VS Code
- 打开 CoolCline 插件，进入设置页面，将 LLM Provider 选项设置为 VS Code，您将看到模型选择框，选择您想使用的模型。
- 如果没有显示模型选择框，那就有这几种问题请检查
    - 您没有安装 GitHub Copilot 插件(在 VS Code 扩展市场搜索 GitHub Copilot 安装)
    - 您没有用 GitHub 账号登录 GitHub Copilot 插件（点击 VS Code 左下角账户，将看到`使用 GitHub 登录以使用 GitHub Copilot`，请用 GitHub 账号登录 GitHub Copilot 插件）
    - 您禁用了 GitHub Copilot 插件（在扩展市场，找到 GitHub Copilot 检查状态）
    - 可能第一次登录，还没有重启 VS Code（请彻底关闭后台，然后重新打开）
    - 重启了还没有，且前面的条件都检查了，可能是网络还没响应，等一下再试
    - 您的 Copilot 额度用完了（如果每月 50 条免费额度已经用完，您可以选择换账号或在这个页面 [https://github.com/settings/copilot](https://github.com/settings/copilot) 以 $10/月购买 Pro 计划）
- 选择模型后即可到聊天页面使用，不需要配置 API Key，鉴权已经通过 GitHub 账号自动实现

## DeepSeek LLM Provider 配置

[DeepSeek](https://platform.deepseek.com/) 虽好，但是目前各个 Provider 提供的 API 都不稳定，这里提供一些 [DeepSeek API 列表](./deepseek_list.md)
