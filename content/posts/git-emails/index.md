---
title: "Configuring Git to Use Different Author Email Addresses Based on Repository Location"
date: 2024-05-27
description: A guide on how to configure Git to use different author email addresses depending on where you clone the repository in your local directory.
menu:
  sidebar:
    name: Git Configuration
    identifier: git-configuration
    weight: 10
tags: ["Git", "Configuration", "Multi-Email"]
categories: ["Git"]
---

Greetings! This post will guide you on how to configure Git to use different author email addresses based on where you clone the repository in your local directory. This can be particularly useful if you have different email addresses for personal projects, work, and different clients.

Here's an example of how you might organize your directories:

- `code/personal`: For personal projects, you might want to use your personal email address.
- `code/work`: For your job, you might want to use your work email address.
- `code/client1`: For your first client, you might want to use a specific client email address.
- `code/client2`: For your second client, you might want to use a different client email address.

To achieve this, you can use the `includeIf` directive in your global `~/.gitconfig` file:

```bash
[includeIf "gitdir:~/code/personal/"]
    path = .gitconfig-personal
[includeIf "gitdir:~/code/work/"]
    path = .gitconfig-work
[includeIf "gitdir:~/code/client1/"]
    path = .gitconfig-client1
[includeIf "gitdir:~/code/client2/"]
    path = .gitconfig-client2
```

In this configuration, you would have four separate .gitconfig files: .gitconfig-personal, .gitconfig-work, .gitconfig-client1, and .gitconfig-client2. Each of these files would contain the user email configuration for the respective directory.

For example, the .gitconfig-personal file might look like this:

```bash
[user]
    email = personal-email@domain.com
```

And the .gitconfig-work file might look like this:

```bash
[user]
    email = work-email@domain.com
```

And so on for client1 and client2. Remember to replace personal-email@domain.com, work-email@domain.com, etc., with the actual email addresses you want to use.

To validate that your configuration is working as expected, you can use the `git config user.email` command in the terminal while inside the repository directory. This command will display the email address that Git is currently configured to use for that repository. If the output matches the email address you specified in the .gitconfig file for that directory, then you've successfully configured Git to use different author email addresses based on the repository location.

Happy coding!