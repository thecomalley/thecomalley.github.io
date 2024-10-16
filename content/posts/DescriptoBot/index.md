---
title: "Automating Pull Request Descriptions in Azure DevOps using DescriptoBot"
date: 2024-10-16
description: "Automating Pull Request Descriptions in Azure DevOps using DescriptoBot"
menu:
  sidebar:
    name: DescriptoBot
    identifier: descriptobot
    weight: 10
hero: descriptobot.jpg
---

In this post, we’ll explore how to replicate [GitHub Copilot’s pull request (PR) description functionality](https://docs.github.com/en/enterprise-cloud@latest/copilot/using-github-copilot/creating-a-pull-request-summary-with-github-copilot) within Azure DevOps, using a custom solution I’ve called DescriptoBot. The goal is to automate the creation of PR descriptions by leveraging Azure OpenAI models, providing a streamlined, AI-driven method to summarize changes and improve efficiency across teams.

### The Problem: Manual PR Descriptions

Writing clear and concise PR descriptions can be a time-consuming task. Developers often need to summarize changes made in a feature branch, highlight key modifications, and provide context, which can easily be overlooked in fast-paced environments. While GitHub Copilot provides a useful feature for generating PR descriptions automatically, Azure DevOps lacks this native functionality.

To solve this, I built DescriptoBot, which automates the process of generating PR descriptions using the GPT-4 model from Azure OpenAI. The bot pulls information from the git diff between branches, summarizes key changes, and suggests a title using the gitmoji format. The bot works by:

- Fetching the diff between the source and target branches.
- Passing the diff summary and full diff to OpenAI to generate a meaningful PR description.
- Suggesting a PR title based on the changes.
- Calculating the cost of the OpenAI prompt and output tokens.
- Automatically updating the PR description in Azure DevOps.

## Core Python Code

Let's break down the Python code that powers DescriptoBot.

Setting Up Environment Variables and Configuration

I like using the dotenv library to make local development easier, the pipeline will pass these variables to the script.

```python
import os
import dotenv
from openai import AzureOpenAI

dotenv.load_dotenv()

pr_number = os.getenv("SYSTEM_PULLREQUEST_PULLREQUESTID")
pr_repository_name = os.getenv("PR_REPOSITORY_NAME")
```

## Defining the Model
For this implementation, we’re using OpenAI’s gpt-4o model, which is hardcoded for now. The model's cost per input and output token are defined so we can calculate the total cost later, this is useful for proof of value.

```python
model_info = {
    "gpt-4o": {
        "name": "gpt-4o",
        "input_tokens": 128000,
        "output_tokens": 4096,
        "input_cost": 0.0000082,
        "output_cost": 0.0000245,
    },
}
model = model_info["gpt-4o"]
```

### Fetching the Git Diff
Here we define a function to get the diff between the source and target branches using the git diff command. This forms the main part of the input to the OpenAI model.

```python
def get_diff(source_branch, target_branch):
  """
  Get the diff between the source and target branches.

  Parameters:
  source_branch (str): The name of the source branch.
  target_branch (str): The name of the target branch.

  Returns:
  tuple: The diff summary and the full diff.

  Raises:
  Exception: If there was an error getting the diff.
  """
  logging.info(f"Getting diff between {source_branch} and {target_branch}")
  try:
    diff_summary = subprocess.check_output(["git", "diff", "--compact-summary", target_branch, source_branch]).decode("utf-8")
    diff = subprocess.check_output(["git", "diff", target_branch, source_branch]).decode("utf-8")
  except Exception as e:
    logging.error(f"Failed to get diff: {e}")
    raise
  else:
    return diff_summary, diff
```

## Tokenizing the Diff
Using the tiktoken library, we encode the diff into tokens, which helps us calculate the cost of using the OpenAI model based on the number of tokens.

```python
import tiktoken

enc = tiktoken.encoding_for_model(model['name'])
tokens = enc.encode(diff)
diff_cost = len(tokens) * model["input_cost"]
print(f"Git diff tokens: {len(tokens)}, Cost: ${diff_cost:.2f}")
```

## Crafting the System Message
The system message sets up the context for OpenAI, instructing it on how to format the PR description. We provide a clear structure for the PR description, including sections like Summary and Key Changes.

```python
system_message = f"""
You are a bot that will help create an Azure DevOps Pull Request description based on a git diff summary and full diff.
Include a Summary and Key Changes section only.
Suggest a PR title based on the changes using a gitmoji prefix.
"""
```

## Generating the PR Description

Finally, we pass the system message and diff to the OpenAI model to generate the PR description. The model outputs a summary of the changes, which we can use to update the PR description in Azure DevOps.

```python
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": system_message},
        {"role": "user", "content": "Create a Pull Request description based on the git diff."},
        {"role": "user", "content": diff_summary},
        {"role": "user", "content": diff}
    ]
)
```