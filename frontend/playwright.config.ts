import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'e2e',timeout:60000,use:{baseURL:'http://127.0.0.1:8080',headless:true,launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']},screenshot:'only-on-failure'},reporter:[['list'],['json',{outputFile:'../tests/browser-results.json'}]],workers:1});
