#!/bin/bash
cd ZimFeast
export DJANGO_SETTINGS_MODULE=ZimFeast.settings
daphne -b 0.0.0.0 -p 8000 ZimFeast.asgi:application
