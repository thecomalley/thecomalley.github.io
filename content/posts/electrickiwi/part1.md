---
title: "Monitoring Electricity usage to save $$ - Part 1"
date: 2021-10-13
description: Monitoring Electricity usage to save money, with Home Assistant & Azure Functions 
menu:
  sidebar:
    name: Part 1 - Getting the data
    identifier: part1
    parent: electricity
    weight: 10
hero: volts.jpg
---

The electricity provider i'm with offers a changeable free "Hour Of Power" every day (off peak hours) So we set about making the most of this in our household, running the dishwasher washing machine and hot water all during this hour. But after a while we fell out of the habit, adjusting our lifestyle to fit this hour wasn't really working... Luckily the Electricity provider does provide the ability to change the Hour of Power for the current day (up to 11:59pm each day)

### We can break the problem of automating this down into three parts
Part 1 - Collecting realtime power consumption data
Part 2 - Analysing data to find peak usage & updating the hour of power

## Part 1. Collecting realtime power consumption data 
The first real problem is access to data. despite the so called *smart meters* its really hard to get access to your own data! now the electricity company's obviously have this and most are pretty good about displaying it back to the user via their respective apps, but nearly all suffer a delay of at lest a day... that's not gonna cut it for us since we need to run a calculation before midnight each day.

After a some advice from a colleague i picked up an [efergy Engage Hub Kit](https://efergy.com/engage/) second hand from TradeMe, as it has an [integration](https://www.home-assistant.io/integrations/efergy/) for my favourite Home Automation Platform [Home Assistant](https://www.home-assistant.io/) however when setting it up i was unable to register the hub. It looks to still be tied to the previous owners account. Efergy support has been unresponsive as well so not of to a great start!

After a bit of googling i stumbled across the awesome opensource project [rtl_433](https://github.com/merbanan/rtl_433) it just so happens that the Effergy transmitters have been decoded by the project! so after a quick visit back to Trademe (not patient enough for an Ali order by this point) i picked up a cheap [Software Defined Radio](https://www.trademe.co.nz/a/marketplace/electronics-photography/home-audio/amplifiers-tuners/listing/329576599)

Pulling out the Raspberry Pi i installed [rtl_433](https://github.com/merbanan/rtl_433) using [this guide](https://www.sensorsiot.org/install-rtl_433-for-a-sdr-rtl-dongle-on-a-raspberry-pi/) and started scanning for messages...

Bingo! there it was the data right from the transmitter no need for a engage hub

## Ingesting the Data
Now we needed to get the data into Home Assistant so i could use the awesome new [Energy Management Feature](https://www.home-assistant.io/blog/2021/08/04/home-energy-management/). 

I found a Home assistant addon (Docker Container) for running [rtl_433](https://github.com/pbkhrv/rtl_433-hass-addons/tree/main/rtl_433) that sends the output from rtl_433 to a MQTT

I already have MQTT server running so i spun up the container added a config file `rtl_433.conf` and ran rtl_433 again `frequency` & `protocol`

```conf
output      mqtt://HOST:PORT,user=XXXX,pass=YYYYYYY

frequency   433.485M
protocol    36

convert     si
report_meta newmodel
```

### Image of MQTT explorer

Now the data was being sent to MQTT we needed to get it into Home Assistant

Here we are defining a sensor looking at the current / Amps that the Transmitter is reporting, but really we need kWh so we need to do a bit more work
```yml
sensor:
  - platform: mqtt
    name: "House Current"
    device_class: "current"
    unit_of_measurement: "A"
    state_topic: "rtl_433/9b13b3f4-rtl433/devices/Efergy-e2CT/34737/current"
```

---


Now faced with a Year 10 Physics lesson we needed to convert the Amps into Watts. we do this by multiplying by 240. 
Its not completely accurate because the voltage isn't always a constant 240v but its good enough for now

```yml
template:
  - sensor:
      - name: "House Power"
        unit_of_measurement: "W"
        device_class: "power"
        state: "{{ states('sensor.house_current') | float * 240 }}"
```

Finally using the confusingly named [integration](https://www.home-assistant.io/integrations/integration/) integration

```yml
sensor:
  - platform: integration
    source: sensor.house_power
    name: "House Energy"
    unit_prefix: k
    round: 2
```

### Home Assistant Energy Dashboard
{{< img src="/posts/electrickiwi/dashboard.png" title="Home Assistant Energy Dashboard" >}}