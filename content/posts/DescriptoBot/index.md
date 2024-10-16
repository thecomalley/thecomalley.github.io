---
title: "Automating Pull Request Descriptions in Azure DevOps"
date: 2024-10-16
description: "Automating Pull Request Descriptions in Azure DevOps"
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

To solve this, I built DescriptoBot, a simple python script that can be manually triggered by a developer when creating a PR in Azure DevOps. The script works by...

- Fetching the diff between the source and target branches.
- Passing the diff summary and full diff to OpenAI to generate a meaningful PR description.
- Suggesting a PR title based on the changes.
- Calculating the cost of the OpenAI prompt and output tokens.
- Automatically updating the PR description in Azure DevOps.

## Example Output

![DescriptoBot Example](/descriptobot-example.png)

## Core Python Code

Let's break down some of the key components of the DescriptoBot script.

### Fetching the Git Diff
Here we simply use the `git diff` command to get the difference between the source and target branches, both in summary and full form.
This provides the context for the OpenAI model to generate a meaningful PR description. 
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

## OpenAI 

```python
client = AzureOpenAI(
  azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
  api_key=os.getenv("AZURE_OPENAI_API_KEY"),
  api_version="2024-02-01"
)

system_message = f"""
You are a bot that will help create an Azure DevOps Pull Request description based on a git diff summary and full diff.
Include a Summary and Key Changes section only
Suggest a PR title based on the changes using an gitmoji prefix this should be the first line of the PR description, don't prefix with # or ##.
There is a character limit of 4000 characters for the PR description so keep it below that.
"""

response = client.chat.completions.create(
    model="gpt-4o", # model = "deployment_name".
    messages=[
        {"role": "system", "content": system_message},
        {"role": "user", "content": "Create a Pull Request description based on the git diff."},
        {"role": "user", "content": diff_summary},
        {"role": "user", "content": diff}
    ]
)
```

