---
slug: 
title: Azure Alert Parser
authors: [chris]
tags: []
---

Recently i've been doing some development with [Azure Monitor Baseline Alerts](https://azure.github.io/azure-monitor-baseline-alerts/welcome/) & wanted to deploy the Landing Zone pattern into by Sandbox / Homelab environment so I could get a feel for how it runs in operations. In my lab we use Pushover for alerting, Its my stand-in for an ITSM tool, so in this post I will show you how to parse the Azure Monitor Baseline Alerts.

The pushover specific code is designed to be easily replaced with any other alerting system or ITSM toolset, so hopefully this 