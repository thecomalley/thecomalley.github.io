---
slug: azure-sandbox-nuke
title: Azure Sandbox Nuke 
authors: [chris]
tags: [terraform, azure, python, function-app, devops]
---

# Keeping Azure Costs Under Control with Automated Sandbox Cleanup

As cloud engineers and developers working with Azure, we've all been there - forgotten resources silently accumulating costs in our sandbox environments. After one too many surprise bills, I decided to build a solution that would automatically clean up unused resources in Azure subscriptions.

There are many tools and scripts available for to accomplish this, But in this blog post i'll share the solution im using to keep my Azure costs under control.

<!-- truncate -->

## Why Even have Sandbox Subscriptions?

First of all Sandbox subscriptions are great, For a team to be really productive ideally every engineer should have their own Sandbox subscription, (this is one of the benefits of a Visual Studio Enterprise subscription) When pared with a M365 Development Tenancy this is an ideal personal lab environment, where you can test out new features, try out new services, and experiment with different configurations without worrying about breaking anything in production.

## The Problem: Forgotten Resources

The Monthly Azure credit for Visual Studio Enterprise (MPN) subscribers is $150 USD which can very quickly be consumed if you are not careful.

If i need to quickly deploy some resources to test out a use case for a customer and forget to delete them, this can quickly consume my entire credit and then the subscription is disabled until the next month.

## The Solution: Azure Sandbox Nuke

Azure Sandbox Nuke is a simple Python function app that runs on a schedule to clean up untagged resource groups in Azure subscriptions. It uses the Azure SDK for Python to interact with Azure resources and is deployed using Terraform.

The solution works by scanning one or more Azure subscriptions on a daily schedule, identifying resource groups without a specified tag (e.g., "WorkloadName"), and deleting them. It then sends a notification with details of what was removed or any errors encountered.

## How It Works

The solution consists of three main components:

### 1. The Core Cleanup Logic

The main logic is implemented in `cleaner.py` It:
- Authenticates with Azure using `DefaultAzureCredential`
- Lists all resource groups in specified subscriptions
- Identifies which ones are missing the required tag (defined by TAG_KEY)
- Deletes those resource groups
- Builds a summary of deleted and errored resource groups

:::tip
`DefaultAzureCredential` makes authentication super easy by running though each available authentication method (service principal, managed identity, Azure CLI, etc.) until it finds one that works. This means no code changes are needed when switching between local development and production environments.

[More info](https://learn.microsoft.com/en-us/python/api/azure-identity/azure.identity.defaultazurecredential?view=azure-python)
:::

```python
def clean_sub_rgs(subscription_id: str) -> tuple:
    """
    Cleans up all resource groups in the given subscription, that are missing a specific tag key.
    """
    credentials = DefaultAzureCredential()
    azurerm = ResourceManagementClient(credentials, subscription_id)

    # list all resource groups
    resource_groups = azurerm.resource_groups.list()

    deleted_resource_groups = []
    errored_resource_groups = []

    for resource_group in resource_groups:
        # Check if the resource group has any tags
        if resource_group.tags is None:
            resource_group.tags = {}

        # Check if the resource group has the tag key
        if TAG_KEY not in resource_group.tags:
            try:
                azurerm.resource_groups.begin_delete(resource_group.name)
                deleted_resource_groups.append(resource_group.name)
            except Exception as e:
                errored_resource_groups.append(resource_group.name)
                
    return (deleted_resource_groups, errored_resource_groups)
```

### 2. Azure Function Timer Trigger

The Azure Function is configured to run on a schedule using a timer trigger:

:::warning
Setting the Timezone is not currently supported on Linux in a Consumption or Flex Consumption plan so we need to set the trigger to UTC. [Source](https://learn.microsoft.com/en-us/azure/azure-functions/functions-bindings-timer?tabs=python-v2%2Cisolated-process%2Cnodejs-v4&pivots=programming-language-python#ncrontab-time-zones)
:::

```python
@app.timer_trigger(schedule="0 0 8 * * *", arg_name="myTimer", run_on_startup=True,
                   use_monitor=False)
def clean_rgs(myTimer: func.TimerRequest) -> None:
    if myTimer.past_due:
        logging.info('The timer is past due!')
    clean_resource_groups()
    logging.info('Python timer trigger function executed.')
```

### 3. Notifications via Pushover

I like to use [Pushover](https://pushover.net/) for notifications within my lab environments because its free, sends push notifications to my phone and has a dead simple interface with notification history.

After cleaning up resources, a notification is sent using the Pushover service to provide a summary of what happened:

```python
def send_pushover_notification(message: str) -> None:
    """
    Sends a notification to a Pushover user.
    """
    url = "https://api.pushover.net/1/messages.json"
    payload = {
        "token": PUSHOVER_API_TOKEN,
        "user": PUSHOVER_USER_KEY,
        "message": message
    }
    try:
        response = requests.post(url, data=payload)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        logging.error(f"Failed to send notification: {e}")
    else:
        logging.info("Notification sent successfully.")
```

## Infrastructure as Code with Terraform

The entire solution is deployed using Terraform with my custom [terraform-azurerm-python-function](https://github.com/thecomalley/terraform-azurerm-python-function) module, which you can read more about in my [previous blog post](https://thecomalley.github.io/terraform-azurerm-python-function).

## Deployment

Deploying the solution is simple with just three commands:

```bash
export ARM_SUBSCRIPTION_ID=<your-subscription-id>
terraform init
terraform apply
```

After deployment, you'll need to manually set the Pushover credentials in the Key Vault since these are marked as sensitive.

## Conclusion

Azure Sandbox Nuke is a straightforward yet effective solution for keeping Azure costs under control. By automatically removing untagged resource groups, it provides a safety net against forgotten resources and encourages good tagging practices.

The complete source code is available on [GitHub](https://github.com/thecomalley/azure-sandbox-nuke) under an MIT license. Feel free to use it, modify it, and let me know if you have any suggestions for improvements!

---

:::danger

This solution is **destructive** and will delete any resource groups that do not have the specified tag. Use with caution and ensure you have scoped it to the correct subscription and tag key.

:::
