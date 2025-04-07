---
slug: terraform-azurerm-python-function
title: Deploying Python Function Apps to Azure with Terraform
authors: [chris]
tags: [terraform, azure, python, function-app, devops]
---

A number of the workloads I run in Azure are based around Python Function Apps. I thought it would be a good idea to create a Terraform module that can be reused across multiple projects while leveraging out some of the newer features in Terraform: [Terraform Test framework](https://developer.hashicorp.com/terraform/language/tests) and [Write-only arguments](https://developer.hashicorp.com/terraform/language/resources/ephemeral/write-only).  
> [View the Module on GitHub](https://github.com/thecomalley/terraform-azurerm-python-function)

<!-- truncate -->

## Module Overview

The module deploys a Python Function App along with its source code to Azure. It creates the necessary resources such as a resource group, storage account, service plan, application insights, log analytics workspace, and key vault. The module also handles the deployment of the Python source code and sets up environment variables.

![](./tapf-test-rg.png)

```hcl
# example module call
module "terraform_azurerm_python_function" {
  source  = "thecomalley/python-function/azurerm"
  version = "1.1.0"

  location = "Australia East"

  resource_group_name       = "example-rg"
  function_app_name         = "example-func"
  storage_account_name      = "examplestorage"
  log_analytics_name        = "example-law"
  app_service_plan_name     = "example-asp"
  application_insights_name = "example-ai"
  key_vault_name            = "example-kv"

  python_version     = "3.11"
  python_source_code = "src"

  environment_variables = {
    EXAMPLE_ENV_1 = "value1"
    EXAMPLE_ENV_2 = "value2"
  }

  secret_environment_variables = [
    "SECRET_1",
    "SECRET_2",
  ]
}
```

## Function Source Code Deployment

This module leverages the Zip deploy method to deploy the source code to Azure. This is ideal for small projects or when you want to keep the source code in the same repository as your Terraform code.

:::tip
For larger projects separating infrastructure and source code deployment might be more appropriate. You can read more about the different deployment methods [here](https://learn.microsoft.com/en-us/azure/azure-functions/functions-deployment-technologies?tabs=windows).
:::

We are able to create a Zip file using the `archive_file` resource in terraform, this is a pretty common pattern often used for deploying Lambda functions to AWS

We need to set a few app settings to enable this to work on the Function App however,

- `ENABLE_ORYX_BUILD`: Indicates whether the Oryx build system is used during deployment. This must be set to `true` when performing remote build deployments to Linux.
- `SCM_DO_BUILD_DURING_DEPLOYMENT`: Controls remote build behavior during deployment. When set to `true`, the project is built remotely during deployment.
- Finally we pass the path to the zip file `zip_deploy_file` 

## Terraform Test

This module also makes use of the [Terraform Test](https://developer.hashicorp.com/terraform/language/tests) functionality introduced in Terraform v1.6.0. Let's walk through how it all works.

We create a test file called `main.tftest.hcl` under the `tests` directory.

:::note
Each Terraform test lives in a test file. Terraform discovers test files are based on their file extension: `.tftest.hcl` or `.tftest.json.`
:::

### Provider
We define our provider the same way we would in our main module. Since azurerm v4, the `subscription_id` is a required field, but we can set it via the `ARM_SUBSCRIPTION_ID` environment variable, i've added a comment to remind me to do so!

```ruby
# tests/main.tftest.hcl
provider "azurerm" {
  features {}
  # ARM_SUBSCRIPTION_ID = ""
}
```

### Setup Module

Often times the module will depend on pre-existing infrastructure, a common pattern is to deploy this infrastructure in a setup module
before running the test. While this module doesn't require any prerequisites, I still have a setup module to create a random ID for the test run. This is useful for creating unique resource names and avoiding name collisions.

```ruby
# tests/main.tftest.hcl
run "setup" {
  module {
    source = "./tests/setup"
  }
}

# tests/setup/main.tf
resource "random_id" "test" {
  byte_length = 4
}

output "test_id" {
  value = random_id.test.hex
}

output "module_name" {
  value = basename(path.cwd)
}
```

### Main Module
Now its time for the main test run. We are deploying the module passing in some required variables. I've also included the starter code for a Function App, this way we can ensure the module deploys successfully. 

```ruby
run "main" {
  variables {
    resource_group_name       = "tapf-test${run.setup.test_id}-rg"
    function_app_name         = "tapf-test${run.setup.test_id}-func"
    storage_account_name      = "tapftest${run.setup.test_id}storage"
    log_analytics_name        = "tapf-test${run.setup.test_id}-law"
    app_service_plan_name     = "tapf-test${run.setup.test_id}-asp"
    application_insights_name = "tapf-test${run.setup.test_id}-ai"
    key_vault_name            = "tapf-test${run.setup.test_id}-kv"

    python_version     = "3.11"
    python_source_code = "src"
  }
}
```


### HTTP Tests

Now that we have confirmed the module has successfully deployed we are going to create one more helper module to verify that the function app is running and responding to requests. The helper module will use the `http` data source to make a request to the function app and access its response.

```ruby
# tests/http/main.tf
variable "endpoint" {
  type = string
}

variable "function_app_name" {
  type = string
}

variable "resource_group_name" {
  type = string
}

data "azurerm_function_app_host_keys" "test" {
  name                = var.function_app_name
  resource_group_name = var.resource_group_name
}

data "http" "test" {
  url    = "https://${var.endpoint}/api/req?code=${data.azurerm_function_app_host_keys.test.primary_key}&user=terraform"
  method = "GET"

  request_headers = {
    "Accept" = "application/json"
  }

  request_body = jsonencode({
    "user" = "terraform"
  })
}

output "body" {
  value = data.http.test.body
}

output "status_code" {
  value = data.http.test.status_code
}
```

This test uses the final helper module and references the `function_app_name`, `default_hostname` & `resource_group_name` outputs from the main module for so the helper can get the `azurerm_function_app_host_keys` and make an HTTP request. It also defines two assert blocks to 

1. check that the HTTP GET request responds with a 200 status code, indicating that the website is running properly.
2. check that the HTTP response body is `Hello, terraform!` indicating that our test source code has successfully deployed and is running 

```hcl
# tests/main.tftest.hcl
run "source_code_deployed" {
  command = plan

  module {
    source = "./tests/http"
  }

  variables {
    function_app_name   = run.main.function_app_name
    resource_group_name = run.main.resource_group_name
    endpoint            = run.main.default_hostname
  }

  assert {
    condition     = data.http.test.status_code == 200
    error_message = "Website responded with HTTP status ${data.http.test.status_code}"
  }
  assert {
    condition     = data.http.test.body == "Hello, terraform!"
    error_message = "Website responded with body ${data.http.test.body}"
  }
}
```

## Secrets Management

Recently, HashiCorp introduced write-only arguments along with ephemeral resources to better manage secrets. This module leverages this functionality.

Previously, if we created a secret in the Key Vault, it would also be referenced in the state file. This exposed the secret value in plaintext and duplicated it in two places.

With azurerm v4.23.0, the `value_wo` argument in the `azurerm_key_vault_secret` resource allows us to create a secret in the Key Vault without saving the value in the state file. This is ideal for secrets managed outside of Terraform, such as passwords or API keys.

This module pre-creates any required secrets and connects them to the function app via [Key Vault references](https://learn.microsoft.com/en-us/azure/app-service/app-service-key-vault-references?tabs=azure-cli). However, it leaves the responsibility of setting the secret value to the user.

## Conclusion

So there we have it—a simple module to deploy a Python Function App to Azure. I'll be leveraging this module in several projects in the future.

If you found this module useful, please consider [giving it a star on GitHub](https://github.com/thecomalley/terraform-azurerm-python-function). If you have any questions or suggestions, feel free to open an issue or submit a pull request. Your feedback is always welcome!