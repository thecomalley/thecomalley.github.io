---
title: "Ansible"
date: 2021-10-13
description: Introduction to Sample Post
menu:
  sidebar:
    name: Ansible
    identifier: Ansible
    weight: 10
tags: ["Basic", "Multi-lingual"]
categories: ["Basic"]
hero: ansible.jpg
---

# Terraform, Azure, Ansible & Windows 

Config management has been something on the back of my mind to dive into but have never quite got around to it, so its about time to have a look at ansible!
The is to to provision & configure a Windows VM without having to touch a GUI

## 1. Deploy the VM
Firstly we need to deploy a VM to Azure, for this i'm just using the example code provided with the [azurerm_windows_virtual_machine](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/windows_virtual_machine) with the addition of a Public IP to manage remotely, 

Before running apply i make sure to check the awesome [Azure VM Comparison site](https://azureprice.net/) to see where the cheapest VM is, (gotta stretch that MSDN budget!!)

### 2 Create an inventory file
Now we have our VM up we need to connect to it, To do this we need to generate an [inventory](https://docs.ansible.com/ansible/latest/user_guide/intro_inventory.html) similar to below

```yml
windows:
 hosts:
     my.public.ip:
         ansible_user: vm-username
         ansible_password: vm-password
```

We Copy paste this info from the portal and the terraform code, but what if we are using random generators for the passwords or are just lazy? if only there was a way to pipe terraform outputs into an ansible inventory file...

Enter terraform [templatefile](https://www.terraform.io/docs/language/functions/templatefile.html) & [local_file](https://registry.terraform.io/providers/hashicorp/local/latest/docs/resources/file)

Basically the template function reads a file and updates it with a supplied set of variables
The local_file resource then writes the updated content back to a file on the drive that ansible can reference!

`ansible.tf`
```terraform
resource "local_file" "ansible" {
  content = templatefile("${path.module}/ansible.tpl",
    {
      hosts = azurerm_public_ip.example.ip_address
      ansible_user = azurerm_windows_virtual_machine.example.admin_username
      ansible_password = azurerm_windows_virtual_machine.example.admin_password
    }
  )
  filename = "../ansible/inventory.yml"
  depends_on = [
    azurerm_windows_virtual_machine.example
    azurerm_public_ip.example
  ]
}
```

`ansible.tpl`
```
windows:
 hosts:
     ${hosts}:
         ansible_user: ${ansible_user}
         ansible_password: ${ansible_password}
 vars:
     ansible_connection: winrm
     ansible_winrm_server_cert_validation: ignore
```
---
### 3. Enable WinRM
Great we now have a windows vm and an inventory file generated all via terraform! 

You could try accessing the vm via `ansible -i 'inventory.yml' windows -m win_ping` but i doubt you'd have much luck. We need to enable WinRM on the server first! luckily the folks over at ansible have a [great powershell script](https://docs.ansible.com/ansible/latest/user_guide/windows_setup.html#winrm-setup) for doing this.

We now just need to deploy it to the server somehow...

Thanks to `azurerm_virtual_machine_extension` we can easily run a powershell script on the vm when its deployed!

```hcl
resource "azurerm_virtual_machine_extension" "example" {
  name                 = "ConfigureRemotingForAnsible"
  virtual_machine_id   = azurerm_windows_virtual_machine.example.id
  publisher            = "Microsoft.Compute"
  type                 = "CustomScriptExtension"
  type_handler_version = "1.9"

  settings = <<SETTINGS
    {
        "fileUris":["https://raw.githubusercontent.com/ansible/ansible/devel/examples/scripts/ConfigureRemotingForAnsible.ps1"],
        "commandToExecute": "powershell.exe -Command \"./ConfigureRemotingForAnsible.ps1; exit 0;\""
    }
SETTINGS
}
```

## Run Ansible!
Now we have WinRM setup on the VM we can access it via ansible using the command from earlier 
`inventory.yml' windows -m win_ping` awesome! but pinging a VM isn't much fun lets make a playbook!

I'm still getting up to speed with how Ansible works for our / my fist playbook all we need to know is Ansible has 
- plugins (kinda like terraform resources) 
- collections (kinda like terraform providers)

So we can grab the [ansible.windows.win_feature](https://docs.ansible.com/ansible/latest/collections/ansible/windows/win_feature_module.html) plugin from the [Ansible.Windows](https://docs.ansible.com/ansible/latest/collections/ansible/windows/index.html#ansible-windows) collection and add it to a playbook like below!

`playbook.yml`
```yml
---
- name: My First Playbook
  hosts: windows
  tasks:  
  - name: Install AD-Domain-Services with sub features and management tools
    ansible.windows.win_feature:
      name: AD-Domain-Services 
      state: present
      include_sub_features: yes
      include_management_tools: yes
```

now to run the whole thing we just run `ansible-playbook -i 'inventory.yml' playbook.yml`
Awesome!

## Next Steps
So there's probably heaps of things i've missed or could do better 
- How to pass vars securely from Terraform to Ansible, (Ansible Vault? KeyVault?)
- What about Ansible AWX / Tower / Ansible Automation Platform??
- What does an end to end VM config playbook look like?
  
Sounds like a blog for another day