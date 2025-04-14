"use strict";(self.webpackChunkmy_blog=self.webpackChunkmy_blog||[]).push([[518],{4369:e=>{e.exports=JSON.parse('{"archive":{"blogPosts":[{"id":"azure-sandbox-nuke","metadata":{"permalink":"/azure-sandbox-nuke","editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/blog/2025-04-12/index.md","source":"@site/blog/2025-04-12/index.md","title":"Azure Sandbox Nuke","description":"As cloud engineers and developers working with Azure, we\'ve all been there - forgotten resources silently accumulating costs in our sandbox environments. After one too many surprise bills, I decided to build a solution that would automatically clean up unused resources in Azure subscriptions.","date":"2025-04-12T00:00:00.000Z","tags":[{"inline":true,"label":"terraform","permalink":"/tags/terraform"},{"inline":true,"label":"azure","permalink":"/tags/azure"},{"inline":true,"label":"python","permalink":"/tags/python"},{"inline":true,"label":"function-app","permalink":"/tags/function-app"},{"inline":true,"label":"devops","permalink":"/tags/devops"}],"readingTime":4.3,"hasTruncateMarker":true,"authors":[{"name":"Chris O\'Malley","title":"Senior DevOps Engineer","page":{"permalink":"/authors/chris-omalley/"},"socials":{"linkedin":"https://www.linkedin.com/in/thecomalley/","github":"https://github.com/thecomalley"},"imageURL":"https://avatars.githubusercontent.com/u/31399219?v=4","key":"chris"}],"frontMatter":{"slug":"azure-sandbox-nuke","title":"Azure Sandbox Nuke","authors":["chris"],"tags":["terraform","azure","python","function-app","devops"]},"unlisted":false,"nextItem":{"title":"Deploying Python Function Apps to Azure with Terraform","permalink":"/terraform-azurerm-python-function"}},"content":"As cloud engineers and developers working with Azure, we\'ve all been there - forgotten resources silently accumulating costs in our sandbox environments. After one too many surprise bills, I decided to build a solution that would automatically clean up unused resources in Azure subscriptions.\\n\\nThere are many tools and scripts available for to accomplish this, But in this blog post i\'ll share the solution im using to keep my Azure costs under control.\\n\\n![](./hero.png)\\n\\n\x3c!-- truncate --\x3e\\n\\n## Why Even have Sandbox Subscriptions?\\n\\nFirst of all Sandbox subscriptions are great, For a team to be really productive ideally every engineer should have their own Sandbox subscription, (this is one of the benefits of a Visual Studio Enterprise subscription) When pared with a M365 Development Tenancy this is an ideal personal lab environment, where you can test out new features, try out new services, and experiment with different configurations without worrying about breaking anything in production.\\n\\n## The Problem: Forgotten Resources\\n\\nThe Monthly Azure credit for Visual Studio Enterprise (MPN) subscribers is $150 USD which can very quickly be consumed if you are not careful.\\n\\nIf i need to quickly deploy some resources to test out a use case for a customer and forget to delete them, this can quickly consume my entire credit and then the subscription is disabled until the next month.\\n\\n## The Solution: Azure Sandbox Nuke\\n\\nAzure Sandbox Nuke is a simple Python function app that runs on a schedule to clean up untagged resource groups in Azure subscriptions. It uses the Azure SDK for Python to interact with Azure resources and is deployed using Terraform.\\n\\nThe solution works by scanning one or more Azure subscriptions on a daily schedule, identifying resource groups without a specified tag (e.g., \\"WorkloadName\\"), and deleting them. It then sends a notification with details of what was removed or any errors encountered.\\n\\n## How It Works\\n\\nThe solution consists of three main components:\\n\\n### 1. The Core Cleanup Logic\\n\\nThe main logic is implemented in `cleaner.py` It:\\n- Authenticates with Azure using `DefaultAzureCredential`\\n- Lists all resource groups in specified subscriptions\\n- Identifies which ones are missing the required tag (defined by TAG_KEY)\\n- Deletes those resource groups\\n- Builds a summary of deleted and errored resource groups\\n\\n:::tip\\n`DefaultAzureCredential` makes authentication super easy by running though each available authentication method (service principal, managed identity, Azure CLI, etc.) until it finds one that works. This means no code changes are needed when switching between local development and production environments.\\n\\n[More info](https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.defaultazurecredential?view=azure-python)\\n:::\\n\\n```python\\ndef clean_sub_rgs(subscription_id: str) -> tuple:\\n    \\"\\"\\"\\n    Cleans up all resource groups in the given subscription, that are missing a specific tag key.\\n    \\"\\"\\"\\n    credentials = DefaultAzureCredential()\\n    azurerm = ResourceManagementClient(credentials, subscription_id)\\n\\n    # list all resource groups\\n    resource_groups = azurerm.resource_groups.list()\\n\\n    deleted_resource_groups = []\\n    errored_resource_groups = []\\n\\n    for resource_group in resource_groups:\\n        # Check if the resource group has any tags\\n        if resource_group.tags is None:\\n            resource_group.tags = {}\\n\\n        # Check if the resource group has the tag key\\n        if TAG_KEY not in resource_group.tags:\\n            try:\\n                azurerm.resource_groups.begin_delete(resource_group.name)\\n                deleted_resource_groups.append(resource_group.name)\\n            except Exception as e:\\n                errored_resource_groups.append(resource_group.name)\\n                \\n    return (deleted_resource_groups, errored_resource_groups)\\n```\\n\\n### 2. Azure Function Timer Trigger\\n\\nThe Azure Function is configured to run on a schedule using a timer trigger:\\n\\n:::warning\\nSetting the Timezone is not currently supported on Linux in a Consumption or Flex Consumption plan so we need to set the trigger to UTC. [Source](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-python#ncrontab-time-zones)\\n:::\\n\\n```python\\n@app.timer_trigger(schedule=\\"0 0 8 * * *\\", arg_name=\\"myTimer\\", run_on_startup=True,\\n                   use_monitor=False)\\ndef clean_rgs(myTimer: func.TimerRequest) -> None:\\n    if myTimer.past_due:\\n        logging.info(\'The timer is past due!\')\\n    clean_resource_groups()\\n    logging.info(\'Python timer trigger function executed.\')\\n```\\n\\n### 3. Notifications via Pushover\\n\\nI like to use [Pushover](https://pushover.net/) for notifications within my lab environments because its free, sends push notifications to my phone and has a dead simple interface with notification history.\\n\\nAfter cleaning up resources, a notification is sent using the Pushover service to provide a summary of what happened:\\n\\n```python\\ndef send_pushover_notification(message: str) -> None:\\n    \\"\\"\\"\\n    Sends a notification to a Pushover user.\\n    \\"\\"\\"\\n    url = \\"https://api.pushover.net/1/messages.json\\"\\n    payload = {\\n        \\"token\\": PUSHOVER_API_TOKEN,\\n        \\"user\\": PUSHOVER_USER_KEY,\\n        \\"message\\": message\\n    }\\n    try:\\n        response = requests.post(url, data=payload)\\n        response.raise_for_status()\\n    except requests.exceptions.RequestException as e:\\n        logging.error(f\\"Failed to send notification: {e}\\")\\n    else:\\n        logging.info(\\"Notification sent successfully.\\")\\n```\\n\\n## Infrastructure as Code with Terraform\\n\\nThe entire solution is deployed using Terraform with my custom [terraform-azurerm-python-function](https://github.com/thecomalley/terraform-azurerm-python-function) module, which you can read more about in my [previous blog post](https://thecomalley.github.io/terraform-azurerm-python-function).\\n\\n## Deployment\\n\\nDeploying the solution is simple with just three commands:\\n\\n```bash\\nexport ARM_SUBSCRIPTION_ID=<your-subscription-id>\\nterraform init\\nterraform apply\\n```\\n\\nAfter deployment, you\'ll need to manually set the Pushover credentials in the Key Vault since these are marked as sensitive.\\n\\n## Conclusion\\n\\nAzure Sandbox Nuke is a straightforward yet effective solution for keeping Azure costs under control. By automatically removing untagged resource groups, it provides a safety net against forgotten resources and encourages good tagging practices.\\n\\nThe complete source code is available on [GitHub](https://github.com/thecomalley/azure-sandbox-nuke) under an MIT license. Feel free to use it, modify it, and let me know if you have any suggestions for improvements!\\n\\n---\\n\\n:::danger\\n\\nThis solution is **destructive** and will delete any resource groups that do not have the specified tag. Use with caution and ensure you have scoped it to the correct subscription and tag key.\\n\\n:::"},{"id":"terraform-azurerm-python-function","metadata":{"permalink":"/terraform-azurerm-python-function","editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/blog/2025-04-06/index.md","source":"@site/blog/2025-04-06/index.md","title":"Deploying Python Function Apps to Azure with Terraform","description":"A number of the workloads I run in Azure are based around Python Function Apps. I thought it would be a good idea to create a Terraform module that can be reused across multiple projects while leveraging out some of the newer features in Terraform: Terraform Test framework and Write-only arguments.","date":"2025-04-06T00:00:00.000Z","tags":[{"inline":true,"label":"terraform","permalink":"/tags/terraform"},{"inline":true,"label":"azure","permalink":"/tags/azure"},{"inline":true,"label":"python","permalink":"/tags/python"},{"inline":true,"label":"function-app","permalink":"/tags/function-app"},{"inline":true,"label":"devops","permalink":"/tags/devops"}],"readingTime":5.945,"hasTruncateMarker":true,"authors":[{"name":"Chris O\'Malley","title":"Senior DevOps Engineer","page":{"permalink":"/authors/chris-omalley/"},"socials":{"linkedin":"https://www.linkedin.com/in/thecomalley/","github":"https://github.com/thecomalley"},"imageURL":"https://avatars.githubusercontent.com/u/31399219?v=4","key":"chris"}],"frontMatter":{"slug":"terraform-azurerm-python-function","title":"Deploying Python Function Apps to Azure with Terraform","authors":["chris"],"tags":["terraform","azure","python","function-app","devops"]},"unlisted":false,"prevItem":{"title":"Azure Sandbox Nuke","permalink":"/azure-sandbox-nuke"},"nextItem":{"title":"AI Pull Request Descriptions in Azure DevOps","permalink":"/ai-pr-descriptions-in-azure-devops"}},"content":"A number of the workloads I run in Azure are based around Python Function Apps. I thought it would be a good idea to create a Terraform module that can be reused across multiple projects while leveraging out some of the newer features in Terraform: [Terraform Test framework](https://developer.hashicorp.com/terraform/language/tests) and [Write-only arguments](https://developer.hashicorp.com/terraform/language/resources/ephemeral/write-only).  \\n> [View the Module on GitHub](https://github.com/thecomalley/terraform-azurerm-python-function)\\n\\n\x3c!-- truncate --\x3e\\n\\n## Module Overview\\n\\nThe module deploys a Python Function App along with its source code to Azure. It creates the necessary resources such as a resource group, storage account, service plan, application insights, log analytics workspace, and key vault. The module also handles the deployment of the Python source code and sets up environment variables.\\n\\n![](./tapf-test-rg.png)\\n\\n```hcl\\n# example module call\\nmodule \\"terraform_azurerm_python_function\\" {\\n  source  = \\"thecomalley/python-function/azurerm\\"\\n  version = \\"1.1.0\\"\\n\\n  location = \\"Australia East\\"\\n\\n  resource_group_name       = \\"example-rg\\"\\n  function_app_name         = \\"example-func\\"\\n  storage_account_name      = \\"examplestorage\\"\\n  log_analytics_name        = \\"example-law\\"\\n  app_service_plan_name     = \\"example-asp\\"\\n  application_insights_name = \\"example-ai\\"\\n  key_vault_name            = \\"example-kv\\"\\n\\n  python_version     = \\"3.11\\"\\n  python_source_code = \\"src\\"\\n\\n  environment_variables = {\\n    EXAMPLE_ENV_1 = \\"value1\\"\\n    EXAMPLE_ENV_2 = \\"value2\\"\\n  }\\n\\n  secret_environment_variables = [\\n    \\"SECRET_1\\",\\n    \\"SECRET_2\\",\\n  ]\\n}\\n```\\n\\n## Function Source Code Deployment\\n\\nThis module leverages the Zip deploy method to deploy the source code to Azure. This is ideal for small projects or when you want to keep the source code in the same repository as your Terraform code.\\n\\n:::tip\\nFor larger projects separating infrastructure and source code deployment might be more appropriate. You can read more about the different deployment methods [here](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies?tabs=windows).\\n:::\\n\\nWe are able to create a Zip file using the `archive_file` resource in terraform, this is a pretty common pattern often used for deploying Lambda functions to AWS\\n\\nWe need to set a few app settings to enable this to work on the Function App however,\\n\\n- `ENABLE_ORYX_BUILD`: Indicates whether the Oryx build system is used during deployment. This must be set to `true` when performing remote build deployments to Linux.\\n- `SCM_DO_BUILD_DURING_DEPLOYMENT`: Controls remote build behavior during deployment. When set to `true`, the project is built remotely during deployment.\\n- Finally we pass the path to the zip file `zip_deploy_file` \\n\\n## Terraform Test\\n\\nThis module also makes use of the [Terraform Test](https://developer.hashicorp.com/terraform/language/tests) functionality introduced in Terraform v1.6.0. Let\'s walk through how it all works.\\n\\nWe create a test file called `main.tftest.hcl` under the `tests` directory.\\n\\n:::note\\nEach Terraform test lives in a test file. Terraform discovers test files are based on their file extension: `.tftest.hcl` or `.tftest.json.`\\n:::\\n\\n### Provider\\nWe define our provider the same way we would in our main module. Since azurerm v4, the `subscription_id` is a required field, but we can set it via the `ARM_SUBSCRIPTION_ID` environment variable, I\'ve added a comment to remind me to do so!\\n\\n```ruby\\n# tests/main.tftest.hcl\\nprovider \\"azurerm\\" {\\n  features {}\\n  # ARM_SUBSCRIPTION_ID = \\"\\"\\n}\\n```\\n\\n### Setup Module\\n\\nOften, modules depend on pre-existing infrastructure. A common pattern is to deploy this infrastructure in a setup module before running the test. While this module doesn\'t require any prerequisites, I still include a setup module to create a random ID for the test run. This helps in generating unique resource names and avoiding name collisions.\\n\\n```ruby\\n# tests/main.tftest.hcl\\nrun \\"setup\\" {\\n  module {\\n    source = \\"./tests/setup\\"\\n  }\\n}\\n\\n# tests/setup/main.tf\\nresource \\"random_id\\" \\"test\\" {\\n  byte_length = 4\\n}\\n\\noutput \\"test_id\\" {\\n  value = random_id.test.hex\\n}\\n\\noutput \\"module_name\\" {\\n  value = basename(path.cwd)\\n}\\n```\\n\\n### Main Module\\nNow its time for the main test run. We are deploying the module passing in some required variables. I\'ve also included the starter code for a Function App, this way we can ensure the module deploys successfully. \\n\\n```ruby\\nrun \\"main\\" {\\n  variables {\\n    resource_group_name       = \\"tapf-test${run.setup.test_id}-rg\\"\\n    function_app_name         = \\"tapf-test${run.setup.test_id}-func\\"\\n    storage_account_name      = \\"tapftest${run.setup.test_id}storage\\"\\n    log_analytics_name        = \\"tapf-test${run.setup.test_id}-law\\"\\n    app_service_plan_name     = \\"tapf-test${run.setup.test_id}-asp\\"\\n    application_insights_name = \\"tapf-test${run.setup.test_id}-ai\\"\\n    key_vault_name            = \\"tapf-test${run.setup.test_id}-kv\\"\\n\\n    python_version     = \\"3.11\\"\\n    python_source_code = \\"src\\"\\n  }\\n}\\n```\\n\\n\\n### HTTP Tests\\n\\nNow that we have confirmed the module has successfully deployed we are going to create one more helper module to verify that the function app is running and responding to requests. The helper module will use the `http` data source to make a request to the function app and access its response.\\n\\n```ruby\\n# tests/http/main.tf\\nvariable \\"endpoint\\" {\\n  type = string\\n}\\n\\nvariable \\"function_app_name\\" {\\n  type = string\\n}\\n\\nvariable \\"resource_group_name\\" {\\n  type = string\\n}\\n\\ndata \\"azurerm_function_app_host_keys\\" \\"test\\" {\\n  name                = var.function_app_name\\n  resource_group_name = var.resource_group_name\\n}\\n\\ndata \\"http\\" \\"test\\" {\\n  url    = \\"https://${var.endpoint}/api/req?code=${data.azurerm_function_app_host_keys.test.primary_key}&user=terraform\\"\\n  method = \\"GET\\"\\n\\n  request_headers = {\\n    \\"Accept\\" = \\"application/json\\"\\n  }\\n\\n  request_body = jsonencode({\\n    \\"user\\" = \\"terraform\\"\\n  })\\n}\\n\\noutput \\"body\\" {\\n  value = data.http.test.body\\n}\\n\\noutput \\"status_code\\" {\\n  value = data.http.test.status_code\\n}\\n```\\n\\nThis test uses the final helper module and references the `function_app_name`, `default_hostname` & `resource_group_name` outputs from the main module for so the helper can get the `azurerm_function_app_host_keys` and make an HTTP request. It also defines two assert blocks to \\n\\n1. check that the HTTP GET request responds with a 200 status code, indicating that the website is running properly.\\n2. check that the HTTP response body is `Hello, terraform!` indicating that our test source code has successfully deployed and is running \\n\\n```hcl\\n# tests/main.tftest.hcl\\nrun \\"source_code_deployed\\" {\\n  command = plan\\n\\n  module {\\n    source = \\"./tests/http\\"\\n  }\\n\\n  variables {\\n    function_app_name   = run.main.function_app_name\\n    resource_group_name = run.main.resource_group_name\\n    endpoint            = run.main.default_hostname\\n  }\\n\\n  assert {\\n    condition     = data.http.test.status_code == 200\\n    error_message = \\"Website responded with HTTP status ${data.http.test.status_code}\\"\\n  }\\n  assert {\\n    condition     = data.http.test.body == \\"Hello, terraform!\\"\\n    error_message = \\"Website responded with body ${data.http.test.body}\\"\\n  }\\n}\\n```\\n\\n## Secrets Management\\n\\nHashiCorp recently introduced write-only arguments and ephemeral resources to enhance secret management. This module leverages these features.\\n\\nPreviously, creating a secret in the Key Vault would also store its value in the Terraform state file, exposing it in plaintext and duplicating it in two locations. This was not ideal for sensitive data.\\n\\nEven adding a lifecycle ignore_changes block wouldn\'t get around this issue, while it would allow the user to update the value in the portal independent of terraform running a `terraform plan` would still refresh the actual secret value into the state file \\n\\n```hcl\\nlifecycle {\\n  ignore_changes = [value] # Allow the value to be managed in the portal\\n}\\n```\\n\\nWith AzureRM v4.23.0, the `value_wo` argument in the `azurerm_key_vault_secret` resource allows secrets to be created in the Key Vault without saving their values in the state file. This is particularly useful for secrets managed outside of Terraform, such as passwords or API keys.\\n\\nThis module pre-creates the required secrets and links them to the function app using [Key Vault references](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references?tabs=azure-cli). However, it leaves the responsibility of setting the secret values to the user. \\n\\nThis approach leaves us with a Function app that is ready to go all the user needs to do is update the value of any secrets in the KeyVault\\n\\n## Conclusion\\n\\nSo there we have it\u2014a simple module to deploy a Python Function App to Azure. I\'ll be leveraging this module in several projects in the future.\\n\\nIf you found this module useful, please consider [giving it a star on GitHub](https://github.com/thecomalley/terraform-azurerm-python-function). If you have any questions or suggestions, feel free to open an issue or submit a pull request. Your feedback is always welcome!"},{"id":"ai-pr-descriptions-in-azure-devops","metadata":{"permalink":"/ai-pr-descriptions-in-azure-devops","editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/blog/2024-10-16/index.md","source":"@site/blog/2024-10-16/index.md","title":"AI Pull Request Descriptions in Azure DevOps","description":"In this post, we\u2019ll explore how to replicate GitHub Copilot\u2019s pull request (PR) description functionality within Azure DevOps, using a custom solution I\u2019ve called DescriptoBot. The goal is to automate the creation of PR descriptions by leveraging Azure OpenAI models, providing a streamlined, AI-driven method to summarize changes and improve efficiency across teams.","date":"2024-10-16T00:00:00.000Z","tags":[{"inline":true,"label":"ai","permalink":"/tags/ai"},{"inline":true,"label":"azure-devops","permalink":"/tags/azure-devops"},{"inline":true,"label":"openai","permalink":"/tags/openai"}],"readingTime":2.645,"hasTruncateMarker":true,"authors":[{"name":"Chris O\'Malley","title":"Senior DevOps Engineer","page":{"permalink":"/authors/chris-omalley/"},"socials":{"linkedin":"https://www.linkedin.com/in/thecomalley/","github":"https://github.com/thecomalley"},"imageURL":"https://avatars.githubusercontent.com/u/31399219?v=4","key":"chris"}],"frontMatter":{"slug":"ai-pr-descriptions-in-azure-devops","title":"AI Pull Request Descriptions in Azure DevOps","authors":["chris"],"tags":["ai","azure-devops","openai"]},"unlisted":false,"prevItem":{"title":"Deploying Python Function Apps to Azure with Terraform","permalink":"/terraform-azurerm-python-function"},"nextItem":{"title":"Working with multiple git email addresses","permalink":"/git-configuration"}},"content":"In this post, we\u2019ll explore how to replicate [GitHub Copilot\u2019s pull request (PR) description functionality](https://docs.github.com/en/enterprise-cloud@latest/copilot/using-github-copilot/creating-a-pull-request-summary-with-github-copilot) within Azure DevOps, using a custom solution I\u2019ve called DescriptoBot. The goal is to automate the creation of PR descriptions by leveraging Azure OpenAI models, providing a streamlined, AI-driven method to summarize changes and improve efficiency across teams.\\n\\n\x3c!-- truncate --\x3e\\n\\n### The Problem: Manual PR Descriptions\\n\\nWriting clear and concise PR descriptions can be a time-consuming task. Developers often need to summarize changes made in a feature branch, highlight key modifications, and provide context, which can easily be overlooked in fast-paced environments. While GitHub Copilot provides a useful feature for generating PR descriptions automatically, Azure DevOps lacks this native functionality.\\n\\nTo solve this, I built DescriptoBot, a simple python script that can be manually triggered by a developer when creating a PR in Azure DevOps. The script works by...\\n\\n- Fetching the diff between the source and target branches.\\n- Passing the diff summary and full diff to OpenAI to generate a meaningful PR description.\\n- Suggesting a PR title based on the changes.\\n- Calculating the cost of the OpenAI prompt and output tokens.\\n- Automatically updating the PR description in Azure DevOps.\\n\\n## Example Output\\n\\n![DescriptoBot Example](./descriptobot-example.png)\\n\\n## Core Python Code\\n\\nLet\'s break down some of the key components of the DescriptoBot script.\\n\\n### Fetching the Git Diff\\nHere we simply use the `git diff` command to get the difference between the source and target branches, both in summary and full form.\\nThis provides the context for the OpenAI model to generate a meaningful PR description. \\n```python\\ndef get_diff(source_branch, target_branch):\\n  \\"\\"\\"\\n  Get the diff between the source and target branches.\\n\\n  Parameters:\\n  source_branch (str): The name of the source branch.\\n  target_branch (str): The name of the target branch.\\n\\n  Returns:\\n  tuple: The diff summary and the full diff.\\n\\n  Raises:\\n  Exception: If there was an error getting the diff.\\n  \\"\\"\\"\\n  logging.info(f\\"Getting diff between {source_branch} and {target_branch}\\")\\n  try:\\n    diff_summary = subprocess.check_output([\\"git\\", \\"diff\\", \\"--compact-summary\\", target_branch, source_branch]).decode(\\"utf-8\\")\\n    diff = subprocess.check_output([\\"git\\", \\"diff\\", target_branch, source_branch]).decode(\\"utf-8\\")\\n  except Exception as e:\\n    logging.error(f\\"Failed to get diff: {e}\\")\\n    raise\\n  else:\\n    return diff_summary, diff\\n```\\n\\n## Tokenizing the Diff\\nUsing the tiktoken library, we encode the diff into tokens, which helps us calculate the cost of using the OpenAI model based on the number of tokens.\\n\\n```python\\nimport tiktoken\\n\\nenc = tiktoken.encoding_for_model(model[\'name\'])\\ntokens = enc.encode(diff)\\ndiff_cost = len(tokens) * model[\\"input_cost\\"]\\nprint(f\\"Git diff tokens: {len(tokens)}, Cost: ${diff_cost:.2f}\\")\\n```\\n\\n## OpenAI \\n\\n```python\\nclient = AzureOpenAI(\\n  azure_endpoint=os.getenv(\\"AZURE_OPENAI_ENDPOINT\\"),\\n  api_key=os.getenv(\\"AZURE_OPENAI_API_KEY\\"),\\n  api_version=\\"2024-02-01\\"\\n)\\n\\nsystem_message = f\\"\\"\\"\\nYou are a bot that will help create an Azure DevOps Pull Request description based on a git diff summary and full diff.\\nInclude a Summary and Key Changes section only\\nSuggest a PR title based on the changes using an gitmoji prefix this should be the first line of the PR description, don\'t prefix with # or ##.\\nThere is a character limit of 4000 characters for the PR description so keep it below that.\\n\\"\\"\\"\\n\\nresponse = client.chat.completions.create(\\n    model=\\"gpt-4o\\", # model = \\"deployment_name\\".\\n    messages=[\\n        {\\"role\\": \\"system\\", \\"content\\": system_message},\\n        {\\"role\\": \\"user\\", \\"content\\": \\"Create a Pull Request description based on the git diff.\\"},\\n        {\\"role\\": \\"user\\", \\"content\\": diff_summary},\\n        {\\"role\\": \\"user\\", \\"content\\": diff}\\n    ]\\n)\\n```"},{"id":"git-configuration","metadata":{"permalink":"/git-configuration","editUrl":"https://github.com/facebook/docusaurus/tree/main/packages/create-docusaurus/templates/shared/blog/2024-05-27.md","source":"@site/blog/2024-05-27.md","title":"Working with multiple git email addresses","description":"In this post, we\u2019ll explore how to configure Git to use different usernames based on the directory you\u2019re working in. This can be useful when working on multiple projects with different email addresses associated with each one. eg personal projects, work projects, client projects, etc.","date":"2024-05-27T00:00:00.000Z","tags":[{"inline":true,"label":"git","permalink":"/tags/git"}],"readingTime":1.49,"hasTruncateMarker":true,"authors":[{"name":"Chris O\'Malley","title":"Senior DevOps Engineer","page":{"permalink":"/authors/chris-omalley/"},"socials":{"linkedin":"https://www.linkedin.com/in/thecomalley/","github":"https://github.com/thecomalley"},"imageURL":"https://avatars.githubusercontent.com/u/31399219?v=4","key":"chris"}],"frontMatter":{"slug":"git-configuration","title":"Working with multiple git email addresses","authors":["chris"],"tags":["git"]},"unlisted":false,"prevItem":{"title":"AI Pull Request Descriptions in Azure DevOps","permalink":"/ai-pr-descriptions-in-azure-devops"}},"content":"In this post, we\u2019ll explore how to configure Git to use different usernames based on the directory you\u2019re working in. This can be useful when working on multiple projects with different email addresses associated with each one. eg personal projects, work projects, client projects, etc.\\n\\n\x3c!-- truncate --\x3e\\n\\nLets assume a folder structure like this:\\n\\n```bash\\n~/code/\\n\u251c\u2500\u2500 personal/\\n\u2502   \u2514\u2500\u2500 project1/\\n\u2502   \u2514\u2500\u2500 project2/\\n\u251c\u2500\u2500 company/\\n\u2502   \u2514\u2500\u2500 project1/\\n\u2502   \u2514\u2500\u2500 project2/\\n\u251c\u2500\u2500 client1/\\n\u2502   \u2514\u2500\u2500 project1/\\n\u2502   \u2514\u2500\u2500 project2/\\n\u251c\u2500\u2500 client2/\\n\u2502   \u2514\u2500\u2500 project1/\\n\u2502   \u2514\u2500\u2500 project2/\\n```\\n\\nThe `.gitconfig` is where we can configure git git `username` and `email` settings. However this file is either in each repository or in the global git configuration.\\n\\nIdeally we would like to have a different email address for each of the directories in the `~/code/` folder.\\n\\nHowever there is a way to achieve this using the `includeIf` directive in the global `.gitconfig` file.\\n\\n```bash\\n[includeIf \\"gitdir:~/code/personal/\\"]\\n    path = .gitconfig-personal\\n[includeIf \\"gitdir:~/code/work/\\"]\\n    path = .gitconfig-work\\n[includeIf \\"gitdir:~/code/client1/\\"]\\n    path = .gitconfig-client1\\n[includeIf \\"gitdir:~/code/client2/\\"]\\n    path = .gitconfig-client2\\n```\\n\\nIn this configuration, you would have four separate `.gitconfig` files: \\n- `~/code/personal/.gitconfig-personal`, \\n- `~/code/work/.gitconfig-work`, \\n- `~/code/client1/.gitconfig-client1`,  \\n- `~/code/client2/.gitconfig-client2.` \\n\\nEach of these files would contain the user email configuration for the respective directory.\\nFor example, the `.gitconfig-personal` file might look like this:\\n\\n```bash\\n[user]\\n    email = personal-email@domain.com\\n```\\n\\nTo validate that your configuration is working as expected, you can use the `git config user.email` command in the terminal while inside the repository directory. This command will display the email address that Git is currently configured to use for that repository. If the output matches the email address you specified in the .gitconfig file for that directory, then you\'ve successfully configured Git to use different author email addresses based on the repository location.\\n\\nHappy coding!"}]}}')}}]);