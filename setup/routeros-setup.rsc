# AV-Router UI — RouterOS 7 setup script
# Paste into a Winbox/WebFig terminal or run: /import routeros-setup.rsc
# Adjust ROUTER_IP, API_USER, API_PASS below.

:local ROUTERIP "192.168.88.1"
:local APIUSER "avui"
:local APIPASS "CHANGE_ME"

# 1) Self-signed certificate for www-ssl
:if ([:len [/certificate find name="avui"]] = 0) do={
  /certificate add name=avui common-name=$ROUTERIP \
    subject-alt-name=("IP:" . $ROUTERIP) days-valid=3650 \
    key-usage=tls-server
  /certificate sign avui
  :delay 3s
}

# 2) Enable www-ssl with that cert; restrict to LAN
/ip service set www-ssl certificate=avui disabled=no \
    address=("10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")

# Optional: disable plain-HTTP www (WebFig over HTTPS still works)
# /ip service set www disabled=yes

# 3) Limited group for the UI — read/write config, no full admin
:if ([:len [/user group find name="avui"]] = 0) do={
  /user group add name=avui policy=read,write,api,test comment="AV-UI limited access"
}
:if ([:len [/user find name=$APIUSER]] = 0) do={
  /user add name=$APIUSER password=$APIPASS group=avui comment="AV Router UI"
} else={
  /user set $APIUSER password=$APIPASS group=avui
}

# 4) Folder for UI files (www-ssl serves Files/ contents)
:if ([:len [/file find name="avui" type="directory"]] = 0) do={
  /file add name=avui type=directory
}

:put "Setup done. Upload UI files to Files/avui/ then browse https://$ROUTERIP/avui/index.html"
