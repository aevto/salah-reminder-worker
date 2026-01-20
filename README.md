# salah reminder worker

a server-side telegram bot that sends short quran reminders before prayer times.

## what it does
- checks daily prayer times for a given location
- runs automatically on a schedule (cron)
- sends reminders via telegram
- avoids duplicate messages using storage

## stack
- cloudflare workers
- telegram bot api
- aladhan prayer times api

## setup (high level)
1. create a telegram bot and get a bot token
2. deploy the worker to cloudflare
3. set environment variables (bot token, chat id)
4. add a cron trigger

this project is intended as a template. configure it for your own use.
