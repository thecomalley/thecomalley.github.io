---
title: "Monitoring cron jobs with healthchecks.io"
date: 2021-06-30
description: This is a quick and simple post about using monitoring a cron job with [healthchecks.io](https://healthchecks.io/)
menu:
  sidebar:
    name: Monitoring cron jobs
    identifier: healthchecks
    weight: 10
hero: healthchecks.jpg
---

This is a quick and simple post about using monitoring a cron job with [healthchecks.io](https://healthchecks.io/)
in this case the script is a rsync job from an local server (unRAID) to azure blob but principles are pretty universal.
you can checkout the code for this on github [homelab-remote-backup](https://github.com/thecomalley/homelab-remote-backup)

healthchecks.io provides "Simple and Effective Cron Job Monitoring" via hitting a http url, it can be used as a SaaS tool and is also open-source so you can [self host it](https://healthchecks.io/docs/self_hosted/)

## Terraform & healthchecks.io
healthchecks.io is available as a [terraform provider](https://github.com/kristofferahl/terraform-provider-healthchecksio) although to use the provider you must create a project and to get an API key specific to that healthchecks project. 

Terraform will provision a check and resulting API endpoint we need to hit for monitoring, but we want to take it a step further and add this endpoint to a bash script automatically. We can do this by using the terraform `template_dir` resource

{% highlight terraform %}
resource "template_dir" "config" {
  source_dir      = "../rclone/templates"
  destination_dir = "../rclone/user_scripts"

  vars = {
    ping_url           = healthchecksio_check.appdata.ping_url
    storage_account    = azurerm_storage_account.example.name
    primary_access_key = azurerm_storage_account.example.primary_access_key
  }
}
{% endhighlight %}

this resource allows us to populate vars in `.tpl` files from terraform variables, outputs or other attributes. this keeps our potentially sensitive ping URL out of source control & ensures anytime changes are made to terraform the bash script is up to date.

## Monitoring cronjob
Using healthchecks.io we are able to monitor three key aspects of our cronjob
- runtime of the script
- exit code from rclone job
- the logs from the rclone command

### [start time of the script](https://healthchecks.io/docs/measuring_script_run_time/)
By adding `/start` to the end of the url we can tell healthchecks.io when the cronjob has started, obviously add this line near the top of the script. hitting the endpoint a second time without the `/start` will tell healthchecks.io the job has completed allowing us to record runtime.

{% highlight bash %}
curl -m 10 --retry 5 $PING_URL/start
{% endhighlight %}

### [exit code from rclone job](https://rclone.org/docs/#list-of-exit-codes)
We can also send the exit code provided by our rclone command, to do this we store the exit code in the variable `exit_code` 
we do this by using the bash [Special Parameter](https://www.gnu.org/software/bash/manual/bash.html#index-_0024_003f) `$?`
Finally by adding the exit code at the end of the url this allows us to pass the code to `healthchecks.io`

{% highlight bash %}
rclone command
exit_code=$?
curl -m 10 --retry 5 $PING_URL/$exit_code
{% endhighlight %}

### [the logs from the rclone command](https://healthchecks.io/docs/attaching_logs/)
Finally we can attach the logs from the rclone command by passing them in the body `--data-raw "$cmd"`
But first we need to capture the output (both the stdout and stderr streams) to do this we add `-v 2>&1` to the end of the command
- `-v` is a flag for rsync that "Prints lots more stuff" 
- `2>&1` will redirect stderr to whatever value is set to stdout, and we already piped stdout to the var `cmd`

 {% highlight bash %}
cmd=$(rclone copy /mnt/user/Backup/appdata azure-remote-backup:appdata -v 2>&1)
curl -m 10 --retry 5 --data-raw "$cmd" $PING_URL
{% endhighlight %}

Check the repo for what this looks like all combined!