#!/bin/bash
cd ZimFeast
export DJANGO_SETTINGS_MODULE=ZimFeast.settings
daphne -b localhost -p 8000 ZimFeast.asgi:application
